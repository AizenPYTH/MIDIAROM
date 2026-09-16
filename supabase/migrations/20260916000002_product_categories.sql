-- Les rayons de la boutique deviennent une donnée, pas un type.
--
-- Jusqu'ici, « jeux vidéo », « consoles » et « figurines » étaient les valeurs
-- d'un type énuméré PostgreSQL. Conséquence : ouvrir un rayon de plus — des
-- goodies, des cartes à collectionner, des pièces rétro — demandait une
-- migration, un déploiement, et la modification d'une dizaine de fichiers.
-- Le vendeur ne pouvait pas le faire seul.
--
-- Ce qui change :
--   1. une table `product_categories` porte le code, le libellé, le libellé au
--      singulier, le slug d'adresse, l'ordre d'affichage et la visibilité ;
--   2. `products.category` devient du texte, avec une clé étrangère vers cette
--      table — on ne peut donc pas ranger un produit dans un rayon qui
--      n'existe pas, et renommer un code se propage (`on update cascade`) ;
--   3. les cinq rayons existants sont repris **à l'identique** : mêmes codes,
--      mêmes libellés, mêmes slugs, même visibilité. Aucune adresse publiée ne
--      change, aucun produit ne change de rayon.
--
-- Le type `product_category` n'est pas supprimé : PostgreSQL ne sait pas
-- retirer une valeur d'un énuméré, et le laisser en place ne coûte rien. Il
-- n'est simplement plus référencé par aucune colonne.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  -- Le code est la clé technique, celle que `products.category` référence.
  -- Il ne se lit pas : c'est le libellé qu'on montre.
  code text not null unique check (code = upper(code) and code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  -- « Console » quand on qualifie **un** article, « Consoles » pour la section.
  label_singular text not null check (length(btrim(label_singular)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position integer not null default 0,
  -- Un rayon non public reste gérable au back-office et invisible en boutique :
  -- c'est ce qui permet de suivre des pièces détachées sans les mettre en vente.
  is_public boolean not null default true,
  -- Comment s'appelle, dans ce rayon, ce que porte `products.platform`.
  -- Une console ou un jeu ont une **plateforme** ; une figurine a une
  -- **licence**. C'est la même colonne et la même ligne au-dessus du nom du
  -- produit, mais pas le même mot — et confondre les deux donnait un filtre
  -- « Toutes plateformes » qui proposait « One Piece » et « Naruto Shippuden ».
  tag_label text not null default 'plateforme' check (length(btrim(tag_label)) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.product_categories is
  'Les rayons de la boutique. Ajoutables et renommables depuis le back-office : ne jamais recoder cette liste en dur dans l''application.';
comment on column public.product_categories.code is
  'Clé technique référencée par products.category. Stable : la renommer déplace tous les produits du rayon (on update cascade).';
comment on column public.product_categories.slug is
  'Segment d''adresse du rayon (/boutique?cat=<slug>). Le changer casse les liens déjà publiés et indexés.';
comment on column public.product_categories.is_public is
  'false = rayon interne, visible au back-office seulement. ACCESSORY et PART le sont : MÉDI@ROM ne vend pas de composants.';
comment on column public.product_categories.tag_label is
  'Le nom, dans ce rayon, de ce que porte products.platform : « plateforme » pour un jeu ou une console, « licence » pour une figurine. Au singulier et en minuscules.';

-- Les cinq rayons d'aujourd'hui, repris tels quels. `on conflict do nothing` :
-- rejouer la migration ne réécrit pas un libellé que le vendeur aurait changé.
insert into public.product_categories (code, label, label_singular, slug, position, is_public, tag_label) values
  ('GAME',        'Jeux vidéo',              'Jeu',        'jeux',        10, true,  'plateforme'),
  ('CONSOLE',     'Consoles',                'Console',    'consoles',    20, true,  'plateforme'),
  ('COLLECTIBLE', 'Figurines Manga / Anime', 'Figurine',   'figurines',   30, true,  'licence'),
  ('ACCESSORY',   'Accessoires',             'Accessoire', 'accessoires', 40, false, 'plateforme'),
  ('PART',        'Pièces',                  'Pièce',      'pieces',      50, false, 'plateforme')
on conflict (code) do nothing;

-- La colonne a pu être ajoutée après coup sur une base où les cinq rayons
-- existaient déjà : le `on conflict do nothing` ci-dessus ne les aurait pas
-- corrigés. On ne touche qu'au rayon des figurines, et seulement s'il porte
-- encore la valeur par défaut — un libellé choisi par le vendeur est gardé.
update public.product_categories
   set tag_label = 'licence'
 where code = 'COLLECTIBLE' and tag_label = 'plateforme';

-- Rattrapage pour une base où la table existait avant l'ajout de `tag_label`.
alter table public.product_categories
  add column if not exists tag_label text not null default 'plateforme';

-- `products.category` passe du type énuméré au texte, puis reçoit sa clé
-- étrangère. La conversion est une simple projection : les valeurs sont déjà
-- exactement les codes insérés ci-dessus.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
      and column_name = 'category' and udt_name = 'product_category'
  ) then
    -- La contrainte anti-MANGA est écrite contre l'énuméré ; la clé étrangère
    -- la remplace et va plus loin — MANGA n'existe pas dans la table, donc
    -- aucun produit ne peut y atterrir.
    alter table public.products drop constraint if exists products_category_not_manga;
    alter table public.products alter column category drop default;
    alter table public.products alter column category type text using category::text;
    alter table public.products alter column category set default 'CONSOLE';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass and conname = 'products_category_fkey'
  ) then
    alter table public.products
      add constraint products_category_fkey
      foreign key (category) references public.product_categories (code)
      on update cascade on delete restrict;
  end if;
end $$;

comment on column public.products.category is
  'Code du rayon, référencé dans product_categories. La liste est gérée au back-office : ne pas la recoder en dur.';

create index if not exists product_categories_position_idx
  on public.product_categories (position, label);

-- Un rayon est une information de vitrine : tout le monde lit les rayons
-- publics, l'atelier lit les siens, seul un administrateur en crée.
alter table public.product_categories enable row level security;

drop policy if exists "product_categories: public read" on public.product_categories;
create policy "product_categories: public read" on public.product_categories
  for select to anon, authenticated using (is_public or public.is_staff());

drop policy if exists "product_categories: admin write" on public.product_categories;
create policy "product_categories: admin write" on public.product_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.product_categories to anon, authenticated;
grant all on public.product_categories to service_role;
