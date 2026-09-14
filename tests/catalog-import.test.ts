import { describe, expect, it } from "vitest";
import { extractJsonLd, productFromSchema, productNodes, productUrls } from "@/lib/catalog/providers/jsonld";
import { fillInput, fillUrl, itemsFromJson, toExternalProduct } from "@/lib/catalog/providers/hlj";
import { draftSku, slugify } from "@/lib/catalog/import";

/**
 * La lecture d'une fiche externe.
 *
 * Deux chemins, deux séries de tests. La **recherche** passe par un acteur
 * Apify dédié à HLJ : ce qui revient est du JSON dont les noms de champs ne
 * sont pas garantis, d'où un lecteur tolérant qu'on éprouve sur plusieurs
 * conventions d'écriture. Les **fiches détaillées**, elles, sont lues en
 * schema.org — un format public et documenté, testable hors ligne.
 *
 * Aucun test ne touche le réseau : c'est justement parce que les contrats
 * distants avaient été supposés que l'import a échoué deux fois.
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

describe("lecture d'un résultat de recherche", () => {
  /** Tel que l'acteur HLJ le décrit : nom, prix JPY et USD, fabricant, GTIN. */
  const ITEM = {
    name: "One Piece Luffy Gear 5",
    url: "/p/BAN12345",
    itemCode: "BAN12345",
    maker: "Bandai",
    category: "One Piece",
    gtin: "4573102639615",
    priceJpy: "12,800",
    priceUsd: "88.50",
    releaseDate: "2026-03",
    imageUrl: "https://www.hlj.com/a.jpg",
  };

  it("lit une fiche quelle que soit la convention de nommage", () => {
    const p = toExternalProduct(ITEM)!;
    expect(p.ref).toBe("BAN12345");
    expect(p.name).toBe("One Piece Luffy Gear 5");
    expect(p.manufacturer).toBe("Bandai");
    expect(p.ean).toBe("4573102639615");
    expect(p.series).toBe("One Piece");
    expect(p.url).toBe("https://www.hlj.com/p/BAN12345");
    expect(p.images.map((i) => i.url)).toEqual(["https://www.hlj.com/a.jpg"]);
    expect(p.images[0]!.source).toBe("HLJ");
  });

  it("garde le prix avec sa devise, sans le faire passer pour des euros", () => {
    const p = toExternalProduct(ITEM)!;
    expect(p.priceCents).toBe(1280000);
    expect(p.currency).toBe("JPY");
    const dollars = toExternalProduct({ name: "X", sku: "Z", priceUsd: "88.50" })!;
    expect(dollars.priceCents).toBe(8850);
    expect(dollars.currency).toBe("USD");
  });

  it("laisse vide ce que l'acteur ne rend pas", () => {
    const p = toExternalProduct({ name: "Figurine", sku: "Z" })!;
    expect(p.manufacturer).toBeNull();
    expect(p.ean).toBeNull();
    expect(p.priceCents).toBeNull();
    expect(p.images).toEqual([]);
  });

  it("écarte un élément sans nom, et un sans référence ni URL", () => {
    expect(toExternalProduct({ sku: "Z" })).toBeNull();
    expect(toExternalProduct({ name: "Sans référence" })).toBeNull();
  });

  it("trouve les éléments où que la réponse les range", () => {
    expect(itemsFromJson([ITEM])).toHaveLength(1);
    expect(itemsFromJson({ items: [ITEM] })).toHaveLength(1);
    expect(itemsFromJson({ data: { results: [ITEM] } })).toHaveLength(1);
    expect(itemsFromJson({ payload: { autreNom: [ITEM] } })).toHaveLength(1);
    expect(itemsFromJson({ total: 0 })).toEqual([]);
    expect(itemsFromJson(null)).toEqual([]);
  });
});

describe("insertion du terme dans un gabarit", () => {
  it("encode pour une URL", () => {
    expect(fillUrl("https://x/s?q={q}&n={limit}", "luffy gear 5", 12)).toBe("https://x/s?q=luffy%20gear%205&n=12");
  });

  it("échappe pour un corps JSON — pas d'encodage URL dans l'entrée d'un acteur", () => {
    const entree = fillInput('{"searchQueries":["{q}"],"maxItems":{limit}}', 'luffy "gear" 5', 12);
    expect(JSON.parse(entree)).toEqual({ searchQueries: ['luffy "gear" 5'], maxItems: 12 });
  });

  it("remplit {url} avec la page de recherche réelle", () => {
    expect(fillInput("{url}", "luffy gear 5", 12)).toBe("https://www.hlj.com/search/?Word=luffy%20gear%205");
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
