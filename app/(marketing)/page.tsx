import type { Metadata } from "next";
import { SITE_URL } from "@/config/site";
import { Hero, Journey, ProductWall, Repairs, ShopCategories, Store, TrustBand, Workshop } from "@/components/marketing/home/sections";
import { getProductCategoryCounts, getProducts } from "@/lib/shop/catalog";
import { getModelsWithActiveRepairs } from "@/lib/repair/catalog";
import { PUBLIC_CATEGORIES } from "@/lib/shop/status";
import { getSeoPage } from "@/lib/content";
import { getBrandSettings, getBusinessRules } from "@/lib/settings";
import { formatPrice } from "@/lib/utils/format";
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
  const [brand, rules, counts, products, models] = await Promise.all([
    getBrandSettings(),
    // Le tarif de diagnostic affiché doit être celui que la caisse applique.
    getBusinessRules(),
    getProductCategoryCounts(),
    getProducts({ sort: "recent" }, WALL),
    // Les consoles réellement réparables : elles décident où mènent les cartes
    // de plateforme. Sans elles, « Diagnostic PlayStation » rouvrirait le
    // choix de la marque.
    getModelsWithActiveRepairs().catch(() => []),
  ]);


  // Le total affiché sur « Voir les N références » ne compte que les rayons
  // publics : accessoires et pièces détachées ne sont pas des rayons ici.
  const total = PUBLIC_CATEGORIES.reduce((n, c) => n + (counts[c] ?? 0), 0);

  // Zéro veut dire « pas de diagnostic facturé » : on n'annonce alors rien,
  // plutôt que d'afficher « 0 € », qui se lirait comme une promesse.
  const diagnostic = rules.diagnostic_fee_cents > 0 ? formatPrice(rules.diagnostic_fee_cents) : null;

  return (
    <>
      <Hero />
      <Repairs models={models} diagnostic={diagnostic} />
      <Journey diagnostic={diagnostic} />
      <TrustBand />
      <Workshop video={WORKSHOP_VIDEO} />
      <ShopCategories />
      <ProductWall products={products} total={total} />
      <Store brand={brand} />
    </>
  );
}
