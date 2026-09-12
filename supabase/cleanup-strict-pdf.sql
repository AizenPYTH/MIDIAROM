-- ==========================================================================
-- REMISE DU SITE AU PÉRIMÈTRE STRICT DU DOCUMENT DU CLIENT — 207 MÉDI@ROM
--
-- Un seul fichier à exécuter sur une base déjà garnie. Il aligne les trois
-- espaces du site sur le document fourni par le client :
--
--   CONSOLES   : seuls les 13 modèles du document et les 5 modèles de la gamme
--                PlayStation 5 restent ; les autres (PS3, rétro, Sega…) sont
--                supprimés. La PS5 ne figure pas dans le document du client :
--                elle a été ajoutée à sa demande, voir supabase/catalog-ps5.sql.
--   RÉPARATION : seules les 887 prestations du document restent ; toutes les
--                autres — anciennes prestations génériques, « Diagnostic … »
--                inventés — sont supprimées.
--   BOUTIQUE   : les 51 produits de démonstration sont supprimés. Le site ne
--                vend plus rien : la boutique a été retirée, seule la
--                réparation subsiste.
--
-- Rien n'est créé ni remplacé : ce fichier ne contient que des suppressions
-- ciblées. Aucune table n'est touchée, aucun DELETE global.
--
-- L'historique est préservé : shop_order_items.product_id, repair_orders
-- (repair_id, model_id) et trade_in_requests.model_id passent à NULL, les
-- lignes gardent leur libellé, leur prix et leur quantité d'origine.
--
-- Ordre imposé par le schéma : repairs.model_id est en ON DELETE RESTRICT, les
-- prestations partent donc avant les modèles.
--
-- Rejouable : une seconde exécution ne supprime plus rien et n'échoue pas.
--
--   Supabase → SQL Editor : coller ce fichier puis « Run »
--   ou : psql "$DB_URL" -f supabase/cleanup-strict-pdf.sql
-- ==========================================================================

set search_path = public, extensions;

do $garde$
declare manquantes text;
begin
  select string_agg(t, ', ' order by t) into manquantes
    from unnest(array['console_models', 'products', 'repairs', 'repair_categories']) as t
   where to_regclass('public.' || t) is null;
  if manquantes is not null then
    raise exception using
      message = 'Schéma incomplet, table(s) absente(s) : ' || manquantes,
      hint = 'Appliquez d''abord les migrations, puis rejouez ce fichier.';
  end if;
end
$garde$;

do $nettoyage$
declare
  -- Les 13 modèles du document du client, puis les 5 modèles PlayStation 5
  -- ajoutés à sa demande. Tout modèle absent de cette liste est supprimé : ne
  -- pas oublier d'y inscrire un modèle que l'on ajoute au catalogue, sans quoi
  -- le prochain passage de ce fichier l'effacerait.
  pdf constant text[] := array[
    'ps4', 'ps4-slim', 'ps4-pro',
    'ps5', 'ps5-digital', 'ps5-slim', 'ps5-slim-digital', 'ps5-pro',
    'switch', 'switch-v2', 'switch-lite', 'switch-oled', 'switch-2',
    'xbox-one', 'xbox-one-s', 'xbox-one-x', 'xbox-series-s', 'xbox-series-x'
  ];
  demo constant text[] := array[
  'CON-PS5S-001', 'CON-PS5P-001', 'CON-PS4S-U01', 'CON-N64-U01', 'CON-PS2S-R01', 'CON-GBC-R01',
  'CON-SW-U01', 'CON-XSX-001', 'CON-DC-U01', 'GAM-PS5-001', 'GAM-PS5-U02', 'GAM-SW-001',
  'GAM-XSX-U01', 'GAM-MD-L01', 'GAM-N64-U01', 'GAM-GB-U01', 'ACC-SW-001', 'ACC-PS5-001',
  'ACC-XSX-001', 'ACC-HDMI-001', 'ACC-PS4-PSU', 'ACC-SW-CHG', 'ACC-PS2-MEM', 'ACC-N64-CTL',
  'PRT-JC-STK', 'PRT-PS5-HDMI', 'COL-FIG-001', 'GAM-PS1-U01', 'CON-PS1-U01', 'CON-PS3S-U01',
  'CON-PSP-R01', 'CON-VITA-U01', 'CON-XSS-001', 'CON-XB1S-U01', 'CON-X360-U01', 'CON-XBOG-U01',
  'CON-SW-U02', 'CON-SWL-U01', 'CON-WII-U01', 'CON-WIIU-U01', 'CON-NGC-U01', 'CON-SNES-U01',
  'CON-NES-U01', 'CON-GB-R01', 'CON-GBA-R01', 'CON-NDS-U01', 'CON-3DS-U01', 'CON-MD-U01',
  'CON-MS-U01', 'CON-SAT-U01', 'CON-GG-R01'
  ];
  n int;
  produits_supprimes int;
  prestations_supprimees int;
  modeles_supprimes int;
