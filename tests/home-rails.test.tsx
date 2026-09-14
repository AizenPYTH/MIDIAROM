import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoGamesRail, ProductRail } from "@/components/marketing/home/shop-sections";
import { CartProvider } from "@/components/shop/cart-provider";
import type { Product } from "@/lib/shop/catalog";
import type { GameListing } from "@/lib/shop/games";

/**
 * Les rayons de l'accueil.
 *
 * L'accueil doit donner à voir les **trois** rayons sans scroller longtemps.
 * C'est la seule chose qui empêche de le vérifier à l'œil : un rayon qui
 * déroule dix articles pousse les deux autres hors de l'écran, et personne ne
 * s'en aperçoit tant que le catalogue est petit. Ces tests fixent donc la borne
 * et l'existence de la suite — « Voir plus » — sur des données maîtrisées.
 */

const produit = (i: number): Product =>
  ({
    id: `p${i}`,
    slug: `produit-${i}`,
    name: `Console ${i}`,
    platform: "PlayStation 5",
    condition: "NEW",
    price_cents: 29900 + i,
    compare_at_price_cents: null,
    quantity: 3,
    low_stock_threshold: 2,
    images: [],
  }) as unknown as Product;

const jeu = (i: number): GameListing =>
  ({
    productId: `g${i}`,
    slug: `jeu-${i}`,
    name: `Jeu ${i}`,
    platform: "PlayStation 5",
    edition: null,
    priceCents: 4999,
    compareAtPriceCents: null,
    condition: "NEW",
    inStock: false,
    igdbId: 1,
    summary: null,
    releaseDate: null,
    genres: [],
    developer: null,
    publisher: null,
    rating: null,
    ratingCount: null,
    coverUrl: null,
    heroUrl: null,
    screenshotUrls: [],
    video: null,
    trailerUrl: null,
  }) as unknown as GameListing;

/**
 * Le bouton « Ajouter au panier » est un composant client qui lit le contexte
 * du panier : sans lui, le rendu jette. On rend donc les rayons dans le même
 * fournisseur que l'application, plutôt que de remplacer le bouton par un
 * faux — c'est justement lui qu'on veut voir apparaître, ou pas.
 */
const rendu = (noeud: React.ReactNode) => renderToStaticMarkup(<CartProvider>{noeud}</CartProvider>);

const compte = (html: string, motif: RegExp) => html.match(motif)?.length ?? 0;

describe("rayon de produits sur l'accueil", () => {
  const cinq = [1, 2, 3, 4, 5].map(produit);

  it("montre une carte par produit reçu, et rien de plus", () => {
    const html = rendu(<ProductRail category="CONSOLE" products={cinq} total={24} />);
    expect(compte(html, /<article/g)).toBe(5);
  });

  it("montre le nom, le prix et un lien vers la fiche", () => {
    const html = rendu(<ProductRail category="CONSOLE" products={[produit(1)]} total={24} />);
    expect(html).toContain("Console 1");
    expect(html).toContain("299");
    expect(html).toContain("/boutique/produit-1");
  });

  it("annonce la suite, et combien il en reste", () => {
    const html = rendu(<ProductRail category="CONSOLE" products={cinq} total={24} />);
    expect(html).toContain("Voir les 24 consoles");
    expect(html).toContain("/boutique?cat=");
  });

  it("ne promet pas un nombre qu'il ne connaît pas", () => {
    const html = rendu(<ProductRail category="CONSOLE" products={cinq} />);
    expect(html).toContain("Voir tout le rayon consoles");
    expect(html).not.toMatch(/Voir les \d/);
  });

  it("n'annonce pas une suite quand le rayon tient entier sur l'accueil", () => {
    const html = rendu(<ProductRail category="CONSOLE" products={cinq} total={5} />);
    expect(html).toContain("Voir tout le rayon consoles");
  });

  it("disparaît plutôt que d'afficher un rayon vide", () => {
    expect(rendu(<ProductRail category="CONSOLE" products={[]} />)).toBe("");
    expect(rendu(<DemoGamesRail games={[]} />)).toBe("");
  });
});

describe("rayon jeux de démonstration", () => {
  it("montre ses jaquettes et sa suite, et se dit indicatif", () => {
    const html = rendu(<DemoGamesRail games={[1, 2, 3, 4, 5].map(jeu)} total={24} />);
    expect(compte(html, /<article/g)).toBe(5);
    expect(html).toContain("Voir les 24 jeux vidéo");
    expect(html).toContain("prix indicatifs");
    // Un jeu de démonstration ne s'ajoute pas au panier : il n'est pas au catalogue.
    expect(html).not.toContain("Ajouter au panier");
    expect(html).toContain("/boutique/jeu/jeu-1");
  });
});
