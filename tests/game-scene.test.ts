import { describe, expect, it } from "vitest";
import { GAME_SCENE_SLOTS, toGameGrid, toGameScene, toGameScenes, youtubeId } from "@/lib/shop/game-scene";
import type { GameListing } from "@/lib/shop/games";

function listing(over: Partial<GameListing> = {}): GameListing {
  return {
    productId: "p1",
    slug: "elden-ring",
    name: "Elden Ring",
    platform: "PS5",
    edition: null,
    condition: "NEW",
    priceCents: 4990,
    inStock: true,
    summary: "Un jeu d'action.",
    releaseDate: "2022-02-25",
    genres: ["Action"],
    developer: "FromSoftware",
    coverUrl: "https://images.igdb.com/cover.jpg",
    heroUrl: "https://images.igdb.com/hero.jpg",
    screenshotUrls: ["https://images.igdb.com/s1.jpg", "https://images.igdb.com/s2.jpg", "https://images.igdb.com/s3.jpg"],
    video: null,
    trailerUrl: "https://www.youtube.com/watch?v=AKXiKBnzpBQ",
    ...over,
  } as GameListing;
}

describe("toGameScene — produit réel", () => {
  it("renvoie vers la fiche produit et affiche le prix", () => {
    const scene = toGameScene(listing(), 0);
    expect(scene.href).toBe("/boutique/elden-ring");
    expect(scene.isDemo).toBe(false);
    // Intl insère une espace fine insécable avant le symbole : on compare
    // les chiffres et la devise, pas le caractère d'espacement.
    expect(scene.price?.replace(/\s/g, " ")).toBe("50 €");
    expect(scene.cta).toBe("Voir la fiche");
  });

  it("annonce le retour plutôt que l'achat quand le stock est vide", () => {
    expect(toGameScene(listing({ inStock: false }), 0).cta).toBe("Bientôt de retour");
  });

  it("ne fabrique pas de ligne de métadonnées à partir de rien", () => {
    const scene = toGameScene(listing({ releaseDate: null, genres: [], developer: null }), 0);
    expect(scene.meta).toBeNull();
  });
});

describe("toGameScene — vitrine de démonstration", () => {
  /**
   * Le point dur de cette vitrine : un jeu qui n'est pas au catalogue ne doit
   * jamais se présenter comme achetable. Pas de lien — un lien mort, ou pire,
   * une promesse commerciale fausse — et pas de prix.
   */
  it("n'a ni lien produit ni prix", () => {
    const scene = toGameScene(listing({ productId: "demo:1029", priceCents: 0 }), 0, true);
    expect(scene.href).toBeNull();
    expect(scene.price).toBeNull();
    expect(scene.isDemo).toBe(true);
    expect(scene.cta).toBe("Bientôt en rayon");
  });

  it("ne chiffre pas non plus un jeu de démonstration porteur d'un prix", () => {
    expect(toGameScene(listing({ priceCents: 4990 }), 0, true).price).toBeNull();
  });
});

describe("répartition scène / grille", () => {
  const many = Array.from({ length: 9 }, (_, i) => listing({ productId: `p${i}`, slug: `jeu-${i}` }));

  it("borne la scène aux segments réellement chorégraphiés", () => {
    expect(toGameScenes(many)).toHaveLength(GAME_SCENE_SLOTS);
  });

  it("passe les jeux suivants en grille, sans en perdre ni en dupliquer", () => {
    const scenes = toGameScenes(many);
    const grid = toGameGrid(many);
    expect(scenes.length + grid.length).toBe(many.length);
    const ids = [...scenes, ...grid].map((s) => s.productId);
    expect(new Set(ids).size).toBe(many.length);
  });

  it("propage le caractère démonstratif à la grille", () => {
    expect(toGameGrid(many, true).every((s) => s.href === null && s.isDemo)).toBe(true);
  });
});

describe("youtubeId", () => {
  it("lit les deux formes d'URL", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=AKXiKBnzpBQ")).toBe("AKXiKBnzpBQ");
    expect(youtubeId("https://youtu.be/AKXiKBnzpBQ")).toBe("AKXiKBnzpBQ");
  });
  it("ne devine rien à partir d'autre chose", () => {
    expect(youtubeId("https://vimeo.com/12345")).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});
