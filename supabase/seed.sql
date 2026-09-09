-- =============================================================================
-- DEVELOPMENT SEED — example catalogue, settings and test accounts.
-- Prices, texts and accounts below are DEVELOPMENT DATA to be replaced from
-- the back-office before going live. Nothing here is a real review, figure
-- or certification.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Dev accounts (password for all: password123)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'admin@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"first_name":"Alice","last_name":"Admin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'technicien@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"first_name":"Théo","last_name":"Technicien"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'client@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"first_name":"Camille","last_name":"Client"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'client2@example.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"first_name":"Dominique","last_name":"Deux"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

update public.profiles set role = 'SUPER_ADMIN' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'TECHNICIAN' where id = '10000000-0000-4000-8000-000000000002';

insert into public.workshops (id, name, slug, city, country_code, is_default)
values ('20000000-0000-4000-8000-000000000001', 'Atelier principal', 'atelier-principal', 'À définir', 'FR', true)
on conflict (id) do nothing;

insert into public.technicians (id, profile_id, workshop_id, display_name, specialties)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001', 'Théo', array['soudure', 'PlayStation', 'Switch'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
insert into public.brands (id, name, slug, display_order) values
  ('40000000-0000-4000-8000-000000000001', 'PlayStation', 'playstation', 1),
  ('40000000-0000-4000-8000-000000000002', 'Xbox', 'xbox', 2),
  ('40000000-0000-4000-8000-000000000003', 'Nintendo', 'nintendo', 3)
on conflict (id) do nothing;

-- Models
insert into public.console_models (id, brand_id, name, slug, short_name, release_year, display_order, seo_title, seo_description, seo_intro) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'PlayStation 5', 'ps5', 'PS5', 2020, 1,
   'Réparation PS5 à distance — envoi, diagnostic, réparation, retour', 'Faites réparer votre PS5 partout en France : port HDMI, surchauffe, alimentation, lecteur. Commande en ligne et suivi du dossier.',
   'La PlayStation 5 est une console fiable mais certains composants (port HDMI, système de refroidissement, alimentation) peuvent nécessiter une intervention en atelier. Choisissez la panne qui correspond à vos symptômes.'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'PlayStation 5 Slim', 'ps5-slim', 'PS5 Slim', 2023, 2, null, null, null),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'PlayStation 5 Pro', 'ps5-pro', 'PS5 Pro', 2024, 3, null, null, null),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 'PlayStation 4', 'ps4', 'PS4', 2013, 4, null, null, null),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 'PlayStation 4 Slim', 'ps4-slim', 'PS4 Slim', 2016, 5, null, null, null),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001', 'PlayStation 4 Pro', 'ps4-pro', 'PS4 Pro', 2016, 6, null, null, null),
  ('41000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000002', 'Xbox Series X', 'xbox-series-x', 'Series X', 2020, 1, null, null, null),
  ('41000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000002', 'Xbox Series S', 'xbox-series-s', 'Series S', 2020, 2, null, null, null),
  ('41000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000002', 'Xbox One', 'xbox-one', 'Xbox One', 2013, 3, null, null, null),
  ('41000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000003', 'Nintendo Switch', 'switch', 'Switch', 2017, 1,
   'Réparation Nintendo Switch à distance — USB-C, écran, Joy-Con', 'Réparation Nintendo Switch : port de charge USB-C, écran, stick drift. Envoyez votre console, suivez la réparation en ligne.', null),
  ('41000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000003', 'Nintendo Switch OLED', 'switch-oled', 'Switch OLED', 2021, 2, null, null, null),
  ('41000000-0000-4000-8000-000000000023', '40000000-0000-4000-8000-000000000003', 'Nintendo Switch Lite', 'switch-lite', 'Switch Lite', 2019, 3, null, null, null)
on conflict (id) do nothing;

-- Faults
insert into public.faults (id, name, slug, short_description, icon, display_order) values
  ('42000000-0000-4000-8000-000000000001', 'Port HDMI / pas d''image', 'hdmi', 'Aucun signal, image qui saute, port abîmé', 'MonitorOff', 1),
  ('42000000-0000-4000-8000-000000000002', 'Ne s''allume plus', 'ne-s-allume-plus', 'Aucune réaction, voyant clignotant, extinction immédiate', 'Power', 2),
  ('42000000-0000-4000-8000-000000000003', 'Port USB-C', 'usb-c', 'Port de charge endommagé ou desserré', 'Usb', 3),
  ('42000000-0000-4000-8000-000000000004', 'Problème de charge', 'charge', 'Ne charge plus ou charge par intermittence', 'BatteryWarning', 4),
  ('42000000-0000-4000-8000-000000000005', 'Surchauffe / bruit', 'surchauffe', 'Ventilateur bruyant, extinction en jeu, message de température', 'Thermometer', 5),
  ('42000000-0000-4000-8000-000000000006', 'Lecteur de disque', 'lecteur', 'Disque non reconnu, bruit, éjection', 'Disc', 6),
  ('42000000-0000-4000-8000-000000000007', 'Alimentation', 'alimentation', 'Coupures, bloc d''alimentation défaillant', 'Plug', 7),
  ('42000000-0000-4000-8000-000000000008', 'Stockage', 'stockage', 'Erreurs disque, SSD/HDD à remplacer', 'HardDrive', 8),
  ('42000000-0000-4000-8000-000000000009', 'Connectique', 'connectique', 'Ports USB, réseau ou casque défectueux', 'Cable', 9),
  ('42000000-0000-4000-8000-000000000010', 'Joy-Con / stick drift', 'joystick', 'Le personnage bouge tout seul', 'Gamepad2', 10),
  ('42000000-0000-4000-8000-000000000011', 'Écran', 'ecran', 'Écran cassé, lignes, tactile inopérant', 'Smartphone', 11),
  ('42000000-0000-4000-8000-000000000012', 'Autre panne', 'autre', 'Vous ne savez pas ? Nous diagnostiquons.', 'HelpCircle', 99)
on conflict (id) do nothing;

-- Option categories
insert into public.option_categories (id, name, slug, display_order) values
  ('43000000-0000-4000-8000-000000000001', 'Nettoyage', 'nettoyage', 1),
  ('43000000-0000-4000-8000-000000000002', 'Entretien & contrôle', 'entretien', 2),
  ('43000000-0000-4000-8000-000000000003', 'Manettes', 'manettes', 3),
  ('43000000-0000-4000-8000-000000000004', 'Stockage', 'stockage', 4),
  ('43000000-0000-4000-8000-000000000005', 'Service', 'service', 5)
on conflict (id) do nothing;

