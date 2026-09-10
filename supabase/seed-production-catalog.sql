-- ==========================================================================
-- DONNÉES DE PRODUCTION — CATALOGUE
--
-- Marques, les 13 modèles de console du document du client, pannes,
-- prestations de départ, options,
-- packs, transports, contrôles qualité, contenus éditoriaux et documents
-- légaux.
--
-- Aucun produit de boutique : le stock réel se saisit depuis le back-office
-- (Stock → Nouveau produit). Tant qu'il est vide, la boutique affiche son
-- état vide, prévu par le design.
--
-- FICHIER GÉNÉRÉ — ne pas modifier à la main.
--   source       : supabase/catalog.sql
--   régénération : node scripts/build-production-seeds.mjs
--
-- Ce fichier ne contient QUE des données : aucun create / alter / drop sur le
-- schéma public, aucune suppression de ligne. Les tables doivent déjà exister,
-- elles sont créées par les migrations (supabase/migrations/) — c'est la
-- différence avec supabase/migrations/20260908000002_catalog.sql, qui, lui,
-- crée les tables et échoue en 42P07 sur une base déjà migrée.
--
-- Rejouable autant de fois que nécessaire : chaque insertion est protégée. Une
-- seconde exécution ne crée pas de doublon et n'écrase pas ce qui a été modifié
-- depuis le back-office.
--
-- Deux façons de l'appliquer :
--   • Supabase → SQL Editor : coller le fichier entier puis « Run » ;
--   • en ligne de commande  : psql "$DB_URL" -f supabase/seed-production-catalog.sql
-- ==========================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Garde : le schéma doit être en place avant toute insertion.
-- ---------------------------------------------------------------------------
do $garde$
declare manquantes text;
begin
  select string_agg(t, ', ' order by t) into manquantes
    from unnest(array['brands', 'console_models', 'content_blocks', 'faq_items', 'faults', 'legal_documents', 'option_categories', 'pack_items', 'packaging_instructions', 'packs', 'products', 'repair_included_options', 'repair_option_compatibility', 'repair_options', 'repairs', 'seo_pages', 'shipping_methods', 'site_settings', 'test_checklist_items', 'test_checklists', 'workshops']) as t
   where to_regclass('public.' || t) is null;
  if manquantes is not null then
    raise exception using
      message = 'Schéma incomplet, table(s) absente(s) : ' || manquantes,
      hint = 'Appliquez d''abord les migrations (scripts/apply-migrations.sh, ou les fichiers de supabase/migrations/), puis rejouez ce fichier.';
  end if;
end
$garde$;

-- Les gardes « drop table if exists » sur les tables temporaires ci-dessous
-- émettent chacune un NOTICE au premier passage : inutile de les afficher.
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Atelier par défaut (rattachement des techniciens et des dossiers)
-- ---------------------------------------------------------------------------
insert into public.workshops (id, name, slug, city, country_code, is_default)
values ('20000000-0000-4000-8000-000000000001', 'Atelier principal', 'atelier-principal', 'À définir', 'FR', true)
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
-- Rejouable : ces lignes n'ont pas de clé naturelle (compatibilités option / modèle),
-- on ne les repose donc que si la table est vide.
do $seed$ begin
if not exists (select 1 from public.repair_option_compatibility) then
insert into public.repair_option_compatibility (option_id, mode, brand_id, model_id) values
  -- Stick drift : manettes Nintendo (Joy-Con) et PlayStation
  ('44000000-0000-4000-8000-000000000010', 'INCLUDE', '40000000-0000-4000-8000-000000000003', null),
  ('44000000-0000-4000-8000-000000000010', 'INCLUDE', '40000000-0000-4000-8000-000000000001', null);
end if;
end $seed$;

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
-- Prestations de réparation (modèle × panne) — PRIX DE DÉPART, ajustables dans le back-office
-- ---------------------------------------------------------------------------
insert into public.repairs (id, model_id, fault_id, name, slug, summary, description, price_cents, estimated_cost_cents, estimated_minutes,
  lead_time_days_min, lead_time_days_max, warranty_months, warranty_scope, warranty_exclusions, included_items, important_notes,
  is_diagnostic_only, is_seo_published, seo_title, seo_description, seo_h1, seo_symptoms, seo_causes, seo_process, seo_faq, display_order) values
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
  ('46000000-0000-4000-8000-000000000009', '44000000-0000-4000-8000-000000000001'),
  ('46000000-0000-4000-8000-000000000009', '44000000-0000-4000-8000-000000000003'),
  ('46000000-0000-4000-8000-000000000009', '44000000-0000-4000-8000-000000000005'),
  ('46000000-0000-4000-8000-000000000011', '44000000-0000-4000-8000-000000000001'),
  ('46000000-0000-4000-8000-000000000011', '44000000-0000-4000-8000-000000000003'),
  ('46000000-0000-4000-8000-000000000011', '44000000-0000-4000-8000-000000000005'),
  ('46000000-0000-4000-8000-000000000015', '44000000-0000-4000-8000-000000000010')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Modes d'envoi — prix de départ
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
  ('48000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000021', 'Contrôle qualité Nintendo Switch')
