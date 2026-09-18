-- ============================================================================
-- Demande de devis gratuite
-- ============================================================================
--
-- Jusqu'ici l'atelier n'avait qu'un seul parcours : le client choisit une
-- prestation, paie, envoie sa console. Les 1 189 prestations du catalogue sont
-- pourtant créées « sur devis » (`price_cents = 0`, `price_is_provisional`), et
-- le moteur de prix empilait ce zéro comme un prix ferme : le dossier passait
-- PAID puis AWAITING_SHIPMENT, et le client envoyait sa console sans qu'aucun
-- prix n'ait jamais été fixé.
--
-- Cette migration ouvre le second parcours. Elle est **additive** : une colonne
-- avec valeur par défaut, une valeur d'énumération, trois colonnes de devis,
-- une colonne de décision. Aucune donnée existante n'est lue, modifiée ni
-- supprimée, et tous les dossiers historiques restent exactement dans l'état et
-- le parcours qui étaient les leurs (`is_quote_request` vaut `false` pour eux,
-- donc rien ne change de comportement).
--
-- Rejouable : chaque instruction est gardée par `if not exists`.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Le statut d'entrée du second parcours
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Une seule valeur nouvelle. Les autres états demandés par le métier existent
-- déjà et gardent leur sens :
--
--   demande en attente du réparateur  → QUOTE_REQUESTED          (nouveau)
--   devis envoyé au client            → WAITING_CUSTOMER_APPROVAL
--   devis accepté                     → APPROVED
--   devis refusé                      → REFUSED_QUOTE
--   console à envoyer                 → AWAITING_SHIPMENT
--   console reçue                     → RECEIVED
--
-- `add value if not exists` ne réécrit aucune ligne : l'énumération s'étend,
-- les valeurs déjà stockées gardent leur représentation binaire.
alter type public.order_status add value if not exists 'QUOTE_REQUESTED' after 'DRAFT';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Ce qui distingue une demande de devis d'une commande
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Le statut dit où en est le dossier ; ce drapeau dit de quel parcours il
-- relève, et le reste vrai jusqu'à la fin. C'est lui qui décide, à
-- l'acceptation du devis, si la console est déjà à l'atelier (parcours prix
-- fixe : elle y est depuis longtemps) ou s'il faut encore la faire venir
-- (parcours devis : elle n'a jamais bougé).
--
-- `default false` : les 47 dossiers existants sont, par construction, des
-- commandes à prix fixe. Aucun n'est touché.
alter table public.repair_orders
  add column if not exists is_quote_request boolean not null default false;

comment on column public.repair_orders.is_quote_request is
  'Dossier né d''une demande de devis gratuite : aucun paiement à la création, console envoyée seulement après acceptation du devis.';

-- Le back-office ouvre sa file « demandes de devis » à chaque chargement.
create index if not exists repair_orders_quote_request_idx
  on public.repair_orders (is_quote_request, status, created_at desc)
  where is_quote_request;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Décider sans compte, et dire pourquoi on refuse
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `decision_token` : 32 octets aléatoires en base64url, tirés côté serveur au
-- moment de l'envoi du devis. Il ouvre UNE page, pour UN devis, et ne donne
-- accès à rien d'autre — ni au compte, ni aux autres dossiers du client. Il
-- cesse d'ouvrir quoi que ce soit dès que le devis quitte l'état SENT, et
-- expire avec lui.
--
-- Le champ reste nul sur tous les devis existants : ils continuent de se
-- décider depuis l'espace client, comme aujourd'hui.
alter table public.supplementary_quotes
  add column if not exists decision_token text,
  add column if not exists decision_token_expires_at timestamptz,
  add column if not exists decision_comment text;

comment on column public.supplementary_quotes.decision_token is
  'Jeton d''accès à la page de décision publique (32 octets aléatoires). Nul tant que le devis n''a pas été envoyé.';
comment on column public.supplementary_quotes.decision_comment is
  'Commentaire libre laissé par le client au moment de sa décision (motif de refus, précision).';

-- Unicité et recherche par jeton. L'index partiel ignore les devis sans jeton :
-- sans le `where`, tous les anciens devis entreraient en collision sur `null`
-- — ce que Postgres tolère, mais l'index serait alors inutilement large.
create unique index if not exists supplementary_quotes_decision_token_idx
  on public.supplementary_quotes (decision_token)
  where decision_token is not null;

-- La trace immuable de la décision garde désormais aussi le motif.
alter table public.quote_decisions
  add column if not exists comment text;

comment on column public.quote_decisions.comment is
  'Motif donné par le client. Archivé avec le montant, la date et la décision : il ne se réécrit pas.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Le corps commun des deux façons de décider
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Deux portes d'entrée — l'espace client (`decide_supplementary_quote`, qui
-- existait) et le lien reçu par e-mail (`decide_quote_by_token`, nouveau) —
-- mais **une seule** logique de décision, ici. Dupliquer ce bloc, c'était se
-- garantir que l'une des deux portes finirait par diverger de l'autre sur une
-- règle d'argent.
--
-- `security definer` : la fonction écrit dans des tables que ni l'anonyme ni le
-- client ne peuvent modifier directement. Les deux appelants ont déjà vérifié
-- qui ils sont ; cette fonction vérifie ce qui est permis.
create or replace function public.apply_quote_decision(
  p_quote_id uuid,
  p_decision public.quote_decision,
  p_decided_by uuid,
  p_comment text default null,
  p_user_agent text default null,
  p_ip_address text default null
)
returns public.supplementary_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.supplementary_quotes;
  v_order public.repair_orders;
  v_new_status public.order_status;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  -- `for update` sur les deux lignes : deux clics simultanés sur « Accepter »
  -- ne doivent pas ajouter deux fois les lignes du devis au total du dossier.
  select * into v_quote from public.supplementary_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  select * into v_order from public.repair_orders where id = v_quote.order_id for update;

  if v_quote.status <> 'SENT' then
    raise exception 'Quote is not awaiting a decision (status %)', v_quote.status using errcode = 'P0001';
  end if;
  if v_quote.expires_at is not null and v_quote.expires_at < now() then
    update public.supplementary_quotes set status = 'EXPIRED' where id = p_quote_id;
    raise exception 'Quote has expired' using errcode = 'P0001';
  end if;

  update public.supplementary_quotes
     set status = case when p_decision = 'ACCEPTED' then 'ACCEPTED'::public.quote_status else 'REFUSED'::public.quote_status end,
         decision = p_decision,
         decided_at = now(),
         decided_by = p_decided_by,
         decision_comment = v_comment,
         -- Le jeton a servi. Il n'ouvre plus rien.
         decision_token = null,
         decision_token_expires_at = null
   where id = p_quote_id
   returning * into v_quote;

  insert into public.quote_decisions (quote_id, order_id, decision, decided_by, amount_cents, comment, user_agent, ip_address)
  values (p_quote_id, v_quote.order_id, p_decision, p_decided_by, v_quote.total_cents, v_comment, p_user_agent, p_ip_address);

  if p_decision = 'ACCEPTED' then
    insert into public.repair_order_items
      (order_id, item_type, source, reference_id, quote_id, label, description, quantity, unit_price_cents, total_cents, estimated_cost_cents)
    select v_quote.order_id, 'QUOTE_ITEM', 'QUOTE', qi.option_id, qi.quote_id, qi.label, qi.description,
           qi.quantity, qi.unit_price_cents, qi.total_cents, qi.estimated_cost_cents
      from public.supplementary_quote_items qi
     where qi.quote_id = p_quote_id;

    update public.repair_orders
       set subtotal_cents = subtotal_cents + v_quote.total_cents,
           total_cents = total_cents + v_quote.total_cents
     where id = v_quote.order_id;

    -- Trois suites possibles, dans cet ordre de priorité :
    --
    --   1. le réparateur a demandé un règlement d'avance → on attend le
    --      paiement, la commande ne bouge pas (comportement d'origine) ;
    --   2. le dossier vient d'une demande de devis et la console n'est jamais
    --      arrivée → il faut maintenant la faire venir. C'est le SEUL moment
    --      où une demande de devis bascule en « colis attendu » ;
    --   3. tout le reste — la console est déjà à l'atelier, le devis était un
    --      complément → l'accord suffit.
    if v_quote.requires_payment and v_quote.total_cents > 0 then
      v_new_status := 'WAITING_CUSTOMER_APPROVAL';
    elsif v_order.is_quote_request and v_order.received_at is null then
      v_new_status := 'AWAITING_SHIPMENT';
    else
      v_new_status := 'APPROVED';
    end if;

    insert into public.order_events (order_id, event_type, title, description, actor_id, metadata)
    values (v_quote.order_id, 'QUOTE_ACCEPTED',
            'Devis ' || v_quote.quote_number || ' accepté',
            'Vous avez accepté le devis de ' || to_char(v_quote.total_cents / 100.0, 'FM999990.00') || ' €.',
            p_decided_by, jsonb_build_object('quote_id', p_quote_id, 'amount_cents', v_quote.total_cents));
  else
    -- Un devis refusé n'expédie jamais rien. Sur une demande de devis, la
    -- console n'a même pas quitté le domicile du client : le dossier se clôt
    -- sur REFUSED_QUOTE et l'atelier n'a rien à retourner.
    if v_quote.is_required_for_repair or (v_order.is_quote_request and v_order.received_at is null) then
      v_new_status := 'REFUSED_QUOTE';
    else
      v_new_status := 'APPROVED';
    end if;

    insert into public.order_events (order_id, event_type, title, description, actor_id, metadata)
    values (v_quote.order_id, 'QUOTE_REFUSED',
            'Devis ' || v_quote.quote_number || ' refusé',
            case when v_comment is null then 'Vous avez refusé le devis.'
                 else 'Vous avez refusé le devis. Motif : ' || v_comment end,
            p_decided_by, jsonb_build_object('quote_id', p_quote_id, 'has_comment', v_comment is not null));
  end if;

  -- On ne déplace le dossier que si plus aucun devis n'attend de réponse.
  if not exists (
    select 1 from public.supplementary_quotes q
     where q.order_id = v_quote.order_id and q.status = 'SENT' and q.id <> p_quote_id
  ) then
    update public.repair_orders set status = v_new_status where id = v_quote.order_id;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, order_id, new_value, user_agent, ip_address)
  values (p_decided_by, 'CUSTOMER', 'quote.decided', 'supplementary_quotes', p_quote_id::text, v_quote.order_id,
          jsonb_build_object('decision', p_decision, 'amount_cents', v_quote.total_cents, 'has_comment', v_comment is not null),
          p_user_agent, p_ip_address);

  return v_quote;
end;
$$;

revoke all on function public.apply_quote_decision(uuid, public.quote_decision, uuid, text, text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Décider depuis l'espace client — inchangé de l'extérieur
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Le commentaire du client s'ajoute en dernier, facultatif : les appels
-- existants continuent de fonctionner tels quels.
--
-- Ajouter un paramètre change la signature, et `create or replace` créerait
-- alors une **surcharge** au lieu de remplacer — deux fonctions du même nom
-- coexisteraient, et un appel à quatre arguments continuerait d'exécuter
-- l'ancienne logique, celle qui ignore le second parcours. On retire donc
-- explicitement l'ancienne.
drop function if exists public.decide_supplementary_quote(uuid, public.quote_decision, text, text);

create or replace function public.decide_supplementary_quote(
  p_quote_id uuid,
  p_decision public.quote_decision,
  p_user_agent text default null,
  p_ip_address text default null,
  p_comment text default null
)
returns public.supplementary_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Le contrôle qui compte : ce devis est-il bien celui de cette personne ?
  select o.customer_id into v_owner
    from public.supplementary_quotes q
    join public.repair_orders o on o.id = q.order_id
   where q.id = p_quote_id;
  if v_owner is null then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;
  if v_owner <> v_uid then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return public.apply_quote_decision(p_quote_id, p_decision, v_uid, p_comment, p_user_agent, p_ip_address);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Décider depuis le lien reçu par e-mail
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Le client d'une demande de devis gratuite n'a, le plus souvent, jamais choisi
-- de mot de passe : lui imposer d'en créer un pour répondre « oui » ou « non »
-- est le meilleur moyen de n'obtenir aucune réponse. Le jeton porte donc
-- l'autorisation, et rien d'autre :
--
--   * 32 octets d'aléa cryptographique — ni le numéro de dossier, ni l'e-mail,
--     ni rien qui se devine ou s'énumère ;
--   * lié à un devis précis, et à lui seul ;
--   * refusé si le devis n'attend plus de décision, ou s'il a expiré ;
--   * effacé par la décision — le lien ne sert qu'une fois ;
--   * vérifié ici, côté serveur, jamais dans le navigateur.
--
-- La décision est attribuée au client propriétaire du dossier, pas à un
-- anonyme : l'archive reste nominative.
create or replace function public.decide_quote_by_token(
  p_token text,
  p_decision public.quote_decision,
  p_comment text default null,
  p_user_agent text default null,
  p_ip_address text default null
)
returns public.supplementary_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_owner uuid;
begin
  -- Un jeton court ou vide n'est pas un jeton : on refuse avant toute lecture.
  if p_token is null or length(p_token) < 32 then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select q.id, o.customer_id into v_quote_id, v_owner
    from public.supplementary_quotes q
    join public.repair_orders o on o.id = q.order_id
   where q.decision_token = p_token
     and q.status = 'SENT'
     and (q.decision_token_expires_at is null or q.decision_token_expires_at > now());
  if v_quote_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return public.apply_quote_decision(v_quote_id, p_decision, v_owner, p_comment, p_user_agent, p_ip_address);
end;
$$;

grant execute on function public.decide_quote_by_token(text, public.quote_decision, text, text, text) to anon, authenticated;
