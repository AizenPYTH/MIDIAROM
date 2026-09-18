-- ============================================================================
-- Catalogue de réparations : une prestation par famille de pannes
-- ============================================================================
--
-- Le catalogue comptait 1 189 prestations actives pour 18 modèles — jusqu'à 89
-- pour une seule console. Ce n'est pas un choix, c'est une liste : pour la PS5,
-- treize entrées disent la même panne d'image (« Changement du port HDMI »,
-- « Port HDMI endommagé », « Aucun signal HDMI », « Écran noir », « Pas
-- d'image », « Image qui coupe », « Image instable »…), dix disent la même
-- panne d'allumage, huit le même lecteur.
--
-- Un client ne choisit pas entre treize formulations du même symptôme. Il
-- choisit « mon écran reste noir ». Et un atelier ne maintient pas 1 189
-- lignes de tarif.
--
-- Cette migration **ne supprime rien**. Elle désactive (`is_active = false`)
-- les variantes redondantes et garde, pour chaque modèle, une prestation par
-- famille de pannes. Tout reste en base :
--
--   * les consoles et les modèles : intacts ;
--   * les dossiers de réparation existants : intacts. Ils portent de toute
--     façon leur propre copie du libellé (`repair_orders.repair_name`), et
--     `repair_id` reste valide — désactiver n'est pas supprimer ;
--   * les prestations écartées : toujours là, réactivables d'une case à cocher
--     au back-office, ou en masse :
--
--       update public.repairs set is_active = true;
--
-- Rejouable. Idempotente sur un catalogue déjà réduit.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Les familles de pannes, dans l'ordre où on les teste
-- ─────────────────────────────────────────────────────────────────────────────
--
-- L'ordre **est** la règle de désambiguïsation : la première famille qui
-- reconnaît le slug l'emporte. C'est ce qui fait que « écran noir, image et
-- HDMI » part en image (1) et non en écran (11), que « manette qui ne charge
-- pas » part en manette (2) et non en charge (5), et que « console bloquée au
-- démarrage — SSD et stockage » part en stockage (7) et non en allumage (3).
--
-- Rien n'est écrit en dur sur un modèle : les motifs jouent contre les slugs
-- réels de `faults`, et un modèle qui n'a aucune panne d'une famille n'en
-- reçoit simplement pas.
with familles (rang, cle, libelle, motifs) as (
  values
    (1,  'image',        'Image & HDMI',            array['hdmi', 'image', 'ecran-noir', 'video', 'resolution', 'hdr', 'artefact', 'affichage', 'graphique']),
    (2,  'manette',      'Manette & joysticks',     array['manette', 'joy-con', 'joycon', 'joystick', 'stick', 'gachette', 'drift', 'synchronisation', 'bouton']),
    (3,  'allumage',     'Allumage',                array['ne-s-allume', 'ne-sallume', 's-eteint', 'seteint', 'voyant', 'bip', 'veille', 'ne-demarre']),
    (4,  'alimentation', 'Alimentation',            array['alimentation', 'court-circuit', 'bloc-d', 'connecteur-d', 'surtension']),
    (5,  'charge',       'Charge & batterie',       array['charge', 'batterie', 'autonomie']),
    (6,  'lecteur',      'Lecteur & disques',       array['lecteur', 'disque', 'blu-ray', 'cartouche', 'carte-de-jeu', 'ejection', 'jeu-non-reconnu']),
    (7,  'stockage',     'Stockage & système',      array['ssd', 'disque-dur', 'stockage', 'microsd', 'micro-sd', 'extension', 'memoire']),
    (8,  'systeme',      'Logiciel système',        array['systeme', 'logiciel', 'mise-a-jour', 'base-de-donnees', 'se-fige', 'sans-echec', 'reinstallation', 'erreur']),
    (9,  'surchauffe',   'Surchauffe',              array['surchauffe', 'ventilateur', 'chauffe', 'metal-liquide', 'thermique', 'bruit']),
    (10, 'nettoyage',    'Nettoyage & entretien',   array['nettoyage', 'depoussierage', 'entretien']),
    (11, 'ecran',        'Écran & tactile',         array['ecran', 'tactile', 'dalle', 'pixel', 'vitre', 'oled', 'retroeclairage']),
    (12, 'usb',          'Ports USB',               array['usb']),
    (13, 'reseau',       'Wi-Fi & réseau',          array['wi-fi', 'wifi', 'bluetooth', 'ethernet', 'internet', 'connexion', 'reseau', 'deconnexion']),
    (14, 'audio',        'Audio',                   array['audio', 'son-', 'jack', 'casque', 'haut-parleur', 'micro-', 'sonore']),
    (15, 'dock',         'Dock & mode TV',          array['dock', 'mode-tv', 'station'])
),

-- Chaque prestation active, rattachée à la PREMIÈRE famille qui la reconnaît.
classees as (
  select r.id,
         r.model_id,
         r.is_featured,
         r.display_order,
         r.name,
         (
           select f.rang
             from familles f
            where exists (select 1 from unnest(f.motifs) m where fa.slug like '%' || m || '%')
            order by f.rang
            limit 1
         ) as famille
    from public.repairs r
    join public.faults fa on fa.id = r.fault_id
   where r.is_active
),

-- Le représentant de chaque (modèle, famille).
--
-- On garde d'abord ce que le vendeur a déjà mis en avant : la sélection posée
-- par `20260918000001_repairs_featured` est une décision humaine, elle prime
-- sur tout tri automatique. À défaut, l'ordre du catalogue, puis le nom — pour
-- que le résultat soit le même à chaque exécution.
gardees as (
  select distinct on (model_id, famille) id
    from classees
   where famille is not null
   order by model_id, famille, is_featured desc, display_order, name, id
)

-- Tout le reste sort de la vitrine. Une prestation qu'aucune famille ne
-- reconnaît sort aussi : c'est, par construction, un libellé qu'un client ne
-- saurait pas choisir.
update public.repairs r
   set is_active = false
 where r.is_active
   and r.id not in (select id from gardees);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cohérence de la liste courte
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `is_featured` pilote les huit ou neuf pannes proposées d'emblée sur
-- /reparation. Une prestation mise en avant qui vient d'être désactivée
-- laisserait un trou dans cette grille : on retire la mise en avant en même
-- temps que la prestation quitte la vitrine.
update public.repairs
   set is_featured = false, featured_order = 0
 where is_featured and not is_active;

-- À l'inverse, le catalogue réduit tient maintenant tout entier dans la liste
-- courte pour la plupart des modèles. On met en avant ce qui reste, dans
-- l'ordre des familles, en s'arrêtant au plafond de neuf que la vitrine sait
-- afficher — le reste attend derrière « Autre problème ».
with rangs as (
  select r.id,
         row_number() over (partition by r.model_id order by r.is_featured desc, r.featured_order, r.display_order, r.name) as rang
    from public.repairs r
   where r.is_active
)
update public.repairs r
   set is_featured = (rangs.rang <= 9),
       featured_order = case when rangs.rang <= 9 then rangs.rang else 0 end
  from rangs
 where rangs.id = r.id;