on conflict (id) do nothing;

-- Rejouable : ces lignes n'ont pas de clé naturelle (points de contrôle qualité),
-- on ne les repose donc que si la table est vide.
do $seed$ begin
if not exists (select 1 from public.test_checklist_items) then
insert into public.test_checklist_items (checklist_id, label, display_order) values
  ('48000000-0000-4000-8000-000000000001', 'Démarrage', 1),
  ('48000000-0000-4000-8000-000000000001', 'Affichage', 2),
  ('48000000-0000-4000-8000-000000000001', 'Ports USB', 3),
  ('48000000-0000-4000-8000-000000000001', 'Wi-Fi', 4),
  ('48000000-0000-4000-8000-000000000001', 'Bluetooth / manette', 5),
  ('48000000-0000-4000-8000-000000000001', 'Ventilation et température', 6),
  ('48000000-0000-4000-8000-000000000001', 'Fonction concernée par la réparation', 7),
  ('48000000-0000-4000-8000-000000000003', 'Démarrage', 1),
  ('48000000-0000-4000-8000-000000000003', 'Charge USB-C', 2),
  ('48000000-0000-4000-8000-000000000003', 'Sortie vidéo via dock', 3),
  ('48000000-0000-4000-8000-000000000003', 'Écran et tactile', 4),
  ('48000000-0000-4000-8000-000000000003', 'Joy-Con (rails, sticks, boutons)', 5),
  ('48000000-0000-4000-8000-000000000003', 'Wi-Fi', 6),
  ('48000000-0000-4000-8000-000000000003', 'Lecteur de cartouche', 7),
  ('48000000-0000-4000-8000-000000000003', 'Fonction concernée par la réparation', 8);
end if;
end $seed$;

-- ---------------------------------------------------------------------------
-- Packaging instructions
-- ---------------------------------------------------------------------------
-- Rejouable : ces lignes n'ont pas de clé naturelle (consignes d'emballage),
-- on ne les repose donc que si la table est vide.
do $seed$ begin
if not exists (select 1 from public.packaging_instructions) then
insert into public.packaging_instructions (model_id, title, body, display_order) values
  (null, 'Utilisez un carton rigide', 'Choisissez un carton en bon état, légèrement plus grand que la console (5 cm de marge sur chaque face).', 1),
  (null, 'Protégez toutes les faces', 'Enveloppez la console dans du papier bulle ou de la mousse. Aucune face ne doit toucher directement le carton.', 2),
  (null, 'Aucun mouvement dans le carton', 'Comblez les espaces vides avec du calage (papier froissé, chips de calage). Secouez doucement : rien ne doit bouger.', 3),
  (null, 'Fermez solidement', 'Utilisez du ruban adhésif large sur toutes les ouvertures, en croix.', 4),
  (null, 'N''envoyez que le nécessaire', 'Ne joignez pas les câbles, manettes ou jeux, sauf si la réparation les concerne ou si nous vous l''avons demandé.', 5),
  (null, 'Glissez votre numéro de dossier', 'Imprimez ou écrivez lisiblement votre numéro de dossier (REP-XXXXXX) sur une feuille placée dans le carton.', 6),
  ('41000000-0000-4000-8000-000000000021', 'Retirez la cartouche et la carte microSD', 'Conservez chez vous la cartouche de jeu et la carte microSD, sauf demande contraire.', 10),
  ('41000000-0000-4000-8000-000000000021', 'Joy-Con', 'Détachez les Joy-Con et ne les envoyez que si la réparation les concerne.', 11);
end if;
end $seed$;

-- ---------------------------------------------------------------------------
-- FAQ
-- ---------------------------------------------------------------------------
-- Rejouable : ces lignes n'ont pas de clé naturelle (questions fréquentes),
-- on ne les repose donc que si la table est vide.
do $seed$ begin
if not exists (select 1 from public.faq_items) then
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
end if;
end $seed$;

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
  ('mentions-legales', 'draft-1', 'Mentions légales', E'> **Document de travail — à compléter avec les informations de l''entreprise.**\n\n## Éditeur\n_À compléter._\n\n## Hébergement\n_À compléter._', true, now())
on conflict (slug, version) do nothing;

