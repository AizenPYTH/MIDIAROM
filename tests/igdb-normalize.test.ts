import { describe, expect, it } from "vitest";
import { cardImage, heroImage, igdbImageUrl, normalizeGame } from "@/lib/igdb/normalize";
import type { IgdbGame } from "@/lib/igdb/types";

/** Réponse IGDB représentative : champs présents, imbriqués, et epoch secondes. */
const RAW: IgdbGame = {
  id: 1942,
  name: "The Witcher 3: Wild Hunt",
  slug: "the-witcher-3-wild-hunt",
  summary: "  Un sorceleur cherche Ciri.  ",
  first_release_date: 1431993600, // 2015-05-19
  total_rating: 93.7,
  total_rating_count: 4210,
  cover: { id: 1, image_id: "co1wyy", width: 1200, height: 1600 },
  artworks: [{ id: 2, image_id: "ar1aaa" }, { id: 3, image_id: "ar1bbb" }],
  screenshots: [{ id: 4, image_id: "sc1aaa" }],
  platforms: [{ id: 48, name: "PlayStation 4" }, { id: 167, name: "PlayStation 5" }],
  genres: [{ id: 12, name: "Role-playing (RPG)" }],
  involved_companies: [
    { developer: true, company: { id: 1, name: "CD Projekt RED" } },
    { publisher: true, company: { id: 2, name: "CD Projekt" } },
  ],
  videos: [{ id: 9, name: "Making of", video_id: "aaa" }, { id: 10, name: "Launch Trailer", video_id: "bbb" }],
};

describe("normalizeGame", () => {
  const game = normalizeGame(RAW);

  it("convertit la date epoch en date ISO", () => {
    expect(game.releaseDate).toBe("2015-05-19");
  });

  it("aplatit sociétés, plateformes et genres", () => {
    expect(game.developer).toBe("CD Projekt RED");
    expect(game.publisher).toBe("CD Projekt");
    expect(game.platforms).toEqual(["PlayStation 4", "PlayStation 5"]);
    expect(game.genres).toEqual(["Role-playing (RPG)"]);
  });

  it("nettoie le résumé et arrondit la note", () => {
    expect(game.summary).toBe("Un sorceleur cherche Ciri.");
    expect(game.rating).toBe(94);
  });

  it("préfère une bande-annonce à un making-of", () => {
    expect(game.trailer?.videoId).toBe("bbb");
    expect(game.trailer?.watchUrl).toContain("bbb");
    expect(game.trailer?.posterUrl).toContain("img.youtube.com");
  });

  it("construit des URL d'image à partir du seul identifiant", () => {
    expect(game.cover?.url).toBe(igdbImageUrl("co1wyy", "cover_big"));
    expect(game.cover?.imageId).toBe("co1wyy");
  });

  it("survit à une fiche vide sans jeter", () => {
    const bare = normalizeGame({ id: 7, name: "Inconnu", slug: "inconnu" });
    expect(bare.releaseDate).toBeNull();
    expect(bare.cover).toBeNull();
    expect(bare.trailer).toBeNull();
    expect(bare.platforms).toEqual([]);
    expect(bare.rating).toBeNull();
  });

  it("traite un total_rating à 0 comme une absence de note", () => {
    expect(normalizeGame({ ...RAW, total_rating: 0 }).rating).toBeNull();
  });
});

describe("choix du visuel selon l'usage", () => {
  it("prend un artwork pour une grande section, la jaquette pour une carte", () => {
    const game = normalizeGame(RAW);
    expect(heroImage(game)?.imageId).toBe("ar1aaa");
    expect(cardImage(game)?.imageId).toBe("co1wyy");
  });

  it("se rabat sur une capture quand il n'y a pas d'artwork", () => {
    const game = normalizeGame({ ...RAW, artworks: [] });
    expect(heroImage(game)?.imageId).toBe("sc1aaa");
  });

  it("ne renvoie pas une jaquette verticale comme fond de section", () => {
    const game = normalizeGame({ ...RAW, artworks: [], screenshots: [] });
    expect(heroImage(game)).toBeNull();
    expect(cardImage(game)?.imageId).toBe("co1wyy");
  });
});
