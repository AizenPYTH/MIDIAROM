import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getGames } from "@/lib/igdb/service";
import type { GameListing } from "@/lib/shop/games";

/**
 * Vitrine de démonstration de la section « Derniers jeux ».
 *
 * Le catalogue réel ne contient encore aucun jeu, et c'est voulu : le magasin
 * saisira son stock plus tard. En attendant, l'accueil doit pouvoir se juger
 * sur pièce. Cette source affiche donc une sélection de jeux **réels**, tirés
 * d'IGDB comme n'importe quelle autre fiche.
 *
 * Elle est volontairement tenue à l'écart du stock :
 *
 *   - ce ne sont PAS des produits : rien n'est créé dans `products` ;
 *   - aucun prix, aucune disponibilité, aucun lien vers une fiche produit —
 *     annoncer qu'un jeu est achetable alors qu'il n'est pas au catalogue
 *     serait un mensonge commercial ;
 *   - dès qu'un seul jeu réel entre au catalogue, cette source s'efface
 *     (voir `getHomepageGames`) ;
 *   - pour la supprimer définitivement : effacer `demo-games.json` et l'appel
 *     dans `lib/shop/games.ts`. Rien d'autre n'en dépend.
 *
 * Les identifiants IGDB ne sont pas écrits à la main — ils seraient faux. Le
 * script `npm run demo:games` interroge IGDB à partir des titres ci-dessous,
 * écrit les fiches dans le cache et le fichier `demo-games.json`.
 */

/**
 * Les titres de la sélection : récents, connus, variés en genre et en
 * plateforme, choisis pour la qualité de leurs visuels. Un titre est un fait,
 * pas une donnée inventée ; c'est IGDB qui fournit identifiant, jaquette et
 * artwork.
 */
export const DEMO_GAME_TITLES = [
  "The Legend of Zelda: Tears of the Kingdom",
  "Elden Ring",
  "God of War Ragnarök",
  "Baldur's Gate 3",
  "Marvel's Spider-Man 2",
  "Hollow Knight: Silksong",
  "Red Dead Redemption 2",
  "Cyberpunk 2077",
  "The Witcher 3: Wild Hunt",
  "Final Fantasy VII Rebirth",
  "Resident Evil 4",
  "Super Mario Odyssey",
  "Hades II",
  "Star Wars Jedi: Survivor",
  "Alan Wake II",
  "Horizon Forbidden West",
  "Ghost of Tsushima",
  "Death Stranding",
  "Sekiro: Shadows Die Twice",
  "Bloodborne",
  "Metroid Dread",
  "Persona 5 Royal",
  "Street Fighter 6",
  "Forza Horizon 5",
  "It Takes Two",
  "Disco Elysium",
  "Returnal",
  "Silent Hill 2",
] as const;

interface DemoEntry {
  igdbId: number;
  title: string;
}

/** Le fichier écrit par `npm run demo:games`. Absent tant qu'il n'a pas tourné. */
async function readDemoFile(): Promise<DemoEntry[]> {
  try {
    const raw = await readFile(path.join(process.cwd(), "lib/shop/demo-games.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is DemoEntry => typeof e?.igdbId === "number" && typeof e?.title === "string");
  } catch {
    return [];
  }
}

/**
 * La sélection, sous la forme que l'accueil consomme déjà.
 *
 * On réutilise `GameListing` pour que les composants n'aient rien à savoir de
 * la provenance. Les champs commerciaux sont neutres : prix nul, `inStock` à
 * faux, `productId` préfixé `demo:` — de quoi les reconnaître sans ambiguïté.
 */
export async function getDemoGames(limit = 24): Promise<GameListing[]> {
  const entries = (await readDemoFile()).slice(0, Math.max(1, limit));
  if (!entries.length) return [];
  const games = await getGames(entries.map((e) => e.igdbId));
  const out: GameListing[] = [];
  for (const entry of entries) {
    const game = games.get(entry.igdbId);
    if (!game) continue;
    out.push({
      productId: `demo:${game.igdbId}`,
      slug: game.slug,
      name: game.name,
      platform: game.platforms[0] ?? null,
      edition: null,
      priceCents: 0,
      compareAtPriceCents: null,
      condition: "NEW",
      inStock: false,
      igdbId: game.igdbId,
      summary: game.summary,
      releaseDate: game.releaseDate,
      genres: game.genres,
      developer: game.developer,
      publisher: game.publisher,
      rating: game.rating,
      ratingCount: game.ratingCount,
      coverUrl: game.cover?.url ?? null,
      heroUrl: game.artworks[0]?.url ?? game.screenshots[0]?.url ?? null,
      screenshotUrls: game.screenshots.map((s) => s.url),
      productImages: [],
      video: null,
      trailerUrl: game.trailer?.watchUrl ?? null,
    });
  }
  return out;
}

/** Une fiche de démonstration se reconnaît à son identifiant. */
export function isDemoListing(listing: Pick<GameListing, "productId">): boolean {
  return listing.productId.startsWith("demo:");
}
