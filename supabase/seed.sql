-- =============================================================================
-- SEED DE DÉVELOPPEMENT — comptes de test et rattachements de démonstration.
--
-- Le catalogue (consoles, pannes, prestations, produits, contenus) vit dans
-- supabase/catalog.sql, applicable en production. Ce fichier-ci ne doit JAMAIS
-- être appliqué sur un projet de production : il crée des comptes dont le mot
-- de passe est public.
--
-- L'ordre de chargement est déclaré dans supabase/config.toml
-- (catalog.sql puis seed.sql).
-- =============================================================================

set search_path = public, extensions;

drop table if exists seed_users;
create temp table seed_users (id uuid, email text, first_name text, last_name text);
insert into seed_users values
  ('10000000-0000-4000-8000-000000000001', 'admin@example.com', 'Alice', 'Admin'),
  ('10000000-0000-4000-8000-000000000002', 'technicien@example.com', 'Théo', 'Technicien'),
  ('10000000-0000-4000-8000-000000000003', 'client@example.com', 'Camille', 'Client'),
  ('10000000-0000-4000-8000-000000000004', 'client2@example.com', 'Dominique', 'Deux');

-- 1. Accounts that do not exist yet. The fixed id is only used when it is free:
--    an account created elsewhere keeps its own id.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated', s.email,
       crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('first_name', s.first_name, 'last_name', s.last_name), now(), now(), '', '', '', ''
  from seed_users s
 where not exists (select 1 from auth.users u where u.email = s.email or u.id = s.id);

-- 2. Development password and confirmed address, pre-existing accounts included.
--    Without this, `password123` never reaches an account created another way.
update auth.users u
   set encrypted_password = crypt('password123', gen_salt('bf')),
       email_confirmed_at = coalesce(u.email_confirmed_at, now()),
       aud = 'authenticated',
       role = 'authenticated',
       raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
       updated_at = now()
  from seed_users s
 where u.email = s.email;

-- 3. Email identity: Supabase Auth expects one row per account (password reset,
--    dashboard management). GoTrue creates it for accounts made through the app.
insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
  from auth.users u
  join seed_users s on s.email = u.email
on conflict (provider_id, provider) do nothing;

-- Roles are keyed by e-mail so they still land on an account created elsewhere.
update public.profiles set role = 'SUPER_ADMIN' where email = 'admin@example.com';
update public.profiles set role = 'TECHNICIAN' where email = 'technicien@example.com';

-- ---------------------------------------------------------------------------
-- Technicien de démonstration (rattaché au compte technicien@example.com)
-- ---------------------------------------------------------------------------
insert into public.technicians (id, profile_id, workshop_id, display_name, specialties)
select '30000000-0000-4000-8000-000000000001', p.id,
       '20000000-0000-4000-8000-000000000001', 'Théo', array['soudure', 'PlayStation', 'Switch']
  from public.profiles p
 where p.email = 'technicien@example.com'
on conflict (id) do nothing;
