import { SiteHeader } from "@/components/marketing/header";
import { SiteFooter } from "@/components/marketing/footer";
import { getSetting } from "@/lib/settings";
import { getActiveModels } from "@/lib/repair/catalog";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [brand, social, models] = await Promise.all([getSetting("brand"), getSetting("social"), getActiveModels()]);
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Aller au contenu
      </a>
      <SiteHeader brandName={brand.name} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter brand={brand} social={social} models={models.map((m) => ({ slug: m.slug, name: m.name }))} />
    </>
  );
}
