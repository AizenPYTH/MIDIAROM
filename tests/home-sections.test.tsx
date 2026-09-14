import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Hero, ProductWall, Repairs, Store, TrustBand } from "@/components/marketing/home/sections";
import { CartProvider } from "@/components/shop/cart-provider";
import { PLATFORMS, TRUST } from "@/components/marketing/home/content";
import { BRAND_DEFAULTS } from "@/config/brand";
import type { Product } from "@/lib/shop/catalog";
import type { GameListing } from "@/lib/shop/games";

/**
 * L'accueil, sur des données maîtrisées.
 *
 * Ces tests ne jugent pas l'esthétique — ça se regarde. Ils fixent les quelques
 * règles qui ne se voient pas à l'œil tant que le catalogue est petit ou que
 * les réglages sont remplis : l'atelier ne répare que des consoles, un jeu de
 * démonstration ne s'ajoute pas au panier, et un réglage absent ne laisse pas
 * de ligne vide.
 */

const rendu = (noeud: React.ReactNode) => renderToStaticMarkup(<CartProvider>{noeud}</CartProvider>);

const produit = (i: number): Product =>
  ({
    id: `p${i}`,
    slug: `produit-${i}`,
    name: `Console ${i}`,
    platform: "PlayStation 5",
    condition: "NEW",
    price_cents: 29900,
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

describe("hero", () => {
  const html = rendu(<Hero />);

  it("dit dès la première ligne que l'atelier ne fait que des consoles", () => {
    expect(html).toContain("consoles uniquement");
  });

  it("garde l'animation gaming enfermée dans le cadre du visuel", () => {
    // Le balayage, la croix et le HUD existent…
    expect(html).toContain("data-scan");
    expect(html).toContain("data-pad");
    expect(html).toContain("data-hud-dot");
    // …et aucun d'eux ne porte le titre ni un bouton : ils sont décoratifs.
    expect(html).toMatch(/data-scan="1"[^>]*aria-hidden="true"/);
    expect(html).toMatch(/data-pad="1"[^>]*aria-hidden="true"/);
  });
});

describe("réparations", () => {
  const html = rendu(<Repairs />);

  it("affiche les quatre familles de consoles et leurs pannes", () => {
    for (const p of PLATFORMS) {
      expect(html, p.name).toContain(p.name);
      for (const f of p.faults) expect(html, f.label).toContain(f.label);
    }
  });

  it("mène chaque ligne de panne au vrai parcours de devis", () => {
    const lignes = html.match(/data-row="1"/g) ?? [];
    expect(lignes).toHaveLength(PLATFORMS.reduce((n, p) => n + p.faults.length, 0));
    expect(html).toContain('href="/reparation"');
  });

  it("ne propose ni téléphone, ni ordinateur, ni tablette", () => {
    // Le texte les nomme une fois, pour dire qu'ils ne sont pas pris en charge.
    expect(html).toContain("ne répare que des consoles");
    expect(html).not.toMatch(/réparation (de |d')?(smartphone|iPhone|ordinateur|tablette)/i);
  });
});

describe("mur de produits", () => {
  it("montre les vrais produits et annonce le reste du catalogue", () => {
    const html = rendu(<ProductWall products={[1, 2].map(produit)} demoGames={[]} total={240} />);
    expect(html).toContain("Console 1");
    expect(html).toContain("/boutique/produit-1");
    expect(html).toContain("Voir les 240 références");
    expect(html).toContain("Ajouter au panier");
  });

  it("ne promet pas un nombre qu'il dépasse déjà", () => {
    const html = rendu(<ProductWall products={[1, 2].map(produit)} demoGames={[]} total={2} />);
    expect(html).toContain("Voir tout le catalogue");
    expect(html).not.toMatch(/Voir les \d/);
  });

  it("n'offre jamais d'ajouter au panier un jeu de démonstration", () => {
    const html = rendu(<ProductWall products={[]} demoGames={[1, 2].map(jeu)} total={0} />);
    expect(html).toContain("Jeu 1");
    expect(html).toContain("prix sont indicatifs");
    expect(html).not.toContain("Ajouter au panier");
  });

  it("le dit, plutôt que d'afficher une grille de cadres vides", () => {
    const html = rendu(<ProductWall products={[]} demoGames={[]} total={0} />);
    expect(html).toContain("ne sont pas encore en ligne");
    expect(html).not.toContain("<article");
  });

  it("garde des filtres qui filtrent vraiment", () => {
    const html = rendu(<ProductWall products={[produit(1)]} demoGames={[]} total={9} />);
    for (const q of ["/boutique?cat=jeux", "/boutique?cat=consoles", "/boutique?cat=figurines", "/boutique?etat=neuf", "/boutique?max=50"]) {
      expect(html, q).toContain(q.replace(/&/g, "&amp;"));
    }
  });
});

describe("bande de confiance", () => {
  it("porte ses quatre engagements sans bordure de cellule", () => {
    const html = rendu(<TrustBand />);
    for (const t of TRUST) expect(html).toContain(t.title);
    // Les cellules n'ont pas de bordure : c'est la gouttière qui dessine les
    // filets, et c'est ce qui évite un trait orphelin quand la rangée se replie.
    expect(html).toContain("gap-px");
  });
});

describe("magasin", () => {
  it("ne laisse pas de ligne vide quand un réglage manque", () => {
    const html = rendu(<Store brand={{ ...BRAND_DEFAULTS, phone: "", hours: "", address_line1: "", postal_code: "", city: "" }} />);
    expect(html).not.toContain("tel:");
    expect(html).toContain("Nous écrire");
  });

  it("affiche adresse, horaires et téléphone dès qu'ils sont renseignés", () => {
    const html = rendu(
      <Store brand={{ ...BRAND_DEFAULTS, phone: "04 91 48 27 48", hours: "Lundi — Samedi · 9h30 → 19h", address_line1: "207 rue de Rome", postal_code: "13006", city: "Marseille" }} />,
    );
    expect(html).toContain("207 rue de Rome, 13006 Marseille");
    expect(html).toContain("9h30");
    expect(html).toContain("tel:0491482748");
  });
});
