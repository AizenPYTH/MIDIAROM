-- ==========================================================================
-- NETTOYAGE DES DONNÉES DE DÉMONSTRATION — 207 MEDIAROM
--
-- Retire deux jeux de données que le client ne souhaite pas conserver :
--
--   1. les 51 produits de démonstration créés pendant le développement, qui ne
--      correspondent à aucun stock réel du magasin ;
--   2. les 98 anciennes prestations de réparation désactivées lors de l'import
--      du catalogue du client, sans catégorie et absentes de son document.
--
-- Ce fichier ne contient QUE des suppressions ciblées : aucun drop de table,
-- aucun DELETE global, aucune ligne créée. Il est rejouable — une seconde
-- exécution ne supprime plus rien et n'échoue pas.
--
-- Après ce nettoyage, la boutique est vide. C'est voulu : le client saisira son
-- stock depuis Stock → Nouveau produit, et la boutique affiche entre-temps son
-- état vide, prévu par le design.
--
-- Les 51 produits ont également été retirés de supabase/catalog.sql (donc de
-- supabase/seed-production-catalog.sql) : rejouer le catalogue ne les recrée
-- pas. Ils restent dans supabase/seed.sql, qui n'est jamais appliqué en
-- production, pour que la boutique reste testable en développement.
--
--   Supabase → SQL Editor : coller ce fichier puis « Run »
--   ou : psql "$DB_URL" -f supabase/cleanup-demo-data.sql
-- ==========================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Garde : le schéma doit être en place.
-- ---------------------------------------------------------------------------
do $garde$
declare manquantes text;
begin
  select string_agg(t, ', ' order by t) into manquantes
    from unnest(array['products', 'repairs', 'shop_order_items', 'stock_movements', 'console_models']) as t
   where to_regclass('public.' || t) is null;
  if manquantes is not null then
    raise exception using
      message = 'Schéma incomplet, table(s) absente(s) : ' || manquantes,
      hint = 'Appliquez d''abord les migrations, puis rejouez ce fichier.';
  end if;
end
$garde$;

-- ---------------------------------------------------------------------------
-- 1. Les 51 produits de démonstration, désignés un par un par leur SKU.
--
-- Cibler la liste exacte plutôt que la table entière : un produit réel saisi
-- entre-temps depuis le back-office n'est pas concerné et survit au nettoyage.
--
-- Deux tables dépendent de products, et la migration a déjà prévu leur sort :
--   • shop_order_items.product_id → ON DELETE SET NULL. L'historique des
--     commandes est préservé : chaque ligne garde son SKU, son libellé, sa
--     quantité et son prix unitaire au moment de l'achat.
--   • stock_movements.product_id  → ON DELETE CASCADE. L'historique de stock
--     d'un produit de démonstration disparaît avec lui, ce qui est le but.
-- ---------------------------------------------------------------------------
do $produits$
declare
  vises int;
  lignes_commande int;
  mouvements int;
  supprimes int;
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
begin
  select count(*) into vises from public.products where sku = any (demo);
  select count(*) into lignes_commande from public.shop_order_items i
    join public.products p on p.id = i.product_id where p.sku = any (demo);
  select count(*) into mouvements from public.stock_movements m
    join public.products p on p.id = m.product_id where p.sku = any (demo);

  raise notice 'Produits de démonstration présents : % sur % attendus', vises, array_length(demo, 1);
  raise notice '  lignes de commande rattachées : % (conservées, product_id passe à NULL)', lignes_commande;
  raise notice '  mouvements de stock rattachés : % (supprimés avec le produit)', mouvements;

  delete from public.products where sku = any (demo);
  get diagnostics supprimes = row_count;
  raise notice 'Produits supprimés : %', supprimes;
end
$produits$;

-- ---------------------------------------------------------------------------
-- 2. Les 98 anciennes prestations sans catégorie.
--
-- Elles avaient été désactivées, jamais supprimées, lors de l'import du
-- catalogue du client. Le critère est celui-là même qui avait servi à les
-- désactiver :
--   • prestation inactive,
--   • sans catégorie (category_id is null) — les 887 prestations du document
--     en ont toutes une, elles sont donc hors d'atteinte par construction,
--   • sur un modèle couvert par le document du client, reconnu au fait qu'il
--     porte au moins une prestation catégorisée.
--
-- Les prestations des 26 autres modèles (PS5, PS3, rétro…) n'ont pas de
-- catégorie non plus, mais elles sont ACTIVES et leurs modèles ne sont pas
-- couverts par le document : le premier critère comme le troisième les
-- écartent.
--
-- Dépendances, prévues par la migration :
--   • repair_orders.repair_id → SET NULL, le dossier garde son libellé de
--     prestation, sa panne, son modèle et sa marque ;
--   • repair_included_options et repair_option_compatibility → CASCADE ;
--   • analytics_events.repair_id → SET NULL.
-- ---------------------------------------------------------------------------
do $prestations$
declare
  vises int;
  avec_categorie int;
  dossiers int;
  supprimes int;
  restantes_pdf int;
begin
  create temp table if not exists cibles_prestations (id uuid primary key) on commit drop;
  delete from cibles_prestations;
  insert into cibles_prestations (id)
  select r.id
    from public.repairs r
   where not r.is_active
     and r.category_id is null
     and exists (select 1 from public.repairs pdf
                  where pdf.model_id = r.model_id and pdf.category_id is not null);

  select count(*) into vises from cibles_prestations;

  -- Filet de sécurité : aucune prestation du document ne doit jamais entrer ici.
  select count(*) into avec_categorie
    from public.repairs r join cibles_prestations c on c.id = r.id
   where r.category_id is not null;
  if avec_categorie > 0 then
    raise exception 'Arrêt : % prestation(s) du catalogue du client visée(s) par la suppression', avec_categorie;
  end if;

  select count(*) into dossiers from public.repair_orders o join cibles_prestations c on c.id = o.repair_id;
  raise notice 'Anciennes prestations visées : %', vises;
  raise notice '  dossiers de réparation rattachés : % (conservés, repair_id passe à NULL)', dossiers;

  delete from public.repairs r using cibles_prestations c where c.id = r.id;
  get diagnostics supprimes = row_count;

  select count(*) into restantes_pdf from public.repairs where category_id is not null;
  raise notice 'Anciennes prestations supprimées : %', supprimes;
  raise notice 'Prestations du document du client encore en base : % (attendu : 887)', restantes_pdf;
end
$prestations$;

-- ---------------------------------------------------------------------------
-- État des lieux (lecture seule) — dernier résultat affiché par le SQL Editor.
-- ---------------------------------------------------------------------------
select element, nombre from (
  select  1, 'produits en boutique (attendu : 0 après nettoyage)', count(*) from public.products
  union all select  2, 'prestations du document du client (attendu : 887)', count(*) from public.repairs where category_id is not null
  union all select  3, 'prestations sans catégorie encore inactives (attendu : 0)', count(*) from public.repairs where not is_active and category_id is null
  union all select  4, 'prestations actives, tous modèles', count(*) from public.repairs where is_active
  union all select  5, 'modèles de console (attendu : 39)', count(*) from public.console_models
  union all select  6, 'catégories de réparation (attendu : 35)', count(*) from public.repair_categories
  union all select  7, 'lignes de commande boutique orphelines (historique conservé)', count(*) from public.shop_order_items where product_id is null
) as etat (ordre, element, nombre)
order by ordre;
