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

-- ---------------------------------------------------------------------------
-- Produits de démonstration (DÉVELOPPEMENT UNIQUEMENT)
--
-- Ces 51 produits ont servi à bâtir et à tester la boutique. Ils ne
-- correspondent à AUCUN stock réel de 207 Mediarom : ils ont été retirés du
-- catalogue de production (supabase/catalog.sql) à la demande du client, qui
-- saisira son stock lui-même depuis Stock → Nouveau produit.
--
-- Ils restent ici pour que la boutique reste testable en local : filtres,
-- fiche produit, panier, rupture, commande, décrément du stock. En production,
-- la boutique affiche simplement son état vide tant qu'aucun produit n'a été
-- créé, et c'est le comportement attendu.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Produits — jeux, accessoires, pièces et collectors (valeurs de départ)
-- ---------------------------------------------------------------------------
insert into public.products (sku, slug, name, category, platform, model_id, condition, condition_notes, description, specs, includes, price_cents, compare_at_price_cents, cost_cents, quantity, low_stock_threshold, is_retro, is_featured, display_order) values
  ('CON-PS4S-U01', 'console-ps4-slim-500-occasion', 'Console PS4 Slim 500 Go', 'CONSOLE', 'PS4', (select id from public.console_models where slug = 'ps4-slim'), 'USED_B', 'Rayures légères sur le capot, lecteur et ports testés.', 'PS4 Slim d''occasion révisée en atelier, nettoyée et pâte thermique remplacée.', '{"Stockage":"500 Go","Couleur":"Noir"}', '{"Console","Manette DualShock 4","Câbles"}', 15900, 17900, 9000, 3, 1, false, false, 3),
  ('CON-SW-U01', 'console-switch-oled-occasion', 'Console Switch OLED', 'CONSOLE', 'Switch', (select id from public.console_models where slug = 'switch-oled'), 'USED_A', 'Comme neuve, protection d''écran posée.', 'Nintendo Switch OLED d''occasion, Joy-Con testés (aucune dérive).', '{"Stockage":"64 Go","Écran":"OLED 7 pouces"}', '{"Console","Joy-Con","Dock","Câbles"}', 26900, 29900, 19000, 2, 1, false, true, 7),
  ('CON-XSX-001', 'console-xbox-series-x', 'Console Xbox Series X', 'CONSOLE', 'Xbox Series X', (select id from public.console_models where slug = 'xbox-series-x'), 'NEW', null, 'Xbox Series X 1 To avec manette sans fil.', '{"Stockage":"1 To SSD","Lecteur":"Blu-ray 4K"}', '{"Console","Manette","Câble HDMI"}', 49900, null, 43000, 3, 2, false, false, 8),
  ('GAM-SW-001', 'jeu-switch-mario-kart-8-deluxe', 'Mario Kart 8 Deluxe — Switch', 'GAME', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Jeu Switch neuf.', '{"Genre":"Course","PEGI":"3"}', '{"Boîte","Cartouche"}', 4990, null, 3800, 5, 2, false, false, 12),
  ('GAM-XSX-U01', 'jeu-xbox-forza-horizon-5', 'Forza Horizon 5 — Xbox Series', 'GAME', 'Xbox Series X', (select id from public.console_models where slug = 'xbox-series-x'), 'USED_A', 'Comme neuf.', 'Jeu Xbox Series d''occasion.', '{"Genre":"Course","PEGI":"3"}', '{"Boîte","Disque"}', 2490, null, 1200, 2, 1, false, false, 13),
  ('ACC-SW-001', 'manette-pro-switch', 'Manette Pro sans fil — Switch', 'ACCESSORY', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Manette Nintendo Switch Pro officielle.', '{"Connexion":"Bluetooth","Autonomie":"40 h"}', '{"Manette","Câble USB-C"}', 5900, null, 4200, 12, 3, false, false, 17),
  ('ACC-XSX-001', 'manette-xbox-officielle-noire', 'Manette officielle noire — Xbox', 'ACCESSORY', 'Xbox Series X', (select id from public.console_models where slug = 'xbox-series-x'), 'NEW', null, 'Manette sans fil Xbox Carbon Black.', '{"Connexion":"Bluetooth / USB-C","Piles":"2 × AA"}', '{"Manette"}', 5400, null, 4000, 8, 3, false, false, 19),
  ('ACC-HDMI-001', 'cable-hdmi-2-1-2m', 'Câble HDMI 2.1 — 2 m', 'ACCESSORY', 'Multi', null, 'NEW', null, 'Câble HDMI 2.1 certifié 4K 120 Hz / 8K.', '{"Longueur":"2 m","Norme":"HDMI 2.1"}', '{"Câble"}', 1490, null, 500, 20, 5, false, false, 20),
  ('ACC-PS4-PSU', 'alimentation-ps4-slim', 'Bloc d''alimentation PS4 Slim (ADP-160CR)', 'PART', 'PS4', (select id from public.console_models where slug = 'ps4-slim'), 'NEW', null, 'Bloc d''alimentation interne compatible PS4 Slim.', '{"Référence":"ADP-160CR / N16-160P1A"}', '{"Bloc d''alimentation"}', 3900, null, 2200, 4, 2, false, false, 21),
  ('ACC-SW-CHG', 'chargeur-usb-c-switch', 'Chargeur USB-C 39 W — Switch', 'ACCESSORY', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Adaptateur secteur compatible dock Nintendo Switch.', '{"Puissance":"39 W","Connecteur":"USB-C"}', '{"Chargeur"}', 2490, null, 1200, 6, 2, false, false, 22),
  ('PRT-JC-STK', 'sticks-remplacement-joy-con', 'Sticks de remplacement Joy-Con (la paire)', 'PART', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Paire de sticks compatibles Joy-Con, pose possible en atelier.', '{"Compatibilité":"Joy-Con gauche et droit"}', '{"2 sticks","Tournevis Y"}', 1200, null, 500, 0, 2, false, false, 25),
  ('COL-FIG-001', 'figurine-collector-vitrine', 'Figurine collector — vitrine', 'COLLECTIBLE', 'Multi', null, 'NEW', null, 'Figurine d''exposition, boîte d''origine.', '{"Hauteur":"25 cm"}', '{"Figurine","Boîte"}', 3400, null, 2000, 6, 2, false, false, 27)
on conflict (sku) do nothing;

-- ---------------------------------------------------------------------------
-- Consoles en vente — catalogue initial
--
-- Une console par modèle marquant du catalogue de réparation : la même fiche
-- `console_models` sert donc à la fois la boutique (products.model_id) et le
-- parcours de réparation, sans duplication.
--
-- Prix, stocks et états sont des VALEURS DE DÉPART, à ajuster dans Stock.
-- Aucune image n'est fournie : la fiche affiche un aperçu rayé explicitement
-- identifié tant qu'aucune photo réelle n'a été téléversée depuis le
-- back-office (Stock → produit → Photos). Aucune image du web n'est reprise,
-- faute de licence vérifiable.
-- ---------------------------------------------------------------------------
insert into public.products (sku, slug, name, category, platform, model_id, condition, condition_notes, description, specs, includes, price_cents, compare_at_price_cents, cost_cents, quantity, low_stock_threshold, is_retro, is_featured, display_order) values
  ('CON-XSS-001', 'console-xbox-series-s', 'Console Xbox Series S', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'xbox-series-s'), (select id from public.console_models where slug = 'xbox-series-s'), 'NEW', null, 'Xbox Series S 512 Go, édition entièrement numérique, avec manette sans fil.', '{"Stockage":"512 Go SSD","Lecteur":"Aucun"}', '{"Console","Manette","Câble HDMI"}', 29900, null, 25500, 3, 1, false, false, 44),
  ('CON-XB1S-U01', 'console-xbox-one-s-1to', 'Console Xbox One S 1 To', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'xbox-one-s'), (select id from public.console_models where slug = 'xbox-one-s'), 'USED_B', 'Lecteur Blu-ray testé, quelques traces d''usage sur le capot.', 'Xbox One S d''occasion révisée, nettoyée, avec manette et câbles.', '{"Stockage":"1 To","Lecteur":"Blu-ray 4K"}', '{"Console","Manette","Câble HDMI","Alimentation"}', 12900, null, 6000, 2, 1, false, false, 45),
  ('CON-SW-U02', 'console-switch-2019', 'Console Switch (modèle 2019)', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'switch'), (select id from public.console_models where slug = 'switch'), 'USED_B', 'Joy-Con testés, légère dérive corrigée en atelier.', 'Nintendo Switch modèle 2019 (autonomie améliorée), révisée et testée.', '{"Stockage":"32 Go","Autonomie":"Modèle 2019"}', '{"Console","Joy-Con","Dock","Câbles"}', 19900, null, 12000, 2, 1, false, false, 48),
  ('CON-SWL-U01', 'console-switch-lite-corail', 'Console Switch Lite corail', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'switch-lite'), (select id from public.console_models where slug = 'switch-lite'), 'USED_A', 'Écran sans rayure, sticks sans dérive.', 'Switch Lite d''occasion testée, batterie en bon état.', '{"Écran":"5,5 pouces","Couleur":"Corail"}', '{"Console","Chargeur"}', 14900, null, 9000, 2, 1, false, false, 49)
on conflict (sku) do nothing;
