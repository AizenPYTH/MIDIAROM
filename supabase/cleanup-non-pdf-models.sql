-- ==========================================================================
-- RESTRICTION DU CATALOGUE AUX 13 MODÈLES DU DOCUMENT DU CLIENT
--
-- Le catalogue de réparation est désormais strictement celui du document
-- fourni par 207 Mediarom. Ce fichier retire, d'une base déjà garnie, les
-- modèles de console qui n'y figurent pas — PS5, PS3, rétro, Sega… — et leurs
-- prestations de réparation.
--
-- Ce qui n'est PAS touché :
--   • les 13 modèles du document et leurs 887 prestations ;
--   • les catégories de réparation ;
--   • les tarifs déjà saisis ;
--   • la boutique : les produits sont gérés séparément, et products.model_id
--     passe simplement à NULL sur une fiche qui pointait vers un modèle retiré.
--
-- L'historique commercial est préservé. repair_orders.model_id et
-- trade_in_requests.model_id passent à NULL ; le dossier garde son nom de
-- modèle, sa marque, sa prestation et sa panne, enregistrés à la commande.
--
-- Ordre imposé par le schéma : repairs.model_id est en ON DELETE RESTRICT, il
-- faut donc supprimer les prestations avant les modèles. Les listes de
-- contrôle qualité, les instructions d'emballage et les règles de
-- compatibilité propres à ces modèles partent en cascade.
--
-- Rejouable : une seconde exécution ne supprime plus rien et n'échoue pas.
--
--   Supabase → SQL Editor : coller ce fichier puis « Run »
--   ou : psql "$DB_URL" -f supabase/cleanup-non-pdf-models.sql
-- ==========================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Garde : le schéma doit être en place.
-- ---------------------------------------------------------------------------
do $garde$
declare manquantes text;
begin
  select string_agg(t, ', ' order by t) into manquantes
    from unnest(array['console_models', 'repairs', 'repair_orders', 'trade_in_requests', 'products']) as t
   where to_regclass('public.' || t) is null;
  if manquantes is not null then
    raise exception using
      message = 'Schéma incomplet, table(s) absente(s) : ' || manquantes,
      hint = 'Appliquez d''abord les migrations, puis rejouez ce fichier.';
  end if;
end
$garde$;

do $restriction$
declare
  pdf constant text[] := array[
    'ps4', 'ps4-slim', 'ps4-pro',
    'switch', 'switch-v2', 'switch-lite', 'switch-oled', 'switch-2',
    'xbox-one', 'xbox-one-s', 'xbox-one-x', 'xbox-series-s', 'xbox-series-x'
  ];
  n_modeles int;
  n_prestations int;
  n_pdf_visees int;
  n_dossiers int;
  n_reprises int;
  n_produits int;
  supprimees int;
  supprimes int;
  restants int;
  restantes_pdf int;
begin
  -- Inventaire avant suppression.
  select count(*) into n_modeles from public.console_models where slug <> all (pdf);
  select count(*) into n_prestations from public.repairs r
    join public.console_models m on m.id = r.model_id where m.slug <> all (pdf);
  select count(*) into n_dossiers from public.repair_orders o
    join public.console_models m on m.id = o.model_id where m.slug <> all (pdf);
  select count(*) into n_reprises from public.trade_in_requests t
    join public.console_models m on m.id = t.model_id where m.slug <> all (pdf);
  select count(*) into n_produits from public.products p
    join public.console_models m on m.id = p.model_id where m.slug <> all (pdf);

  raise notice 'Modèles hors document visés : %', n_modeles;
  raise notice '  prestations à supprimer avec eux : %', n_prestations;
  raise notice '  dossiers de réparation rattachés : % (conservés, model_id passe à NULL)', n_dossiers;
  raise notice '  demandes de reprise rattachées : % (conservées, model_id passe à NULL)', n_reprises;
  raise notice '  fiches produit rattachées : % (conservées, model_id passe à NULL)', n_produits;

  -- Filet de sécurité : aucune prestation du document ne doit jamais être visée.
  select count(*) into n_pdf_visees from public.repairs r
    join public.console_models m on m.id = r.model_id
   where m.slug <> all (pdf) and r.category_id is not null;
  if n_pdf_visees > 0 then
    raise exception 'Arrêt : % prestation(s) du document du client rattachée(s) à un modèle hors périmètre', n_pdf_visees;
  end if;

  -- Les prestations d'abord : repairs.model_id est en ON DELETE RESTRICT.
  delete from public.repairs r
   using public.console_models m
   where m.id = r.model_id and m.slug <> all (pdf);
  get diagnostics supprimees = row_count;

  delete from public.console_models where slug <> all (pdf);
  get diagnostics supprimes = row_count;

  select count(*) into restants from public.console_models;
  select count(*) into restantes_pdf from public.repairs where category_id is not null;

  raise notice 'Prestations supprimées : %', supprimees;
  raise notice 'Modèles supprimés : %', supprimes;
  raise notice 'Modèles restants : % (attendu : 13)', restants;
  raise notice 'Prestations du document du client : % (attendu : 887)', restantes_pdf;
end
$restriction$;

-- ---------------------------------------------------------------------------
-- État des lieux (lecture seule) — dernier résultat affiché par le SQL Editor.
-- ---------------------------------------------------------------------------
select element, nombre from (
  select  1, 'modèles de console (attendu : 13)', count(*) from public.console_models
  union all select  2, 'prestations du document du client (attendu : 887)', count(*) from public.repairs where category_id is not null
  union all select  3, 'prestations rattachées à un modèle hors document (attendu : 0)', count(*)
              from public.repairs r join public.console_models m on m.id = r.model_id
             where m.slug <> all (array['ps4','ps4-slim','ps4-pro','switch','switch-v2','switch-lite','switch-oled','switch-2','xbox-one','xbox-one-s','xbox-one-x','xbox-series-s','xbox-series-x'])
  union all select  4, 'catégories de réparation (attendu : 35)', count(*) from public.repair_categories
  union all select  5, 'dossiers de réparation sans modèle (historique conservé)', count(*) from public.repair_orders where model_id is null
) as etat (ordre, element, nombre)
order by ordre;
