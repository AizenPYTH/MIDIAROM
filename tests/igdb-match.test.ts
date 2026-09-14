import { describe, expect, it } from "vitest";
import { AUTO_MATCH_THRESHOLD, canonicalPlatform, rankMatches, scoreMatch, titleSimilarity } from "@/lib/igdb/match";
import type { Game } from "@/lib/igdb/types";

function game(partial: Partial<Game> & Pick<Game, "igdbId" | "name">): Game {
  return {
    slug: partial.name.toLowerCase().replace(/\s+/g, "-"),
    summary: null, storyline: null, releaseDate: null, platforms: [], genres: [],
    developer: null, publisher: null, rating: null, ratingCount: null,
    cover: null, artworks: [], screenshots: [], trailer: null,
    ...partial,
  };
}

describe("canonicalPlatform", () => {
  it("ramène les orthographes courantes à la forme IGDB", () => {
    expect(canonicalPlatform("PS5")).toBe("playstation 5");
    expect(canonicalPlatform("ps 5")).toBe("playstation 5");
    expect(canonicalPlatform("PlayStation 5")).toBe("playstation 5");
    expect(canonicalPlatform("Switch")).toBe("nintendo switch");
    expect(canonicalPlatform("Xbox Series X")).toBe("xbox series x|s");
  });

  it("réduit une déclinaison de modèle à sa plateforme", () => {
    expect(canonicalPlatform("PlayStation 5 Digital Edition")).toBe("playstation 5");
    expect(canonicalPlatform("Nintendo Switch OLED")).toBe("nintendo switch");
  });

  it("ne prétend rien quand la plateforme est absente", () => {
    expect(canonicalPlatform(null)).toBeNull();
    expect(canonicalPlatform("")).toBeNull();
  });
});

describe("titleSimilarity", () => {
  it("note 1 pour deux titres identiques", () => {
    expect(titleSimilarity("god of war", "god of war")).toBe(1);
  });
  it("tolère un suffixe en trop", () => {
    expect(titleSimilarity("god of war ragnarok ps5", "god of war ragnarok")).toBeGreaterThan(0.9);
  });
  it("sépare deux titres différents", () => {
    expect(titleSimilarity("god of war", "gran turismo")).toBeLessThan(0.5);
  });
});

describe("scoreMatch — le piège des versions par plateforme", () => {
  const hints = { name: "FIFA 23", platform: "PS5" };
  const ps5 = game({ igdbId: 1, name: "FIFA 23", platforms: ["PlayStation 5", "Xbox Series X|S"] });
  const ps4 = game({ igdbId: 2, name: "FIFA 23", platforms: ["PlayStation 4"] });

  it("retient la fiche qui porte la bonne plateforme", () => {
    const [best] = rankMatches([ps4, ps5], hints);
    expect(best!.game.igdbId).toBe(1);
    expect(best!.isConfident).toBe(true);
  });

  it("refuse d'associer automatiquement une fiche d'une autre plateforme", () => {
    const wrong = scoreMatch(ps4, hints);
    expect(wrong.isConfident).toBe(false);
    expect(wrong.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
    expect(wrong.reasons.join(" ")).toContain("ABSENTE");
  });

  it("enfonce la mauvaise plateforme dans la bande « Peu probable »", () => {
    // Sans le bonus de plateforme, le plafond est déjà de 0,75 : ce n'est donc
    // pas la pénalité qui bloque l'association automatique. Son rôle est de
    // faire passer le candidat sous 0,60, seuil auquel le back-office bascule
    // de l'orange « À vérifier » au rouge « Peu probable ». C'est ce signal-là
    // qui évite qu'un titre parfaitement identique donne l'illusion d'un bon
    // candidat. Voir confidenceTone() dans components/admin/game-match.tsx.
    const wrong = scoreMatch(ps4, hints);
    expect(wrong.confidence).toBeLessThan(0.6);
  });

  it("reste sous le seuil quand la plateforme du produit est inconnue", () => {
    // Titre parfait mais rien pour départager : c'est exactement le cas où une
    // validation humaine doit être demandée.
    const m = scoreMatch(ps4, { name: "FIFA 23" });
    expect(m.isConfident).toBe(false);
  });
});

describe("scoreMatch — éditions", () => {
  const remaster = game({ igdbId: 10, name: "The Last of Us Part II Remastered", platforms: ["PlayStation 5"] });
  const original = game({ igdbId: 11, name: "The Last of Us Part II", platforms: ["PlayStation 4"] });

  it("préfère l'édition demandée", () => {
    const [best] = rankMatches([original, remaster], { name: "The Last of Us Part II Remastered", platform: "PS5" });
    expect(best!.game.igdbId).toBe(10);
  });
});

describe("scoreMatch — code-barres", () => {
  it("court-circuite tout quand l'EAN a désigné le jeu", () => {
    const m = scoreMatch(game({ igdbId: 5, name: "Titre sans rapport" }), { name: "Autre chose", platform: "PS5" }, true);
    expect(m.confidence).toBe(1);
    expect(m.isConfident).toBe(true);
  });
});

describe("scoreMatch — année", () => {
  it("départage deux homonymes par l'année de sortie", () => {
    const a = game({ igdbId: 20, name: "DOOM", platforms: ["PC (Microsoft Windows)"], releaseDate: "1993-12-10" });
    const b = game({ igdbId: 21, name: "DOOM", platforms: ["PC (Microsoft Windows)"], releaseDate: "2016-05-13" });
    const [best] = rankMatches([a, b], { name: "DOOM", platform: "PC", releaseYear: 2016 });
    expect(best!.game.igdbId).toBe(21);
  });
});
