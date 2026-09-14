import type { Game, GameImage, GameImageSize, GameTrailer, IgdbGame, IgdbImage, IgdbVideo } from "@/lib/igdb/types";

/**
 * Traduction IGDB → modèle interne.
 *
 * Seul fichier du dépôt autorisé à connaître la forme des réponses IGDB. Tout
 * ce qui sort d'ici est du `Game`, utilisable tel quel par une page ou un
 * composant.
 */

const IMAGE_CDN = "https://images.igdb.com/igdb/image/upload";

/**
 * URL d'une image IGDB à la taille demandée.
 *
 * Le CDN sert n'importe quelle taille à partir du seul `image_id` : on stocke
 * donc l'identifiant, jamais une URL figée. `t_*_2x` double la densité pour les
 * écrans Retina.
 */
export function igdbImageUrl(imageId: string, size: GameImageSize = "cover_big", retina = false): string {
  return `${IMAGE_CDN}/t_${size}${retina ? "_2x" : ""}/${imageId}.jpg`;
}

function toImage(raw: IgdbImage | undefined | null, size: GameImageSize): GameImage | null {
  if (!raw?.image_id) return null;
  return { imageId: raw.image_id, url: igdbImageUrl(raw.image_id, size), width: raw.width ?? null, height: raw.height ?? null };
}

function toImages(raw: IgdbImage[] | undefined, size: GameImageSize, limit: number): GameImage[] {
  if (!raw?.length) return [];
  return raw.map((i) => toImage(i, size)).filter((i): i is GameImage => i !== null).slice(0, limit);
}

/**
 * Bande-annonce.
 *
 * IGDB ne renvoie qu'un identifiant YouTube, jamais un fichier vidéo. On
 * construit donc une référence exploitable (page de visionnage + vignette
 * officielle) sans jamais télécharger ni réhéberger la vidéo : ce serait
 * contraire aux conditions de YouTube comme d'IGDB.
 */
function toTrailer(videos: IgdbVideo[] | undefined): GameTrailer | null {
  if (!videos?.length) return null;
  // Une bande-annonce plutôt qu'un making-of quand IGDB nomme la vidéo.
  const preferred = videos.find((v) => /trailer|bande[- ]annonce/i.test(v.name ?? "")) ?? videos[0];
  if (!preferred?.video_id) return null;
  return {
    provider: "youtube",
    videoId: preferred.video_id,
    title: preferred.name ?? null,
    posterUrl: `https://img.youtube.com/vi/${preferred.video_id}/maxresdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${preferred.video_id}`,
  };
}

function company(raw: IgdbGame["involved_companies"], role: "developer" | "publisher"): string | null {
  return raw?.find((c) => c[role] && c.company?.name)?.company?.name ?? null;
}

/** Epoch secondes IGDB → date ISO seule, ou null. */
function toReleaseDate(epochSeconds: number | undefined): string | null {
  if (!epochSeconds) return null;
  const date = new Date(epochSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Nombre fini et positif, sinon null : IGDB renvoie parfois 0 pour « inconnu ». */
function toRating(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

export function normalizeGame(raw: IgdbGame): Game {
  return {
    igdbId: raw.id,
    name: raw.name,
    slug: raw.slug,
    summary: raw.summary?.trim() || null,
    storyline: raw.storyline?.trim() || null,
    releaseDate: toReleaseDate(raw.first_release_date),
    platforms: (raw.platforms ?? []).map((p) => p.name).filter(Boolean),
    genres: (raw.genres ?? []).map((g) => g.name).filter(Boolean),
    developer: company(raw.involved_companies, "developer"),
    publisher: company(raw.involved_companies, "publisher"),
    rating: toRating(raw.total_rating),
    ratingCount: toRating(raw.total_rating_count),
    cover: toImage(raw.cover, "cover_big"),
    // Bornés : une fiche IGDB peut porter des dizaines de visuels, dont on
    // n'affichera jamais la moitié, et qu'on stockerait pour rien.
    artworks: toImages(raw.artworks, "1080p", 6),
    screenshots: toImages(raw.screenshots, "screenshot_big", 8),
    trailer: toTrailer(raw.videos),
  };
}

/**
 * Visuel de fond d'une grande section (hero).
 *
 * Un artwork est composé pour être vu en large ; une capture d'écran dépanne ;
 * la jaquette, verticale, est le dernier recours. Renvoie null plutôt qu'une
 * image inadaptée : l'appelant sait alors afficher un aplat.
 */
export function heroImage(game: Game): GameImage | null {
  return game.artworks[0] ?? game.screenshots[0] ?? null;
}

/** Visuel de carte produit : la jaquette, puis n'importe quoi de présentable. */
export function cardImage(game: Game): GameImage | null {
  return game.cover ?? game.artworks[0] ?? game.screenshots[0] ?? null;
}
