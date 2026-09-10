-- Vérifie qu'une base migrée puis garnie par les deux SEULS fichiers de données
-- de production contient bien le catalogue attendu — et rien de plus.
--
-- Exécuté par supabase/tests/run.sh après deux passages des deux fichiers dans
-- une même session : ce que produit le SQL Editor de Supabase quand on relance
-- l'import.
set search_path = public, extensions;

do $test$
declare
  n_modeles int;
  n_categories int;
  n_pdf int;
  n_provisoires int;
  n_produits int;
  n_doublons int;
begin
  select count(*) into n_modeles from public.console_models;
  select count(*) into n_categories from public.repair_categories;
  select count(*) into n_pdf from public.repairs where category_id is not null;
  select count(*) into n_provisoires from public.repairs where price_is_provisional;
  select count(*) into n_produits from public.products;

  if n_modeles <> 39 then
    raise exception 'modèles de console : % au lieu de 39', n_modeles;
  end if;
  if n_categories <> 35 then
    raise exception 'catégories de réparation : % au lieu de 35', n_categories;
  end if;
  -- Les 887 prestations du document du client, ni une de plus ni une de moins.
  if n_pdf <> 887 then
    raise exception 'prestations issues du document : % au lieu de 887', n_pdf;
  end if;
  if n_provisoires <> 874 then
    raise exception 'tarifs à configurer : % au lieu de 874', n_provisoires;
  end if;
  if n_produits <> 51 then
    raise exception 'produits boutique : % au lieu de 51', n_produits;
  end if;

  -- Un modèle ne peut pas porter deux fois la même panne : c'est la garantie
  -- qu'un rejeu n'a rien dupliqué.
  select count(*) into n_doublons from (
    select model_id, fault_id from public.repairs group by 1, 2 having count(*) > 1
  ) as d;
  if n_doublons <> 0 then
    raise exception '% couple(s) modèle/panne en double', n_doublons;
  end if;

  -- Aucun compte de démonstration : ces fichiers ne doivent contenir que du
  -- catalogue. Un profil ici voudrait dire que seed.sql s'est glissé dedans.
  if exists (select 1 from public.profiles) then
    raise exception 'des profils existent : les fichiers de production ne doivent créer aucun compte';
  end if;
  if exists (select 1 from public.repair_orders) then
    raise exception 'des dossiers existent : les fichiers de production ne doivent créer aucune commande';
  end if;
end
$test$;

select 'production seed tests OK' as result;
