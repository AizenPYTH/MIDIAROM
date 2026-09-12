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

  if n_modeles <> 18 then
    raise exception 'modèles de console : % au lieu de 18 (13 du document + 5 PS5)', n_modeles;
  end if;
  if n_categories <> 35 then
    raise exception 'catégories de réparation : % au lieu de 35', n_categories;
  end if;
  -- Les 887 prestations du document du client, plus les 302 de la gamme
  -- PlayStation 5 ajoutée hors document : ni une de plus, ni une de moins.
  if n_pdf <> 1189 then
    raise exception 'prestations du catalogue : % au lieu de 1189', n_pdf;
  end if;
  -- Ni le document ni le catalogue PS5 ne contiennent de prix : sur une base
  -- neuve, toutes les prestations arrivent « sur devis ». En production, celles
  -- déjà chiffrées depuis le back-office conservent leur tarif.
  if n_provisoires <> 1189 then
    raise exception 'tarifs à configurer : % au lieu de 1189', n_provisoires;
  end if;
  -- Le site ne vend rien : l'import ne doit créer aucun produit.
  if n_produits <> 0 then
    raise exception 'produits boutique : % au lieu de 0', n_produits;
  end if;

  -- La gamme PlayStation 5, ajoutée hors document à la demande du client.
  if (select count(*) from public.console_models where family = 'ps5') <> 5 then
    raise exception 'modèles PlayStation 5 : % au lieu de 5', (select count(*) from public.console_models where family = 'ps5');
  end if;
  if (select count(*) from public.repairs r join public.console_models m on m.id = r.model_id where m.family = 'ps5') <> 302 then
    raise exception 'prestations PlayStation 5 : % au lieu de 302',
      (select count(*) from public.repairs r join public.console_models m on m.id = r.model_id where m.family = 'ps5');
  end if;

  -- La photo de façade est livrée avec le site, publiée dès le premier import.
  if not exists (select 1 from public.gallery_items
                  where image_path = '/medias/facade-207-mediarom.webp' and is_published) then
    raise exception 'la photo de façade du magasin est absente de la galerie';
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