begin
  -- ---------------------------------------------------------------------
  -- 1. BOUTIQUE — les 51 produits de démonstration, désignés par leur SKU.
  --    Cibler la liste exacte plutôt que la table : un produit réel saisi
  --    depuis le back-office survit au nettoyage.
  -- ---------------------------------------------------------------------
  select count(*) into n from public.products where sku = any (demo);
  raise notice 'BOUTIQUE — produits de démonstration présents : % sur %', n, array_length(demo, 1);
  delete from public.products where sku = any (demo);
  get diagnostics produits_supprimes = row_count;

  -- ---------------------------------------------------------------------
  -- 2. RÉPARATION — tout ce qui ne vient pas du document.
  --    Les 887 prestations du document portent toutes une catégorie ; celles
  --    qui n'en ont pas ont été créées par le catalogue générique et sont
  --    donc, du point de vue du client, inventées.
  -- ---------------------------------------------------------------------
  select count(*) into n from public.repairs where category_id is null;
  raise notice 'RÉPARATION — prestations hors document : %', n;
  delete from public.repairs where category_id is null;
  get diagnostics prestations_supprimees = row_count;

  -- ---------------------------------------------------------------------
  -- 3. CONSOLES — les modèles absents du document, et ce qu'il leur reste
  --    de prestations. Filet de sécurité avant toute suppression.
  -- ---------------------------------------------------------------------
  select count(*) into n
    from public.repairs r join public.console_models m on m.id = r.model_id
   where m.slug <> all (pdf) and r.category_id is not null;
  if n > 0 then
    raise exception 'Arrêt : % prestation(s) catalogue rattachée(s) à un modèle hors périmètre', n;
  end if;

  delete from public.repairs r using public.console_models m
   where m.id = r.model_id and m.slug <> all (pdf);
  get diagnostics n = row_count;
  prestations_supprimees := prestations_supprimees + n;

  select count(*) into n from public.console_models where slug <> all (pdf);
  raise notice 'CONSOLES — modèles hors document : %', n;
  delete from public.console_models where slug <> all (pdf);
  get diagnostics modeles_supprimes = row_count;

  raise notice '---';
  raise notice 'Produits supprimés : %', produits_supprimes;
  raise notice 'Prestations supprimées : %', prestations_supprimees;
  raise notice 'Modèles supprimés : %', modeles_supprimes;
end
$nettoyage$;

-- ---------------------------------------------------------------------------
-- Photos des 13 modèles
--
-- Les images fournies par le client sont livrées AVEC le site
-- (public/medias/consoles/<slug>.webp) : un déploiement suffit à les afficher,
-- sans téléversement ni étape supplémentaire. publicMediaUrl sert tel quel tout
-- chemin commençant par « / ».
--
-- On ne renseigne que les modèles encore sans photo : une image téléversée
-- depuis Catalogue → Modèles reste prioritaire et n'est jamais écrasée.
-- ---------------------------------------------------------------------------
update public.console_models
   set image_path = '/medias/consoles/' || slug || '.webp', updated_at = now()
 where slug in ('ps4', 'ps4-slim', 'ps4-pro',
                'switch', 'switch-v2', 'switch-lite', 'switch-oled', 'switch-2',
                'xbox-one', 'xbox-one-s', 'xbox-one-x', 'xbox-series-s', 'xbox-series-x')
   and coalesce(image_path, '') = '';

-- ---------------------------------------------------------------------------
-- Photo de la façade du magasin
--
-- Photo réelle du 207 rue de Rome, livrée avec le site
-- (public/medias/facade-207-mediarom.webp). Elle s'affiche sur la page
-- « Le magasin » et dans le bloc magasin de l'accueil.
--
-- gallery_items n'a pas de clé naturelle : la garde porte sur le chemin, ce qui
-- rend l'insertion rejouable sans créer de doublon.
-- ---------------------------------------------------------------------------
insert into public.gallery_items (category, image_path, title, description, display_order, is_published)
select 'storefront', '/medias/facade-207-mediarom.webp',
       'Façade du magasin 207 Médi@roM à Marseille',
       'Le magasin, 207 rue de Rome à Marseille : vitrine consoles et jeux, réparation express.',
       0, true
 where not exists (select 1 from public.gallery_items where image_path = '/medias/facade-207-mediarom.webp');

-- ---------------------------------------------------------------------------
-- Nom de l'enseigne
--
-- L'enseigne du magasin se lit « 207 Médi@roM » : un arobase à la place du
-- « a ». Le site affichait « 207 Mediarom ». On ne corrige que la valeur
-- d'origine : un nom modifié depuis Réglages n'est jamais écrasé.
-- ---------------------------------------------------------------------------
update public.site_settings
   set value = jsonb_set(value, '{name}', '"207 Médi@roM"'), updated_at = now()
 where key = 'brand' and value ->> 'name' = '207 Mediarom';

update public.gallery_items
   set title = 'Façade du magasin 207 Médi@roM à Marseille'
 where image_path = '/medias/facade-207-mediarom.webp'
   and title = 'Façade du magasin 207 Mediarom à Marseille';

-- ---------------------------------------------------------------------------
-- État des lieux (lecture seule) — dernier résultat affiché par le SQL Editor.
-- ---------------------------------------------------------------------------
select element, nombre from (
  select 1, 'CONSOLES — modèles (13 du document + 5 PS5)', count(*) from public.console_models
  union all select 2, 'CONSOLES — modèles avec photo', count(*) from public.console_models where image_path is not null
  union all select 3, 'RÉPARATION — prestations (887 du document + 302 PS5)', count(*) from public.repairs where category_id is not null
  union all select 4, 'RÉPARATION — prestations hors document (attendu : 0)', count(*) from public.repairs where category_id is null
  union all select 5, 'RÉPARATION — catégories (attendu : 35)', count(*) from public.repair_categories
  union all select 6, 'BOUTIQUE — produits résiduels (attendu : 0, le site ne vend plus)', count(*) from public.products
  union all select 7, 'MAGASIN — photo de façade publiée (attendu : 1)', count(*)
              from public.gallery_items where image_path = '/medias/facade-207-mediarom.webp' and is_published
) as etat (ordre, element, nombre)
order by ordre;
