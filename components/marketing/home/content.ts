import { ROUTES } from "@/config/site";
import { CATEGORY_SLUGS } from "@/lib/shop/status";

/**
 * Le contenu éditorial de l'accueil.
 *
 * Plateformes, pannes, étapes et éléments de confiance ne viennent pas de la
 * base : ce sont des textes de vitrine, stables, qui n'ont pas à faire un
 * aller-retour en SQL pour s'afficher. Ils sont réunis ici plutôt qu'éparpillés
 * dans le JSX, pour qu'une relecture métier tienne dans un seul fichier.
 *
 * ⚠︎ **Les prix et les délais ci-dessous sont les valeurs de travail du
 * handoff, pas des tarifs validés.** Le cahier des charges n'était pas dans le
 * projet au moment de l'implémentation. Toute valeur qui en vient remplace
 * celle-ci — en particulier le prix du diagnostic, les délais par intervention
 * et la durée de garantie. Le parcours de devis réel, lui, calcule ses prix
 * depuis la base (`lib/repair/catalog.ts`) : ces montants-ci sont des repères
 * d'entrée de gamme affichés en vitrine, et chaque ligne mène au vrai parcours.
 */

/** Le bandeau noir, au-dessus de l'en-tête. */
export const UTILITY_BAR = [
  "Atelier spécialisé consoles — Marseille",
  "Diagnostic sous 48 h, devis avant intervention",
  "Envoi suivi partout en France",
];

/** Les pastilles de réassurance du hero. */
export const HERO_TRUST = [
  "Diagnostic sous 48 h",
  "Devis avant intervention",
  "Garantie 3 mois",
  "Colis suivi aller et retour",
];

export interface Fault {
  label: string;
  price: string;
}

export interface Platform {
  key: string;
  name: string;
  models: string;
  from: string;
  /** La légende de la photo attendue du magasin. */
  photo: string;
  /**
   * Par quoi commencent les slugs des modèles de cette famille dans la base
   * (`ps5`, `switch-oled`, `xbox-series-x`…).
   *
   * Sert à envoyer « Diagnostic PlayStation » sur la page de la PS5 plutôt que
   * sur l'écran où l'on choisit sa marque — arriver sur un choix de marque
   * après avoir cliqué sur une marque n'a aucun sens.
   *
   * Vide pour le rétro : il ramasse tout ce que les autres n'ont pas pris.
   */
  slugPrefixes: string[];
  faults: Fault[];
}

/**
 * Les quatre familles de consoles.
 *
 * **Consoles uniquement.** Ni téléphones, ni ordinateurs, ni tablettes : c'est
 * écrit noir sur blanc dans la page, et ça ne doit pas se démentir ici.
 */
export const PLATFORMS: Platform[] = [
  {
    key: "playstation",
    slugPrefixes: ["ps"],
    name: "PlayStation",
    models: "PS5, PS5 Slim, PS4, PS4 Pro, PS3, PS2",
    from: "dès 49 €",
    photo: "Console PlayStation sur l'établi",
    faults: [
      { label: "Port HDMI", price: "79 €" },
      { label: "Nettoyage et pâte thermique", price: "49 €" },
      { label: "Surchauffe et ventilation", price: "59 €" },
      { label: "Lecteur Blu-ray", price: "89 €" },
      { label: "Alimentation", price: "95 €" },
    ],
  },
  {
    key: "switch",
    slugPrefixes: ["switch"],
    name: "Nintendo Switch",
    models: "Switch, Switch 2, Lite, OLED",
    from: "dès 45 €",
    photo: "Nintendo Switch démontée",
    faults: [
      { label: "Dérive des Joy-Con", price: "45 €" },
      { label: "Écran ou vitre", price: "119 €" },
      { label: "Connecteur de charge USB-C", price: "69 €" },
      { label: "Batterie", price: "59 €" },
      { label: "Lecteur de cartouche", price: "65 €" },
    ],
  },
  {
    key: "xbox",
    slugPrefixes: ["xbox"],
    name: "Xbox",
    models: "Series X, Series S, One, One S, One X, 360",
    from: "dès 49 €",
    photo: "Console Xbox ouverte",
    faults: [
      { label: "Port HDMI", price: "79 €" },
      { label: "Alimentation", price: "89 €" },
      { label: "Lecteur disque", price: "89 €" },
      { label: "Nettoyage et pâte thermique", price: "49 €" },
      { label: "Manette : sticks et gâchettes", price: "39 €" },
    ],
  },
  {
    key: "retro",
    slugPrefixes: [],
    name: "Rétro",
    models: "N64, SNES, Mega Drive, Game Boy, PS1",
    from: "dès 39 €",
    photo: "Consoles rétro en vitrine",
    faults: [
      { label: "Recap condensateurs", price: "dès 65 €" },
      { label: "Pile de sauvegarde", price: "15 €" },
      { label: "Nettoyage connecteur", price: "35 €" },
      { label: "Sortie vidéo RGB ou HDMI", price: "sur devis" },
      { label: "Manette et joystick", price: "dès 39 €" },
    ],
  },
];

