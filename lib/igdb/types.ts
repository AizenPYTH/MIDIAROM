/**
 * IGDB — contrat de données.
 *
 * Deux familles de types vivent ici, et la frontière entre les deux est le
 * point important : `Igdb*` décrit ce que l'API renvoie, `Game` décrit ce que
 * le reste de l'application manipule. Aucun composant, aucune page, aucune
 * route ne doit importer un type `Igdb*` : le jour où IGDB change de schéma,
 * seul `lib/igdb/normalize.ts` doit bouger.
 */

// ---------------------------------------------------------------------------
// Réponses brutes IGDB (seulement les champs demandés par lib/igdb/client.ts)
// ---------------------------------------------------------------------------

export interface IgdbImage {
  id: number;
  image_id: string;
  width?: number;
  height?: number;
}

export interface IgdbCompanyInvolvement {
  developer?: boolean;
  publisher?: boolean;
  company?: { id: number; name: string };
}

export interface IgdbVideo {
  id: number;
  name?: string;
  video_id: string; // identifiant YouTube
}

export interface IgdbNamed {
  id: number;
  name: string;
  abbreviation?: string;
}

export interface IgdbGame {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number; // epoch secondes
  total_rating?: number;
  total_rating_count?: number;
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  platforms?: IgdbNamed[];
  genres?: IgdbNamed[];
  involved_companies?: IgdbCompanyInvolvement[];
  videos?: IgdbVideo[];
  external_games?: { id: number; category?: number; uid?: string }[];
  parent_game?: number;
  version_parent?: number;
}

// ---------------------------------------------------------------------------
// Modèle interne — le seul que le reste du site connaît
// ---------------------------------------------------------------------------

/** Taille d'image IGDB. Le nom correspond au segment d'URL du CDN. */
export type GameImageSize = "thumb" | "cover_small" | "cover_big" | "screenshot_med" | "screenshot_big" | "screenshot_huge" | "720p" | "1080p";

export interface GameImage {
  /** Identifiant IGDB de l'image : suffit à reconstruire n'importe quelle taille. */
  imageId: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface GameTrailer {
  /** Seule YouTube est renvoyée par IGDB aujourd'hui. */
  provider: "youtube";
  videoId: string;
  title: string | null;
  /** Vignette officielle, utilisable comme affiche de la vidéo. */
  posterUrl: string;
  watchUrl: string;
}

/**
 * Un jeu, tel que l'application le manipule.
 *
 * Tous les champs facultatifs sont explicitement `null` plutôt qu'absents :
 * une fiche incomplète est un cas normal (IGDB ne connaît pas tout), pas une
 * erreur, et le rendu doit pouvoir s'écrire sans `?.` en cascade.
 */
export interface Game {
  igdbId: number;
  name: string;
  slug: string;
  summary: string | null;
  storyline: string | null;
  releaseDate: string | null; // ISO, date seule
  platforms: string[];
  genres: string[];
  developer: string | null;
  publisher: string | null;
  rating: number | null; // 0–100
  ratingCount: number | null;
  cover: GameImage | null;
  artworks: GameImage[];
  screenshots: GameImage[];
  trailer: GameTrailer | null;
}

/** Un candidat de correspondance, avec de quoi juger sans ouvrir IGDB. */
export interface GameMatch {
  game: Game;
  /** 0 à 1. Voir lib/igdb/match.ts pour la composition du score. */
  confidence: number;
  /** Ce qui a fait monter ou descendre le score, en clair, pour le back-office. */
  reasons: string[];
  /** Au-dessus du seuil d'association automatique ? */
  isConfident: boolean;
}

/** Ce qu'on sait du produit au moment de chercher son jeu. */
export interface GameLookupHints {
  name: string;
  platform?: string | null;
  ean?: string | null;
  sku?: string | null;
  edition?: string | null;
  region?: string | null;
  releaseYear?: number | null;
}
