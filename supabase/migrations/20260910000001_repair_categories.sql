-- Sur Supabase (hébergé et CLI), pgcrypto et citext vivent dans le schéma
-- "extensions", hors du search_path par défaut ; sur un PostgreSQL nu ils sont
-- dans "public". Garder les deux évite un échec selon la cible.
set search_path = public, extensions;

-- =============================================================================
-- 0010 — Catégories de réparation
--
-- Le catalogue de réparation du client est organisé en trois niveaux :
--   modèle de console → catégorie (« Image & HDMI », « Charge & USB-C »…) → panne.
-- Les deux premiers niveaux existaient déjà (console_models, repairs) ; il
-- manquait la catégorie, qui regroupe les pannes d'un même modèle.
--
-- Ajout purement additif : aucune colonne existante n'est modifiée ni supprimée.
-- =============================================================================

create table public.repair_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index repair_categories_order_idx on public.repair_categories (display_order);
create trigger repair_categories_set_updated_at before update on public.repair_categories
  for each row execute function public.set_updated_at();

-- Catégorie d'une prestation, et tarif encore à configurer.
alter table public.repairs
  add column category_id uuid references public.repair_categories (id) on delete set null,
  -- Le catalogue fourni par le client ne comporte aucun prix : les prestations
  -- importées sont marquées « tarif à configurer » et présentées « sur devis »
  -- côté client tant qu'un prix n'a pas été saisi dans le back-office.
  add column price_is_provisional boolean not null default false;

create index repairs_model_category_idx on public.repairs (model_id, category_id, display_order);

alter table public.repair_categories enable row level security;
create policy "repair_categories: public read active" on public.repair_categories
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "repair_categories: admin write" on public.repair_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.repair_categories to anon, authenticated;
grant all on public.repair_categories to service_role;