-- Options
insert into public.repair_options (id, category_id, name, slug, short_description, description, price_cents, estimated_cost_cents, estimated_minutes, applies_to_all, is_recommended, display_order) values
  ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'Dépoussiérage interne', 'depoussierage-interne', 'Retrait de la poussière accumulée à l''intérieur de la console.', 'Soufflage et brossage des radiateurs, du ventilateur et de la carte. Réalisé console ouverte, pendant l''intervention.', 1490, 0, 15, true, false, 1),
  ('44000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000001', 'Nettoyage complet', 'nettoyage-complet', 'Nettoyage interne approfondi de tous les éléments accessibles.', 'Démontage étendu, nettoyage du bloc de refroidissement, du ventilateur, des grilles et de la coque.', 2490, 0, 30, true, true, 2),
  ('44000000-0000-4000-8000-000000000003', '43000000-0000-4000-8000-000000000001', 'Nettoyage du ventilateur', 'nettoyage-ventilateur', 'Ventilateur démonté et nettoyé.', 'Le ventilateur est démonté, nettoyé et contrôlé (bruit, jeu d''axe).', 990, 0, 10, true, false, 3),
  ('44000000-0000-4000-8000-000000000004', '43000000-0000-4000-8000-000000000001', 'Nettoyage extérieur', 'nettoyage-exterieur', 'Coque, grilles et façades nettoyées.', 'Nettoyage des surfaces extérieures avec des produits adaptés au plastique.', 690, 0, 10, true, false, 4),
  ('44000000-0000-4000-8000-000000000005', '43000000-0000-4000-8000-000000000002', 'Entretien thermique', 'entretien-thermique', 'Remplacement de la pâte thermique et des pads.', 'Remplacement des interfaces thermiques (pâte ou pads selon le modèle) pour retrouver des températures normales.', 2990, 400, 30, true, true, 5),
  ('44000000-0000-4000-8000-000000000006', '43000000-0000-4000-8000-000000000002', 'Contrôle métal liquide PS5', 'controle-metal-liquide-ps5', 'Vérification de l''interface métal liquide de la PS5.', 'Contrôle visuel de la répartition du métal liquide et de l''état du joint. Une reprise est proposée uniquement si nécessaire.', 1490, 0, 15, false, false, 6),
  ('44000000-0000-4000-8000-000000000007', '43000000-0000-4000-8000-000000000002', 'Contrôle des connectiques', 'controle-connectiques', 'Test de tous les ports (USB, réseau, HDMI, alimentation).', 'Chaque port est testé et inspecté ; les soudures sont contrôlées à la loupe.', 1490, 0, 15, true, false, 7),
  ('44000000-0000-4000-8000-000000000008', '43000000-0000-4000-8000-000000000002', 'Inspection préventive', 'inspection-preventive', 'Inspection de la carte mère et des composants sensibles.', 'Recherche de traces d''oxydation, de composants fatigués ou de condensateurs gonflés. Un rapport est ajouté au dossier.', 1490, 0, 20, true, false, 8),
  ('44000000-0000-4000-8000-000000000009', '43000000-0000-4000-8000-000000000003', 'Nettoyage manette', 'nettoyage-manette', 'Nettoyage d''une manette envoyée avec la console.', 'Nettoyage des sticks, gâchettes et de la coque d''une manette. Envoyez la manette avec la console.', 1290, 0, 15, true, false, 9),
  ('44000000-0000-4000-8000-000000000010', '43000000-0000-4000-8000-000000000003', 'Réparation stick drift', 'reparation-stick-drift', 'Remplacement du module de stick d''une manette / Joy-Con.', 'Remplacement d''un module de stick défaillant. Une manette ou un Joy-Con par option.', 2990, 800, 30, false, false, 10),
  ('44000000-0000-4000-8000-000000000011', '43000000-0000-4000-8000-000000000004', 'Installation / remplacement SSD', 'installation-ssd', 'Installation d''un SSD que vous fournissez avec la console.', 'Installation d''un SSD M.2 compatible (fourni par vos soins), mise à jour et formatage. Le SSD n''est pas inclus.', 2490, 0, 20, false, false, 11),
  ('44000000-0000-4000-8000-000000000012', '43000000-0000-4000-8000-000000000005', 'Emballage retour renforcé', 'emballage-renforce', 'Carton double cannelure et calage sur mesure pour le retour.', 'Votre console repart dans un carton neuf renforcé avec calage mousse.', 590, 300, 5, true, false, 12),
  ('44000000-0000-4000-8000-000000000013', '43000000-0000-4000-8000-000000000005', 'Traitement prioritaire', 'traitement-prioritaire', 'Votre dossier passe en tête de file dès réception.', 'Votre console est prise en charge en priorité à l''atelier. Le délai de transport n''est pas concerné.', 1990, 0, 0, true, false, 13)
on conflict (id) do nothing;

-- Compatibility rules for non-universal options
insert into public.repair_option_compatibility (option_id, mode, brand_id, model_id) values
  -- Liquid metal check: PS5 family only
  ('44000000-0000-4000-8000-000000000006', 'INCLUDE', null, '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000006', 'INCLUDE', null, '41000000-0000-4000-8000-000000000002'),
  ('44000000-0000-4000-8000-000000000006', 'INCLUDE', null, '41000000-0000-4000-8000-000000000003'),
  -- Stick drift: Nintendo (Joy-Con) and PlayStation controllers
  ('44000000-0000-4000-8000-000000000010', 'INCLUDE', '40000000-0000-4000-8000-000000000003', null),
  ('44000000-0000-4000-8000-000000000010', 'INCLUDE', '40000000-0000-4000-8000-000000000001', null),
  -- SSD install: PS5 family
  ('44000000-0000-4000-8000-000000000011', 'INCLUDE', null, '41000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000011', 'INCLUDE', null, '41000000-0000-4000-8000-000000000002'),
  ('44000000-0000-4000-8000-000000000011', 'INCLUDE', null, '41000000-0000-4000-8000-000000000003');

-- Packs
insert into public.packs (id, name, slug, short_description, description, price_cents, is_recommended, display_order) values
  ('45000000-0000-4000-8000-000000000001', 'Pack Entretien', 'pack-entretien', 'Dépoussiérage, ventilateur et extérieur.', 'L''essentiel pour repartir sur une console propre : dépoussiérage interne, nettoyage du ventilateur et de l''extérieur.', 1990, false, 1),
  ('45000000-0000-4000-8000-000000000002', 'Pack Entretien complet', 'pack-entretien-complet', 'Nettoyage approfondi, ventilateur, thermique et extérieur.', 'Nettoyage interne approfondi, ventilateur démonté, remplacement des interfaces thermiques et nettoyage extérieur.', 3490, true, 2),
  ('45000000-0000-4000-8000-000000000003', 'Pack Premium', 'pack-premium', 'Entretien complet + contrôle thermique et connectiques + inspection.', 'Le pack le plus complet : nettoyage approfondi, entretien thermique, contrôle des connectiques, inspection préventive et nettoyage extérieur.', 4990, false, 3)
