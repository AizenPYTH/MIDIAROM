-- Correction : « Manga & Anime » désignait des livres, pas des figurines.
--
-- La migration précédente (20260915000001) a ajouté la valeur `MANGA` à
-- `product_category` en croyant que le magasin vendrait des tomes papier. Ce
-- n'est pas le cas : « manga / anime » désigne ici des **figurines de
-- personnages** — One Piece, Naruto, Dragon Ball, Demon Slayer… — qui relèvent
-- exactement de `COLLECTIBLE`. Deux catégories pour une seule réalité, c'est
-- une ambiguïté qui finit en produits mal classés.
--
-- On ne touche pas à 20260915000001 : elle est appliquée, une migration
-- appliquée ne se réécrit pas. PostgreSQL ne sait pas non plus retirer une
-- valeur d'un type énuméré. On rend donc `MANGA` **inutilisable** :
--   1. les éventuelles lignes qui la portent rejoignent `COLLECTIBLE` ;
--   2. une contrainte interdit de l'employer à l'avenir ;
--   3. le commentaire de colonne dit pourquoi, pour qui lira le schéma.
--
-- Si le magasin décide un jour de vendre de vrais tomes papier, il suffira de
-- retirer la contrainte `products_category_not_manga`.

-- 1. Reclassement. Au moment de l'écriture, aucun produit réel ne porte MANGA —
--    la valeur n'a jamais servi qu'à des fixtures de démonstration. La requête
--    est écrite pour être sûre quoi qu'il en soit, et ne touche rien d'autre.
update public.products set category = 'COLLECTIBLE' where category = 'MANGA';

-- 2. Verrou. Idempotent : rejouer la migration ne double pas la contrainte.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_category_not_manga'
  ) then
    alter table public.products
      add constraint products_category_not_manga check (category <> 'MANGA');
  end if;
end $$;

comment on constraint products_category_not_manga on public.products is
  'MANGA est une valeur morte de product_category : les figurines manga/anime sont des COLLECTIBLE. Retirer cette contrainte si le magasin vend un jour des tomes papier.';

comment on column public.products.category is
  'Rayon du produit. Publics : GAME (jeux vidéo), CONSOLE, COLLECTIBLE (figurines manga/anime et collectors). ACCESSORY et PART servent l''atelier. MANGA est interdit par contrainte — voir products_category_not_manga.';

do $$
declare restants integer;
begin
  select count(*) into restants from public.products where category = 'MANGA';
  raise notice 'Figurines manga/anime : % produit(s) encore en MANGA (0 attendu).', restants;
end $$;
