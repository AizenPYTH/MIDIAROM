import { SiteHeader } from "@/components/marketing/header";
import { SiteFooter } from "@/components/marketing/footer";
import { MobileTabBar } from "@/components/marketing/tab-bar";
import { Backdrop } from "@/components/marketing/backdrop";
import { RevealArmer } from "@/components/marketing/motion";
import { getSetting } from "@/lib/settings";
import { getActiveModels } from "@/lib/repair/catalog";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [brand, social, models] = await Promise.all([getSetting("brand"), getSetting("social"), getActiveModels()]);
  return (
    <>
      <Backdrop />
      <RevealArmer />
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-ink-900">
        Aller au contenu
      </a>
      <SiteHeader brand={brand} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter brand={brand} social={social} models={models.map((m) => ({ slug: m.slug, name: m.name }))} />
      <MobileTabBar />
    </>
  );
}