insert into public.seo_pages (path, title, description) values
  ('/', 'Réparation de consoles à distance — PS5, Xbox, Switch', 'Faites réparer votre console où que vous soyez en France : choisissez la panne, commandez en ligne, envoyez la console et suivez la réparation jusqu''au retour.'),
  ('/comment-ca-marche', 'Comment ça marche ? — Réparation de console à distance', 'De la commande au retour : les étapes de votre réparation à distance, expliquées simplement.'),
  ('/confiance', 'Pourquoi nous confier votre console ?', 'Atelier, techniciens, traçabilité, garantie et paiement sécurisé : ce qui vous permet d''envoyer votre console en confiance.'),
  ('/faq', 'Questions fréquentes', 'Envoi, délais, devis complémentaire, garantie, données : toutes les réponses sur notre service de réparation à distance.')
on conflict (path) do nothing;


-- =============================================================================
-- CATALOGUE ÉTENDU (vente + réparation)
-- Modèles, pannes et réparations générés par famille de console ; produits de
-- démonstration ; réglages boutique. Prix indicatifs à ajuster dans le back-office.
-- =============================================================================
insert into public.brands (id, name, slug, display_order) values
  ('40000000-0000-4000-8000-000000000004', 'Sega', 'sega', 4)
on conflict (id) do nothing;

drop table if exists seed_models;
create temp table seed_models (brand_slug text, name text, slug text, short_name text, year int, family text, is_retro boolean, is_handheld boolean, variants text[], common_issues text[], display_order int);
insert into seed_models values
  ('playstation', 'PlayStation 4', 'ps4', 'PS4', 2013, 'ps4', false, false, '{"Fat (CUH-1000 à 1200)"}', '{"Port HDMI","Ventilateur bruyant","Lecteur Blu-ray","Disque dur"}', 4),
  ('playstation', 'PlayStation 4 Slim', 'ps4-slim', 'PS4 Slim', 2016, 'ps4', false, false, '{"Slim (CUH-2000 à 2200)"}', '{"Port HDMI","Surchauffe","Lecteur"}', 5),
  ('playstation', 'PlayStation 4 Pro', 'ps4-pro', 'PS4 Pro', 2016, 'ps4', false, false, '{"Pro (CUH-7000 à 7200)"}', '{"Ventilateur très bruyant","Port HDMI","Surchauffe"}', 6),
  ('xbox', 'Xbox Series X', 'xbox-series-x', 'Series X', 2020, 'xbox-series', false, false, '{"Series X"}', '{"Port HDMI","Lecteur","Alimentation","Surchauffe"}', 1),
  ('xbox', 'Xbox Series S', 'xbox-series-s', 'Series S', 2020, 'xbox-series', false, false, '{"Series S (512 Go, 1 To)"}', '{"Port HDMI","Alimentation","Stockage"}', 2),
  ('xbox', 'Xbox One', 'xbox-one', 'Xbox One', 2013, 'xbox-one', false, false, '{"One (2013)"}', '{"Port HDMI","Lecteur Blu-ray","Alimentation externe"}', 3),
  ('xbox', 'Xbox One S', 'xbox-one-s', 'One S', 2016, 'xbox-one', false, false, '{"One S","One S All-Digital"}', '{"Port HDMI","Lecteur","Ventilateur"}', 4),
  ('xbox', 'Xbox One X', 'xbox-one-x', 'One X', 2017, 'xbox-one', false, false, '{"One X"}', '{"Port HDMI","Surchauffe","Alimentation"}', 5),
  ('nintendo', 'Nintendo Switch', 'switch', 'Switch', 2017, 'switch', false, true, '{"V1 (2017)","V2 (2019)"}', '{"Port USB-C","Dérive des Joy-Con","Écran","Batterie"}', 1),
  ('nintendo', 'Nintendo Switch OLED', 'switch-oled', 'Switch OLED', 2021, 'switch', false, true, '{"OLED"}', '{"Port USB-C","Joy-Con","Écran OLED"}', 2),
  ('nintendo', 'Nintendo Switch Lite', 'switch-lite', 'Switch Lite', 2019, 'switch-lite', false, true, '{"Lite"}', '{"Sticks intégrés (dérive)","Port USB-C","Écran"}', 3);

insert into public.console_models (id, brand_id, name, slug, short_name, release_year, display_order, family, variants, common_issues, is_retro, is_handheld)
select gen_random_uuid(), b.id, m.name, m.slug, m.short_name, m.year, m.display_order, m.family, m.variants, m.common_issues, m.is_retro, m.is_handheld
from seed_models m join public.brands b on b.slug = m.brand_slug
on conflict (slug) do update set family = excluded.family, variants = excluded.variants, common_issues = excluded.common_issues, is_retro = excluded.is_retro, is_handheld = excluded.is_handheld, display_order = excluded.display_order;

