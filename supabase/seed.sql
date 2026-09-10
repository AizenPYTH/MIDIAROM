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
  ('CON-PS5S-001', 'console-ps5-slim-pack-manette', 'Console PS5 Slim — pack manette', 'CONSOLE', 'PS5', (select id from public.console_models where slug = 'ps5-slim'), 'NEW', null, 'PlayStation 5 Slim avec lecteur Blu-ray, une manette DualSense et le câble HDMI 2.1.', '{"Stockage":"1 To SSD","Lecteur":"Blu-ray 4K","Manette":"DualSense"}', '{"Console","Manette DualSense","Câble HDMI","Câble d''alimentation"}', 49900, null, 43000, 4, 2, false, true, 1),
  ('CON-PS5P-001', 'console-ps5-pro', 'Console PS5 Pro', 'CONSOLE', 'PS5', (select id from public.console_models where slug = 'ps5-pro'), 'NEW', null, 'PlayStation 5 Pro édition numérique, 2 To.', '{"Stockage":"2 To SSD","Lecteur":"En option"}', '{"Console","Manette DualSense","Câble HDMI"}', 79900, null, 70000, 2, 1, false, true, 2),
  ('CON-PS4S-U01', 'console-ps4-slim-500-occasion', 'Console PS4 Slim 500 Go', 'CONSOLE', 'PS4', (select id from public.console_models where slug = 'ps4-slim'), 'USED_B', 'Rayures légères sur le capot, lecteur et ports testés.', 'PS4 Slim d''occasion révisée en atelier, nettoyée et pâte thermique remplacée.', '{"Stockage":"500 Go","Couleur":"Noir"}', '{"Console","Manette DualShock 4","Câbles"}', 15900, 17900, 9000, 3, 1, false, false, 3),
  ('CON-N64-U01', 'console-n64-complete-2-manettes', 'Console N64 complète + 2 manettes', 'CONSOLE', 'Nintendo 64', (select id from public.console_models where slug = 'nintendo-64'), 'USED_A', 'Sticks de manettes remplacés, plastique non jauni.', 'Nintendo 64 testée, nettoyée, avec deux manettes et le câble vidéo.', '{"Région":"PAL","Sortie":"Composite"}', '{"Console","2 manettes","Alimentation","Câble AV"}', 14900, null, 7000, 1, 1, true, true, 4),
  ('CON-PS2S-R01', 'console-ps2-slim-recapee', 'Console PS2 Slim recapée', 'CONSOLE', 'PS2', (select id from public.console_models where slug = 'ps2'), 'REFURBISHED', 'Condensateurs et laser remplacés en atelier.', 'PS2 Slim entièrement révisée : lecteur neuf, condensateurs neufs, garantie atelier.', '{"Modèle":"SCPH-90004","Région":"PAL"}', '{"Console","Manette","Alimentation","Câble AV"}', 8900, null, 3500, 2, 1, true, false, 5),
  ('CON-GBC-R01', 'game-boy-color-coque-neuve', 'Game Boy Color — coque neuve', 'CONSOLE', 'Game Boy', (select id from public.console_models where slug = 'game-boy-color'), 'REFURBISHED', 'Coque et vitre neuves, écran d''origine.', 'Game Boy Color reconditionnée : coque neuve, boutons neufs, contacts nettoyés.', '{"Couleur":"Violet transparent"}', '{"Console"}', 11900, null, 4500, 1, 1, true, false, 6),
  ('CON-SW-U01', 'console-switch-oled-occasion', 'Console Switch OLED', 'CONSOLE', 'Switch', (select id from public.console_models where slug = 'switch-oled'), 'USED_A', 'Comme neuve, protection d''écran posée.', 'Nintendo Switch OLED d''occasion, Joy-Con testés (aucune dérive).', '{"Stockage":"64 Go","Écran":"OLED 7 pouces"}', '{"Console","Joy-Con","Dock","Câbles"}', 26900, 29900, 19000, 2, 1, false, true, 7),
  ('CON-XSX-001', 'console-xbox-series-x', 'Console Xbox Series X', 'CONSOLE', 'Xbox Series X', (select id from public.console_models where slug = 'xbox-series-x'), 'NEW', null, 'Xbox Series X 1 To avec manette sans fil.', '{"Stockage":"1 To SSD","Lecteur":"Blu-ray 4K"}', '{"Console","Manette","Câble HDMI"}', 49900, null, 43000, 3, 2, false, false, 8),
  ('CON-DC-U01', 'console-dreamcast-occasion', 'Console Dreamcast', 'CONSOLE', 'Dreamcast', (select id from public.console_models where slug = 'dreamcast'), 'USED_B', 'Lecteur GD-ROM testé, quelques traces d''usage.', 'Dreamcast PAL testée avec manette et VMU.', '{"Région":"PAL"}', '{"Console","Manette","VMU","Câbles"}', 12900, null, 6000, 1, 1, true, false, 9),
  ('GAM-PS5-001', 'jeu-ps5-astro-bot', 'Astro Bot — PS5', 'GAME', 'PS5', (select id from public.console_models where slug = 'ps5'), 'NEW', null, 'Jeu PS5 neuf sous blister.', '{"Genre":"Plateforme","PEGI":"7"}', '{"Boîte","Disque"}', 5990, null, 4500, 6, 2, false, true, 10),
  ('GAM-PS5-U02', 'jeu-ps5-god-of-war-ragnarok', 'God of War Ragnarök — PS5', 'GAME', 'PS5', (select id from public.console_models where slug = 'ps5'), 'USED_A', 'Boîte et disque impeccables.', 'Jeu PS5 d''occasion, testé.', '{"Genre":"Action","PEGI":"18"}', '{"Boîte","Disque"}', 2990, 3990, 1500, 3, 1, false, false, 11),
  ('GAM-SW-001', 'jeu-switch-mario-kart-8-deluxe', 'Mario Kart 8 Deluxe — Switch', 'GAME', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Jeu Switch neuf.', '{"Genre":"Course","PEGI":"3"}', '{"Boîte","Cartouche"}', 4990, null, 3800, 5, 2, false, false, 12),
  ('GAM-XSX-U01', 'jeu-xbox-forza-horizon-5', 'Forza Horizon 5 — Xbox Series', 'GAME', 'Xbox Series X', (select id from public.console_models where slug = 'xbox-series-x'), 'USED_A', 'Comme neuf.', 'Jeu Xbox Series d''occasion.', '{"Genre":"Course","PEGI":"3"}', '{"Boîte","Disque"}', 2490, null, 1200, 2, 1, false, false, 13),
  ('GAM-MD-L01', 'lot-5-cartouches-mega-drive', 'Lot 5 cartouches testées — Mega Drive', 'GAME', 'Mega Drive', (select id from public.console_models where slug = 'mega-drive'), 'USED_B', 'Cartouches sans boîte, contacts nettoyés.', 'Lot de cinq jeux Mega Drive testés un à un.', '{"Région":"PAL"}', '{"5 cartouches"}', 7500, null, 3000, 3, 1, true, false, 14),
  ('GAM-N64-U01', 'jeu-n64-zelda-ocarina-of-time', 'The Legend of Zelda: Ocarina of Time — N64', 'GAME', 'Nintendo 64', (select id from public.console_models where slug = 'nintendo-64'), 'USED_B', 'Cartouche seule, sauvegarde fonctionnelle.', 'Cartouche N64 PAL testée.', '{"Région":"PAL"}', '{"Cartouche"}', 4900, null, 2500, 1, 1, true, true, 15),
  ('GAM-GB-U01', 'jeu-game-boy-pokemon-rouge', 'Pokémon Rouge — Game Boy', 'GAME', 'Game Boy', (select id from public.console_models where slug = 'game-boy'), 'USED_B', 'Pile de sauvegarde remplacée en atelier.', 'Cartouche Game Boy testée, pile neuve.', '{"Région":"FR"}', '{"Cartouche"}', 3900, null, 1800, 2, 1, true, false, 16),
  ('ACC-SW-001', 'manette-pro-switch', 'Manette Pro sans fil — Switch', 'ACCESSORY', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Manette Nintendo Switch Pro officielle.', '{"Connexion":"Bluetooth","Autonomie":"40 h"}', '{"Manette","Câble USB-C"}', 5900, null, 4200, 12, 3, false, false, 17),
  ('ACC-PS5-001', 'manette-dualsense-blanche', 'Manette DualSense blanche — PS5', 'ACCESSORY', 'PS5', (select id from public.console_models where slug = 'ps5'), 'NEW', null, 'Manette DualSense officielle.', '{"Connexion":"Bluetooth / USB-C"}', '{"Manette"}', 6490, null, 5200, 8, 3, false, false, 18),
  ('ACC-XSX-001', 'manette-xbox-officielle-noire', 'Manette officielle noire — Xbox', 'ACCESSORY', 'Xbox Series X', (select id from public.console_models where slug = 'xbox-series-x'), 'NEW', null, 'Manette sans fil Xbox Carbon Black.', '{"Connexion":"Bluetooth / USB-C","Piles":"2 × AA"}', '{"Manette"}', 5400, null, 4000, 8, 3, false, false, 19),
  ('ACC-HDMI-001', 'cable-hdmi-2-1-2m', 'Câble HDMI 2.1 — 2 m', 'ACCESSORY', 'Multi', null, 'NEW', null, 'Câble HDMI 2.1 certifié 4K 120 Hz / 8K.', '{"Longueur":"2 m","Norme":"HDMI 2.1"}', '{"Câble"}', 1490, null, 500, 20, 5, false, false, 20),
  ('ACC-PS4-PSU', 'alimentation-ps4-slim', 'Bloc d''alimentation PS4 Slim (ADP-160CR)', 'PART', 'PS4', (select id from public.console_models where slug = 'ps4-slim'), 'NEW', null, 'Bloc d''alimentation interne compatible PS4 Slim.', '{"Référence":"ADP-160CR / N16-160P1A"}', '{"Bloc d''alimentation"}', 3900, null, 2200, 4, 2, false, false, 21),
  ('ACC-SW-CHG', 'chargeur-usb-c-switch', 'Chargeur USB-C 39 W — Switch', 'ACCESSORY', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Adaptateur secteur compatible dock Nintendo Switch.', '{"Puissance":"39 W","Connecteur":"USB-C"}', '{"Chargeur"}', 2490, null, 1200, 6, 2, false, false, 22),
  ('ACC-PS2-MEM', 'carte-memoire-ps2-8mo', 'Carte mémoire 8 Mo — PS2', 'ACCESSORY', 'PS2', (select id from public.console_models where slug = 'ps2'), 'USED_A', 'Testée, formatée.', 'Carte mémoire officielle 8 Mo.', '{"Capacité":"8 Mo"}', '{"Carte mémoire"}', 1290, null, 400, 5, 2, true, false, 23),
  ('ACC-N64-CTL', 'manette-n64-stick-neuf', 'Manette N64 — stick neuf', 'ACCESSORY', 'Nintendo 64', (select id from public.console_models where slug = 'nintendo-64'), 'REFURBISHED', 'Stick remplacé, boutons nettoyés.', 'Manette officielle Nintendo 64 avec stick neuf posé en atelier.', '{"Couleur":"Grise"}', '{"Manette"}', 3490, null, 1500, 3, 1, true, false, 24),
  ('PRT-JC-STK', 'sticks-remplacement-joy-con', 'Sticks de remplacement Joy-Con (la paire)', 'PART', 'Switch', (select id from public.console_models where slug = 'switch'), 'NEW', null, 'Paire de sticks compatibles Joy-Con, pose possible en atelier.', '{"Compatibilité":"Joy-Con gauche et droit"}', '{"2 sticks","Tournevis Y"}', 1200, null, 500, 0, 2, false, false, 25),
  ('PRT-PS5-HDMI', 'connecteur-hdmi-ps5', 'Connecteur HDMI PS5 (pièce)', 'PART', 'PS5', (select id from public.console_models where slug = 'ps5'), 'NEW', null, 'Connecteur HDMI d''origine pour PS5, pose en atelier recommandée.', '{"Compatibilité":"PS5 toutes révisions"}', '{"Connecteur"}', 1490, null, 600, 10, 3, false, false, 26),
  ('COL-FIG-001', 'figurine-collector-vitrine', 'Figurine collector — vitrine', 'COLLECTIBLE', 'Multi', null, 'NEW', null, 'Figurine d''exposition, boîte d''origine.', '{"Hauteur":"25 cm"}', '{"Figurine","Boîte"}', 3400, null, 2000, 6, 2, false, false, 27),
  ('GAM-PS1-U01', 'jeu-ps1-final-fantasy-vii', 'Final Fantasy VII — PS1', 'GAME', 'PS1', (select id from public.console_models where slug = 'ps1'), 'USED_C', 'Boîtier fissuré, disques rayés mais lisibles, notice absente.', 'Jeu PS1 PAL testé sur console.', '{"Région":"PAL"}', '{"Boîtier","3 disques"}', 3900, 5900, 1500, 1, 1, true, false, 28)
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
  ('CON-PS1-U01', 'console-playstation-1-manette', 'Console PlayStation (PS1) + manette', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'ps1'), (select id from public.console_models where slug = 'ps1'), 'USED_B', 'Plastique légèrement jauni, lecteur testé sur plusieurs jeux.', 'PlayStation première génération testée en atelier, avec manette et câbles.', '{"Région":"PAL","Sortie":"Composite"}', '{"Console","Manette","Alimentation","Câble AV"}', 7900, null, 3500, 2, 1, true, false, 40),
  ('CON-PS3S-U01', 'console-ps3-slim-320', 'Console PS3 Slim 320 Go', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'ps3'), (select id from public.console_models where slug = 'ps3'), 'USED_B', 'Ventilateur nettoyé, pâte thermique remplacée.', 'PS3 Slim révisée en atelier, disque dur 320 Go, une manette DualShock 3.', '{"Stockage":"320 Go","Modèle":"CECH-30xx"}', '{"Console","Manette DualShock 3","Câble HDMI","Alimentation"}', 9900, null, 4500, 2, 1, true, false, 41),
  ('CON-PSP-R01', 'console-psp-3004-revisee', 'PSP 3004 — batterie neuve', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'psp'), (select id from public.console_models where slug = 'psp'), 'REFURBISHED', 'Batterie neuve, écran sans pixel mort.', 'PSP 3004 reconditionnée : batterie neuve, coque nettoyée, carte mémoire 8 Go incluse.', '{"Écran":"4,3 pouces","Mémoire":"8 Go incluse"}', '{"Console","Chargeur","Carte mémoire 8 Go"}', 8900, null, 4000, 2, 1, true, false, 42),
  ('CON-VITA-U01', 'console-ps-vita-slim', 'Console PS Vita Slim', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'ps-vita'), (select id from public.console_models where slug = 'ps-vita'), 'USED_A', 'Écran impeccable, sticks sans dérive.', 'PS Vita Slim d''occasion testée, avec carte mémoire 16 Go.', '{"Écran":"LCD 5 pouces","Mémoire":"16 Go incluse"}', '{"Console","Chargeur","Carte mémoire 16 Go"}', 13900, null, 7000, 1, 1, true, false, 43),
  ('CON-XSS-001', 'console-xbox-series-s', 'Console Xbox Series S', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'xbox-series-s'), (select id from public.console_models where slug = 'xbox-series-s'), 'NEW', null, 'Xbox Series S 512 Go, édition entièrement numérique, avec manette sans fil.', '{"Stockage":"512 Go SSD","Lecteur":"Aucun"}', '{"Console","Manette","Câble HDMI"}', 29900, null, 25500, 3, 1, false, false, 44),
  ('CON-XB1S-U01', 'console-xbox-one-s-1to', 'Console Xbox One S 1 To', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'xbox-one-s'), (select id from public.console_models where slug = 'xbox-one-s'), 'USED_B', 'Lecteur Blu-ray testé, quelques traces d''usage sur le capot.', 'Xbox One S d''occasion révisée, nettoyée, avec manette et câbles.', '{"Stockage":"1 To","Lecteur":"Blu-ray 4K"}', '{"Console","Manette","Câble HDMI","Alimentation"}', 12900, null, 6000, 2, 1, false, false, 45),
  ('CON-X360-U01', 'console-xbox-360-slim-250', 'Console Xbox 360 Slim 250 Go', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'xbox-360'), (select id from public.console_models where slug = 'xbox-360'), 'USED_B', 'Ventilation nettoyée, pâte thermique remplacée.', 'Xbox 360 Slim testée en atelier, avec manette sans fil et câbles.', '{"Stockage":"250 Go","Modèle":"Slim"}', '{"Console","Manette","Câble HDMI","Alimentation"}', 6900, null, 3000, 2, 1, true, false, 46),
  ('CON-XBOG-U01', 'console-xbox-premiere-generation', 'Console Xbox première génération', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'xbox-originale'), (select id from public.console_models where slug = 'xbox-originale'), 'USED_C', 'Plastique marqué, horloge interne à remplacer.', 'Xbox première génération testée, vendue en l''état avec manette.', '{"Région":"PAL"}', '{"Console","Manette","Câble AV","Alimentation"}', 7900, null, 3500, 1, 1, true, false, 47),
  ('CON-SW-U02', 'console-switch-2019', 'Console Switch (modèle 2019)', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'switch'), (select id from public.console_models where slug = 'switch'), 'USED_B', 'Joy-Con testés, légère dérive corrigée en atelier.', 'Nintendo Switch modèle 2019 (autonomie améliorée), révisée et testée.', '{"Stockage":"32 Go","Autonomie":"Modèle 2019"}', '{"Console","Joy-Con","Dock","Câbles"}', 19900, null, 12000, 2, 1, false, false, 48),
  ('CON-SWL-U01', 'console-switch-lite-corail', 'Console Switch Lite corail', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'switch-lite'), (select id from public.console_models where slug = 'switch-lite'), 'USED_A', 'Écran sans rayure, sticks sans dérive.', 'Switch Lite d''occasion testée, batterie en bon état.', '{"Écran":"5,5 pouces","Couleur":"Corail"}', '{"Console","Chargeur"}', 14900, null, 9000, 2, 1, false, false, 49),
  ('CON-WII-U01', 'console-wii-wii-sports', 'Console Wii + Wii Sports', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'wii'), (select id from public.console_models where slug = 'wii'), 'USED_B', 'Lecteur testé, capteur et câbles fournis.', 'Nintendo Wii complète avec Wii Sports, une manette et le Nunchuk.', '{"Région":"PAL"}', '{"Console","Wiimote","Nunchuk","Barre de capteurs","Wii Sports"}', 5900, null, 2500, 3, 1, true, false, 50),
  ('CON-WIIU-U01', 'console-wii-u-premium-32', 'Console Wii U 32 Go Premium', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'wii-u'), (select id from public.console_models where slug = 'wii-u'), 'USED_B', 'GamePad testé, batterie d''origine.', 'Wii U Premium noire 32 Go avec GamePad, testée en atelier.', '{"Stockage":"32 Go","Pack":"Premium"}', '{"Console","GamePad","Alimentations","Câble HDMI"}', 11900, null, 5500, 1, 1, true, false, 51),
  ('CON-NGC-U01', 'console-gamecube-manette', 'Console GameCube + manette', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'gamecube'), (select id from public.console_models where slug = 'gamecube'), 'USED_B', 'Lecteur testé, plastique en bon état.', 'GameCube PAL testée avec une manette d''origine et les câbles.', '{"Région":"PAL","Couleur":"Indigo"}', '{"Console","Manette","Alimentation","Câble AV"}', 12900, null, 6000, 1, 1, true, false, 52),
  ('CON-SNES-U01', 'console-super-nintendo-2-manettes', 'Console Super Nintendo + 2 manettes', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'super-nintendo'), (select id from public.console_models where slug = 'super-nintendo'), 'USED_B', 'Boîtier légèrement jauni, connecteur nettoyé.', 'Super Nintendo PAL testée, deux manettes d''origine, câbles fournis.', '{"Région":"PAL"}', '{"Console","2 manettes","Alimentation","Câble AV"}', 11900, null, 5500, 1, 1, true, false, 53),
  ('CON-NES-U01', 'console-nes-2-manettes', 'Console NES + 2 manettes', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'nes'), (select id from public.console_models where slug = 'nes'), 'USED_C', 'Connecteur de cartouches remplacé, boîtier marqué.', 'NES testée après remplacement du connecteur 72 broches.', '{"Région":"PAL"}', '{"Console","2 manettes","Alimentation","Câble AV"}', 9900, null, 4500, 1, 1, true, false, 54),
  ('CON-GB-R01', 'console-game-boy-retroeclairee', 'Game Boy Classic — écran rétroéclairé', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'game-boy'), (select id from public.console_models where slug = 'game-boy'), 'REFURBISHED', 'Écran IPS rétroéclairé posé en atelier, coque neuve.', 'Game Boy d''origine modifiée en atelier : écran IPS, coque neuve, contacts nettoyés.', '{"Écran":"IPS rétroéclairé","Coque":"Neuve"}', '{"Console"}', 14900, null, 7000, 1, 1, true, false, 55),
  ('CON-GBA-R01', 'console-game-boy-advance-sp', 'Game Boy Advance SP', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'game-boy-advance'), (select id from public.console_models where slug = 'game-boy-advance'), 'REFURBISHED', 'Batterie neuve, charnières révisées.', 'Game Boy Advance SP reconditionnée : batterie neuve, écran nettoyé.', '{"Écran":"Rétroéclairé","Modèle":"AGS-101"}', '{"Console","Chargeur"}', 12900, null, 6000, 2, 1, true, false, 56),
  ('CON-NDS-U01', 'console-nintendo-ds-lite', 'Console Nintendo DS Lite', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'nintendo-ds'), (select id from public.console_models where slug = 'nintendo-ds'), 'USED_B', 'Charnière saine, écrans sans pixel mort.', 'Nintendo DS Lite testée, stylet et chargeur fournis.', '{"Écrans":"Doubles","Couleur":"Blanc"}', '{"Console","Chargeur","Stylet"}', 6900, null, 3000, 2, 1, true, false, 57),
  ('CON-3DS-U01', 'console-new-nintendo-3ds-xl', 'New Nintendo 3DS XL', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'nintendo-3ds'), (select id from public.console_models where slug = 'nintendo-3ds'), 'USED_A', 'Écrans impeccables, carte SD 4 Go incluse.', 'New Nintendo 3DS XL d''occasion testée, effet 3D fonctionnel.', '{"Écrans":"XL","Mémoire":"4 Go"}', '{"Console","Chargeur","Carte SD"}', 17900, null, 10000, 1, 1, true, false, 58),
  ('CON-MD-U01', 'console-mega-drive-2', 'Console Mega Drive 2 + 1 manette', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'mega-drive'), (select id from public.console_models where slug = 'mega-drive'), 'USED_B', 'Sortie vidéo testée, boîtier en bon état.', 'Mega Drive 2 PAL testée avec une manette 3 boutons.', '{"Région":"PAL"}', '{"Console","Manette","Alimentation","Câble AV"}', 8900, null, 4000, 2, 1, true, false, 59),
  ('CON-MS-U01', 'console-master-system-ii', 'Console Master System II', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'master-system'), (select id from public.console_models where slug = 'master-system'), 'USED_C', 'Jeu intégré fonctionnel, plastique jauni.', 'Master System II testée, avec manette et câbles.', '{"Région":"PAL"}', '{"Console","Manette","Alimentation","Câble AV"}', 7900, null, 3500, 1, 1, true, false, 60),
  ('CON-SAT-U01', 'console-saturn-pal', 'Console Saturn PAL', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'saturn'), (select id from public.console_models where slug = 'saturn'), 'USED_B', 'Lecteur testé, pile de sauvegarde remplacée.', 'Sega Saturn PAL révisée : pile de sauvegarde neuve, lecteur testé.', '{"Région":"PAL"}', '{"Console","Manette","Alimentation","Câble AV"}', 15900, null, 8000, 1, 1, true, false, 61),
  ('CON-GG-R01', 'console-game-gear-recapee', 'Game Gear recapée', 'CONSOLE', (select coalesce(short_name, name) from public.console_models where slug = 'game-gear'), (select id from public.console_models where slug = 'game-gear'), 'REFURBISHED', 'Condensateurs remplacés, son et écran révisés.', 'Game Gear entièrement recapée en atelier : condensateurs neufs, écran nettoyé.', '{"Écran":"Rétroéclairé d origine","Révision":"Recap complet"}', '{"Console"}', 11900, null, 5500, 1, 1, true, false, 62)
on conflict (sku) do nothing;
