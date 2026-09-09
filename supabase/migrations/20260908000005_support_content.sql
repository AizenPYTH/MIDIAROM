-- Sur Supabase (hébergé et CLI), pgcrypto et citext vivent dans le schéma
-- "extensions", hors du search_path par défaut ; sur un PostgreSQL nu ils sont
-- dans "public". Garder les deux évite un échec selon la cible.
set search_path = public, extensions;

-- =============================================================================
-- 0005 — SAV, reviews, notifications, analytics, audit logs, settings, content
-- =============================================================================

-- After-sales requests
create table public.sav_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.repair_orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  status public.sav_status not null default 'NEW',
  subject text not null,
  description text not null,
  assigned_to uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sav_requests_order_idx on public.sav_requests (order_id);
create index sav_requests_status_idx on public.sav_requests (status);
create trigger sav_requests_set_updated_at before update on public.sav_requests
  for each row execute function public.set_updated_at();

create table public.sav_messages (
  id uuid primary key default gen_random_uuid(),
  sav_request_id uuid not null references public.sav_requests (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  is_from_staff boolean not null default false,
  is_internal boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index sav_messages_request_idx on public.sav_messages (sav_request_id, created_at);

-- Customer reviews (only real, order-linked reviews)
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.repair_orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  review_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  rating int check (rating between 1 and 5),
  title text,
  body text,
  display_name text,
  status public.review_status not null default 'PENDING',
  is_featured boolean not null default false,
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_status_idx on public.reviews (status, is_featured);
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- Notification outbox (email / in-app)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete set null,
  recipient_email citext,
  order_id uuid references public.repair_orders (id) on delete cascade,
  event_type text not null,             -- ORDER_PAID, QUOTE_SENT, ...
  channel public.notification_channel not null default 'EMAIL',
  subject text,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'PENDING',
  provider_message_id text,
  error text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_order_idx on public.notifications (order_id);
create index notifications_status_idx on public.notifications (status);

-- Analytics events (first-party, privacy friendly)
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_id text,
  user_id uuid,
  order_id uuid references public.repair_orders (id) on delete set null,
  repair_id uuid references public.repairs (id) on delete set null,
  path text,
  referrer text,
  landing_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  value_cents int,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_session_idx on public.analytics_events (session_id);
create index analytics_events_created_idx on public.analytics_events (created_at desc);

-- Marketing spend, entered by admins, used for CAC computation
create table public.marketing_costs (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- google, meta…
  campaign text,
  period_start date not null,
  period_end date not null,
  amount_cents int not null check (amount_cents >= 0),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Audit log
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.user_role,
  action text not null,                 -- e.g. order.status_changed
  resource_type text not null,          -- e.g. repair_orders
  resource_id text,
  order_id uuid references public.repair_orders (id) on delete set null,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id);
create index audit_logs_order_idx on public.audit_logs (order_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- Site settings (key/value JSON, editable from the back-office)
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,   -- readable by anonymous visitors
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Editable content blocks (mini CMS)
create table public.content_blocks (
  key text primary key,                 -- homepage.hero, trust.company_story…
  title text,
  body text,                            -- markdown
  data jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general',
  question text not null,
  answer text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger faq_items_set_updated_at before update on public.faq_items
  for each row execute function public.set_updated_at();

-- SEO overrides for static routes
create table public.seo_pages (
  path text primary key,                -- "/", "/comment-ca-marche"
  title text,
  description text,
  canonical text,
  no_index boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Workshop gallery (real photos uploaded from the back-office)
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'workshop',   -- workshop | repair | before_after | team
  title text,
  description text,
  image_path text not null,             -- content-media bucket
  display_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Legal documents with versioning (CGV, privacy…), validated externally
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,                   -- cgv, confidentialite, mentions-legales
  version text not null,
  title text not null,
  body text not null,                   -- markdown
  is_current boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (slug, version)
);
create index legal_documents_current_idx on public.legal_documents (slug) where is_current;
