-- Sur Supabase (hébergé et CLI), pgcrypto et citext vivent dans le schéma
-- "extensions", hors du search_path par défaut ; sur un PostgreSQL nu ils sont
-- dans "public". Garder les deux évite un échec selon la cible.
set search_path = public, extensions;

-- =============================================================================
-- 0001 — Foundation: extensions, enums, helpers, profiles, addresses, workshops
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('CUSTOMER', 'TECHNICIAN', 'ADMIN', 'SUPER_ADMIN');

create type public.order_status as enum (
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'AWAITING_SHIPMENT',
  'IN_TRANSIT_TO_WORKSHOP',
  'RECEIVED',
  'RECEPTION_CHECK',
  'DIAGNOSIS',
  'WAITING_CUSTOMER_APPROVAL',
  'APPROVED',
  'REPAIRING',
  'QUALITY_CONTROL',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUSED_QUOTE',
  'UNREPAIRABLE',
  'RETURN_REQUIRED',
  'SAV',
  'DISPUTED'
);

create type public.order_item_type as enum (
  'REPAIR', 'OPTION', 'PACK', 'SHIPPING', 'DIAGNOSTIC_FEE', 'QUOTE_ITEM', 'ADJUSTMENT'
);
create type public.order_item_source as enum ('INITIAL', 'QUOTE', 'ADMIN');

create type public.payment_status as enum (
  'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'
);
create type public.payment_purpose as enum ('INITIAL', 'QUOTE', 'OTHER');

create type public.invoice_type as enum ('INITIAL', 'SUPPLEMENTARY', 'CREDIT_NOTE');
create type public.invoice_status as enum ('DRAFT', 'ISSUED', 'PAID', 'VOID');

create type public.quote_status as enum ('DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED', 'CANCELLED');
create type public.quote_decision as enum ('ACCEPTED', 'REFUSED');

create type public.diagnostic_outcome as enum (
  'REPAIRABLE', 'UNREPAIRABLE', 'NOT_ECONOMICAL', 'NO_FAULT_FOUND', 'FURTHER_DIAGNOSIS_NEEDED'
);
create type public.severity_level as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

create type public.media_kind as enum (
  'RECEPTION', 'DIAGNOSTIC', 'REPAIR', 'SHIPPING', 'FINAL', 'DOCUMENT', 'SAV', 'QUOTE'
);

create type public.shipment_direction as enum ('TO_WORKSHOP', 'TO_CUSTOMER');
create type public.shipment_status as enum (
  'PENDING', 'LABEL_CREATED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'CANCELLED'
);

create type public.test_result_status as enum ('PENDING', 'PASS', 'FAIL', 'NA');
create type public.sav_status as enum ('NEW', 'IN_ANALYSIS', 'ANSWERED', 'RETURN_REQUESTED', 'CLOSED');
create type public.review_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type public.notification_status as enum ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
create type public.notification_channel as enum ('EMAIL', 'IN_APP');
create type public.compatibility_mode as enum ('INCLUDE', 'EXCLUDE');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'CUSTOMER',
  email citext not null,
  first_name text,
  last_name text,
  phone text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (email);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile e-mail in sync when the auth e-mail changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so RLS policies can call them cheaply)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('TECHNICIAN', 'ADMIN', 'SUPER_ADMIN') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('ADMIN', 'SUPER_ADMIN') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'SUPER_ADMIN' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Prevent customers from escalating their own role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the service role / SQL sessions: those are trusted
  -- (server code checks permissions before using the service role).
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only administrators can change roles' using errcode = '42501';
  end if;
  -- Only a super admin can grant / revoke SUPER_ADMIN.
  if (new.role = 'SUPER_ADMIN' or old.role = 'SUPER_ADMIN')
     and new.role is distinct from old.role
     and not public.is_super_admin() then
    raise exception 'Only super administrators can manage super administrators' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Customer addresses
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  first_name text not null,
  last_name text not null,
  company text,
  line1 text not null,
  line2 text,
  postal_code text not null,
  city text not null,
  country_code char(2) not null default 'FR',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_profile_idx on public.addresses (profile_id);

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workshops & technicians (multi-workshop ready)
-- ---------------------------------------------------------------------------
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code char(2) not null default 'FR',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workshops_set_updated_at
  before update on public.workshops
  for each row execute function public.set_updated_at();

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  workshop_id uuid references public.workshops (id) on delete set null,
  display_name text not null,
  specialties text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger technicians_set_updated_at
  before update on public.technicians
  for each row execute function public.set_updated_at();
