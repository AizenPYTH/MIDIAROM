import type { GameListing } from "@/lib/shop/games";
import { CONDITION_LABELS } from "@/lib/shop/status";
import { ROUTES } from "@/config/site";

/**
 * Adaptation d'un produit de la boutique au panneau de la scène « Derniers
 * jeux ».
 *
 * La maquette attend quelques valeurs d'affichage — une étiquette courte, une
 * ligne de métadonnées, une lueur — que le catalogue ne porte pas telles
 * quelles. Elles se déduisent toutes de données réelles ; rien n'est inventé,
 * et un champ absent donne `null`, jamais un texte de remplissage.
 *
 * Ce fichier est le seul endroit où les libellés de la scène sont décidés. Les
 * composants d'affichage reçoivent un `GameScene` et n'interprètent plus rien.
 */

/** Les quatre accents de la charte, dans l'ordre où la maquette les fait tourner. */
const GLOWS = [
  "rgba(255,122,61,0.50)",
  "rgba(255,92,168,0.45)",
  "rgba(216,255,62,0.32)",
  "rgba(51,225,255,0.34)",
  "rgba(124,92,255,0.42)",
] as const;

export interface GameScene {
  productId: string;
  slug: string;
  /**
   * URL de la fiche produit réelle, ou null pour une fiche de démonstration —
   * qui n'est pas au catalogue et ne doit donc pas se prétendre achetable.
   */
  href: string | null;
  /** Vrai pour la vitrine de démonstration. L'affichage le dit au visiteur. */
  isDemo: boolean;
  /** Titre affiché : le nom du jeu. */
  name: string;
  /** Étiquette courte du rail de jaquettes (état, ou édition si elle existe). */
  tag: string;
  /** Résumé IGDB, ou description du produit, ou null. */
  pitch: string | null;
  /** Plateformes affichées en pastilles. Toujours au moins une si connue. */
  platforms: string[];
  /** « 15 janvier 2024 · Action · Naughty Dog » — seulement ce qu'on sait. */
  meta: string | null;
  /** Prix formaté, ou null si le produit n'est pas chiffré. */
  price: string | null;
  inStock: boolean;
  /** Libellé du bouton principal, selon la disponibilité réelle. */
  cta: string;
  coverUrl: string | null;
  artworkUrl: string | null;
  screenshotUrls: string[];
  /** Vidéo de fond dont l'atelier dispose légalement, ou null. */
  video: { url: string; posterUrl: string | null } | null;
  /** Identifiant YouTube de la bande-annonce, ou null. */
  trailerYoutubeId: string | null;
  glow: string;
}

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function formatPrice(cents: number): string | null {
  return cents > 0 ? EURO.format(cents / 100) : null;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** Extrait l'identifiant d'une URL YouTube. Null si ce n'en est pas une. */
export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?&]v=([A-Za-z0-9_-]{6,})|youtu\.be\/([A-Za-z0-9_-]{6,})/);
  return match?.[1] ?? match?.[2] ?? null;
}

/**
 * Ligne de métadonnées : date, genre, studio — dans cet ordre, et uniquement
 * ce qui est renseigné. Une fiche vide ne produit pas « · · ».
 */
function metaLine(listing: GameListing): string | null {
  const parts = [formatDate(listing.releaseDate), listing.genres[0] ?? null, listing.developer].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Étiquette du rail. L'édition quand elle existe (« Remastered »), sinon
 * l'état réel du produit (« Neuf », « Occasion — grade A »), qui est toujours
 * renseigné.
 */
function tagFor(listing: GameListing): string {
  return listing.edition?.trim() || CONDITION_LABELS[listing.condition] || "Jeu";
}

export function toGameScene(listing: GameListing, index: number, demo = false): GameScene {
  return {
    productId: listing.productId,
    slug: listing.slug,
    href: demo ? null : `${ROUTES.shop}/${listing.slug}`,
    isDemo: demo,
    name: listing.name,
    tag: tagFor(listing),
    pitch: listing.summary,
    platforms: listing.platform ? [listing.platform] : [],
    meta: metaLine(listing),
    price: demo ? null : formatPrice(listing.priceCents),
    inStock: listing.inStock,
    // Une fiche de démonstration ne promet pas un achat : elle renvoie vers
    // la bande-annonce, seule action honnête tant que le jeu n'est pas en rayon.
    cta: demo ? "Bientôt en rayon" : listing.inStock ? "Voir la fiche" : "Bientôt de retour",
    coverUrl: listing.coverUrl,
    artworkUrl: listing.heroUrl,
    screenshotUrls: listing.screenshotUrls.slice(0, 2),
    video: listing.video,
    trailerYoutubeId: youtubeId(listing.trailerUrl),
    glow: GLOWS[index % GLOWS.length]!,
  };
}

/**
 * La scène est chorégraphiée en CSS sur cinq segments (`:nth-child(1..5)` dans
 * app/globals.css). Au-delà, les panneaux surnuméraires n'auraient aucune
 * plage d'animation et resteraient invisibles : on borne ici plutôt que de
 * laisser un jeu muet au milieu du rail.
 */
export const GAME_SCENE_SLOTS = 5;

export function toGameScenes(listings: GameListing[], demo = false): GameScene[] {
  return listings.slice(0, GAME_SCENE_SLOTS).map((l, i) => toGameScene(l, i, demo));
}

/**
 * Le rail complet, au-delà des cinq panneaux chorégraphiés.
 *
 * La scène anime cinq segments ; la vitrine en compte bien plus. Les jeux
 * suivants sont présentés sous la scène, en grille, pour que la sélection
 * paraisse ce qu'elle est — un vrai rayon — sans casser la chorégraphie.
 */
export function toGameGrid(listings: GameListing[], demo = false): GameScene[] {
  return listings.slice(GAME_SCENE_SLOTS).map((l, i) => toGameScene(l, i + GAME_SCENE_SLOTS, demo));
}
