import { describe, expect, it } from "vitest";
import { toExternalProduct } from "@/lib/catalog/providers/hlj";
import { draftSku, slugify } from "@/lib/catalog/import";

/**
 * La lecture d'un résultat externe.
 *
 * C'est le point fragile de cet import : un acteur Apify n'est pas un contrat
 * d'API, ses noms de champs varient et peuvent changer. La correspondance est
 * donc tolérante — plusieurs noms possibles par information — et ce test fixe
 * ce qu'elle doit savoir lire, plus ce qu'elle ne doit jamais inventer.
 */

describe("toExternalProduct", () => {
  it("lit une fiche complète", () => {
    const p = toExternalProduct({
      name: "One Piece Luffy Gear 5",
      url: "https://hlj.com/p/ABC123",
      code: "ABC123",
      manufacturer: "Bandai",
      series: "One Piece",
      character: "Monkey D. Luffy",
      jan: "4573102639615",
      size: "30 cm",
      releaseDate: "2026-03",
      description: "Figurine peinte.",
      images: ["https://hlj.com/a.jpg", { url: "https://hlj.com/b.jpg" }],
      price: "¥12,800",
    })!;
    expect(p.ref).toBe("ABC123");
    expect(p.manufacturer).toBe("Bandai");
    expect(p.ean).toBe("4573102639615");
    expect(p.images.map((i) => i.url)).toEqual(["https://hlj.com/a.jpg", "https://hlj.com/b.jpg"]);
    expect(p.priceCents).toBe(1280000);
    expect(p.currency).toBe("JPY");
  });

  it("accepte les autres noms de champs d'un acteur", () => {
    const p = toExternalProduct({ title: "Naruto Uzumaki", productUrl: "https://x/y", sku: "N-1", maker: "Good Smile", barcode: "123" })!;
    expect(p.name).toBe("Naruto Uzumaki");
    expect(p.ref).toBe("N-1");
    expect(p.manufacturer).toBe("Good Smile");
    expect(p.ean).toBe("123");
  });

  it("laisse vide ce que la source ne donne pas, sans rien inventer", () => {
    const p = toExternalProduct({ name: "Figurine", code: "Z" })!;
    expect(p.manufacturer).toBeNull();
    expect(p.series).toBeNull();
    expect(p.ean).toBeNull();
    expect(p.size).toBeNull();
    expect(p.priceCents).toBeNull();
    expect(p.images).toEqual([]);
  });

  it("écarte une ligne sans nom ni référence exploitable", () => {
    expect(toExternalProduct({ manufacturer: "Bandai" })).toBeNull();
    expect(toExternalProduct({})).toBeNull();
  });

  it("se rabat sur l'URL comme référence quand la source n'en donne pas", () => {
    expect(toExternalProduct({ name: "X", url: "https://hlj.com/p/42" })!.ref).toBe("https://hlj.com/p/42");
  });

  it("crédite chaque image de sa source et de sa page", () => {
    const p = toExternalProduct({ name: "X", code: "1", url: "https://hlj.com/p/1", image: "https://hlj.com/i.jpg" })!;
    expect(p.images[0]).toEqual({ url: "https://hlj.com/i.jpg", source: "HLJ", sourceUrl: "https://hlj.com/p/1" });
  });

  it("ignore ce qui n'est pas une URL d'image", () => {
    expect(toExternalProduct({ name: "X", code: "1", images: ["pas-une-url", null, 42] })!.images).toEqual([]);
  });
});

describe("brouillon", () => {
  it("fabrique un slug lisible", () => {
    expect(slugify("One Piece — Luffy Gear 5 !")).toBe("one-piece-luffy-gear-5");
    expect(slugify("★★★")).toBe("figurine");
  });

  it("préfixe le SKU par la source, pour qu'il ne passe pas pour une référence maison", () => {
    expect(draftSku("HLJ", "ABC-123")).toBe("HLJ-ABC-123");
    expect(draftSku("HLJ", "a/b c")).toBe("HLJ-A-B-C");
  });
});
