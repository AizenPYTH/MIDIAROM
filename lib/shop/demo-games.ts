import "server-only";
import { getGames } from "@/lib/igdb/service";
import demoEntries from "@/lib/shop/demo-games.json";
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
  "Astro Bot",
  "Super Mario Bros. Wonder",
  "Mario Kart 8 Deluxe",
  "Splatoon 3",
  "Animal Crossing: New Horizons",
  "Pikmin 4",
  "Xenoblade Chronicles 3",
  "Fire Emblem: Three Houses",
  "Luigi's Mansion 3",
  "Kirby and the Forgotten Land",
  "The Legend of Zelda: Breath of the Wild",
  "Super Smash Bros. Ultimate",
  "Demon's Souls",
  "Dark Souls III",
  "Nier: Automata",
  "Monster Hunter: World",
  "Monster Hunter Rise",
  "Dragon Quest XI",
  "Octopath Traveler II",
  "Like a Dragon: Infinite Wealth",
  "Yakuza 0",
  "Devil May Cry 5",
  "Resident Evil Village",
  "Dead Space",
  "Diablo IV",
  "Starfield",
  "The Last of Us Part II",
  "Uncharted 4: A Thief's End",
  "Gran Turismo 7",
  "Ratchet & Clank: Rift Apart",
  "Stray",
  "Cuphead",
  "Celeste",
  "Ori and the Will of the Wisps",
  "Hollow Knight",
  "Dead Cells",
  "Hades",
  "Slay the Spire",
  "Outer Wilds",
  "Subnautica",
  "Terraria",
  "Stardew Valley",
  "Elden Ring: Shadow of the Erdtree",
  "Final Fantasy XVI",
  "Tekken 8",
  "Mortal Kombat 1",
  "EA Sports FC 24",
  "Assassin's Creed Mirage",
  "Kingdom Come: Deliverance II",
  "Black Myth: Wukong",
  "Metaphor: ReFantazio",
  "Dragon's Dogma 2",
  "Helldivers II",
  "Balatro",
  "Sea of Stars",
  "Pentiment",
  "Pizza Tower",
  "Lies of P",
  "Armored Core VI: Fires of Rubicon",
] as const;

interface DemoEntry {
  igdbId: number;
  title: string;
}

/** Le fichier écrit par `npm run demo:games`. Absent tant qu'il n'a pas tourné. */
/**
 * Les entrées de la vitrine, **importées** et non lues sur le disque.
 *
 * C'était un vrai bug de production. Le fichier était lu au runtime par
 * `readFile(path.join(process.cwd(), …))` : en local ça marche, mais le
 * traçage de fichiers de Next ne suit pas un chemin construit à l'exécution.
 * Le JSON n'était donc pas embarqué dans la fonction serverless, la lecture
 * échouait silencieusement (`catch → []`), et l'accueil déployé restait vide —
 * sans jeu vedette, donc sans scène, donc sans vidéo.
 *
 * Un import statique est résolu à la compilation : le contenu part dans le
 * bundle. Le fichier est donc versionné, vaut `[]` par défaut, et
 * `npm run demo:games` le réécrit — il faut ensuite le committer.
 */
function readDemoFile(): DemoEntry[] {
  const parsed: unknown = demoEntries;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (e): e is DemoEntry =>
      typeof (e as DemoEntry)?.igdbId === "number" && typeof (e as DemoEntry)?.title === "string",
  );
}

/**
 * La sélection, sous la forme que l'accueil consomme déjà.
 *
 * On réutilise `GameListing` pour que les composants n'aient rien à savoir de
 * la provenance. Les champs commerciaux sont neutres : prix nul, `inStock` à
 * faux, `productId` préfixé `demo:` — de quoi les reconnaître sans ambiguïté.
 */
export async function getDemoGames(limit = 24): Promise<GameListing[]> {
  const entries = readDemoFile().slice(0, Math.max(1, limit));
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
