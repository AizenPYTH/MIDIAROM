import { SiteHeader } from "@/components/marketing/header";
import { DemoBanner } from "@/components/marketing/demo-banner";
import { SiteFooter } from "@/components/marketing/footer";
import { MobileTabBar } from "@/components/marketing/tab-bar";
import { Backdrop } from "@/components/marketing/backdrop";
import { RevealArmer } from "@/components/marketing/motion";
import { getSetting } from "@/lib/settings";
import { getActiveModels } from "@/lib/repair/catalog";
import { getRayons } from "@/lib/shop/categories";
import { getProductTags } from "@/lib/shop/catalog";
import { rayonsPublics } from "@/lib/shop/rayons";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [brand, social, models, rayons, tags] = await Promise.all([getSetting("brand"), getSetting("social"), getActiveModels(), getRayons(), getProductTags()]);
  // Les rayons de la navigation et du pied de page viennent de la base : un
  // rayon ouvert au back-office apparaît dans le menu sans redéploiement.
  const publics = rayonsPublics(rayons);
  return (
    <>
      <Backdrop />
      <RevealArmer />
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-paper focus:px-4 focus:py-2 focus:text-ink-900">
        Aller au contenu
      </a>
      <DemoBanner />
      <SiteHeader brand={brand} rayons={publics} tags={tags} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter brand={brand} social={social} models={models.map((m) => ({ slug: m.slug, name: m.name }))} rayons={publics} />
      <MobileTabBar />
    </>
  );
}