on conflict (id) do nothing;

insert into public.pack_items (pack_id, option_id, display_order) values
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000001', 1),
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000003', 2),
  ('45000000-0000-4000-8000-000000000001', '44000000-0000-4000-8000-000000000004', 3),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000002', 1),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000003', 2),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000005', 3),
  ('45000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000004', 4),
  ('45000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000002', 1),
  ('45000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000005', 2),
  ('45000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000007', 3),
  ('45000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000008', 4),
  ('45000000-0000-4000-8000-000000000003', '44000000-0000-4000-8000-000000000004', 5)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Repairs (model × fault) — DEV PRICES
-- ---------------------------------------------------------------------------
insert into public.repairs (id, model_id, fault_id, name, slug, summary, description, price_cents, estimated_cost_cents, estimated_minutes,
  lead_time_days_min, lead_time_days_max, warranty_months, warranty_scope, warranty_exclusions, included_items, important_notes,
  is_diagnostic_only, is_seo_published, seo_title, seo_description, seo_h1, seo_symptoms, seo_causes, seo_process, seo_faq, display_order) values
  ('46000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
   'Réparation port HDMI PS5', 'hdmi', 'Remplacement du connecteur HDMI de la carte mère.',
   'Le port HDMI de la PS5 est soudé directement sur la carte mère. Nous le remplaçons par un connecteur neuf avec un équipement de soudure adapté, puis nous testons l''affichage sur plusieurs résolutions.',
   5000, 600, 60, 2, 4, 6, 'Le connecteur HDMI remplacé et sa soudure.', 'Dommages ultérieurs au port (câble forcé, chute), oxydation, autre panne indépendante.',
   array['Diagnostic', 'Remplacement du connecteur HDMI', 'Remontage', 'Tests d''affichage', 'Contrôle final'],
   'Si des pistes de la carte mère sont arrachées, une reprise de pistes peut être nécessaire : elle vous est alors proposée par devis avant toute intervention.',
   false, true,
   'Réparation port HDMI PS5 — pas d''image ? Réparation à distance', 'Votre PS5 n''affiche plus d''image ? Remplacement du port HDMI en atelier, envoi depuis toute la France, suivi en ligne et garantie sur l''intervention.',
   'Réparation port HDMI PS5',
   'Aucun signal sur la TV, image qui apparaît puis disparaît, message « pas de signal », câble qui ne tient plus dans le port, broches visiblement tordues.',
   'Le connecteur HDMI de la PS5 est fragile : un câble tiré, une chute ou des branchements répétés peuvent casser ses broches ou ses soudures. Dans la plupart des cas, la carte mère elle-même n''est pas touchée.',
   'Après réception et diagnostic, nous dessoudons l''ancien connecteur, nettoyons les pastilles, soudons un connecteur neuf, puis testons l''affichage et l''audio avant remontage.',
   '[{"question":"Mes données sont-elles conservées ?","answer":"Oui, l''intervention ne touche pas au stockage de la console."},{"question":"Et si ce n''est pas le port HDMI ?","answer":"Le diagnostic le confirme avant toute intervention. Si la cause est différente, nous vous proposons la réparation adaptée par devis, que vous êtes libre d''accepter ou non."}]'::jsonb, 1),

  ('46000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000005',
   'Entretien thermique PS5 (surchauffe)', 'surchauffe', 'Nettoyage complet, remplacement des pads et contrôle du métal liquide.',
   'Une PS5 qui souffle fort ou s''éteint en jeu manque souvent de refroidissement. Nous nettoyons le bloc de refroidissement, remplaçons les pads thermiques et contrôlons l''interface métal liquide.',
   6990, 900, 75, 2, 4, 6, 'Les interfaces thermiques remplacées et le nettoyage effectué.', 'Composants défaillants non liés à la surchauffe.',
   array['Diagnostic', 'Dépoussiérage interne', 'Nettoyage du ventilateur', 'Remplacement des pads thermiques', 'Contrôle du métal liquide', 'Tests de température', 'Contrôle final'],
   null, false, true,
   'PS5 en surchauffe ou bruyante — entretien thermique en atelier', 'PS5 qui surchauffe, ventilateur bruyant ou extinction en jeu : nettoyage complet et entretien thermique en atelier, avec suivi en ligne.',
   'PS5 en surchauffe : entretien thermique',
   'Ventilateur très bruyant, console chaude au toucher, message de température, extinction en pleine partie.',
   'Poussière accumulée dans le radiateur, pads thermiques desséchés, métal liquide mal réparti.',
   'Démontage complet, nettoyage, remplacement des interfaces thermiques, contrôle du métal liquide, tests de température sous charge.',
   '[]'::jsonb, 2),

  ('46000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000007',
   'Réparation alimentation PS5', 'alimentation', 'Diagnostic et remplacement du bloc d''alimentation interne.',
   'Coupures, clignotement ou absence totale de démarrage peuvent venir du bloc d''alimentation. Après diagnostic, nous le remplaçons par un bloc compatible.',
   7990, 3500, 45, 2, 4, 6, 'Le bloc d''alimentation remplacé.', 'Dommages liés à une surtension ultérieure.',
   array['Diagnostic', 'Remplacement du bloc d''alimentation', 'Remontage', 'Tests', 'Contrôle final'],
   'Si le diagnostic révèle une panne de carte mère plutôt que d''alimentation, un devis vous est proposé avant toute intervention.',
   false, true, 'Réparation alimentation PS5 — console qui ne s''allume plus', 'PS5 qui ne s''allume plus ou s''éteint seule : diagnostic et remplacement de l''alimentation en atelier, envoi depuis toute la France.',
   'Réparation alimentation PS5', 'Aucune réaction au bouton, voyant qui clignote puis s''éteint, coupures aléatoires.',
   'Bloc d''alimentation fatigué, surtension, composant défaillant.', 'Diagnostic sur banc, remplacement du bloc, tests de stabilité.', '[]'::jsonb, 3),

  ('46000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002',
   'Diagnostic PS5 (ne s''allume plus)', 'ne-s-allume-plus', 'Diagnostic complet pour identifier la cause.',
   'Une console qui ne s''allume plus peut avoir plusieurs causes (alimentation, carte mère, bouton). Nous réalisons un diagnostic complet et vous proposons la réparation adaptée par devis.',
   2900, 0, 45, 1, 3, 0, null, null,
   array['Diagnostic complet', 'Rapport avec photos', 'Devis de réparation'],
   'Le montant du diagnostic est déduit de la réparation si vous acceptez le devis (règle configurable).',
   true, true, 'PS5 ne s''allume plus — diagnostic en atelier', 'Votre PS5 ne s''allume plus ? Diagnostic complet en atelier puis devis de réparation, sans engagement.',
   'PS5 qui ne s''allume plus', 'Aucun voyant, bip puis extinction, clignotement bleu ou blanc.', 'Alimentation, carte mère, bouton ou connectique interne.',
   'Diagnostic complet, rapport photo, proposition de réparation par devis.', '[]'::jsonb, 4),

  ('46000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000006',
   'Réparation lecteur PS5', 'lecteur', 'Lecteur Blu-ray remplacé ou réparé.',
   'Disque non reconnu, bruit, éjection impossible : nous diagnostiquons le lecteur et le réparons ou le remplaçons en conservant l''appairage avec la carte mère.',
   6900, 2500, 60, 2, 5, 6, 'Le lecteur réparé ou remplacé.', 'Disques rayés ou lecteur endommagé par un corps étranger ultérieur.',
   array['Diagnostic', 'Réparation ou remplacement du lecteur', 'Remontage', 'Tests de lecture', 'Contrôle final'],
   null, false, true, 'Réparation lecteur PS5 — disque non reconnu', 'Le lecteur de votre PS5 ne lit plus les disques ? Réparation en atelier avec conservation de l''appairage.',
   'Réparation lecteur PS5', 'Disque non reconnu, bruit de moteur, éjection impossible.', 'Lentille, moteur ou carte du lecteur.', 'Diagnostic, réparation ou remplacement, tests de lecture.', '[]'::jsonb, 5),

  ('46000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000012',
   'Diagnostic PS5', 'autre', 'Vous ne savez pas d''où vient la panne ? Nous diagnostiquons.',
   'Décrivez vos symptômes lors de la commande. Nous réalisons un diagnostic complet et vous proposons la réparation adaptée par devis.',
   2900, 0, 45, 1, 3, 0, null, null, array['Diagnostic complet', 'Rapport avec photos', 'Devis de réparation'],
   'Le montant du diagnostic est déduit de la réparation si vous acceptez le devis (règle configurable).',
   true, false, null, null, null, null, null, null, '[]'::jsonb, 99),

  ('46000000-0000-4000-8000-000000000007', '41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001',
   'Réparation port HDMI PS5 Slim', 'hdmi', 'Remplacement du connecteur HDMI de la carte mère.',
   'Remplacement du connecteur HDMI par un connecteur neuf, puis tests d''affichage.', 5000, 600, 60, 2, 4, 6,
   'Le connecteur HDMI remplacé et sa soudure.', 'Dommages ultérieurs au port, oxydation, autre panne indépendante.',
   array['Diagnostic', 'Remplacement du connecteur HDMI', 'Remontage', 'Tests d''affichage', 'Contrôle final'], null, false, true,
   'Réparation port HDMI PS5 Slim', 'PS5 Slim sans image : remplacement du port HDMI en atelier, envoi depuis toute la France.',
   'Réparation port HDMI PS5 Slim', 'Aucun signal, image instable, port abîmé.', 'Connecteur cassé ou dessoudé.', 'Dessoudage, pose d''un connecteur neuf, tests.', '[]'::jsonb, 1),

  ('46000000-0000-4000-8000-000000000008', '41000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000001',
   'Réparation port HDMI PS4', 'hdmi', 'Remplacement du connecteur HDMI.', 'Remplacement du connecteur HDMI par un connecteur neuf, puis tests d''affichage.',
   4500, 500, 50, 2, 4, 6, 'Le connecteur HDMI remplacé et sa soudure.', 'Dommages ultérieurs au port, oxydation.',
   array['Diagnostic', 'Remplacement du connecteur HDMI', 'Remontage', 'Tests d''affichage', 'Contrôle final'], null, false, true,
   'Réparation port HDMI PS4', 'PS4 sans image : remplacement du port HDMI en atelier.', 'Réparation port HDMI PS4', 'Aucun signal, image instable.', 'Connecteur cassé ou dessoudé.', 'Dessoudage, pose d''un connecteur neuf, tests.', '[]'::jsonb, 1),

  ('46000000-0000-4000-8000-000000000009', '41000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000005',
   'Entretien thermique PS4 (surchauffe)', 'surchauffe', 'Nettoyage complet et remplacement de la pâte thermique.',
   'Nettoyage du radiateur et du ventilateur, remplacement de la pâte thermique, tests de température.', 4990, 300, 60, 2, 4, 6,
   'Le nettoyage et la pâte thermique.', 'Composants défaillants non liés à la surchauffe.',
   array['Diagnostic', 'Dépoussiérage interne', 'Nettoyage du ventilateur', 'Remplacement de la pâte thermique', 'Tests de température', 'Contrôle final'], null, false, true,
   'PS4 bruyante ou en surchauffe — entretien thermique', 'PS4 qui souffle fort ou s''éteint : nettoyage complet et pâte thermique neuve en atelier.',
   'PS4 en surchauffe : entretien thermique', 'Ventilateur bruyant, extinction en jeu.', 'Poussière, pâte thermique sèche.', 'Nettoyage, pâte thermique, tests.', '[]'::jsonb, 2),

  ('46000000-0000-4000-8000-000000000010', '41000000-0000-4000-8000-000000000011', '42000000-0000-4000-8000-000000000001',
   'Réparation port HDMI Xbox Series X', 'hdmi', 'Remplacement du connecteur HDMI.', 'Remplacement du connecteur HDMI par un connecteur neuf, puis tests d''affichage.',
   5900, 700, 60, 2, 4, 6, 'Le connecteur HDMI remplacé et sa soudure.', 'Dommages ultérieurs au port, oxydation.',
   array['Diagnostic', 'Remplacement du connecteur HDMI', 'Remontage', 'Tests d''affichage', 'Contrôle final'], null, false, true,
   'Réparation port HDMI Xbox Series X', 'Xbox Series X sans image : remplacement du port HDMI en atelier, envoi depuis toute la France.',
   'Réparation port HDMI Xbox Series X', 'Aucun signal, image instable, port abîmé.', 'Connecteur cassé ou dessoudé.', 'Dessoudage, pose d''un connecteur neuf, tests.', '[]'::jsonb, 1),

  ('46000000-0000-4000-8000-000000000011', '41000000-0000-4000-8000-000000000011', '42000000-0000-4000-8000-000000000005',
   'Entretien thermique Xbox Series X', 'surchauffe', 'Nettoyage complet et remplacement de la pâte thermique.',
   'Nettoyage du radiateur et du ventilateur, remplacement de la pâte thermique, tests de température.', 5990, 300, 60, 2, 4, 6,
   'Le nettoyage et la pâte thermique.', 'Composants défaillants non liés à la surchauffe.',
   array['Diagnostic', 'Dépoussiérage interne', 'Nettoyage du ventilateur', 'Remplacement de la pâte thermique', 'Tests de température', 'Contrôle final'], null, false, true,
   'Xbox Series X en surchauffe — entretien thermique', 'Xbox Series X bruyante ou qui s''éteint : entretien thermique en atelier.',
   'Xbox Series X en surchauffe', 'Ventilateur bruyant, extinction.', 'Poussière, pâte thermique sèche.', 'Nettoyage, pâte thermique, tests.', '[]'::jsonb, 2),

  ('46000000-0000-4000-8000-000000000012', '41000000-0000-4000-8000-000000000012', '42000000-0000-4000-8000-000000000001',
   'Réparation port HDMI Xbox Series S', 'hdmi', 'Remplacement du connecteur HDMI.', 'Remplacement du connecteur HDMI par un connecteur neuf, puis tests d''affichage.',
   5500, 700, 60, 2, 4, 6, 'Le connecteur HDMI remplacé et sa soudure.', 'Dommages ultérieurs au port, oxydation.',
   array['Diagnostic', 'Remplacement du connecteur HDMI', 'Remontage', 'Tests d''affichage', 'Contrôle final'], null, false, true,
   'Réparation port HDMI Xbox Series S', 'Xbox Series S sans image : remplacement du port HDMI en atelier.', 'Réparation port HDMI Xbox Series S',
   'Aucun signal, image instable.', 'Connecteur cassé ou dessoudé.', 'Dessoudage, pose d''un connecteur neuf, tests.', '[]'::jsonb, 1),

  ('46000000-0000-4000-8000-000000000013', '41000000-0000-4000-8000-000000000021', '42000000-0000-4000-8000-000000000003',
   'Réparation port USB-C Nintendo Switch', 'usb-c', 'Remplacement du connecteur de charge USB-C.',
   'Le port USB-C de la Switch est soudé sur la carte mère. Nous le remplaçons par un connecteur neuf et testons la charge et le dock.',
   5900, 500, 60, 2, 4, 6, 'Le connecteur USB-C remplacé et sa soudure.', 'Chargeurs non conformes, dommages ultérieurs, oxydation.',
   array['Diagnostic', 'Remplacement du connecteur USB-C', 'Remontage', 'Tests de charge et dock', 'Contrôle final'],
   'Un chargeur non officiel peut avoir endommagé la puce de charge : dans ce cas, une intervention complémentaire vous est proposée par devis.',
   false, true, 'Réparation port USB-C Nintendo Switch — ne charge plus', 'Votre Switch ne charge plus ou le câble bouge dans le port ? Remplacement du connecteur USB-C en atelier, envoi depuis toute la France.',
   'Réparation port USB-C Nintendo Switch', 'La console ne charge plus, charge par intermittence, ne passe plus sur la TV via le dock, câble qui bouge dans le port.',
   'Connecteur USB-C usé ou cassé, soudures fissurées, chargeur non conforme.', 'Dessoudage du connecteur, nettoyage, pose d''un connecteur neuf, tests de charge et de sortie vidéo via le dock.', '[]'::jsonb, 1),

  ('46000000-0000-4000-8000-000000000014', '41000000-0000-4000-8000-000000000021', '42000000-0000-4000-8000-000000000011',
   'Remplacement écran Nintendo Switch', 'ecran', 'Écran LCD ou vitre tactile remplacés.',
   'Écran fissuré, lignes, tactile inopérant : nous remplaçons la dalle ou la vitre tactile selon le diagnostic.',
   6900, 2500, 60, 2, 4, 6, 'L''écran remplacé.', 'Casse ultérieure, infiltration de liquide.',
   array['Diagnostic', 'Remplacement de l''écran ou de la vitre', 'Remontage', 'Tests tactile et affichage', 'Contrôle final'], null, false, true,
   'Remplacement écran Nintendo Switch', 'Écran de Switch cassé ou tactile inopérant : remplacement en atelier avec suivi en ligne.',
   'Remplacement écran Nintendo Switch', 'Écran fissuré, lignes, taches, tactile inopérant.', 'Chute, pression, choc.', 'Diagnostic, remplacement, tests.', '[]'::jsonb, 2),

  ('46000000-0000-4000-8000-000000000015', '41000000-0000-4000-8000-000000000021', '42000000-0000-4000-8000-000000000010',
   'Réparation Joy-Con (stick drift)', 'joystick', 'Remplacement du module de stick d''un Joy-Con.',
   'Le personnage bouge tout seul ? Nous remplaçons le module de stick défaillant. Envoyez le Joy-Con concerné (ou la console avec ses Joy-Con).',
   3900, 800, 30, 1, 3, 6, 'Le module de stick remplacé.', 'Chute, liquide, usure du second Joy-Con non traité.',
   array['Diagnostic', 'Remplacement du module de stick', 'Calibration', 'Tests', 'Contrôle final'], 'Le prix correspond à un Joy-Con. Ajoutez l''option « Réparation stick drift » pour le second.',
   false, true, 'Réparation Joy-Con stick drift — Nintendo Switch', 'Joy-Con qui dérive ? Remplacement du module de stick en atelier avec calibration.',
   'Réparation Joy-Con : stick drift', 'Le curseur ou le personnage bouge seul, direction fantôme.', 'Usure du module de stick.', 'Remplacement du module, calibration, tests.', '[]'::jsonb, 3),

  ('46000000-0000-4000-8000-000000000016', '41000000-0000-4000-8000-000000000022', '42000000-0000-4000-8000-000000000003',
   'Réparation port USB-C Nintendo Switch OLED', 'usb-c', 'Remplacement du connecteur de charge USB-C.',
   'Remplacement du connecteur USB-C par un connecteur neuf, puis tests de charge et de dock.', 6500, 500, 60, 2, 4, 6,
   'Le connecteur USB-C remplacé et sa soudure.', 'Chargeurs non conformes, dommages ultérieurs, oxydation.',
   array['Diagnostic', 'Remplacement du connecteur USB-C', 'Remontage', 'Tests de charge et dock', 'Contrôle final'], null, false, true,
   'Réparation port USB-C Switch OLED', 'Switch OLED qui ne charge plus : remplacement du port USB-C en atelier.', 'Réparation port USB-C Switch OLED',
   'Ne charge plus, câble qui bouge.', 'Connecteur usé ou cassé.', 'Dessoudage, connecteur neuf, tests.', '[]'::jsonb, 1),

  ('46000000-0000-4000-8000-000000000017', '41000000-0000-4000-8000-000000000021', '42000000-0000-4000-8000-000000000012',
   'Diagnostic Nintendo Switch', 'autre', 'Vous ne savez pas d''où vient la panne ? Nous diagnostiquons.',
   'Décrivez vos symptômes lors de la commande. Nous réalisons un diagnostic complet et vous proposons la réparation adaptée par devis.',
   2900, 0, 45, 1, 3, 0, null, null, array['Diagnostic complet', 'Rapport avec photos', 'Devis de réparation'],
   'Le montant du diagnostic est déduit de la réparation si vous acceptez le devis (règle configurable).', true, false,
   null, null, null, null, null, null, '[]'::jsonb, 99)
