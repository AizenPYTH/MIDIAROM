import type { Metadata } from "next";
import { SITE_URL, ROUTES } from "@/config/site";
import { BoutiqueV9, HeroV9, MachinesV9, MagasinV9, PannesV9, ParcoursV9 } from "@/components/marketing/home/v9";
import { RayonV9, type RayonProduit } from "@/components/marketing/home/rayon-v9";
import { getProductCategoryCounts, getProducts } from "@/lib/shop/catalog";
import { getModelsWithActiveRepairs } from "@/lib/repair/catalog";
import { getRayons } from "@/lib/shop/categories";
import { rayonsPublics } from "@/lib/shop/rayons";
import { getSeoPage } from "@/lib/content";
import { getBrandSettings, getBusinessRules } from "@/lib/settings";
import { formatPrice } from "@/lib/utils/format";

/**
 * L'accueil : un atelier de réparation de consoles, et la boutique qui va avec.
 *
 * L'ordre est la promesse du site et ne se négocie pas — hero réparation,
 * 01 votre machine, 02 votre panne, 03 le parcours, la boutique, en rayon, le
 * magasin. La réparation occupe le plus de surface parce que c'est le métier
 * principal ; les produits restent atteignables en deux gestes.
 *
 * Rendu à la demande : prix, stock et nombre de références viennent du
 * catalogue. Un rendu statique figerait l'état du magasin au moment du build.
 */
export const dynamic = "force-dynamic";

/** Le mur d'accueil. Douze références, filtres compris — au-delà, le catalogue. */
const MUR = 24;

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeoPage("/"), getBrandSettings()]);
  return {
    title: { absolute: seo?.title ?? `${brand.name} — ${brand.tagline}` },
    description: seo?.description ?? brand.description,
    alternates: { canonical: SITE_URL },
  };
}

/**
 * Où mène une tuile de plateforme.
 *
 * Vers la page de la console la plus récente de la famille — `/reparation/ps5`
 * — et non vers `/reparation`, qui rouvre le choix de la marque. Le
 * rattachement se fait sur le début du slug, parce que c'est ce que la base
 * garantit. Sans modèle publié pour une famille, on retombe sur le parcours
 * général : un lien vers une page inexistante serait pire.
 */
function liensMachines(models: { slug: string }[]): Record<string, string> {
  const prefixes: Record<string, string[]> = { playstation: ["ps"], switch: ["switch"], xbox: ["xbox"] };
  const out: Record<string, string> = {};
  for (const [cle, debuts] of Object.entries(prefixes)) {
    const m = models.find((x) => debuts.some((d) => x.slug.startsWith(d)));
    if (m) out[cle] = `${ROUTES.repair}/${m.slug}`;
  }
  const retro = models.find((x) => !Object.values(prefixes).flat().some((d) => x.slug.startsWith(d)));
  if (retro) out.retro = `${ROUTES.repair}/${retro.slug}`;
  return out;
}

export default async function HomePage() {
  const [brand, rules, counts, products, models, rayons] = await Promise.all([
    getBrandSettings(),
    // Le tarif de diagnostic affiché doit être celui que la caisse applique.
    getBusinessRules(),
    getProductCategoryCounts(),
    getProducts({ sort: "recent" }, MUR),
    getModelsWithActiveRepairs().catch(() => []),
    getRayons(),
  ]);

  // Les rayons publics, dans l'ordre choisi au back-office. Le mur d'accueil,
  // ses filtres et son total n'en connaissent pas d'autres.
  const publics = rayonsPublics(rayons);
  const codesPublics = publics.map((r) => r.code);

  // Le total du bouton « Voir tout le catalogue » ne compte que les rayons
  // publics : accessoires et pièces détachées ne sont pas des rayons ici.
  const total = codesPublics.reduce((n, c) => n + (counts[c] ?? 0), 0);

  // Zéro veut dire « pas de diagnostic facturé » : on n'annonce alors rien,
  // plutôt que d'afficher « 0 € », qui se lirait comme une promesse.
  const diagnostic = rules.diagnostic_fee_cents > 0 ? formatPrice(rules.diagnostic_fee_cents) : null;

  // Le mur ne montre que les rayons publics : un câble ou une pièce détachée
  // n'a rien à faire en vitrine, et fausserait les filtres.
  const produits: RayonProduit[] = products
    .filter((p) => codesPublics.includes(p.category))
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceCents: p.price_cents,
      quantity: p.quantity,
      seuil: p.low_stock_threshold,
      condition: p.condition,
      category: p.category,
      platform: p.platform,
      image: p.images[0] ?? null,
    }));

  return (
    <>
      <HeroV9 diagnostic={diagnostic} />
      <MachinesV9 modelHrefs={liensMachines(models)} />
      <PannesV9 />
      <ParcoursV9 />
      <BoutiqueV9 rayons={publics} />
      <RayonV9 produits={produits} total={total} rayons={publics} />
      <MagasinV9 brand={brand} />
    </>
  );
}
