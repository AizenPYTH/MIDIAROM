import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGames } from "@/lib/igdb/service";
import { cardImage, heroImage } from "@/lib/igdb/normalize";
import type { Game } from "@/lib/igdb/types";
import type { Product } from "@/lib/shop/catalog";

/**
 * Source de données de la section « Derniers jeux » de l'accueil.
 *
 * Un produit de la boutique, augmenté de sa fiche IGDB quand elle existe. Les
 * composants d'affichage (carte, rail, jeu mis en avant) reçoivent ce type et
 * rien d'autre : ils ignorent jusqu'à l'existence d'IGDB, et continuent de
 * fonctionner si la fiche manque.
 *
 * Tout se lit dans NOTRE base : afficher l'accueil ne déclenche aucun appel à
 * IGDB, jamais, même à froid. Une fiche absente donne des visuels à null, que
 * l'affichage remplace par les photos du produit puis par un aplat.
 */
export interface GameListing {
  /** Identité côté boutique — toujours présente. */
  productId: string;
  slug: string;
  name: string;
  platform: string | null;
  edition: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  condition: Product["condition"];
  inStock: boolean;

  /** Enrichissement IGDB — null quand la fiche manque ou n'est pas associée. */
  igdbId: number | null;
  summary: string | null;
  releaseDate: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  rating: number | null;
  ratingCount: number | null;

  /** Visuels déjà choisis pour leur usage : rien à arbitrer côté composant. */
  coverUrl: string | null;
  heroUrl: string | null;
  screenshotUrls: string[];
  /** Photos du produit lui-même, repli quand IGDB n'a rien. */
  productImages: string[];

  /** Vidéo utilisable en fond de section, ou null. Voir hero-video plus bas. */
  video: { url: string; posterUrl: string | null } | null;
  /** Bande-annonce YouTube : une référence, jamais un fichier réhébergé. */
  trailerUrl: string | null;
}

const IN_STOCK = (p: Pick<Product, "quantity">) => (p.quantity ?? 0) > 0;

/**
 * Assemble un produit et sa fiche IGDB.
 *
 * Ordre de repli des visuels, tel que demandé : IGDB, puis nos propres photos,
 * puis rien — l'affichage pose alors son propre aplat. Aucun de ces cas n'est
 * une erreur.
 */
function toListing(product: Product, game: Game | null): GameListing {
  const cover = game ? cardImage(game) : null;
  const hero = game ? heroImage(game) : null;
  const productImages = (product.images ?? []).filter(Boolean);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    platform: product.platform,
    edition: product.edition,
    priceCents: product.price_cents,
    compareAtPriceCents: product.compare_at_price_cents,
    condition: product.condition,
    inStock: IN_STOCK(product),

    igdbId: game?.igdbId ?? null,
    summary: game?.summary ?? product.description ?? null,
    releaseDate: game?.releaseDate ?? null,
    genres: game?.genres ?? [],
    developer: game?.developer ?? null,
    publisher: game?.publisher ?? null,
    rating: game?.rating ?? null,
    ratingCount: game?.ratingCount ?? null,

    coverUrl: cover?.url ?? productImages[0] ?? null,
    heroUrl: hero?.url ?? productImages[0] ?? null,
    screenshotUrls: (game?.screenshots ?? []).map((s) => s.url),
    productImages,

    // La vidéo de fond n'est JAMAIS déduite d'IGDB : seulement une URL que
    // l'atelier a renseignée parce qu'il en dispose légalement.
    video: product.hero_video_url
      ? { url: product.hero_video_url, posterUrl: product.hero_video_poster_path ?? hero?.url ?? null }
      : null,
    trailerUrl: game?.trailer?.watchUrl ?? null,
  };
}

/** Charge les fiches IGDB de plusieurs produits en une seule requête. */
async function withGames(products: Product[]): Promise<GameListing[]> {
  const ids = products.map((p) => p.igdb_game_id).filter((id): id is number => typeof id === "number");
  const games = await getGames(ids);
  return products.map((p) => toListing(p, p.igdb_game_id ? (games.get(Number(p.igdb_game_id)) ?? null) : null));
}

/**
 * Les derniers jeux entrés au catalogue.
 *
 * Une requête produits, une requête fiches. Vingt cartes coûtent deux
 * allers-retours à notre base et zéro à IGDB.
 */
export const getLatestGames = cache(async (limit = 12): Promise<GameListing[]> => {
  const { data } = await createSupabaseAdminClient()
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("category", "GAME")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 48));
  return withGames(data ?? []);
});

/**
 * Le jeu mis en avant.
 *
 * On privilégie un produit marqué en avant par l'atelier ; à défaut le jeu le
 * plus récent qui a de quoi remplir un grand visuel. Renvoie null quand le
 * catalogue n'a rien : la section disparaît, elle ne s'affiche pas vide.
 */
export const getFeaturedGame = cache(async (): Promise<GameListing | null> => {
  const db = createSupabaseAdminClient();
  const { data: featured } = await db
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("category", "GAME")
    .eq("is_featured", true)
    .order("display_order", { ascending: true })
    .limit(1);
  if (featured?.length) return (await withGames(featured))[0] ?? null;

  const { data: recent } = await db
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("category", "GAME")
    .not("igdb_game_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);
  const listings = await withGames(recent ?? []);
  return listings.find((l) => l.heroUrl) ?? listings[0] ?? null;
});

/** Tout ce dont la section « Derniers jeux » a besoin, en une fois. */
export const getHomepageGames = cache(async (limit = 12): Promise<{ featured: GameListing | null; latest: GameListing[] }> => {
  const [featured, latest] = await Promise.all([getFeaturedGame(), getLatestGames(limit)]);
  return { featured, latest };
});