on conflict (id) do nothing;

-- Options already included in some repairs (never sold on top)
insert into public.repair_included_options (repair_id, option_id) values
  ('46000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000001'),
  ('46000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000003'),
  ('46000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000005'),
  ('46000000-0000-4000-8000-000000000002', '44000000-0000-4000-8000-000000000006'),
  ('46000000-0000-4000-8000-000000000009', '44000000-0000-4000-8000-000000000001'),
  ('46000000-0000-4000-8000-000000000009', '44000000-0000-4000-8000-000000000003'),
  ('46000000-0000-4000-8000-000000000009', '44000000-0000-4000-8000-000000000005'),
  ('46000000-0000-4000-8000-000000000011', '44000000-0000-4000-8000-000000000001'),
  ('46000000-0000-4000-8000-000000000011', '44000000-0000-4000-8000-000000000003'),
  ('46000000-0000-4000-8000-000000000011', '44000000-0000-4000-8000-000000000005'),
  ('46000000-0000-4000-8000-000000000015', '44000000-0000-4000-8000-000000000010')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Shipping methods (DEV prices)
-- ---------------------------------------------------------------------------
insert into public.shipping_methods (id, code, name, description, price_cents, estimated_cost_cents, provider_code, includes_outbound, includes_return, insurance_cents, display_order) values
  ('47000000-0000-4000-8000-000000000001', 'label_round_trip', 'Étiquette aller + retour', 'Nous vous envoyons une étiquette prépayée pour l''aller. Le retour est inclus. Déposez le colis en point relais ou bureau de poste.', 1490, 1200, 'mock', true, true, 50000, 1),
  ('47000000-0000-4000-8000-000000000002', 'own_shipping', 'Vous expédiez, retour inclus', 'Vous expédiez la console par le transporteur de votre choix, à vos frais. Le retour est inclus.', 790, 600, 'mock', false, true, 50000, 2),
  ('47000000-0000-4000-8000-000000000003', 'drop_off', 'Dépôt et retrait à l''atelier', 'Vous déposez et récupérez la console à l''atelier, sur rendez-vous.', 0, 0, 'none', false, false, 0, 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- QC checklists
-- ---------------------------------------------------------------------------
insert into public.test_checklists (id, model_id, name) values
  ('48000000-0000-4000-8000-000000000001', null, 'Contrôle qualité générique'),
  ('48000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'Contrôle qualité PS5'),
  ('48000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000021', 'Contrôle qualité Nintendo Switch')
on conflict (id) do nothing;

insert into public.test_checklist_items (checklist_id, label, display_order) values
  ('48000000-0000-4000-8000-000000000001', 'Démarrage', 1),
  ('48000000-0000-4000-8000-000000000001', 'Affichage', 2),
  ('48000000-0000-4000-8000-000000000001', 'Ports USB', 3),
  ('48000000-0000-4000-8000-000000000001', 'Wi-Fi', 4),
  ('48000000-0000-4000-8000-000000000001', 'Bluetooth / manette', 5),
  ('48000000-0000-4000-8000-000000000001', 'Ventilation et température', 6),
  ('48000000-0000-4000-8000-000000000001', 'Fonction concernée par la réparation', 7),
  ('48000000-0000-4000-8000-000000000002', 'Démarrage', 1),
  ('48000000-0000-4000-8000-000000000002', 'Affichage HDMI (1080p / 4K)', 2),
  ('48000000-0000-4000-8000-000000000002', 'Ports USB avant et arrière', 3),
  ('48000000-0000-4000-8000-000000000002', 'Wi-Fi', 4),
  ('48000000-0000-4000-8000-000000000002', 'Bluetooth', 5),
  ('48000000-0000-4000-8000-000000000002', 'Lecteur Blu-ray', 6),
  ('48000000-0000-4000-8000-000000000002', 'Ventilation', 7),
  ('48000000-0000-4000-8000-000000000002', 'Température sous charge', 8),
  ('48000000-0000-4000-8000-000000000002', 'Test manette DualSense', 9),
  ('48000000-0000-4000-8000-000000000002', 'Fonction concernée par la réparation', 10),
  ('48000000-0000-4000-8000-000000000003', 'Démarrage', 1),
  ('48000000-0000-4000-8000-000000000003', 'Charge USB-C', 2),
  ('48000000-0000-4000-8000-000000000003', 'Sortie vidéo via dock', 3),
  ('48000000-0000-4000-8000-000000000003', 'Écran et tactile', 4),
  ('48000000-0000-4000-8000-000000000003', 'Joy-Con (rails, sticks, boutons)', 5),
  ('48000000-0000-4000-8000-000000000003', 'Wi-Fi', 6),
  ('48000000-0000-4000-8000-000000000003', 'Lecteur de cartouche', 7),
  ('48000000-0000-4000-8000-000000000003', 'Fonction concernée par la réparation', 8);

-- ---------------------------------------------------------------------------
-- Packaging instructions
-- ---------------------------------------------------------------------------
insert into public.packaging_instructions (model_id, title, body, display_order) values
  (null, 'Utilisez un carton rigide', 'Choisissez un carton en bon état, légèrement plus grand que la console (5 cm de marge sur chaque face).', 1),
  (null, 'Protégez toutes les faces', 'Enveloppez la console dans du papier bulle ou de la mousse. Aucune face ne doit toucher directement le carton.', 2),
  (null, 'Aucun mouvement dans le carton', 'Comblez les espaces vides avec du calage (papier froissé, chips de calage). Secouez doucement : rien ne doit bouger.', 3),
  (null, 'Fermez solidement', 'Utilisez du ruban adhésif large sur toutes les ouvertures, en croix.', 4),
  (null, 'N''envoyez que le nécessaire', 'Ne joignez pas les câbles, manettes ou jeux, sauf si la réparation les concerne ou si nous vous l''avons demandé.', 5),
  (null, 'Glissez votre numéro de dossier', 'Imprimez ou écrivez lisiblement votre numéro de dossier (REP-XXXXXX) sur une feuille placée dans le carton.', 6),
  ('41000000-0000-4000-8000-000000000021', 'Retirez la cartouche et la carte microSD', 'Conservez chez vous la cartouche de jeu et la carte microSD, sauf demande contraire.', 10),
  ('41000000-0000-4000-8000-000000000021', 'Joy-Con', 'Détachez les Joy-Con et ne les envoyez que si la réparation les concerne.', 11);

-- ---------------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------------
insert into public.faq_items (category, question, answer, display_order) values
  ('envoi', 'Comment envoyer ma console ?', 'Après paiement, vous recevez vos instructions d''envoi et, selon le transport choisi, une étiquette prépayée à imprimer. Emballez la console en suivant nos instructions et déposez le colis au point indiqué.', 1),
  ('envoi', 'Dois-je envoyer les câbles ?', 'Non, sauf si la panne les concerne ou si nous vous le demandons. Conservez câbles, manettes et jeux chez vous.', 2),
  ('reparation', 'Combien de temps dure la réparation ?', 'Chaque réparation affiche un délai indicatif en atelier, hors transport. Ce délai peut évoluer selon l''état de la console et la disponibilité des pièces ; vous êtes informé à chaque étape dans votre suivi.', 3),
  ('reparation', 'Que se passe-t-il si une autre panne est découverte ?', 'Nous vous envoyons un devis complémentaire avec photos et explications. Aucune intervention supplémentaire n''est réalisée sans votre accord explicite, enregistré et horodaté.', 4),
  ('reparation', 'Que se passe-t-il si la console est irréparable ?', 'Nous vous en informons avec le diagnostic. Les frais éventuels (diagnostic, retour) dépendent des conditions en vigueur, affichées avant votre commande.', 5),
  ('reparation', 'Que se passe-t-il si je refuse le devis ?', 'La console vous est retournée. Les conditions applicables (frais de diagnostic et de retour) sont indiquées dans nos CGV et rappelées sur le devis.', 6),
  ('garantie', 'Quelle garantie ?', 'Chaque réparation précise la durée et le périmètre de sa garantie : elle couvre l''intervention réalisée, pas l''ensemble de la console.', 7),
  ('donnees', 'Mes données sont-elles conservées ?', 'Nos interventions ne nécessitent généralement pas d''effacer vos données. Nous vous recommandons néanmoins de sauvegarder ce qui est important avant l''envoi.', 8),
  ('envoi', 'Qui paie le transport ?', 'Le transport est choisi et réglé lors de la commande. Le tarif dépend de la formule sélectionnée.', 9),
  ('suivi', 'Comment suivre mon dossier ?', 'Depuis votre espace client ou la page Suivi, avec votre numéro de dossier. Vous êtes également notifié par e-mail à chaque étape.', 10),
  ('commande', 'Puis-je annuler ?', 'Vous pouvez demander l''annulation tant que la console n''a pas été expédiée. Les conditions d''annulation et de rétractation figurent dans nos CGV.', 11),
  ('reparation', 'Puis-je envoyer une console déjà ouverte ?', 'Oui, indiquez-le lors de la commande. Une console déjà ouverte ou ayant subi une tentative de réparation peut nécessiter un diagnostic plus poussé.', 12),
  ('reparation', 'Que se passe-t-il en cas d''oxydation ?', 'L''oxydation est constatée au diagnostic et documentée avec photos. Une remise en état peut être proposée par devis lorsqu''elle est techniquement possible.', 13),
  ('envoi', 'Que se passe-t-il si le colis est endommagé ?', 'Nous photographions chaque colis à réception. En cas de dommage de transport, nous vous prévenons immédiatement avec les preuves nécessaires à une réclamation.', 14);

-- ---------------------------------------------------------------------------
-- Settings (public keys are readable by visitors)
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value, description, is_public) values
  ('brand', '{"name":"207 Mediarom","tagline":"Jeux vidéo, consoles, rétro et réparation à Marseille","description":"Magasin de jeux vidéo au 207 rue de Rome à Marseille depuis 1997 : vente neuf et occasion, rétrogaming, reprise et atelier de réparation de consoles.","email":"contact@example.com","phone":"04 91 48 27 48","address_line1":"207 rue de Rome","postal_code":"13006","city":"Marseille","country":"France","logo_path":null,"hours":"Lun–Sam 9h30–19h","founded_year":"1997","siret":"","legal_form":""}', 'Identité de l''entreprise', true),
  ('social', '{"instagram":"","facebook":"","tiktok":"","youtube":"","google_business":""}', 'Réseaux sociaux', true),
  ('business_rules', '{"vat_rate_bp":2000,"prices_include_vat":true,"diagnostic_fee_cents":2900,"diagnostic_fee_deducted_when_repaired":true,"refused_quote_return_fee_cents":0,"unrepairable_return_fee_cents":0,"no_fault_found_fee_cents":2900,"quote_validity_days":7,"review_request_delay_days":3,"unclaimed_console_days":90}', 'Règles métier (diagnostic, refus, TVA)', true),
  ('warranty', '{"default_months":6,"scope":"La garantie couvre l''intervention réalisée et les pièces remplacées, dans le cadre d''une utilisation normale.","exclusions":"Chocs, liquides, oxydation, ouverture par un tiers, pannes indépendantes de l''intervention."}', 'Garantie par défaut', true),
  ('shipping_info', '{"intro":"Vous choisissez votre formule de transport lors de la commande.","return_carrier_note":"Le retour est effectué en colis suivi avec assurance selon la formule choisie.","workshop_receiving_name":"Atelier Console — Service réparation","workshop_receiving_address":""}', 'Informations transport', true),
  ('trust', '{"company_story":"","years_of_experience":null,"team_intro":"","workshop_intro":"","new_management_note":""}', 'Réputation / confiance (à compléter avec des informations réelles)', true),
  ('checkout', '{"terms_version":"draft","show_terms_summary":true}', 'Paramètres du checkout', true),
  ('analytics', '{"ga_enabled":false,"ads_enabled":false}', 'Analytics', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Content blocks (mini CMS)
-- ---------------------------------------------------------------------------
insert into public.content_blocks (key, title, body, data) values
  ('homepage.hero', 'Envoyez-nous votre console.', 'Décrivez la panne, choisissez la prestation, imprimez l''étiquette. Diagnostic à réception, devis avant toute intervention complémentaire, suivi en ligne jusqu''au retour.', '{"cta_primary":"Démarrer une réparation","cta_secondary":"Grille tarifaire"}'),
  ('homepage.tracking', 'Où en est ma console ?', 'Votre numéro de dossier et votre e-mail suffisent pour voir le statut et les étapes. Photos, diagnostic, devis et messages sont dans votre espace client.', '{"cta_primary":"Suivre ma réparation","cta_secondary":"Mon espace client"}'),
  ('homepage.repair', 'Réparation par envoi', 'Vous décrivez la panne en ligne, vous recevez vos instructions d''envoi et, selon la formule, une étiquette prépayée. À réception : photos, diagnostic, devis si nécessaire, réparation. Aucune intervention sans votre accord.', '{"howto":[{"title":"Vous décrivez la panne","text":"Console, prestation, symptômes. Trois minutes."},{"title":"Étiquette prépayée","text":"Reçue par e-mail selon la formule choisie, à imprimer et coller sur le colis."},{"title":"Diagnostic à réception","text":"Photos, constat, devis complémentaire par e-mail si nécessaire, validation en un clic."},{"title":"Retour suivi","text":"Tests de contrôle qualité, garantie sur l''intervention, numéro de suivi du colis."}]}'),
  ('homepage.reassurance', null, null, '{"items":[{"icon":"Truck","title":"Réparation à distance","text":"Envoyez votre console depuis n''importe où en France."},{"icon":"Wrench","title":"Atelier spécialisé","text":"Des techniciens équipés pour la micro-soudure et les consoles récentes."},{"icon":"Eye","title":"Suivi du dossier","text":"Photos à réception, diagnostic, devis, tests : tout est tracé."},{"icon":"ShieldCheck","title":"Garantie sur l''intervention","text":"Chaque réparation précise sa durée et son périmètre de garantie."},{"icon":"Lock","title":"Paiement sécurisé","text":"Paiement en ligne sécurisé, aucune donnée bancaire stockée chez nous."}]}'),
  ('how_it_works.steps', 'Comment ça marche ?', null, '{"steps":[{"title":"Choisissez votre réparation","text":"Sélectionnez votre console, votre modèle et la panne constatée. Le prix s''affiche immédiatement."},{"title":"Commandez en ligne","text":"Ajoutez les options utiles, choisissez le transport et payez en ligne."},{"title":"Recevez vos instructions","text":"Vous recevez votre numéro de dossier, les instructions d''emballage et, selon la formule, votre étiquette."},{"title":"Envoyez votre console","text":"Déposez le colis. Le numéro de suivi est rattaché à votre dossier."},{"title":"Réception et documentation","text":"À l''arrivée, le colis et la console sont photographiés, le numéro de série et les accessoires sont notés."},{"title":"Diagnostic","text":"Un technicien confirme la panne. Si une autre intervention est nécessaire, vous recevez un devis à accepter ou refuser."},{"title":"Réparation","text":"L''intervention est réalisée et documentée dans votre dossier."},{"title":"Tests","text":"Une checklist de contrôle qualité est validée avant l''expédition."},{"title":"Retour","text":"La console repart en colis suivi. Vous recevez le numéro de suivi."}]}'),
  ('trust.intro', 'Vous savez où va votre console, et ce qui lui arrive.', 'Chaque dossier est documenté : photos à réception, numéro de série, diagnostic, devis, tests et expédition. Vous suivez chaque étape depuis votre espace client.', '{}'),
  ('repair.cta', 'Commander cette réparation', null, '{}'),
  ('upsell.title', 'Profitez de l''intervention pour entretenir votre console', 'La console est déjà ouverte : c''est le moment idéal pour un entretien. Ces options sont facultatives.', '{}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Legal documents — STRUCTURE ONLY. Content must be validated by a lawyer.
-- ---------------------------------------------------------------------------
insert into public.legal_documents (slug, version, title, body, is_current, published_at) values
  ('cgv', 'draft-1', 'Conditions générales de vente', E'> **Document de travail — à valider juridiquement avant mise en ligne.**\n\n## 1. Commande\n_À compléter._\n\n## 2. Prix\n_À compléter._\n\n## 3. Paiement\n_À compléter._\n\n## 4. Diagnostic\n_À compléter._\n\n## 5. Devis complémentaire\n_À compléter._\n\n## 6. Réparation et délais\n_À compléter._\n\n## 7. Transport et assurance\n_À compléter._\n\n## 8. Droit de rétractation\n_À compléter._\n\n## 9. Garantie et pièces\n_À compléter._\n\n## 10. Données personnelles\n_À compléter._\n\n## 11. Consoles ouvertes, modifiées ou oxydées\n_À compléter._\n\n## 12. Consoles irréparables et refus de devis\n_À compléter._\n\n## 13. Réclamation et médiation\n_À compléter._\n\n## 14. Consoles non réclamées\n_À compléter._', true, now()),
  ('confidentialite', 'draft-1', 'Politique de confidentialité', E'> **Document de travail — à valider juridiquement avant mise en ligne.**\n\n## Données collectées\n_À compléter._\n\n## Finalités\n_À compléter._\n\n## Durée de conservation\n_À compléter._\n\n## Photos et vidéos de dossiers\nLes médias liés à un dossier sont privés et accessibles uniquement au client concerné et à l''atelier.\n\n## Vos droits\nAccès, rectification, suppression : depuis votre espace client ou par e-mail.\n\n## Cookies et mesure d''audience\n_À compléter._', true, now()),
  ('mentions-legales', 'draft-1', 'Mentions légales', E'> **Document de travail — à compléter avec les informations de l''entreprise.**\n\n## Éditeur\n_À compléter._\n\n## Hébergement\n_À compléter._', true, now());

insert into public.seo_pages (path, title, description) values
  ('/', 'Réparation de consoles à distance — PS5, Xbox, Switch', 'Faites réparer votre console où que vous soyez en France : choisissez la panne, commandez en ligne, envoyez la console et suivez la réparation jusqu''au retour.'),
  ('/comment-ca-marche', 'Comment ça marche ? — Réparation de console à distance', 'De la commande au retour : les étapes de votre réparation à distance, expliquées simplement.'),
  ('/confiance', 'Pourquoi nous confier votre console ?', 'Atelier, techniciens, traçabilité, garantie et paiement sécurisé : ce qui vous permet d''envoyer votre console en confiance.'),
  ('/faq', 'Questions fréquentes', 'Envoi, délais, devis complémentaire, garantie, données : toutes les réponses sur notre service de réparation à distance.')
on conflict (path) do nothing;

