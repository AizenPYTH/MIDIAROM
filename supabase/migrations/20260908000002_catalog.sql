-- =============================================================================
-- 0002 — Catalog: brands, console models, faults, repairs, options, packs,
--        compatibility rules, shipping methods, QC checklists, packaging guides
-- =============================================================================

-- Brands: PlayStation, Xbox, Nintendo…
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

-- Console models: PS5, PS5 Slim, Switch OLED…
create table public.console_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  name text not null,
  slug text not null unique,            -- used in /reparation/[model]
  short_name text,
  description text,
  image_path text,                      -- storage path in content-media
  release_year int,
  display_order int not null default 0,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  seo_intro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index console_models_brand_idx on public.console_models (brand_id);
create trigger console_models_set_updated_at before update on public.console_models
  for each row execute function public.set_updated_at();

-- Faults / symptoms: HDMI, no image, does not power on…
create table public.faults (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,            -- used in /reparation/[model]/[fault]
  short_description text,
  icon text,                            -- lucide icon name
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger faults_set_updated_at before update on public.faults
  for each row execute function public.set_updated_at();

-- Repair = the sellable service for (model, fault)
create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.console_models (id) on delete restrict,
  fault_id uuid not null references public.faults (id) on delete restrict,
  name text not null,                   -- "Réparation port HDMI PS5"
  slug text not null,
  summary text,                         -- one-liner shown in lists
  description text,                     -- rich text (markdown)
  price_cents int not null check (price_cents >= 0),
  compare_at_price_cents int check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  estimated_cost_cents int not null default 0 check (estimated_cost_cents >= 0), -- parts estimate for margin
  estimated_minutes int not null default 0 check (estimated_minutes >= 0),
  lead_time_days_min int,
  lead_time_days_max int,
  warranty_months int not null default 0,
  warranty_scope text,                  -- what the warranty covers
  warranty_exclusions text,
  included_items text[] not null default '{}', -- "Diagnostic", "Remontage", "Tests"…
  important_notes text,                 -- caveats shown before order
  is_diagnostic_only boolean not null default false, -- e.g. "Autre panne" -> diagnostic
  is_active boolean not null default true,
  is_seo_published boolean not null default false,  -- generates /reparation/[model]/[fault]
  -- SEO content
  seo_title text,
  seo_description text,
  seo_h1 text,
  seo_symptoms text,
  seo_causes text,
  seo_process text,
  seo_faq jsonb not null default '[]'::jsonb,       -- [{question, answer}]
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, fault_id),
  unique (model_id, slug)
);
create index repairs_model_idx on public.repairs (model_id);
create index repairs_fault_idx on public.repairs (fault_id);
create index repairs_active_seo_idx on public.repairs (is_active, is_seo_published);
create trigger repairs_set_updated_at before update on public.repairs
  for each row execute function public.set_updated_at();

-- Option categories (cleaning, maintenance, controller, storage…)
create table public.option_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_order int not null default 0
);

-- Repair options / add-ons
create table public.repair_options (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.option_categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  price_cents int not null check (price_cents >= 0),
  estimated_cost_cents int not null default 0 check (estimated_cost_cents >= 0),
  estimated_minutes int not null default 0,
  vat_rate_bp int,                      -- null = site default
  applies_to_all boolean not null default false, -- compatible everywhere unless excluded
  is_recommended boolean not null default false, -- shown first in upsell
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger repair_options_set_updated_at before update on public.repair_options
  for each row execute function public.set_updated_at();

-- Compatibility rules. A rule matches when every non-null column matches.
-- An option is available for a repair when:
--   it is not already included in the repair
--   AND (applies_to_all OR at least one INCLUDE rule matches)
--   AND no EXCLUDE rule matches.
create table public.repair_option_compatibility (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.repair_options (id) on delete cascade,
  mode public.compatibility_mode not null default 'INCLUDE',
  brand_id uuid references public.brands (id) on delete cascade,
  model_id uuid references public.console_models (id) on delete cascade,
  fault_id uuid references public.faults (id) on delete cascade,
  repair_id uuid references public.repairs (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (brand_id is not null or model_id is not null or fault_id is not null or repair_id is not null)
);
create index roc_option_idx on public.repair_option_compatibility (option_id);
create index roc_model_idx on public.repair_option_compatibility (model_id);
create index roc_repair_idx on public.repair_option_compatibility (repair_id);

-- Options already included in a repair (never sold on top of it)
create table public.repair_included_options (
  repair_id uuid not null references public.repairs (id) on delete cascade,
  option_id uuid not null references public.repair_options (id) on delete cascade,
  primary key (repair_id, option_id)
);

-- Packs (bundles of options with a bundle price)
create table public.packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  price_cents int not null check (price_cents >= 0),
  is_recommended boolean not null default false,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger packs_set_updated_at before update on public.packs
  for each row execute function public.set_updated_at();

create table public.pack_items (
  pack_id uuid not null references public.packs (id) on delete cascade,
  option_id uuid not null references public.repair_options (id) on delete cascade,
  display_order int not null default 0,
  primary key (pack_id, option_id)
);

-- Shipping methods offered at checkout (admin configured)
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- e.g. "colissimo_round_trip"
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  estimated_cost_cents int not null default 0,  -- what the carrier bills us (margin)
  provider_code text not null default 'mock',   -- ShippingProvider implementation key
  provider_service_code text,
  includes_outbound boolean not null default true,  -- customer -> workshop label included
  includes_return boolean not null default true,
  insurance_cents int not null default 0,       -- covered value
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipping_methods_set_updated_at before update on public.shipping_methods
  for each row execute function public.set_updated_at();

-- Quality-control checklists (per model, or generic when model_id is null)
create table public.test_checklists (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.console_models (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger test_checklists_set_updated_at before update on public.test_checklists
  for each row execute function public.set_updated_at();

create table public.test_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.test_checklists (id) on delete cascade,
  label text not null,
  description text,
  display_order int not null default 0
);
create index test_checklist_items_checklist_idx on public.test_checklist_items (checklist_id);

-- Packaging instructions (generic + per model), editable from the back-office
create table public.packaging_instructions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.console_models (id) on delete cascade, -- null = generic
  title text not null,
  body text not null,
  image_path text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger packaging_instructions_set_updated_at before update on public.packaging_instructions
  for each row execute function public.set_updated_at();
