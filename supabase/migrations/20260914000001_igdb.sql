-- =============================================================================
-- IGDB — enrichissement des produits de type GAME
--
-- Deux choses ici :
--   1. de quoi identifier un jeu à coup sûr (EAN, édition, région), que la
--      table products ne portait pas ;
--   2. un cache des fiches IGDB, pour que l'affichage d'une page ne déclenche
--      jamais d'appel à IGDB.
--
-- Le cache stocke la fiche NORMALISÉE (modèle Game de lib/igdb/types.ts), pas
-- la réponse brute : c'est ce que lit le site, et cela évite de retraduire à
-- chaque lecture. Les visuels restent des identifiants d'images IGDB servis
-- par leur CDN — on ne constitue pas une copie autonome de la base IGDB.
--
-- Rejouable : aucune suppression, aucun écrasement.
-- =============================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Identification du produit
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists ean text;
alter table public.products add column if not exists edition text;
alter table public.products add column if not exists region text;
alter table public.products add column if not exists release_year integer;

comment on column public.products.ean is 'Code-barres. Piste la plus fiable pour identifier une édition sur une plateforme donnée.';
comment on column public.products.edition is 'Deluxe, Remastered, Game of the Year…';
comment on column public.products.region is 'PAL, NTSC-U, NTSC-J… Utile pour le rétro.';

-- Un EAN désigne un article et un seul, mais reste facultatif.
create unique index if not exists products_ean_key on public.products (ean) where ean is not null;

-- ---------------------------------------------------------------------------
-- 2. Cache des fiches IGDB
-- ---------------------------------------------------------------------------
create table if not exists public.igdb_games (
  igdb_id      bigint primary key,
  name         text not null,
  slug         text not null,
  -- Fiche normalisée (Game). Structure extensible : ajouter un champ au
  -- modèle n'impose pas de migration.
  data         jsonb not null,
  synced_at    timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

comment on table public.igdb_games is 'Cache serveur des fiches IGDB normalisées. Jamais lu par le navigateur directement.';

create index if not exists igdb_games_synced_at_idx on public.igdb_games (synced_at);
create index if not exists igdb_games_slug_idx on public.igdb_games (slug);

-- ---------------------------------------------------------------------------
-- 3. Association produit ↔ jeu
--
-- On garde la trace de COMMENT l'association a été faite : une correspondance
-- validée à la main ne doit jamais être écrasée par une resynchronisation
-- automatique moins sûre.
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'igdb_match_source') then
    create type public.igdb_match_source as enum ('AUTO', 'MANUAL', 'BARCODE');
  end if;
end $$;

alter table public.products add column if not exists igdb_game_id bigint;
alter table public.products add column if not exists igdb_synced_at timestamptz;
alter table public.products add column if not exists igdb_match_source public.igdb_match_source;
alter table public.products add column if not exists igdb_match_confidence numeric(4, 3);

comment on column public.products.igdb_game_id is 'Fiche IGDB associée. Toujours dissociable : mettre à null suffit.';
comment on column public.products.igdb_match_source is 'AUTO = score suffisant, MANUAL = choisi par l''atelier, BARCODE = EAN reconnu par IGDB.';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_igdb_game_id_fkey') then
    alter table public.products
      add constraint products_igdb_game_id_fkey
      foreign key (igdb_game_id) references public.igdb_games (igdb_id)
      -- Vider le cache ne doit jamais supprimer un produit : l'association
      -- tombe, le produit reste, et sa fiche se resynchronise.
      on delete set null;
  end if;
end $$;

create index if not exists products_igdb_game_id_idx on public.products (igdb_game_id) where igdb_game_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Mise en avant sur l'accueil
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists hero_video_url text;
alter table public.products add column if not exists hero_video_poster_path text;

comment on column public.products.hero_video_url is
  'Vidéo promotionnelle dont nous disposons légalement. Renseignée à la main : rien n''est téléchargé depuis une plateforme tierce.';

-- ---------------------------------------------------------------------------
-- 5. RLS — même règle que products : lecture publique, écriture administrateur
-- ---------------------------------------------------------------------------
alter table public.igdb_games enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'igdb_games' and policyname = 'igdb_games: public read') then
    create policy "igdb_games: public read" on public.igdb_games
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'igdb_games' and policyname = 'igdb_games: admin write') then
    create policy "igdb_games: admin write" on public.igdb_games
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

do $$
declare n integer;
begin
  select count(*) into n from public.igdb_games;
  raise notice 'IGDB : cache prêt (% fiche(s) en base).', n;
end $$;
