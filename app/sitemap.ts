import type { MetadataRoute } from "next";
import { ROUTES, SITE_URL } from "@/config/site";
import { getModelsWithActiveRepairs, getSeoPublishedRepairs } from "@/lib/repair/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [models, repairs] = await Promise.all([getModelsWithActiveRepairs().catch(() => []), getSeoPublishedRepairs().catch(() => [])]);
  const statics: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}${ROUTES.repair}`, changeFrequency: "weekly", priority: 0.9 },
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
  ];
}
