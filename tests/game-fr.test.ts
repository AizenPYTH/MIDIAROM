import { describe, expect, it } from "vitest";
import { genreFr, genresFr, platformFr, yearOf } from "@/lib/shop/game-fr";
import { toGameScene } from "@/lib/shop/game-scene";
import type { GameListing } from "@/lib/shop/games";

/**
 * Le site est en français de bout en bout. IGDB ne sert que de l'anglais : ce
 * test verrouille la frontière — ce qui se traduit est traduit, ce qui ne se
 * traduit pas est écarté, et rien n'est inventé pour combler le vide.
 */

describe("genres", () => {
  it("traduit le vocabulaire d'IGDB", () => {
    expect(genreFr("Role-playing (RPG)")).toBe("Jeu de rôle");
    expect(genreFr("Shooter")).toBe("Tir");
    expect(genreFr("Hack and slash/Beat 'em up")).toBe("Action-baston");
  });

  it("écarte un genre inconnu plutôt que de l'afficher en anglais", () => {
    expect(genreFr("Battle Royale")).toBeNull();
    expect(genresFr(["Shooter", "Battle Royale", "Adventure"])).toEqual(["Tir", "Aventure"]);
  });

  it("borne la liste : deux genres suffisent à situer un jeu", () => {
    expect(genresFr(["Adventure", "Puzzle", "Indie", "Arcade"])).toHaveLength(2);
  });
});

describe("plateformes", () => {
  it("raccourcit ce qu'IGDB rallonge", () => {
    expect(platformFr("PC (Microsoft Windows)")).toBe("PC");
  });

  it("laisse les marques intactes — elles ne se traduisent pas", () => {
    expect(platformFr("PlayStation 5")).toBe("PlayStation 5");
    expect(platformFr("Sega Mega Drive")).toBe("Sega Mega Drive");
  });
});

describe("année", () => {
  it("ne garde que l'année d'une date ISO", () => {
    expect(yearOf("2023-05-12")).toBe("2023");
    expect(yearOf(null)).toBeNull();
    expect(yearOf("bientôt")).toBeNull();
  });
});

function listing(over: Partial<GameListing> = {}): GameListing {
  return {
    productId: "demo:1", slug: "jeu", name: "Jeu", platform: "PC (Microsoft Windows)", edition: null,
    condition: "NEW", priceCents: 0, inStock: false, summary: "An English summary from IGDB.",
    releaseDate: "2023-05-12", genres: ["Role-playing (RPG)", "Battle Royale"], developer: "Studio",
    coverUrl: null, heroUrl: null, screenshotUrls: [], video: null, trailerUrl: null, ...over,
  } as GameListing;
}

describe("la fiche affichée", () => {
  it("n'affiche jamais le résumé anglais d'une fiche de démonstration", () => {
    expect(toGameScene(listing(), 0, true).pitch).toBeNull();
  });

  it("garde la description du magasin pour un vrai produit", () => {
    expect(toGameScene(listing({ summary: "Rédigé par le magasin." }), 0).pitch).toBe("Rédigé par le magasin.");
  });

  it("compose une ligne de métadonnées entièrement française", () => {
    const meta = toGameScene(listing(), 0, true).meta!;
    expect(meta).toBe("Jeu de rôle · 2023 · Studio");
    expect(meta).not.toMatch(/Role-playing|Battle Royale/);
  });

  it("affiche la plateforme sous son nom d'usage", () => {
    expect(toGameScene(listing(), 0, true).platforms).toEqual(["PC"]);
  });

  it("ne fabrique pas de ligne à partir de rien", () => {
    expect(toGameScene(listing({ genres: [], releaseDate: null, developer: null }), 0, true).meta).toBeNull();
  });
});
