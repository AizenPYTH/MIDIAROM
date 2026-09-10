-- =============================================================================
-- CATALOGUE INITIAL — 207 MEDIAROM
--
-- Marques, consoles, pannes, prestations de réparation, options, packs,
-- transports, contrôles qualité, contenus éditoriaux, documents légaux et
-- produits de la boutique.
--
-- Ce fichier est le SEUL à appliquer sur un projet de production : il ne
-- contient ni compte de démonstration, ni dossier, ni avis fictif.
--
--   psql "$DB_URL" -f supabase/catalog.sql
--
-- Tous les prix sont des PRIX DE DÉPART, destinés à être ajustés depuis le
-- back-office (Catalogue → Réparations pour les prestations, Stock pour les
-- produits). Rien n'est codé en dur côté application : tout vient d'ici puis de
-- la base.
--
-- Rejouable : chaque insertion est protégée, une seconde exécution ne crée pas
-- de doublon et n'écrase pas ce que vous avez modifié dans le back-office.
-- =============================================================================

set search_path = public, extensions;
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

-- ---------------------------------------------------------------------------
-- Prestations de réparation
--
-- Ce fichier n'en crée AUCUNE, volontairement. Le catalogue de réparation est
-- strictement celui du document du client : il est chargé par
-- supabase/catalog-reparations.sql et lui seul. Toute prestation créée ici
-- serait une prestation inventée, absente du document.
-- ---------------------------------------------------------------------------

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
  ('brand', '{"name":"207 Médi@roM","tagline":"Jeux vidéo, consoles, rétro et réparation à Marseille","description":"Magasin de jeux vidéo au 207 rue de Rome à Marseille depuis 1997 : vente neuf et occasion, rétrogaming, reprise et atelier de réparation de consoles.","email":"contact@example.com","phone":"04 91 48 27 48","address_line1":"207 rue de Rome","postal_code":"13006","city":"Marseille","country":"France","logo_path":null,"hours":"Lun–Sam 9h30–19h","founded_year":"1997","siret":"","legal_form":""}', 'Identité de l''entreprise', true),
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
       'Façade du magasin 207 Médi@roM à Marseille',
       'Le magasin, 207 rue de Rome à Marseille : vitrine consoles et jeux, réparation express.',
       0, true
 where not exists (select 1 from public.gallery_items where image_path = '/medias/facade-207-mediarom.webp');

-- ---------------------------------------------------------------------------
-- Photos des 13 modèles, livrées avec le site (public/medias/consoles/).
-- Renseignées seulement si le modèle n'a pas déjà sa propre photo.
-- ---------------------------------------------------------------------------
update public.console_models
   set image_path = '/medias/consoles/' || slug || '.webp', updated_at = now()
 where coalesce(image_path, '') = '';

insert into public.site_settings (key, value, description, is_public) values
  ('shop', '{"shipping_enabled":true,"shipping_fee_cents":690,"free_shipping_threshold_cents":8000,"pickup_enabled":true,"pickup_note":"Retrait au magasin aux horaires d''ouverture, sans rendez-vous.","shipping_note":"Colissimo suivi, expédition sous 48 h ouvrées après paiement."}', 'Boutique : livraison et retrait', true)
on conflict (key) do nothing;

insert into public.content_blocks (key, title, body, data) values
  ('homepage.sale', 'Jeux, consoles et rétro.', 'Le stock du magasin de la rue de Rome, en ligne. Neuf, occasion révisée et garantie, accessoires et collector. Retrait boutique ou envoi partout en France.', '{"cta_primary":"Voir la boutique","cta_secondary":"Je revends ma console"}'),
  ('homepage.tradein', 'Vendez-nous votre console', 'Estimation en ligne, paiement au comptoir le jour même. Consoles, jeux, manettes, collectors — du Master System à la PS5.', '{"cta":"Estimer mon lot"}'),
  ('homepage.retro', 'Le mur du rétrogaming', 'Cartouches testées une à une, consoles recapées, notices d''origine. Les arrivages sont annoncés dans la boutique.', '{}')
on conflict (key) do nothing;
