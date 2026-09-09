-- Sur Supabase (hébergé et CLI), pgcrypto et citext vivent dans le schéma
-- "extensions", hors du search_path par défaut ; sur un PostgreSQL nu ils sont
-- dans "public". Garder les deux évite un échec selon la cible.
set search_path = public, extensions;

-- =============================================================================
-- 0003 — Orders (repair files), items, status history, events, payments,
--        invoices, shipments
-- =============================================================================

-- Human readable order numbers: REP-000001 (never generated client side)
create sequence public.repair_order_number_seq start 1;

create table public.repair_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default '',  -- filled by trigger (REP-000001)
  tracking_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  workshop_id uuid references public.workshops (id) on delete set null,
  assigned_technician_id uuid references public.technicians (id) on delete set null,
  status public.order_status not null default 'PENDING_PAYMENT',

  -- Catalog references (nullable so catalog edits never break history)
  brand_id uuid references public.brands (id) on delete set null,
  model_id uuid references public.console_models (id) on delete set null,
  fault_id uuid references public.faults (id) on delete set null,
  repair_id uuid references public.repairs (id) on delete set null,
  shipping_method_id uuid references public.shipping_methods (id) on delete set null,

  -- Snapshots at order time (immutable commercial record)
  brand_name text not null,
  model_name text not null,
  fault_name text not null,
  repair_name text not null,
  warranty_months int not null default 0,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_email citext not null,
  customer_phone text,
  shipping_address jsonb not null,        -- {line1,line2,postal_code,city,country_code}
  customer_notes text,                    -- symptoms described by the customer
  console_serial_number text,             -- declared by customer (optional)
  accepted_terms_at timestamptz,
  accepted_terms_version text,

  -- Money (integer cents, VAT included when prices_include_vat)
  currency char(3) not null default 'EUR',
  subtotal_cents int not null default 0 check (subtotal_cents >= 0),
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  total_cents int not null default 0 check (total_cents >= 0),
  paid_cents int not null default 0 check (paid_cents >= 0),
  vat_rate_bp int not null default 2000,

  -- Attribution
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  landing_page text,
  referrer text,
  analytics_session_id text,

  -- Lifecycle timestamps
  paid_at timestamptz,
  received_at timestamptz,
  diagnosed_at timestamptz,
  repaired_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  review_requested_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index repair_orders_customer_idx on public.repair_orders (customer_id);
create index repair_orders_status_idx on public.repair_orders (status);
create index repair_orders_created_idx on public.repair_orders (created_at desc);
create index repair_orders_repair_idx on public.repair_orders (repair_id);
create index repair_orders_email_idx on public.repair_orders (customer_email);
create trigger repair_orders_set_updated_at before update on public.repair_orders
  for each row execute function public.set_updated_at();

create or replace function public.assign_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'REP-' || lpad(nextval('public.repair_order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger repair_orders_assign_number
  before insert on public.repair_orders
  for each row execute function public.assign_order_number();

-- Line items (initial order + accepted quotes + admin adjustments)
create table public.repair_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  item_type public.order_item_type not null,
  source public.order_item_source not null default 'INITIAL',
  reference_id uuid,                    -- repair/option/pack/shipping method id
  quote_id uuid,                        -- set when source = QUOTE (FK added later)
  label text not null,
  description text,
  quantity int not null default 1 check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  estimated_cost_cents int not null default 0,
  created_at timestamptz not null default now()
);
create index repair_order_items_order_idx on public.repair_order_items (order_id);

-- Status history
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- Timeline events (visible to customer when is_public)
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  event_type text not null,             -- e.g. ORDER_PAID, PACKAGE_RECEIVED, QUOTE_SENT
  title text not null,
  description text,
  is_public boolean not null default true,
  actor_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- Record every status change automatically
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger repair_orders_log_status
  after insert or update of status on public.repair_orders
  for each row execute function public.log_order_status_change();

-- ---------------------------------------------------------------------------
-- Payments (Stripe or other provider). Truth comes from webhooks only.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete restrict,
  quote_id uuid,                        -- FK added in workshop migration
  purpose public.payment_purpose not null default 'INITIAL',
  provider text not null,               -- 'stripe' | 'mock'
  provider_session_id text,
  provider_payment_id text,             -- payment_intent id
  amount_cents int not null check (amount_cents >= 0),
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  currency char(3) not null default 'EUR',
  status public.payment_status not null default 'PENDING',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz
);
create index payments_order_idx on public.payments (order_id);
create unique index payments_provider_session_idx on public.payments (provider, provider_session_id)
  where provider_session_id is not null;
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Webhook idempotency
create table public.payment_provider_events (
  id text primary key,                  -- provider event id
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invoices (generation/accounting integration can be plugged later)
-- ---------------------------------------------------------------------------
create sequence public.invoice_number_seq start 1;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete set null,
  invoice_number text not null unique default '', -- filled by trigger
  invoice_type public.invoice_type not null default 'INITIAL',
  status public.invoice_status not null default 'ISSUED',
  amount_cents int not null,
  vat_cents int not null default 0,
  currency char(3) not null default 'EUR',
  lines jsonb not null default '[]'::jsonb,   -- frozen line items
  document_path text,                          -- storage path (documents bucket) when a PDF exists
  external_ref text,                           -- accounting software id
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index invoices_order_idx on public.invoices (order_id);

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := 'F-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger invoices_assign_number before insert on public.invoices
  for each row execute function public.assign_invoice_number();

-- ---------------------------------------------------------------------------
-- Shipments & tracking
-- ---------------------------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  direction public.shipment_direction not null,
  provider_code text not null,
  service_code text,
  carrier_name text,
  tracking_number text,
  tracking_url text,
  label_path text,                      -- storage path (shipping-media bucket)
  provider_shipment_id text,
  status public.shipment_status not null default 'PENDING',
  weight_grams int,
  length_cm int,
  width_cm int,
  height_cm int,
  declared_value_cents int,
  is_insured boolean not null default false,
  cost_cents int not null default 0,
  from_address jsonb,
  to_address jsonb,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);
create index shipments_tracking_idx on public.shipments (tracking_number);
create trigger shipments_set_updated_at before update on public.shipments
  for each row execute function public.set_updated_at();

create table public.shipping_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status public.shipment_status not null,
  description text,
  location text,
  occurred_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index shipping_events_shipment_idx on public.shipping_events (shipment_id, occurred_at);
