import type { MetadataRoute } from "next";
import { ROUTES, SITE_URL } from "@/config/site";
import { getModelsWithActiveRepairs, getSeoPublishedRepairs } from "@/lib/repair/catalog";
import { getProducts } from "@/lib/shop/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // La boutique était absente du plan du site : aucune fiche produit n'était
  // proposée à l'indexation, alors que chacune a son titre, sa description et
  // ses données structurées. Un magasin en ligne dont le catalogue n'est pas
  // dans son sitemap se prive de la moitié de ses pages.
  const [models, repairs, products] = await Promise.all([
    getModelsWithActiveRepairs().catch(() => []),
    getSeoPublishedRepairs().catch(() => []),
    getProducts({}, 1000).catch(() => []),
  ]);
  const statics: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}${ROUTES.repair}`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}${ROUTES.shop}`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}${ROUTES.howItWorks}`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}${ROUTES.trust}`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}${ROUTES.faq}`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}${ROUTES.packaging}`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}${ROUTES.tracking}`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}${ROUTES.contact}`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}${ROUTES.cgv}`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}${ROUTES.privacy}`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [
    ...statics,
    ...models.map((m) => ({ url: `${SITE_URL}${ROUTES.repair}/${m.slug}`, lastModified: m.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...repairs.map((r) => ({ url: `${SITE_URL}${ROUTES.repair}/${r.modelSlug}/${r.faultSlug}`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${SITE_URL}${ROUTES.shop}/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