-- Pannes supplémentaires
insert into public.faults (name, slug, short_description, icon, display_order) values
  ('Ventilateur bruyant / HS', 'ventilateur', 'Bruit anormal, ventilateur bloqué ou arrêté', 'Fan', 12),
  ('Nettoyage / entretien', 'nettoyage-entretien', 'Dépoussiérage complet, pâte thermique, pads', 'Sparkles', 13),
  ('Lecteur de cartouche', 'lecteur-cartouche', 'Jeu non reconnu, contacts oxydés', 'Package', 14),
  ('Lecteur microSD', 'micro-sd', 'Carte non détectée, erreur de lecture', 'HardDrive', 15),
  ('Batterie', 'batterie', 'Autonomie très faible, batterie gonflée', 'BatteryWarning', 16),
  ('Condensateurs (recap)', 'recap-condensateurs', 'Image ou son dégradés, console rétro qui vieillit', 'Cpu', 17),
  ('Pile de sauvegarde', 'pile-sauvegarde', 'Sauvegardes perdues (console ou cartouche)', 'Battery', 18),
  ('Sortie vidéo / RGB', 'sortie-video', 'Image tremblante, absente, mod RGB ou HDMI', 'Tv', 19),
  ('Boutons / gâchettes', 'boutons', 'Bouton mort, gâchette qui reste enfoncée', 'Gamepad2', 20),
  ('Wi-Fi / Bluetooth', 'wifi-bluetooth', 'Manettes ou réseau qui décrochent', 'Wifi', 21),
  ('Manette', 'manette', 'Sticks, gâchettes, batterie ou port de charge de la manette', 'Gamepad', 22)
on conflict (slug) do nothing;

