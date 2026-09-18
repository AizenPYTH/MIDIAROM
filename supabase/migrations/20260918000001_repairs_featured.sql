-- Le catalogue de réparation garde ses 1 189 prestations. Le client n'en voit
-- plus que sept à neuf.
--
-- Le problème : l'atelier a importé un catalogue technique complet — jusqu'à
-- quatre-vingt-neuf prestations pour une seule console, avec des variantes qui
-- disent au fond la même chose (« Aucun signal HDMI », « Pas d'image »,
-- « Écran noir », « Problème de sortie vidéo »…). C'est la bonne granularité
-- pour un réparateur qui saisit un dossier ; c'est un mur pour un client qui
-- veut faire réparer sa console.
--
-- Ce qui change : deux colonnes, et rien d'autre.
--   * `is_featured`    — la prestation paraît dans la liste courte du client ;
--   * `featured_order` — son rang dans cette liste.
--
-- Ce qui ne change pas, et c'est l'essentiel :
--   * aucune prestation n'est supprimée ni désactivée ;
--   * aucun prix, aucune règle de devis, aucun dossier existant n'est touché ;
--   * tout le catalogue reste commandable — ce qui n'est pas mis en avant vit
--     derrière « Autre problème », avec sa recherche ;
--   * le back-office continue de voir et de gérer les 1 189 lignes.
--
-- L'amorçage plus bas choisit une première sélection. Il est **rejouable sans
-- dommage** : il ne touche qu'un modèle dont aucune prestation n'est encore
-- mise en avant. Le jour où le vendeur recompose sa liste depuis le
-- back-office, rejouer cette migration ne la défera pas.

alter table public.repairs
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order integer not null default 0;

comment on column public.repairs.is_featured is
  'Paraît dans la liste courte proposée au client (7 à 9 par modèle). Les autres restent commandables derrière « Autre problème » : ne jamais désactiver une prestation pour la retirer de cette liste.';
comment on column public.repairs.featured_order is
  'Rang dans la liste courte. Les ex æquo sont départagés par display_order puis par nom.';

-- L'index sert la seule requête chaude : la liste courte d'un modèle.
create index if not exists repairs_featured_idx
  on public.repairs (model_id, is_featured, featured_order, display_order);

-- ---------------------------------------------------------------------------
-- Première sélection
--
-- Elle n'invente rien : chaque ligne ci-dessous est un **motif** appliqué aux
-- pannes réellement présentes pour le modèle. Un modèle qui n'a pas de lecteur
-- de disque — une PS5 Digital Edition — n'en voit tout simplement pas
-- apparaître ; une Switch n'a pas de sortie HDMI et n'en reçoit pas.
--
-- Les motifs sont ordonnés du plus précis au plus large : on préfère
-- « Aucun signal HDMI », clair pour un client, à « Remplacement du circuit
-- TMDS », juste mais illisible. C'est tout l'objet de cette liste.
--
-- Les exclusions comptent autant que les inclusions : « Manette qui ne charge
-- pas » ne doit pas occuper la case « alimentation de la console », et
-- « Joy-Con 2 qui ne s'allume plus » ne doit pas occuper celle de la console
-- elle-même. D'où les `(?!…)`.
-- ---------------------------------------------------------------------------

do $$
declare
  touches integer;
begin
  with slots(rang, motifs) as (values
    -- Image et HDMI.
    (1,  array['^aucun-signal-hdmi$','^pas-dimage$','^pas-d-image$','^port-hdmi-endommage$','^changement-du-port-hdmi$','hdmi']),
    -- La console ne s'allume plus — la console, pas sa manette.
    (2,  array['^(?!joy-con|manette).*(qui-ne-s-allume-plus|qui-ne-sallume-plus)$','^ne-s-allume-plus$','^ne-sallume-plus$','^(?!joy-con|manette).*(ne-s-allume-plus|ne-sallume-plus)']),
    -- Écran : dégâts physiques seulement, ce qui le réserve aux portables.
    -- Un « Écran de récupération » de Xbox n'est pas une casse d'écran.
    (3,  array['^ecran-fissure','^ecran-casse','^lignes-sur-l-ecran$','^ecran-blanc$','^tactile-qui-ne-repond-plus$']),
    -- Charge et alimentation de la console.
    (4,  array['^ne-charge-plus$','^batterie-(?!joy-con)','^probleme-dalimentation$','^probleme-d-alimentation$','^bloc-dalimentation-defectueux$','^probleme-de-bloc-d-alimentation-externe$','^connecteur-dalimentation-endommage$','^port-usb-c-endommage$','^(?!manette|joy-con).*(charge|alimentation)']),
    -- Surchauffe et ventilation.
    (5,  array['^surchauffe$','^ventilateur-bruyant$','surchauffe','ventilateur']),
    -- Lecteur : disque, cartouche ou carte de jeu selon la machine.
    (6,  array['^disque-non-reconnu$','^cartouche-non-reconnue$','^carte-de-jeu-non-reconnue$','^lecteur-blu-ray-defectueux$','cartouche','disque','lecteur']),
    -- Manette, Joy-Con, dérive des sticks.
    (7,  array['^joy-con-drift$','^joystick-drift$','^drift-du-joystick$','^drift$','^manette-non-reconnue$','^joy-con-non-reconnu$','drift','manette']),
    -- Ports USB.
    (8,  array['^port-usb-defectueux$','^port-usb-endommage$','^port-usb','usb']),
    -- Réseau.
    (9,  array['^wi-fi-non-detecte$','^wi-fi-defectueux$','^probleme-de-connexion-internet$','wi-fi','reseau','ethernet']),
    -- Entretien.
    (10, array['^nettoyage','nettoyage','depoussierage','pate-thermique'])
  ),
  -- Les modèles à amorcer : ceux dont aucune prestation n'est encore mise en
  -- avant. Un modèle déjà composé au back-office est laissé intact.
  vierges as (
    select m.id
    from public.console_models m
    where m.is_active
      and not exists (select 1 from public.repairs r where r.model_id = m.id and r.is_featured)
  ),
  -- Pour chaque (modèle, case), la prestation dont la panne satisfait le motif
  -- le plus précis.
  choix as (
    select distinct on (v.id, s.rang) v.id as model_id, s.rang, r.id as repair_id
    from vierges v
    cross join slots s
    join public.repairs r on r.model_id = v.id and r.is_active
    join public.faults f on f.id = r.fault_id and f.is_active
    cross join lateral (
      select min(u.i) as prio from unnest(s.motifs) with ordinality as u(motif, i) where f.slug ~ u.motif
    ) p
    where p.prio is not null
    order by v.id, s.rang, p.prio, r.display_order, r.name
  ),
  -- Une prestation peut satisfaire deux cases : elle garde la première et la
  -- seconde reste vide plutôt que de se répéter.
  sans_doublon as (
    select distinct on (model_id, repair_id) * from choix order by model_id, repair_id, rang
  ),
  numerote as (
    select model_id, repair_id, row_number() over (partition by model_id order by rang) as n from sans_doublon
  ),
  retenus as (select repair_id, n from numerote where n <= 9)
  update public.repairs r
     set is_featured = true, featured_order = retenus.n
    from retenus
   where r.id = retenus.repair_id;

  get diagnostics touches = row_count;
  raise notice 'Prestations mises en avant : %', touches;
end $$;
