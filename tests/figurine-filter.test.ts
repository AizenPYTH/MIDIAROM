import { describe, expect, it } from "vitest";
import { judgeFigurine, sortFigurines } from "@/lib/catalog/figurine-filter";
import type { ExternalProduct } from "@/lib/catalog/providers/types";

/**
 * Le tri figurines / dérivés.
 *
 * Deux risques opposés, et les deux comptent : laisser passer un t-shirt, et
 * écarter une vraie figurine. Les cas ambigus — *Mascot Figure*, shokugan,
 * Ichiban Kuji — sont donc testés explicitement, parce que c'est là qu'un
 * filtre trop simple fait des dégâts invisibles.
 */

const fiche = (over: Partial<ExternalProduct> = {}): ExternalProduct => ({
  ref: "REF1",
  name: "Produit",
  url: null,
  manufacturer: null,
  series: null,
  category: null,
  availability: null,
  character: null,
  ean: null,
  size: null,
  releaseDate: null,
  description: null,
  images: [],
  priceCents: null,
  currency: null,
  ...over,
});

const verdict = (over: Partial<ExternalProduct>) => judgeFigurine(fiche(over)).verdict;

describe("tri des figurines", () => {
  it("garde ce que le métier nomme une figurine", () => {
    expect(verdict({ name: "One Piece Luffy Gear 5 Figure" })).toBe("figurine");
    expect(verdict({ name: "Nendoroid Monkey D. Luffy" })).toBe("figurine");
    expect(verdict({ name: "Pop Up Parade Luffy" })).toBe("figurine");
    expect(verdict({ name: "S.H.Figuarts Luffy" })).toBe("figurine");
    expect(verdict({ name: "Luffy 1/8 Scale Figure" })).toBe("figurine");
  });

  it("se fie au rayon de la source quand le titre ne dit rien", () => {
    expect(verdict({ name: "Monkey D. Luffy", category: "Figures" })).toBe("figurine");
  });

  it("se fie au fabricant quand ni le titre ni le rayon ne disent rien", () => {
    expect(verdict({ name: "Monkey D. Luffy", manufacturer: "Good Smile Company" })).toBe("figurine");
    expect(verdict({ name: "Monkey D. Luffy", manufacturer: "MegaHouse" })).toBe("figurine");
  });

  it("écarte les dérivés évidents", () => {
    for (const name of [
      "One Piece Luffy T-Shirt",
      "Luffy Sticker Set",
      "One Piece Mug Cup",
      "Luffy Wall Scroll Poster",
      "One Piece Acrylic Stand Luffy",
      "Luffy Keychain",
      "One Piece Gummy Candy",
      "Luffy Plush Doll",
      "One Piece Tote Bag",
    ]) {
      expect(verdict({ name }), name).toBe("ecarte");
    }
  });

  it("n'écarte pas les ambigus : ils passent en doute, pas à la poubelle", () => {
    // « Mascot » seul n'est pas un veto : une Mascot Figure est une figurine.
    expect(verdict({ name: "One Piece Luffy Mascot Figure" })).toBe("figurine");
    // Un shokugan est une figurine vendue avec un bonbon.
    expect(verdict({ name: "Luffy Candy Toy Figure", category: "Candy Toys" })).toBe("figurine");
    // Un mot d'exclusion et un mot de figurine : gardé, mais signalé.
    expect(verdict({ name: "Ichiban Kuji One Piece Towel" })).toBe("doute");
    // Une maquette à monter n'est pas une figurine peinte — gardée, signalée.
    expect(verdict({ name: "RG Gundam Model Kit" })).toBe("doute");
    // Rien pour décider : on ne tranche pas à la place de l'atelier.
    expect(verdict({ name: "One Piece Luffy" })).toBe("doute");
  });

  it("dit pourquoi, à chaque fois qu'il ne tranche pas net", () => {
    expect(judgeFigurine(fiche({ name: "Luffy T-Shirt" })).reason).toContain("shirt");
    expect(judgeFigurine(fiche({ name: "Luffy Figure" })).reason).toBeNull();
  });

  it("sépare sans rien perdre, figurines sûres en tête", () => {
    const { kept, rejected } = sortFigurines([
      fiche({ ref: "A", name: "Luffy T-Shirt" }),
      fiche({ ref: "B", name: "One Piece Luffy" }),
      fiche({ ref: "C", name: "Luffy Figure" }),
    ]);
    expect(kept.map((k) => k.product.ref)).toEqual(["C", "B"]);
    expect(rejected.map((r) => r.product.ref)).toEqual(["A"]);
    expect(kept.length + rejected.length).toBe(3);
  });
});