-- Grille de prix par famille (DEV) : famille, panne, prix, coût pièces estimé, minutes, délai min/max, garantie (mois)
drop table if exists seed_prices;
create temp table seed_prices (family text, fault_slug text, price int, cost int, minutes int, lead_min int, lead_max int, warranty int);
insert into seed_prices values
  ('ps5','hdmi',8900,1800,60,2,4,6),('ps5','alimentation',9500,4500,45,2,5,6),('ps5','surchauffe',4900,800,60,1,3,6),('ps5','ventilateur',6900,2500,60,2,4,6),('ps5','lecteur',8900,3500,60,2,5,6),('ps5','stockage',7900,0,45,1,3,6),('ps5','connectique',6900,1500,60,2,4,6),('ps5','ne-s-allume-plus',7900,3000,90,3,6,6),('ps5','nettoyage-entretien',4900,800,60,1,3,3),('ps5','wifi-bluetooth',6900,2000,60,2,4,6),('ps5','manette',3900,1200,40,1,3,3),('ps5','autre',2900,0,45,2,5,0),
  ('ps4','hdmi',7900,1500,60,2,4,6),('ps4','alimentation',8900,3500,45,2,5,6),('ps4','surchauffe',4900,800,60,1,3,6),('ps4','ventilateur',5900,2000,60,2,4,6),('ps4','lecteur',6900,2500,60,2,5,6),('ps4','stockage',6900,0,45,1,3,6),('ps4','connectique',5900,1200,60,2,4,6),('ps4','ne-s-allume-plus',6900,2500,90,3,6,6),('ps4','nettoyage-entretien',4500,600,60,1,3,3),('ps4','wifi-bluetooth',5900,1800,60,2,4,6),('ps4','manette',3500,1000,40,1,3,3),('ps4','autre',2500,0,45,2,5,0),
  ('ps3','hdmi',6900,1500,60,2,5,6),('ps3','alimentation',7900,3000,45,2,5,6),('ps3','surchauffe',5900,900,90,3,6,3),('ps3','lecteur',6900,2500,60,3,6,6),('ps3','stockage',4900,0,45,1,3,6),('ps3','ne-s-allume-plus',6900,2500,90,3,6,3),('ps3','nettoyage-entretien',4500,600,60,1,3,3),('ps3','autre',2500,0,45,2,5,0),
  ('ps2','lecteur',4900,1500,60,2,5,6),('ps2','alimentation',4900,1500,45,2,5,6),('ps2','connectique',3900,800,45,2,4,6),('ps2','nettoyage-entretien',3500,300,45,1,3,3),('ps2','recap-condensateurs',6500,1500,120,4,8,6),('ps2','sortie-video',4900,1200,60,3,6,6),('ps2','ne-s-allume-plus',4900,1500,60,3,6,3),('ps2','autre',2000,0,45,2,5,0),
  ('ps1','lecteur',4500,1500,60,2,5,6),('ps1','alimentation',3900,1000,45,2,5,6),('ps1','recap-condensateurs',6500,1500,120,4,8,6),('ps1','sortie-video',4500,1000,60,3,6,6),('ps1','nettoyage-entretien',3000,300,45,1,3,3),('ps1','autre',2000,0,45,2,5,0),
  ('psp','ecran',6900,2500,60,2,5,6),('psp','batterie',3900,1500,30,1,3,6),('psp','charge',4900,1200,60,2,4,6),('psp','boutons',3900,800,45,2,4,6),('psp','joystick',3900,900,45,2,4,6),('psp','lecteur',4900,1500,60,2,5,6),('psp','autre',2000,0,45,2,5,0),
  ('vita','ecran',8900,3500,60,2,5,6),('vita','batterie',4500,1800,30,1,3,6),('vita','charge',4900,1200,60,2,4,6),('vita','joystick',4500,1200,45,2,4,6),('vita','boutons',3900,800,45,2,4,6),('vita','autre',2000,0,45,2,5,0),
  ('xbox-series','hdmi',8900,1800,60,2,4,6),('xbox-series','alimentation',8900,4000,45,2,5,6),('xbox-series','surchauffe',4900,800,60,1,3,6),('xbox-series','ventilateur',6900,2500,60,2,4,6),('xbox-series','lecteur',7900,3000,60,2,5,6),('xbox-series','stockage',7900,0,45,1,3,6),('xbox-series','ne-s-allume-plus',7900,3000,90,3,6,6),('xbox-series','wifi-bluetooth',6900,2000,60,2,4,6),('xbox-series','nettoyage-entretien',4900,800,60,1,3,3),('xbox-series','manette',3900,1200,40,1,3,3),('xbox-series','autre',2900,0,45,2,5,0),
  ('xbox-one','hdmi',7900,1500,60,2,4,6),('xbox-one','alimentation',7900,3000,45,2,5,6),('xbox-one','surchauffe',4900,800,60,1,3,6),('xbox-one','ventilateur',5900,2000,60,2,4,6),('xbox-one','lecteur',6900,2500,60,2,5,6),('xbox-one','stockage',6900,0,45,1,3,6),('xbox-one','ne-s-allume-plus',6900,2500,90,3,6,6),('xbox-one','nettoyage-entretien',4500,600,60,1,3,3),('xbox-one','manette',3500,1000,40,1,3,3),('xbox-one','autre',2500,0,45,2,5,0),
  ('xbox-360','alimentation',5900,2000,45,2,5,6),('xbox-360','surchauffe',6900,1000,120,3,6,3),('xbox-360','lecteur',5900,2000,60,3,6,6),('xbox-360','stockage',3900,0,30,1,3,6),('xbox-360','ne-s-allume-plus',5900,2000,90,3,6,3),('xbox-360','nettoyage-entretien',4500,600,60,1,3,3),('xbox-360','autre',2500,0,45,2,5,0),
  ('xbox-og','alimentation',5900,2000,45,2,5,6),('xbox-og','lecteur',5900,2000,60,3,6,6),('xbox-og','stockage',4900,1500,60,2,5,6),('xbox-og','recap-condensateurs',6500,1200,120,4,8,6),('xbox-og','nettoyage-entretien',4500,600,60,1,3,3),('xbox-og','autre',2500,0,45,2,5,0),
  ('switch','usb-c',6900,1500,60,2,4,6),('switch','ecran',11900,5000,60,2,5,6),('switch','batterie',5900,2500,45,1,3,6),('switch','joystick',4500,1600,40,1,3,6),('switch','lecteur-cartouche',5900,1500,60,2,4,6),('switch','micro-sd',4900,1200,60,2,4,6),('switch','charge',6900,1500,60,2,4,6),('switch','surchauffe',4900,600,60,1,3,3),('switch','ne-s-allume-plus',6900,2000,90,3,6,3),('switch','nettoyage-entretien',3900,300,45,1,3,3),('switch','wifi-bluetooth',5900,1500,60,2,4,6),('switch','autre',2000,0,45,2,5,0),
  ('switch-lite','usb-c',6900,1500,60,2,4,6),('switch-lite','ecran',9900,4000,60,2,5,6),('switch-lite','batterie',5900,2500,45,1,3,6),('switch-lite','joystick',4900,1800,45,1,3,6),('switch-lite','lecteur-cartouche',5900,1500,60,2,4,6),('switch-lite','micro-sd',4900,1200,60,2,4,6),('switch-lite','charge',6900,1500,60,2,4,6),('switch-lite','ne-s-allume-plus',6900,2000,90,3,6,3),('switch-lite','boutons',4500,900,45,2,4,6),('switch-lite','autre',2000,0,45,2,5,0),
  ('wiiu','lecteur',6900,2500,60,3,6,6),('wiiu','alimentation',4900,1500,45,2,5,6),('wiiu','wifi-bluetooth',5900,1500,60,2,4,6),('wiiu','ecran',7900,3000,60,2,5,6),('wiiu','joystick',4500,1200,45,2,4,6),('wiiu','charge',4900,1200,60,2,4,6),('wiiu','ne-s-allume-plus',5900,2000,90,3,6,3),('wiiu','nettoyage-entretien',3900,300,45,1,3,3),('wiiu','autre',2000,0,45,2,5,0),
  ('wii','lecteur',5900,2000,60,3,6,6),('wii','alimentation',3900,1200,45,2,5,6),('wii','wifi-bluetooth',4900,1200,60,2,4,6),('wii','ne-s-allume-plus',4900,1500,90,3,6,3),('wii','nettoyage-entretien',3500,300,45,1,3,3),('wii','autre',2000,0,45,2,5,0),
  ('gamecube','lecteur',5900,2000,60,3,6,6),('gamecube','alimentation',3900,1200,45,2,5,6),('gamecube','connectique',3900,800,45,2,4,6),('gamecube','nettoyage-entretien',3500,300,45,1,3,3),('gamecube','sortie-video',4500,1000,60,3,6,6),('gamecube','autre',2000,0,45,2,5,0),
  ('n64','connectique',3900,800,45,2,4,6),('n64','sortie-video',6900,2500,90,4,8,6),('n64','recap-condensateurs',6500,1200,120,4,8,6),('n64','lecteur-cartouche',3900,500,45,2,4,6),('n64','nettoyage-entretien',3500,300,45,1,3,3),('n64','alimentation',3500,1000,45,2,5,6),('n64','autre',2000,0,45,2,5,0),
  ('snes','lecteur-cartouche',3900,500,45,2,4,6),('snes','recap-condensateurs',6500,1200,120,4,8,6),('snes','sortie-video',6900,2500,90,4,8,6),('snes','alimentation',3500,1000,45,2,5,6),('snes','nettoyage-entretien',3500,300,45,1,3,3),('snes','autre',2000,0,45,2,5,0),
  ('nes','lecteur-cartouche',3900,800,45,2,4,6),('nes','recap-condensateurs',6500,1200,120,4,8,6),('nes','sortie-video',6900,2500,90,4,8,6),('nes','alimentation',3500,1000,45,2,5,6),('nes','nettoyage-entretien',3500,300,45,1,3,3),('nes','autre',2000,0,45,2,5,0),
  ('gb','ecran',5900,2500,60,3,6,6),('gb','boutons',3500,500,45,2,4,6),('gb','connectique',2900,300,30,2,4,6),('gb','nettoyage-entretien',3000,200,45,1,3,3),('gb','pile-sauvegarde',1500,200,20,1,3,3),('gb','autre',2000,0,45,2,5,0),
  ('gba','ecran',6900,3000,60,3,6,6),('gba','boutons',3500,500,45,2,4,6),('gba','batterie',3500,1200,30,1,3,6),('gba','nettoyage-entretien',3000,200,45,1,3,3),('gba','pile-sauvegarde',1500,200,20,1,3,3),('gba','autre',2000,0,45,2,5,0),
  ('ds','ecran',6900,2800,60,3,6,6),('ds','charge',4500,1000,60,2,4,6),('ds','batterie',3900,1200,30,1,3,6),('ds','boutons',3500,500,45,2,4,6),('ds','joystick',3900,900,45,2,4,6),('ds','lecteur-cartouche',4500,900,45,2,4,6),('ds','autre',2000,0,45,2,5,0),
  ('dreamcast','lecteur',5900,2000,60,3,6,6),('dreamcast','alimentation',4500,1200,45,2,5,6),('dreamcast','recap-condensateurs',6500,1200,120,4,8,6),('dreamcast','sortie-video',4900,1500,60,3,6,6),('dreamcast','nettoyage-entretien',3500,300,45,1,3,3),('dreamcast','autre',2000,0,45,2,5,0),
  ('saturn','lecteur',5900,2000,60,3,6,6),('saturn','alimentation',4500,1200,45,2,5,6),('saturn','recap-condensateurs',6500,1200,120,4,8,6),('saturn','sortie-video',4900,1500,60,3,6,6),('saturn','pile-sauvegarde',1500,200,20,1,3,3),('saturn','autre',2000,0,45,2,5,0),
  ('megadrive','recap-condensateurs',6500,1200,120,4,8,6),('megadrive','sortie-video',4900,1500,60,3,6,6),('megadrive','alimentation',3500,1000,45,2,5,6),('megadrive','connectique',3900,800,45,2,4,6),('megadrive','nettoyage-entretien',3000,200,45,1,3,3),('megadrive','autre',2000,0,45,2,5,0),
  ('mastersystem','recap-condensateurs',6500,1200,120,4,8,6),('mastersystem','sortie-video',4900,1500,60,3,6,6),('mastersystem','alimentation',3500,1000,45,2,5,6),('mastersystem','connectique',3900,800,45,2,4,6),('mastersystem','autre',2000,0,45,2,5,0),
  ('gamegear','recap-condensateurs',6900,1500,120,4,8,6),('gamegear','ecran',7900,3500,90,4,8,6),('gamegear','alimentation',3500,1000,45,2,5,6),('gamegear','boutons',3500,500,45,2,4,6),('gamegear','autre',2000,0,45,2,5,0);