/** De la panne au retour de la console. */
export const STEPS = [
  { n: "01", title: "Vous décrivez la panne", body: "Console, modèle, symptôme, photos si vous voulez. Deux minutes, sans créer de compte." },
  { n: "02", title: "Diagnostic en atelier", body: "Banc de test et mesures. Le diagnostic est facturé 20 € et offert si vous acceptez la réparation." },
  { n: "03", title: "Devis avant intervention", body: "Détaillé pièce par pièce, prix et délai fermes. Rien n'est entrepris sans votre accord." },
  { n: "04", title: "Réparation et tests", body: "Intervention puis deux heures de test sous charge avant fermeture du boîtier." },
  { n: "05", title: "Retour suivi", body: "Colis suivi, ou retrait au comptoir. Garantie trois mois sur la main d'œuvre et la pièce." },
];

/** La bande de confiance, sous le parcours. */
export const TRUST = [
  { title: "Prix affichés", body: "Tarifs indicatifs publiés par panne, devis ferme après diagnostic." },
  { title: "Devis avant intervention", body: "Refus du devis : la console repart, seuls les frais de port restent dus." },
  { title: "Garantie trois mois", body: "Sur la main d'œuvre et la pièce remplacée, sans condition." },
  { title: "Suivi de bout en bout", body: "Un numéro de réparation, un statut à chaque étape, colis suivi." },
];

/** Ce qui se passe entre l'arrivée de la console et son départ. */
export const SAVOIR_FAIRE = [
  "Ouverture et inspection : on photographie l'intérieur avant toute intervention.",
  "Nettoyage complet, pâte thermique et pads remplacés.",
  "Microsoudure : port HDMI, connecteur de charge, composants de puissance.",
  "Tests avant fermeture : image, lecteur, manettes, deux heures sous charge.",
];

/** Les trois rayons. Pas un de plus, et aucun livre manga. */
export const CATEGORIES = [
  {
    key: "GAME" as const,
    visual: "jeux" as const,
    name: "Jeux vidéo",
    note: "Neuf, occasion testée, import et collector.",
    photo: "Rayon jeux vidéo",
    href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}`,
  },
  {
    key: "CONSOLE" as const,
    visual: "consoles" as const,
    name: "Consoles",
    note: "Récentes et rétro, révisées en atelier, avec manettes et accessoires.",
    photo: "Rayon consoles",
    href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.CONSOLE}`,
  },
  {
    key: "COLLECTIBLE" as const,
    visual: "figurines" as const,
    name: "Figurines manga / anime",
    note: "One Piece, Naruto, Dragon Ball, Demon Slayer, Jujutsu Kaisen.",
    photo: "Vitrine figurines de personnages",
    href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.COLLECTIBLE}`,
  },
];

/**
 * Les filtres de la grille produits.
 *
 * Ils ne décorent pas : chacun mène au catalogue réel avec sa requête, telle
 * que `app/(marketing)/boutique/page.tsx` la lit. Un filtre qui ne filtre rien
 * serait pire qu'absent.
 */
export const SHOP_FILTERS = [
  { label: "Tout", href: ROUTES.shop },
  { label: "Jeux vidéo", href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}` },
  { label: "Consoles", href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.CONSOLE}` },
  { label: "Figurines", href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.COLLECTIBLE}` },
  { label: "Neuf", href: `${ROUTES.shop}?etat=neuf` },
  { label: "Occasion", href: `${ROUTES.shop}?etat=occasion` },
  { label: "Moins de 50 €", href: `${ROUTES.shop}?max=50` },
];
