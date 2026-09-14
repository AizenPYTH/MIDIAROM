import { describe, expect, it } from "vitest";
import { extractJsonLd, productFromSchema, productNodes, productUrls } from "@/lib/catalog/providers/jsonld";
import { readSearchPage } from "@/lib/catalog/providers/hlj";
import { draftSku, slugify } from "@/lib/catalog/import";

/**
 * La lecture d'une fiche externe.
 *
 * C'était le point fragile de l'import, et il a lâché : la première version
 * envoyait un terme de recherche à un acteur Apify qui n'en accepte pas — un
 * schéma deviné, un HTTP 400 au premier essai réel. La lecture repose désormais
 * sur schema.org, un format public et documenté, ce qui la rend testable hors
 * ligne sur des exemples conformes à la norme plutôt que sur des suppositions.
 */

const PAGE = "https://www.hlj.com/search/?Word=luffy";

/** Une page telle qu'une boutique la publie : un bloc JSON-LD dans du HTML. */
function page(...blocs: unknown[]): string {
  return `<html><head>${blocs
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`)
    .join("")}</head><body>…</body></html>`;
}

const PRODUIT = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "One Piece Luffy Gear 5",
  url: "/p/BAN12345",
  sku: "BAN12345",
  gtin13: "4573102639615",
  brand: { "@type": "Brand", name: "Bandai" },
  category: "One Piece",
  description: "Figurine peinte, échelle 1/8.",
  image: ["https://www.hlj.com/a.jpg", { "@type": "ImageObject", url: "/b.jpg" }],
  height: "30 cm",
  releaseDate: "2026-03-01",
  offers: { "@type": "Offer", price: "12800", priceCurrency: "JPY" },
};

describe("extraction JSON-LD", () => {
  it("lit les blocs d'une page et aplatit @graph", () => {
    const html = page({ "@graph": [PRODUIT, { "@type": "WebSite" }] });
    expect(extractJsonLd(html)).toHaveLength(3);
  });

  it("ignore un bloc illisible sans emporter les autres", () => {
    const html = `<script type="application/ld+json">{cassé</script>${page(PRODUIT)}`;
    expect(productNodes(extractJsonLd(html))).toHaveLength(1);
  });

  it("trouve les produits emballés dans un ItemList", () => {
    const html = page({ "@type": "ItemList", itemListElement: [{ "@type": "ListItem", item: PRODUIT }] });
    expect(productNodes(extractJsonLd(html))).toHaveLength(1);
  });

  it("récupère les liens quand l'ItemList ne porte que des URL", () => {
    const html = page({ "@type": "ItemList", itemListElement: [{ "@type": "ListItem", url: "/p/1" }, { url: "/p/2" }] });
    expect(productUrls(extractJsonLd(html), PAGE)).toEqual(["https://www.hlj.com/p/1", "https://www.hlj.com/p/2"]);
  });
});

describe("Product schema.org → fiche à importer", () => {
  const p = productFromSchema(PRODUIT, "HLJ", PAGE)!;

  it("lit ce que la norme publie", () => {
    expect(p.ref).toBe("BAN12345");
    expect(p.name).toBe("One Piece Luffy Gear 5");
    expect(p.manufacturer).toBe("Bandai");
    expect(p.ean).toBe("4573102639615");
    expect(p.size).toBe("H 30 cm");
    expect(p.series).toBe("One Piece");
    expect(p.priceCents).toBe(1280000);
    expect(p.currency).toBe("JPY");
  });

  it("rend les URL absolues, images comprises", () => {
    expect(p.url).toBe("https://www.hlj.com/p/BAN12345");
    expect(p.images.map((i) => i.url)).toEqual(["https://www.hlj.com/a.jpg", "https://www.hlj.com/b.jpg"]);
  });

  it("crédite chaque image de sa source et de sa page", () => {
    expect(p.images[0]!.source).toBe("HLJ");
    expect(p.images[0]!.sourceUrl).toBe("https://www.hlj.com/p/BAN12345");
  });

  it("laisse vide ce que la page ne publie pas, sans rien inventer", () => {
    const minimal = productFromSchema({ "@type": "Product", name: "Figurine", sku: "Z" }, "HLJ", PAGE)!;
    expect(minimal.manufacturer).toBeNull();
    expect(minimal.ean).toBeNull();
    expect(minimal.size).toBeNull();
    expect(minimal.priceCents).toBeNull();
    expect(minimal.images).toEqual([]);
  });

  it("écarte une fiche sans nom", () => {
    expect(productFromSchema({ "@type": "Product", sku: "Z" }, "HLJ", PAGE)).toBeNull();
  });

  it("se rabat sur l'URL comme référence quand la page n'en donne pas", () => {
    expect(productFromSchema({ "@type": "Product", name: "X", url: "/p/42" }, "HLJ", PAGE)!.ref).toBe("https://www.hlj.com/p/42");
  });
});

describe("lecture d'une page de recherche", () => {
  it("rend les produits trouvés", () => {
    const { products } = readSearchPage(page({ "@type": "ItemList", itemListElement: [{ item: PRODUIT }] }), PAGE);
    expect(products).toHaveLength(1);
    expect(products[0]!.name).toBe("One Piece Luffy Gear 5");
  });

  it("rend les liens à ouvrir quand la page ne liste que des URL", () => {
    const { products, urls } = readSearchPage(page({ "@type": "ItemList", itemListElement: [{ url: "/p/1" }] }), PAGE);
    expect(products).toEqual([]);
    expect(urls).toEqual(["https://www.hlj.com/p/1"]);
  });

  it("ne rend rien, et ne jette pas, sur une page sans données structurées", () => {
    expect(readSearchPage("<html><body>rien</body></html>", PAGE)).toEqual({ products: [], urls: [] });
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