-- Libellés de prestation par panne (%s = nom court du modèle)
drop table if exists seed_labels;
create temp table seed_labels (fault_slug text, label text, summary text, included text[]);
insert into seed_labels values
  ('hdmi', 'Réparation port HDMI %s', 'Remplacement du connecteur HDMI (micro-soudure), tests d''affichage.', '{"Diagnostic","Remplacement du connecteur HDMI","Remontage","Tests d''affichage"}'),
  ('ne-s-allume-plus', 'Console %s ne s''allume plus', 'Recherche de panne, réparation de l''étage d''alimentation ou de la carte mère.', '{"Diagnostic","Réparation","Remontage","Tests"}'),
  ('usb-c', 'Remplacement port USB-C %s', 'Connecteur de charge neuf soudé sur la carte mère.', '{"Diagnostic","Remplacement du port USB-C","Remontage","Tests de charge"}'),
  ('charge', 'Problème de charge %s', 'Port, circuit de charge ou batterie : recherche et réparation.', '{"Diagnostic","Réparation","Tests de charge"}'),
  ('surchauffe', 'Surchauffe / nettoyage thermique %s', 'Démontage complet, dépoussiérage, pâte thermique et pads neufs.', '{"Démontage","Nettoyage complet","Pâte thermique et pads","Tests sous charge"}'),
  ('lecteur', 'Réparation lecteur %s', 'Lecteur optique remplacé ou réparé (laser, courroie, mécanisme).', '{"Diagnostic","Réparation du lecteur","Tests de lecture"}'),
  ('alimentation', 'Réparation alimentation %s', 'Bloc ou étage d''alimentation réparé ou remplacé.', '{"Diagnostic","Réparation alimentation","Tests"}'),
  ('stockage', 'Stockage / SSD %s', 'Remplacement ou installation du stockage et réinstallation du système.', '{"Diagnostic","Remplacement du stockage","Réinstallation système"}'),
  ('connectique', 'Connectique %s', 'Ports USB, réseau, casque ou manettes remplacés.', '{"Diagnostic","Remplacement du port","Tests"}'),
  ('joystick', 'Sticks / dérive %s', 'Sticks remplacés, calibration et tests.', '{"Remplacement des sticks","Calibration","Tests"}'),
  ('ecran', 'Remplacement écran %s', 'Écran ou vitre d''origine remplacé, tactile testé.', '{"Remplacement de l''écran","Remontage","Tests tactile / affichage"}'),
  ('autre', 'Diagnostic %s', 'Vous ne savez pas d''où vient la panne ? Nous diagnostiquons et vous envoyons un devis.', '{"Diagnostic complet","Devis détaillé"}'),
  ('ventilateur', 'Remplacement ventilateur %s', 'Ventilateur neuf, nettoyage du radiateur.', '{"Remplacement du ventilateur","Nettoyage","Tests sous charge"}'),
  ('nettoyage-entretien', 'Nettoyage complet %s', 'Dépoussiérage intégral, contrôle des connecteurs, pâte thermique si nécessaire.', '{"Démontage","Nettoyage complet","Contrôle final"}'),
  ('lecteur-cartouche', 'Lecteur de cartouche %s', 'Contacts nettoyés ou connecteur remplacé.', '{"Nettoyage / remplacement du connecteur","Tests avec cartouche"}'),
  ('micro-sd', 'Lecteur microSD %s', 'Lecteur de carte remplacé.', '{"Remplacement du lecteur","Tests"}'),
  ('batterie', 'Remplacement batterie %s', 'Batterie neuve, cycle de charge testé.', '{"Remplacement de la batterie","Tests de charge"}'),
  ('recap-condensateurs', 'Recap condensateurs %s', 'Condensateurs remplacés, carte nettoyée : image et son retrouvés.', '{"Remplacement des condensateurs","Nettoyage de la carte","Tests"}'),
  ('pile-sauvegarde', 'Pile de sauvegarde %s', 'Pile remplacée (console ou cartouche) sans perdre le reste.', '{"Remplacement de la pile","Tests de sauvegarde"}'),
  ('sortie-video', 'Sortie vidéo / RGB %s', 'Réparation de la sortie vidéo ou installation d''un mod RGB / HDMI.', '{"Diagnostic","Réparation ou mod vidéo","Tests"}'),
  ('boutons', 'Boutons / gâchettes %s', 'Membranes, boutons ou gâchettes remplacés.', '{"Remplacement","Nettoyage des contacts","Tests"}'),
  ('wifi-bluetooth', 'Wi-Fi / Bluetooth %s', 'Module ou antenne remplacés.', '{"Diagnostic","Remplacement du module","Tests de connexion"}'),
  ('manette', 'Réparation manette %s', 'Sticks, gâchettes, batterie ou port de charge de la manette.', '{"Diagnostic","Réparation","Tests"}');

