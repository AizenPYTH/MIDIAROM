-- Vérifie supabase/cleanup-demo-data.sql sur une base qui contient exactement ce
-- que la production contenait : le catalogue, les 887 prestations du document du
-- client, les 98 anciennes prestations désactivées par l'import, et les 51
-- produits de démonstration.
--
-- Exécuté par supabase/tests/run.sh après deux passages du nettoyage : le second
-- ne doit plus rien trouver à supprimer et ne doit pas échouer.
set search_path = public, extensions;

do $test$
declare
  n_demo int;
  n_inactives int;
  n_pdf int;
  n_modeles int;
  n_categories int;
begin
  -- Les produits de démonstration sont reconnaissables à leurs SKU du seed.
  select count(*) into n_demo from public.products
   where sku like 'CON-%' or sku like 'GAM-%' or sku like 'ACC-%' or sku like 'PRT-%';
  if n_demo <> 0 then
    raise exception 'produits de démonstration restants : %', n_demo;
  end if;

  -- Plus aucune prestation sans catégorie et inactive sur un modèle du document.
  -- Le catalogue de réparation est strictement celui du document : plus aucune
  -- prestation sans catégorie, pas même un « Diagnostic » générique.
  select count(*) into n_inactives from public.repairs where category_id is null;
  if n_inactives <> 0 then
    raise exception 'prestations hors document restantes : %', n_inactives;
  end if;

  -- Ce que le nettoyage ne doit surtout pas avoir touché.
  select count(*) into n_pdf from public.repairs where category_id is not null;
  if n_pdf <> 887 then
    raise exception 'prestations du document du client : % au lieu de 887', n_pdf;
  end if;

  select count(*) into n_modeles from public.console_models;
  if n_modeles <> 13 then
    raise exception 'modèles de console : % au lieu de 13', n_modeles;
  end if;

  select count(*) into n_categories from public.repair_categories;
  if n_categories <> 35 then
    raise exception 'catégories de réparation : % au lieu de 35', n_categories;
  end if;


  -- L'historique des commandes survit à la suppression des produits : la ligne
  -- garde son libellé et son prix, seul le lien vers la fiche produit est coupé.
  if exists (select 1 from public.shop_order_items where label is null or unit_price_cents is null) then
    raise exception 'des lignes de commande ont perdu leur libellé ou leur prix';
  end if;
end
$test$;

select 'cleanup tests OK' as result;
