-- =============================================================================
-- 0009 — Vente (produits, stock, commandes boutique), reprises, fiches consoles,
--        photos jointes par le client, symptômes structurés.
--
-- Complète la plateforme de réparation avec les activités du magasin :
--   - products / stock_movements     : catalogue de vente (neuf, occasion gradée, révisé)
--   - shop_orders / items / history  : commandes boutique (retrait ou envoi), payées
--                                      via la même abstraction de paiement que les
--                                      réparations (payments.shop_order_id)
--   - trade_in_requests / events     : demandes de reprise avec offre de l'atelier
--   - console_models                 : famille, variantes, pannes fréquentes (fiches consoles)
--   - repair_orders.symptoms         : symptômes cochés par le client
--   - media_kind CUSTOMER + bucket customer-media : photos jointes à la demande
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.product_category as enum ('CONSOLE', 'GAME', 'ACCESSORY', 'PART', 'COLLECTIBLE');
create type public.product_condition as enum ('NEW', 'REFURBISHED', 'USED_A', 'USED_B', 'USED_C');
create type public.shop_order_status as enum ('PENDING', 'PAID', 'PREPARED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
create type public.shop_fulfillment as enum ('PICKUP', 'SHIPPING');
create type public.trade_in_status as enum ('NEW', 'ESTIMATED', 'ACCEPTED', 'REFUSED', 'CLOSED');
create type public.trade_in_item_type as enum ('CONSOLE', 'GAME', 'ACCESSORY', 'LOT');
create type public.trade_in_condition as enum ('LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS');

alter type public.media_kind add value if not exists 'CUSTOMER';
alter type public.payment_purpose add value if not exists 'SHOP';
alter type public.invoice_type add value if not exists 'SHOP';

-- ---------------------------------------------------------------------------
-- Catalogue de réparation : fiches consoles + symptômes client
-- ---------------------------------------------------------------------------
alter table public.console_models
  add column if not exists family text,                       -- ps5, ps4, switch, retro-cartridge…
  add column if not exists variants text[] not null default '{}',
  add column if not exists common_issues text[] not null default '{}',
  add column if not exists is_retro boolean not null default false,
  add column if not exists is_handheld boolean not null default false;
create index if not exists console_models_family_idx on public.console_models (family);

alter table public.repair_orders
  add column if not exists symptoms text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Produits & stock
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  name text not null,
  category public.product_category not null default 'CONSOLE',
  platform text not null,                         -- libellé affiché et filtré ("PS5", "Nintendo 64", "Multi")
  model_id uuid references public.console_models (id) on delete set null,  -- lien fiche console
  condition public.product_condition not null default 'NEW',
  condition_notes text,                           -- défauts / état précis (occasion)
  description text,
  specs jsonb not null default '{}'::jsonb,       -- caractéristiques {libellé: valeur}
  includes text[] not null default '{}',          -- contenu / accessoires fournis
  price_cents int not null check (price_cents >= 0),
  compare_at_price_cents int check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  cost_cents int not null default 0 check (cost_cents >= 0),
  quantity int not null default 0 check (quantity >= 0),
  low_stock_threshold int not null default 2 check (low_stock_threshold >= 0),
  weight_grams int,
  images text[] not null default '{}',            -- chemins content-media
  is_retro boolean not null default false,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_active_idx on public.products (is_active, display_order);
create index products_platform_idx on public.products (platform);
create index products_category_idx on public.products (category);
create index products_model_idx on public.products (model_id);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  delta int not null,
  reason text not null,                           -- ORDER_PAID, ORDER_CANCELLED, ADJUSTMENT, RECEIVED…
  reference_id uuid,                              -- shop_order id, trade-in id…
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Commandes boutique
-- ---------------------------------------------------------------------------
create sequence public.shop_order_number_seq start 1;

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default '',   -- C-000001 (trigger)
  tracking_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_email citext not null,
  customer_phone text,
  fulfillment public.shop_fulfillment not null default 'PICKUP',
  shipping_address jsonb,                          -- {line1,line2,postal_code,city,country_code}
  status public.shop_order_status not null default 'PENDING',
  currency char(3) not null default 'EUR',
  subtotal_cents int not null default 0 check (subtotal_cents >= 0),
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  total_cents int not null default 0 check (total_cents >= 0),
  paid_cents int not null default 0 check (paid_cents >= 0),
  vat_rate_bp int not null default 2000,
  customer_notes text,
  internal_notes text,
  carrier_name text,
  tracking_number text,
  tracking_url text,
  accepted_terms_at timestamptz,
  accepted_terms_version text,
  paid_at timestamptz,
  prepared_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shop_orders_status_idx on public.shop_orders (status);
create index shop_orders_created_idx on public.shop_orders (created_at desc);
create index shop_orders_customer_idx on public.shop_orders (customer_id);
create trigger shop_orders_set_updated_at before update on public.shop_orders
  for each row execute function public.set_updated_at();

create or replace function public.assign_shop_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'C-' || lpad(nextval('public.shop_order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger shop_orders_assign_number before insert on public.shop_orders
  for each row execute function public.assign_shop_order_number();

create table public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  sku text,
  label text not null,                            -- snapshot
  platform text,
  condition public.product_condition,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);
create index shop_order_items_order_idx on public.shop_order_items (order_id);

create table public.shop_order_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  from_status public.shop_order_status,
  to_status public.shop_order_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index shop_order_history_order_idx on public.shop_order_history (order_id, created_at);

-- Paiements & factures : une ligne peut désormais concerner un dossier de
-- réparation OU une commande boutique.
alter table public.payments alter column order_id drop not null;
alter table public.payments add column shop_order_id uuid references public.shop_orders (id) on delete restrict;
alter table public.payments add constraint payments_target_check check (order_id is not null or shop_order_id is not null);
create index payments_shop_order_idx on public.payments (shop_order_id);

alter table public.invoices alter column order_id drop not null;
alter table public.invoices add column shop_order_id uuid references public.shop_orders (id) on delete restrict;
alter table public.invoices add constraint invoices_target_check check (order_id is not null or shop_order_id is not null);
create index invoices_shop_order_idx on public.invoices (shop_order_id);

alter table public.notifications add column shop_order_id uuid references public.shop_orders (id) on delete cascade;
-- Les factures boutique (order_id null) doivent rester lisibles par leur client.
drop policy if exists "invoices: read own or staff" on public.invoices;
create policy "invoices: read own or staff" on public.invoices
  for select to authenticated using (
    public.is_staff()
    or (order_id is not null and public.owns_order(order_id))
    or (shop_order_id is not null and exists (select 1 from public.shop_orders o where o.id = shop_order_id and o.customer_id = auth.uid()))
  );

alter table public.notifications add column trade_in_id uuid;

-- ---------------------------------------------------------------------------
-- Reprises
-- ---------------------------------------------------------------------------
create sequence public.trade_in_number_seq start 1;

create table public.trade_in_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default '',  -- T-000001 (trigger)
  access_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  customer_id uuid references public.profiles (id) on delete set null,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_email citext not null,
  customer_phone text,
  item_type public.trade_in_item_type not null default 'CONSOLE',
  platform text not null,
  model_id uuid references public.console_models (id) on delete set null,
  item_title text not null,                         -- "PS3 Fat + 14 jeux"
  condition public.trade_in_condition not null default 'GOOD',
  accessories text[] not null default '{}',
  description text,
  photos text[] not null default '{}',              -- chemins bucket customer-media
  status public.trade_in_status not null default 'NEW',
  offer_cents int check (offer_cents is null or offer_cents >= 0),
  offer_note text,
  offered_at timestamptz,
  offer_expires_at timestamptz,
  decided_at timestamptz,
  decision_note text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trade_in_requests_status_idx on public.trade_in_requests (status);
create index trade_in_requests_created_idx on public.trade_in_requests (created_at desc);
create index trade_in_requests_customer_idx on public.trade_in_requests (customer_id);
create trigger trade_in_requests_set_updated_at before update on public.trade_in_requests
  for each row execute function public.set_updated_at();

create or replace function public.assign_trade_in_number()
returns trigger
language plpgsql
as $$
begin
  if new.request_number is null or new.request_number = '' then
    new.request_number := 'T-' || lpad(nextval('public.trade_in_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;
create trigger trade_in_requests_assign_number before insert on public.trade_in_requests
  for each row execute function public.assign_trade_in_number();

create table public.trade_in_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.trade_in_requests (id) on delete cascade,
  event_type text not null,                         -- CREATED, OFFER_SENT, ACCEPTED, REFUSED, NOTE, CLOSED
  title text not null,
  description text,
  is_public boolean not null default true,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index trade_in_events_request_idx on public.trade_in_events (request_id, created_at);

alter table public.notifications add constraint notifications_trade_in_fk foreign key (trade_in_id) references public.trade_in_requests (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
create policy "products: public read active" on public.products
  for select to anon, authenticated using (is_active or public.is_staff());
create policy "products: admin write" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.stock_movements enable row level security;
create policy "stock_movements: staff read" on public.stock_movements
  for select to authenticated using (public.is_staff());

alter table public.shop_orders enable row level security;
create policy "shop_orders: customer read own or staff" on public.shop_orders
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy "shop_orders: staff update" on public.shop_orders
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.shop_order_items enable row level security;
create policy "shop_order_items: read via order" on public.shop_order_items
  for select to authenticated using (
    public.is_staff() or exists (select 1 from public.shop_orders o where o.id = order_id and o.customer_id = auth.uid())
  );

alter table public.shop_order_history enable row level security;
create policy "shop_order_history: read via order" on public.shop_order_history
  for select to authenticated using (
    public.is_staff() or exists (select 1 from public.shop_orders o where o.id = order_id and o.customer_id = auth.uid())
  );

alter table public.trade_in_requests enable row level security;
create policy "trade_ins: customer read own or staff" on public.trade_in_requests
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());
create policy "trade_ins: staff update" on public.trade_in_requests
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.trade_in_events enable row level security;
create policy "trade_in_events: read via request" on public.trade_in_events
  for select to authenticated using (
    public.is_staff() or (is_public and exists (select 1 from public.trade_in_requests r where r.id = request_id and r.customer_id = auth.uid()))
  );

grant select on public.products to anon, authenticated;
grant select on public.stock_movements, public.shop_orders, public.shop_order_items, public.shop_order_history, public.trade_in_requests, public.trade_in_events to authenticated;
grant update on public.shop_orders, public.trade_in_requests to authenticated;
grant all on public.products, public.stock_movements, public.shop_orders, public.shop_order_items, public.shop_order_history, public.trade_in_requests, public.trade_in_events to service_role;
grant usage, select on sequence public.shop_order_number_seq, public.trade_in_number_seq to service_role;

-- ---------------------------------------------------------------------------
-- Storage : photos jointes par le client (demande de réparation, reprise)
-- Chemins : "drafts/<uuid>/<fichier>" avant validation (dépôt anonyme limité par
-- le bucket), puis "<order_id>/CUSTOMER/<fichier>" ou "trade-ins/<request_id>/<fichier>"
-- après déplacement côté serveur (rôle service).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-media', 'customer-media', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "storage: draft upload customer media" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'customer-media' and (storage.foldername(name))[1] = 'drafts');
create policy "storage: staff read customer media" on storage.objects
  for select to authenticated using (bucket_id = 'customer-media' and public.is_staff());
create policy "storage: staff delete customer media" on storage.objects
  for delete to authenticated using (bucket_id = 'customer-media' and public.is_staff());
create policy "storage: customer read own customer media" on storage.objects
  for select to authenticated
  using (bucket_id = 'customer-media' and public.owns_order(public.storage_order_id(name)));

-- Vue rentabilité : les commandes boutique ne sont pas des dossiers ; rien à changer.