insert into public.repairs (model_id, fault_id, name, slug, summary, price_cents, estimated_cost_cents, estimated_minutes, lead_time_days_min, lead_time_days_max, warranty_months, included_items, is_diagnostic_only, is_seo_published, display_order)
select m.id, f.id, format(l.label, m.short_name), f.slug, l.summary, p.price, p.cost, p.minutes, p.lead_min, p.lead_max, p.warranty, l.included, f.slug = 'autre', true, f.display_order
from public.console_models m
join seed_prices p on p.family = m.family
join public.faults f on f.slug = p.fault_slug
join seed_labels l on l.fault_slug = f.slug
where not exists (select 1 from public.repairs r where r.model_id = m.id and r.fault_id = f.id)
  -- Un modèle dont le catalogue vient du document du client n'a pas besoin de
  -- ces prestations génériques : les créer ferait doublon avec les siennes.
  -- Sans cette clause, un rejeu de ce fichier APRÈS catalog-reparations.sql
  -- garnirait les modèles que celui-ci a créés (Switch V2, Switch 2).
  and not exists (select 1 from public.repairs pdf where pdf.model_id = m.id and pdf.category_id is not null);


-- ---------------------------------------------------------------------------
-- Photo de la façade du magasin
--
-- Photo réelle du 207 rue de Rome, fournie par le client et livrée avec le
-- site (public/medias/). Le chemin commence par « / » : publicMediaUrl le sert
-- tel quel, sans passer par le bucket content-media. Le gérant peut la
-- remplacer depuis Contenu → Galerie, en téléversant une nouvelle image et en
-- collant son chemin — le reste continue de fonctionner à l'identique.
--
-- Le titre sert de texte alternatif dans le bloc « magasin » de l'accueil.
-- gallery_items n'a pas de clé naturelle : la garde porte donc sur le chemin.
-- ---------------------------------------------------------------------------
insert into public.gallery_items (category, image_path, title, description, display_order, is_published)
select 'storefront', '/medias/facade-207-mediarom.webp',
       'Façade du magasin 207 Mediarom à Marseille',
       'Le magasin, 207 rue de Rome à Marseille : vitrine consoles et jeux, réparation express.',
       0, true
 where not exists (select 1 from public.gallery_items where image_path = '/medias/facade-207-mediarom.webp');

