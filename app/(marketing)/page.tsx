import type { Metadata } from "next";
import { SITE_URL } from "@/config/site";
import { Hero, Journey, ProductWall, Repairs, ShopCategories, Store, TrustBand, Workshop } from "@/components/marketing/home/sections";
import { getHomepageGames } from "@/lib/shop/games";
import { getProductCategoryCounts, getProducts } from "@/lib/shop/catalog";
import { PUBLIC_CATEGORIES } from "@/lib/shop/status";
import { getSeoPage } from "@/lib/content";
import { getBrandSettings } from "@/lib/settings";
import { WORKSHOP_VIDEO } from "@/lib/content/assets";

/**
 * L'accueil : un atelier de réparation de consoles, et la boutique qui va avec.
 *
 * L'ordre est la promesse du site et ne se négocie pas — hero compact, pannes
 * prises en charge console par console, parcours du diagnostic au retour,
 * engagements, vidéo d'atelier, puis la boutique : trois rayons et le mur de
 * produits. La réparation occupe le plus de surface parce que c'est le métier
 * principal ; les produits restent atteignables en deux gestes.
 *
 * Rendu à la demande : prix, stock et nombre de références viennent du
 * catalogue. Un rendu statique figerait l'état du magasin au moment du build.
 */
export const dynamic = "force-dynamic";

/** Le mur de produits de l'accueil. Le reste est derrière « Voir les N références ». */
const WALL = 8;

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeoPage("/"), getBrandSettings()]);
  return {
    title: { absolute: seo?.title ?? `${brand.name} — ${brand.tagline}` },
    description: seo?.description ?? brand.description,
    alternates: { canonical: SITE_URL },
  };
}

export default async function HomePage() {
  const [brand, counts, products] = await Promise.all([
    getBrandSettings(),
    getProductCategoryCounts(),
    getProducts({ sort: "recent" }, WALL),
  ]);

  // La sélection IGDB ne prend le relais que si le catalogue est vide : un vrai
  // produit et une fiche de démonstration ne se mélangent jamais dans la même
  // grille, sinon le visiteur ne sait plus lequel il peut acheter.
  const { latest, isDemo } = products.length ? { latest: [], isDemo: false } : await getHomepageGames(WALL);
  const demoGames = isDemo ? latest.slice(0, WALL) : [];

  // Le total affiché sur « Voir les N références » ne compte que les rayons
  // publics : accessoires et pièces détachées ne sont pas des rayons ici.
  const total = PUBLIC_CATEGORIES.reduce((n, c) => n + (counts[c] ?? 0), 0);

  return (
    <>
      <Hero />
      <Repairs />
      <Journey />
      <TrustBand />
      <Workshop video={WORKSHOP_VIDEO} />
      <ShopCategories />
      <ProductWall products={products} demoGames={demoGames} total={total} />
      <Store brand={brand} />
    </>
  );
}
