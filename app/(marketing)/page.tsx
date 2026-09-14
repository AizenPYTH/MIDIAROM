import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { HeroRepair, RepairFlow, ShiftScene } from "@/components/marketing/home/scenes";
import { FeaturedGame } from "@/components/marketing/home/featured-game";
import { GamesGrid } from "@/components/marketing/home/games-grid";
import { ProductRail, RepairServices, ShopCategories, SHOP_CATEGORIES } from "@/components/marketing/home/shop-sections";
import { getHomepageGames } from "@/lib/shop/games";
import { toGameScene, toGameScenes } from "@/lib/shop/game-scene";
import { getProductCategoryCounts, getProducts, productPhotos, type Product } from "@/lib/shop/catalog";
import { CATEGORY_SLUGS, type ProductCategory } from "@/lib/shop/status";
import { DEMO_FEATURED_VIDEO } from "@/lib/content/assets";
import { getSeoPage } from "@/lib/content";
import { getBrandSettings } from "@/lib/settings";

/**
 * Accueil.
 *
 * Le parcours tient en deux idées, dans cet ordre : **MÉDI@ROM répare vos
 * consoles**, puis **MÉDI@ROM tient une boutique gaming et pop culture**.
 * Hero, atelier, bascule, boutique. Rien d'autre.
 *
 * La page portait quatre scènes épinglées totalisant près de 1500svh. Il en
 * reste **une** — la bascule atelier → boutique, 180svh — plus le volet avant
 * et après de la réparation, animé à l'entrée. Le reste est immobile : c'est
 * un magasin, pas une démonstration technique.
 *
 * Rendu à la demande : prix, stock et rayons viennent du catalogue. Un rendu
 * statique figerait l'état du magasin au moment du build.
 */
export const dynamic = "force-dynamic";

/** Ce que la grille de démonstration montre au maximum sur l'accueil. */
const GAMES_ON_HOME = 30;
/** Produits réels affichés par rayon. */
const PER_RAIL = 6;

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeoPage("/"), getBrandSettings()]);
  return {
    title: { absolute: seo?.title ?? `${brand.name} — ${brand.tagline}` },
    description: seo?.description ?? brand.description,
    alternates: { canonical: SITE_URL },
  };
}

export default async function HomePage() {
  // Une lecture par rayon, plus les jeux. Aucun appel à IGDB à l'affichage :
  // les fiches viennent du cache.
  const [{ featured, latest, isDemo }, counts, consoles, figurines] = await Promise.all([
    getHomepageGames(GAMES_ON_HOME + 1),
    getProductCategoryCounts(),
    getProducts({ category: CATEGORY_SLUGS.CONSOLE, sort: "recent" }, PER_RAIL),
    getProducts({ category: CATEGORY_SLUGS.COLLECTIBLE, sort: "recent" }, PER_RAIL),
  ]);

  // Un produit sans photo propre récupère celle de son modèle de console.
  // Les jeux ont leur propre bloc (`GamesGrid`), qu'ils soient réels ou de
  // démonstration : un rail « Jeux vidéo » de plus ferait doublon.
  const rails: { category: ProductCategory; products: Product[] }[] = [
    { category: "CONSOLE", products: consoles },
    { category: "COLLECTIBLE", products: figurines },
  ];
  const photos = await productPhotos(rails.flatMap((r) => r.products));

  // Le jeu du moment, puis le reste de la sélection.
  const featuredScene = featured ? toGameScene(featured, 0, isDemo) : null;
  const gridGames = toGameScenes(
    latest.filter((listing) => listing.productId !== featured?.productId).slice(0, GAMES_ON_HOME),
    isDemo,
  );
  // Habillage vidéo du jeu vedette, à défaut d'une vidéo du produit.
  const ambientVideo = { url: DEMO_FEATURED_VIDEO, posterUrl: featuredScene?.artworkUrl ?? null, ambient: true };
  const emptyShop = rails.every((r) => r.products.length === 0) && gridGames.length === 0;

  return (
    <>
      <HeroRepair />
      <RepairServices />
      <RepairFlow />

      {/* Le seul moment épinglé de la page. */}
      <ShiftScene />

      <ShopCategories counts={counts} />

      {featuredScene ? <FeaturedGame game={featuredScene} ambientVideo={ambientVideo} /> : null}
      <GamesGrid games={gridGames} isDemo={isDemo} />

      {rails.map(({ category, products }) => (
        <ProductRail
          key={category}
          title={SHOP_CATEGORIES.find((c) => c.category === category)?.name ?? ""}
          category={category}
          products={products}
          photos={photos}
          accent={SHOP_CATEGORIES.find((c) => c.category === category)?.color ?? "rgba(255,244,234,0.14)"}
        />
      ))}

      {/* Rien en rayon : on le dit, plutôt que d'afficher des sections vides. */}
      {emptyShop ? (
        <section data-warm="1" style={{ background: "#0d0710", padding: "70px 30px 90px" }}>
          <div style={{ maxWidth: 1420, margin: "0 auto" }}>
            <p data-reveal="1" style={{ margin: 0, maxWidth: "46ch", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.45, color: "#e4c9bd" }}>
              Les arrivages ne sont pas encore en ligne. Passez rue de Rome : le rayon, lui, est plein.
            </p>
            <Link href={ROUTES.shop} style={{ display: "inline-flex", alignItems: "center", marginTop: 24, minHeight: 44, background: "#fff4ea", color: "#1a0d06", borderRadius: 999, padding: "17px 28px", fontWeight: 600, fontSize: 16.5 }}>
              Parcourir la boutique
            </Link>
          </div>
        </section>
      ) : null}

      {/* Retour à la réparation : la page se referme sur ce qui la commence. */}
      <section id="devis" style={{ position: "relative", background: "#0d0710", padding: "100px 30px 110px" }}>
        <div style={{ maxWidth: 1420, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 48, alignItems: "center" }}>
          <div data-reveal="1" style={{ minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9a95c4" }}>Une console en panne ?</span>
            <h2 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,5.2vw,74px)", lineHeight: 0.9, letterSpacing: "-0.04em" }}>
              Le devis prend trois minutes.
            </h2>
            <p style={{ margin: "20px 0 0", maxWidth: "38ch", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.45, color: "#b9b4e8" }}>
              Choisissez l&apos;appareil et la panne, décrivez ce qui se passe. Diagnostic sous 48 heures, devis avant toute intervention.
            </p>
          </div>
          <div data-reveal="1" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href={ROUTES.repair} className="btn-gradient" style={{ borderRadius: 999, padding: "19px 32px", fontWeight: 600, fontSize: 17, color: "var(--color-on-accent)", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Démarrer mon devis
            </Link>
            <Link href={ROUTES.tracking} style={{ borderRadius: 999, padding: "19px 30px", border: "1px solid rgba(244,242,255,0.2)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f4f2ff", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Suivre ma réparation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
