import { describe, expect, it } from "vitest";
import { toGameScene, toGameScenes, youtubeId } from "@/lib/shop/game-scene";
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
   * La règle a changé, et c'est délibéré : la vitrine ressemble maintenant à
   * une boutique — les jeux ont une fiche et un prix indicatif. Ce qui n'a pas
   * changé, et que ce test protège : **leur fiche n'est jamais une fiche du
   * catalogue**. Un lien de démonstration qui pointerait vers `/boutique/<slug>`
   * promettrait un produit qui n'existe pas.
   */
  it("mène à sa propre fiche, jamais à une fiche du catalogue", () => {
    const scene = toGameScene(listing({ productId: "demo:1029", slug: "elden-ring" }), 0, true);
    expect(scene.href).toBe("/boutique/jeu/elden-ring");
    expect(scene.href).not.toBe("/boutique/elden-ring");
    expect(scene.isDemo).toBe(true);
  });

  it("affiche un prix, pour ressembler à un rayon", () => {
    expect(toGameScene(listing({ priceCents: 2999 }), 0, true).price).not.toBeNull();
  });

  it("invite à consulter, pas à acheter", () => {
    expect(toGameScene(listing(), 0, true).cta).toBe("Voir le jeu");
  });

  it("n'emprunte pas la description du catalogue", () => {
    // Les résumés IGDB sont en anglais : ils ne s'affichent pas.
    expect(toGameScene(listing({ summary: "An English summary." }), 0, true).pitch).toBeNull();
  });
});

describe("toGameScenes", () => {
  const many = Array.from({ length: 9 }, (_, i) => listing({ productId: `p${i}`, slug: `jeu-${i}` }));

  /**
   * Le rayon n'est plus borné à cinq. La scène chorégraphiée qui imposait cette
   * limite a été remplacée par une grille : tout ce qu'on lui donne s'affiche,
   * et c'est l'accueil qui décide combien de jaquettes il montre.
   */
  it("n'en perd aucun et n'en duplique aucun", () => {
    const scenes = toGameScenes(many);
    expect(scenes).toHaveLength(many.length);
    expect(new Set(scenes.map((s) => s.productId)).size).toBe(many.length);
  });

  it("propage le caractère démonstratif à toute la liste", () => {
    const scenes = toGameScenes(many, true);
    expect(scenes.every((s) => s.isDemo)).toBe(true);
    // Aucune ne doit pointer vers le catalogue réel.
    expect(scenes.every((s) => s.href?.startsWith("/boutique/jeu/"))).toBe(true);
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