insert into public.site_settings (key, value, description, is_public) values
  ('shop', '{"shipping_enabled":true,"shipping_fee_cents":690,"free_shipping_threshold_cents":8000,"pickup_enabled":true,"pickup_note":"Retrait au magasin aux horaires d''ouverture, sans rendez-vous.","shipping_note":"Colissimo suivi, expédition sous 48 h ouvrées après paiement."}', 'Boutique : livraison et retrait', true)
on conflict (key) do nothing;

insert into public.content_blocks (key, title, body, data) values
  ('homepage.sale', 'Jeux, consoles et rétro.', 'Le stock du magasin de la rue de Rome, en ligne. Neuf, occasion révisée et garantie, accessoires et collector. Retrait boutique ou envoi partout en France.', '{"cta_primary":"Voir la boutique","cta_secondary":"Je revends ma console"}'),
  ('homepage.tradein', 'Vendez-nous votre console', 'Estimation en ligne, paiement au comptoir le jour même. Consoles, jeux, manettes, collectors — du Master System à la PS5.', '{"cta":"Estimer mon lot"}'),
  ('homepage.retro', 'Le mur du rétrogaming', 'Cartouches testées une à une, consoles recapées, notices d''origine. Les arrivages sont annoncés dans la boutique.', '{}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Rechargement du cache de schéma de PostgREST.
--
-- Sans effet si le schéma n'a pas bougé, mais indispensable juste après une
-- migration : sinon l'API continue d'ignorer les nouvelles tables et le site
-- affiche des listes vides sans la moindre erreur.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- État des lieux (lecture seule) — dernier résultat affiché par le SQL Editor.
-- ---------------------------------------------------------------------------
select element, nombre from (
  select  1, 'marques', count(*) from public.brands
  union all select  2, 'modèles de console (attendu : 13)', count(*) from public.console_models
  union all select  3, 'pannes', count(*) from public.faults
  union all select  4, 'prestations', count(*) from public.repairs
  union all select  5, 'options', count(*) from public.repair_options
  union all select  6, 'packs', count(*) from public.packs
  union all select  7, 'formules de transport', count(*) from public.shipping_methods
  union all select  8, 'produits boutique (le stock réel se saisit dans le back-office)', count(*) from public.products
) as etat (ordre, element, nombre)
order by ordre;
