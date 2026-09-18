import { describe, expect, it } from "vitest";
import { LIBELLE_PLUS, MAX_VOLET, entreesDesRayons, type TagRayon } from "@/lib/shop/menu";
import { RAYONS_PAR_DEFAUT, rayonsPublics, type Rayon } from "@/lib/shop/rayons";

/**
 * Le volet d'un rayon dans l'en-tête.
 *
 * Ce qu'on protège ici : qu'il dise le mot du rayon et non « plateforme » par
 * défaut, qu'il montre ce que le magasin a réellement en stock plutôt que le
 * début de l'alphabet, et qu'il s'arrête avant de refaire la page.
 */

const PUBLICS = rayonsPublics(RAYONS_PAR_DEFAUT);

const tag = (rayon: string, valeur: string, nombre = 1): TagRayon => ({ rayon, valeur, nombre });

const CATALOGUE: TagRayon[] = [
  tag("GAME", "PlayStation 5", 4),
  tag("GAME", "Nintendo Switch", 3),
  tag("CONSOLE", "PlayStation 5", 2),
  tag("CONSOLE", "Nintendo 64"),
  tag("CONSOLE", "Xbox Series X"),
  tag("COLLECTIBLE", "One Piece", 2),
  tag("COLLECTIBLE", "Naruto Shippuden", 2),
];

function volet(code: string, tags = CATALOGUE) {
  const entree = entreesDesRayons(PUBLICS, tags).find((e) => e.href.endsWith(`cat=${PUBLICS.find((r) => r.code === code)!.slug}`));
  return entree?.volet;
}

describe("ce qu'un rayon déplie", () => {
  it("annonce la colonne avec le mot du rayon, pas avec un mot par défaut", () => {
    // C'est toute l'affaire : « One Piece » n'est pas une plateforme.
    expect(volet("CONSOLE")?.intitule).toBe("plateformes");
    expect(volet("GAME")?.intitule).toBe("plateformes");
    expect(volet("COLLECTIBLE")?.intitule).toBe("licences");
  });

  it("montre une plateforme dans chacun des rayons qui l'emploie", () => {
    // La version précédente ne la rattachait qu'au premier rayon : « Consoles »
    // perdait la PlayStation 5 parce que des jeux PlayStation 5 existaient.
    expect(volet("GAME")?.liens.map((l) => l.label)).toContain("PlayStation 5");
    expect(volet("CONSOLE")?.liens.map((l) => l.label)).toContain("PlayStation 5");
  });

  it("met les mieux fournies devant, et départage à l'alphabet", () => {
    expect(volet("GAME")?.liens.map((l) => l.label)).toEqual(["PlayStation 5", "Nintendo Switch"]);
    // Nintendo 64 et Xbox Series X sont à égalité : l'ordre ne doit pas bouger
    // d'une visite à l'autre.
    expect(volet("CONSOLE")?.liens.map((l) => l.label)).toEqual(["PlayStation 5", "Nintendo 64", "Xbox Series X"]);
  });

  it("mène au rayon filtré sur la valeur, en échappant les espaces", () => {
    expect(volet("COLLECTIBLE")?.liens.find((l) => l.label === "One Piece")).toEqual({ href: "/boutique?cat=figurines&plateforme=One%20Piece", label: "One Piece" });
  });
});

describe("le lien « voir plus »", () => {
  it("mène au rayon, et dit la même chose dans tous les rayons", () => {
    // Il a d'abord porté le compte — « Voir les 9 consoles ». Un compte reste
    // juste, mais n'apprend plus rien passé quelques dizaines de références :
    // « Voir les 312 jeux vidéo » ne se lit pas, il se subit.
    expect(volet("GAME")?.plus).toEqual({ href: "/boutique?cat=jeux", label: LIBELLE_PLUS });
    expect(volet("CONSOLE")?.plus).toEqual({ href: "/boutique?cat=consoles", label: LIBELLE_PLUS });
    expect(volet("COLLECTIBLE")?.plus).toEqual({ href: "/boutique?cat=figurines", label: LIBELLE_PLUS });
  });
});

describe("ce que le volet ne fait pas", () => {
  it("ne s'ouvre pas sur un rayon sans article", () => {
    expect(volet("CONSOLE", [])).toBeUndefined();
    expect(entreesDesRayons(PUBLICS, []).every((e) => !e.volet)).toBe(true);
  });

  it("ne déroule pas tout le catalogue : le reste est derrière le lien du bas", () => {
    const beaucoup = Array.from({ length: MAX_VOLET + 7 }, (_, i) => tag("COLLECTIBLE", `Licence ${String(i).padStart(2, "0")}`, 30 - i));
    const v = volet("COLLECTIBLE", beaucoup);
    expect(v?.liens).toHaveLength(MAX_VOLET);
    expect(v?.liens.at(-1)?.label).toBe(`Licence ${String(MAX_VOLET - 1).padStart(2, "0")}`);
  });

  it("suit un rayon créé après coup, sans rien redéployer", () => {
    const goodies: Rayon = { code: "GOODIES", label: "Goodies et porte-clés", short: "Goodie", slug: "goodies", position: 25, isPublic: true, tagLabel: "licence" };
    const entrees = entreesDesRayons([...PUBLICS, goodies], [tag("GOODIES", "Zelda", 3)]);
    const neuf = entrees.find((e) => e.href === "/boutique?cat=goodies");
    expect(neuf?.label).toBe("Goodies");
    expect(neuf?.volet?.intitule).toBe("licences");
    expect(neuf?.volet?.liens.map((l) => l.label)).toEqual(["Zelda"]);
  });
});
