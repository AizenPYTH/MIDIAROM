import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { HeroShop } from "@/components/marketing/home/scenes";
import { CategoryCards, DemoGamesRail, ProductRail, RepairBand } from "@/components/marketing/home/shop-sections";
import { getHomepageGames } from "@/lib/shop/games";
import { getProductCategoryCounts, getProducts } from "@/lib/shop/catalog";
import { CATEGORY_SLUGS } from "@/lib/shop/status";
import { getSeoPage } from "@/lib/content";
import { getBrandSettings } from "@/lib/settings";

/**
 * Accueil — une boutique, pas une présentation.
 *
 * L'ordre dit tout : hero court, les trois rayons en cartes, puis les produits.
 * Un visiteur voit une jaquette avant d'avoir fini de lire le titre de la page,
 * et l'atelier arrive après, comme le service qu'il est.
 *
 * C'est un renversement assumé. La page racontait l'entreprise — quatre scènes
 * épinglées, un récit en quatre temps, une bascule — et la boutique venait en
 * fin de parcours. Elle commence maintenant par le rayon : voir, choisir,
 * ouvrir, ajouter au panier.
 *
 * Rendu à la demande : prix, stock et rayons viennent du catalogue. Un rendu
 * statique figerait l'état du magasin au moment du build.
 */
export const dynamic = "force-dynamic";

/**
 * Articles montrés par rayon sur l'accueil.
 *
 * Cinq, et pas davantage. L'accueil doit donner à voir les **trois** rayons
 * sans scroller longtemps ; un rayon déroulé en entier repousse les deux
 * autres hors de l'écran et transforme la page d'accueil en page de catalogue.
 * Le bouton « Voir plus » en bas de chaque rayon mène au rayon complet.
 */
const PER_RAIL = 5;
/** Combien de jeux lire pour connaître la taille du rayon de démonstration. */
const DEMO_POOL = 24;

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
  const [{ latest, isDemo }, counts, games, consoles, figurines] = await Promise.all([
    getHomepageGames(DEMO_POOL),
    getProductCategoryCounts(),
    getProducts({ category: CATEGORY_SLUGS.GAME, sort: "recent" }, PER_RAIL),
    getProducts({ category: CATEGORY_SLUGS.CONSOLE, sort: "recent" }, PER_RAIL),
    getProducts({ category: CATEGORY_SLUGS.COLLECTIBLE, sort: "recent" }, PER_RAIL),
  ]);

  // Les vrais jeux sont des produits comme les autres. La sélection de
  // démonstration ne prend le relais que si le rayon est vide.
  const demoGames = isDemo ? latest.slice(0, PER_RAIL) : [];
  const rienEnRayon = !games.length && !demoGames.length && !consoles.length && !figurines.length;

  return (
    <>
      <HeroShop />
      <CategoryCards counts={counts} />

      {/* Les trois rayons, cinq articles chacun, chacun avec sa suite. Le
          visiteur voit une jaquette, une console et une figurine avant
          d'arriver à l'atelier. */}
      <ProductRail category="GAME" products={games} total={counts.GAME} />
      <DemoGamesRail games={demoGames} total={isDemo ? latest.length : undefined} />
      <ProductRail category="CONSOLE" products={consoles} total={counts.CONSOLE} />
      <ProductRail category="COLLECTIBLE" products={figurines} total={counts.COLLECTIBLE} />

      {/* Rien en rayon : on le dit, plutôt que d'empiler des sections vides. */}
      {rienEnRayon ? (
        <section className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
          <p data-reveal="1" className="max-w-[46ch] text-[16px] leading-[1.5] text-ink-soft">
            Les arrivages ne sont pas encore en ligne. Passez rue de Rome : le rayon, lui, est plein.
          </p>
          <Link href={ROUTES.shop} className="mt-6 inline-flex min-h-[48px] items-center rounded-full bg-ink px-7 font-semibold text-bg">
            Parcourir la boutique
          </Link>
        </section>
      ) : null}

      <RepairBand />

    </>
  );
}
