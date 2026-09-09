-- Sur Supabase (hébergé et CLI), pgcrypto et citext vivent dans le schéma
-- "extensions", hors du search_path par défaut ; sur un PostgreSQL nu ils sont
-- dans "public". Garder les deux évite un échec selon la cible.
set search_path = public, extensions;

-- =============================================================================
-- 0004 — Workshop: media, reception, diagnostics, supplementary quotes,
--        repair work, parts, QC tests, messages
-- =============================================================================

-- Unified media registry (files themselves live in private storage buckets)
create table public.order_media (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  kind public.media_kind not null,
  bucket text not null,
  path text not null,                   -- <order_id>/<kind>/<uuid>.<ext>
  mime_type text not null,
  size_bytes int not null check (size_bytes >= 0),
  original_name text,
  caption text,
  is_video boolean not null default false,
  is_visible_to_customer boolean not null default true,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index order_media_order_idx on public.order_media (order_id, kind);

-- Reception report (one per order, editable)
create table public.reception_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.repair_orders (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  package_condition text,
  exterior_condition text,
  serial_number text,
  accessories text[] not null default '{}',
  visible_damage text,
  initial_test text,
  comments text,
  tracking_number_scanned text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reception_reports_set_updated_at before update on public.reception_reports
  for each row execute function public.set_updated_at();

-- Diagnostic sheet (one per order; can be revised, history kept in audit log)
create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.repair_orders (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  declared_fault text,
  fault_reproduced boolean,
  findings text,
  severity public.severity_level,
  outcome public.diagnostic_outcome,
  recommended_work text,
  parts_needed text,
  internal_notes text,                  -- never shown to the customer
  customer_summary text,                -- shown to the customer
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger diagnostics_set_updated_at before update on public.diagnostics
  for each row execute function public.set_updated_at();

-- Supplementary quotes (D-000001)
create sequence public.quote_number_seq start 1;

create table public.supplementary_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  quote_number text not null unique default '',   -- filled by trigger (D-000001)
  status public.quote_status not null default 'DRAFT',
  title text not null,
  diagnosis_summary text,               -- "Oxydation détectée sur la carte mère."
  message text,                         -- explanation for the customer
  total_cents int not null default 0 check (total_cents >= 0),
  currency char(3) not null default 'EUR',
  requires_payment boolean not null default true,
  is_required_for_repair boolean not null default false, -- refusal blocks the repair (vs optional upsell)
  created_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz,
  expires_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  decision public.quote_decision,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supplementary_quotes_order_idx on public.supplementary_quotes (order_id);
create index supplementary_quotes_status_idx on public.supplementary_quotes (status);
create trigger supplementary_quotes_set_updated_at before update on public.supplementary_quotes
  for each row execute function public.set_updated_at();

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
as $$
begin
  if new.quote_number is null or new.quote_number = '' then
    new.quote_number := 'D-' || lpad(nextval('public.quote_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger supplementary_quotes_assign_number before insert on public.supplementary_quotes
  for each row execute function public.assign_quote_number();

create table public.supplementary_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.supplementary_quotes (id) on delete cascade,
  option_id uuid references public.repair_options (id) on delete set null,
  label text not null,
  description text,
  quantity int not null default 1 check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  estimated_cost_cents int not null default 0,
  created_at timestamptz not null default now()
);
create index supplementary_quote_items_quote_idx on public.supplementary_quote_items (quote_id);

-- Immutable trace of every customer decision
create table public.quote_decisions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.supplementary_quotes (id) on delete cascade,
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  decision public.quote_decision not null,
  decided_by uuid references public.profiles (id) on delete set null,
  amount_cents int not null,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);
create index quote_decisions_quote_idx on public.quote_decisions (quote_id);

alter table public.repair_order_items
  add constraint repair_order_items_quote_fk
  foreign key (quote_id) references public.supplementary_quotes (id) on delete set null;
alter table public.payments
  add constraint payments_quote_fk
  foreign key (quote_id) references public.supplementary_quotes (id) on delete set null;

-- Repair work log (time tracking for profitability)
create table public.repair_work_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  description text not null,
  minutes_spent int not null default 0 check (minutes_spent >= 0),
  is_visible_to_customer boolean not null default false,
  created_at timestamptz not null default now()
);
create index repair_work_logs_order_idx on public.repair_work_logs (order_id);

-- Parts used
create table public.repair_parts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  name text not null,
  reference text,
  supplier text,
  quantity int not null default 1 check (quantity > 0),
  unit_cost_cents int not null default 0 check (unit_cost_cents >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index repair_parts_order_idx on public.repair_parts (order_id);

-- Quality control run (one per order; results per checklist item)
create table public.repair_tests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.repair_orders (id) on delete cascade,
  checklist_id uuid references public.test_checklists (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger repair_tests_set_updated_at before update on public.repair_tests
  for each row execute function public.set_updated_at();

create table public.repair_test_results (
  id uuid primary key default gen_random_uuid(),
  repair_test_id uuid not null references public.repair_tests (id) on delete cascade,
  checklist_item_id uuid references public.test_checklist_items (id) on delete set null,
  label text not null,
  status public.test_result_status not null default 'PENDING',
  comment text,
  tested_by uuid references public.profiles (id) on delete set null,
  tested_at timestamptz,
  display_order int not null default 0
);
create index repair_test_results_test_idx on public.repair_test_results (repair_test_id);

-- Messages between customer and workshop (is_internal = staff-only notes)
create table public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  is_from_staff boolean not null default false,
  is_internal boolean not null default false,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index order_messages_order_idx on public.order_messages (order_id, created_at);
