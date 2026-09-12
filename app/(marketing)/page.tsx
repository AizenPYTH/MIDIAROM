import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { CtaBanner, FaqList, GuaranteeStrip, HowToList, PriceList, ReviewsSection, StoreSection } from "@/components/marketing/sections";
import { RepairForm } from "@/components/repair/repair-form";
import { getRepairFormBase } from "@/lib/repair/form-data";
import { blockData, getContentBlocks, getFaqItems, getGalleryItems, getSeoPage } from "@/lib/content";
import { getBrandSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/utils/format";

/**
 * Rendu à la demande, pour la même raison que /reparation : consoles prises en
 * charge, tarifs et blocs éditoriaux viennent tous de la base. Un rendu
 * statique fige l'état du catalogue au moment du build.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeoPage("/"), getBrandSettings()]);
  return {
    title: { absolute: seo?.title ?? `${brand.name} — ${brand.tagline}` },
    description: seo?.description ?? brand.description,
    alternates: { canonical: SITE_URL },
  };
}

// Le site ne vend rien : les quatre garanties parlent de l'atelier, pas du
// rayon. Elles ne servent que si le bloc « homepage.reassurance » est vide.
const DEFAULT_GUARANTEES = ["Diagnostic avant toute intervention", "Devis gratuit, refus sans frais", "Réparation garantie 3 mois", "Dépôt au magasin ou envoi"];
const DEFAULT_HOWTO = [
  { title: "Vous décrivez la panne", text: "Console, prestation, symptômes. Trois minutes." },
  { title: "Étiquette prépayée", text: "Reçue par e-mail selon la formule choisie, à imprimer et coller sur le colis." },
  { title: "Diagnostic à réception", text: "Photos, constat, devis complémentaire par e-mail si nécessaire, validation en un clic." },
  { title: "Retour suivi", text: "Tests de contrôle qualité, garantie sur l'intervention, numéro de suivi du colis." },
];

export default async function HomePage() {
  const [blocks, faq, brand, form, gallery] = await Promise.all([
    getContentBlocks(["homepage.hero", "homepage.tradein", "homepage.repair", "homepage.reassurance", "trust.intro"]),
    getFaqItems(),
    getBrandSettings(),
    getRepairFormBase(),
    getGalleryItems(),
  ]);
  const hero = blocks["homepage.hero"];
  const heroData = blockData(hero, { cta_primary: "Démarrer une réparation", cta_secondary: "Grille tarifaire" });
  const tradeIn = blocks["homepage.tradein"];
  const tradeInData = blockData(tradeIn, { cta: "Estimer mon lot" });
  const repairBlock = blocks["homepage.repair"];
  const howto = blockData(repairBlock, { howto: DEFAULT_HOWTO }).howto;
  const reassurance = blockData(blocks["homepage.reassurance"], { items: [] as { title: string }[] }).items.map((i) => i.title);
  const guarantees = (reassurance.length ? reassurance : DEFAULT_GUARANTEES).slice(0, 4);

  const db = createSupabaseAdminClient();
  const [{ data: popular }, { data: reviews }] = await Promise.all([
    db
      .from("repairs")
      .select("id, name, price_cents, is_diagnostic_only, model:console_models!inner(slug, name, is_active), fault:faults!inner(slug, is_active)")
      .eq("is_active", true)
      .eq("is_seo_published", true)
      .order("display_order")
      .limit(12),
    db.from("public_reviews").select("*").order("is_featured", { ascending: false }).limit(6),
  ]);
  const priceList = (popular ?? [])
    .filter((r) => (r.model as { is_active: boolean }).is_active && (r.fault as { is_active: boolean }).is_active)
    .slice(0, 5)
    .map((r) => ({
      label: `${r.name}${r.is_diagnostic_only ? " (déduit si réparation)" : ""}`,
      price: formatPrice(r.price_cents),
      href: `${ROUTES.repair}/${(r.model as { slug: string }).slug}/${(r.fault as { slug: string }).slug}`,
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brand.name,
    description: brand.description,
    url: SITE_URL,
    ...(brand.email ? { email: brand.email } : {}),
    ...(brand.phone ? { telephone: brand.phone } : {}),
    ...(brand.address_line1 ? { address: { "@type": "PostalAddress", streetAddress: brand.address_line1, postalCode: brand.postal_code, addressLocality: brand.city, addressCountry: "FR" } } : {}),
    areaServed: "FR",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Le site ne vend rien : le hero « vente / réparation » du handoff
          devient un bloc unique, pleine largeur, consacré à l'atelier. */}
      <section id="top" className="bg-ink-900 px-11 pb-13 pt-16 text-paper max-sm:px-5 max-sm:pb-8 max-sm:pt-[26px]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[18px]">
          <Eyebrow tone="repair">Atelier — depuis 1997</Eyebrow>
          <h1 className="text-[34px] font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-[clamp(38px,5vw,62px)]">{hero?.title ?? "Envoyez-nous votre console."}</h1>
          <p className="max-w-[52ch] text-[15px] leading-[1.5] text-[#c4bdae] sm:text-[17px]">{hero?.body ?? "Décrivez la panne, choisissez la prestation, imprimez l'étiquette. Diagnostic à réception, devis avant toute intervention complémentaire."}</p>
          {/* Le hero n'ayant plus qu'une moitié, les deux boutons tiennent
              désormais côte à côte, même au téléphone. */}
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Link href="#reparation" className="bg-accent px-[22px] py-[15px] text-center text-[15px] font-semibold text-white hover:bg-paper hover:text-ink-900 sm:py-3.5">
              {heroData.cta_primary}
            </Link>
            <Link href="#tarifs" className="border border-[#55503f] px-[22px] py-[15px] text-center text-[15px] font-semibold text-paper hover:border-paper sm:py-3.5">
              {heroData.cta_secondary}
            </Link>
          </div>
          <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
            <Link href={ROUTES.tracking} className="hover:text-paper">
              Suivre ma réparation
            </Link>
            {" · "}
            <Link href={ROUTES.account} className="hover:text-paper">
              Espace client
            </Link>
            {" · "}
            <Link href={ROUTES.howItWorks} className="hover:text-paper">
              Comment ça marche
            </Link>
          </p>
        </div>
      </section>

      <GuaranteeStrip items={guarantees} />

      {/* Réparation : explication + fiche */}
      <section id="reparation" className="bg-ink-900 px-6 py-[76px] text-paper" style={{ scrollMarginTop: 80 }}>
        <div className="mx-auto grid max-w-[1280px] items-start gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="flex flex-col gap-[26px]">
            <div>
              <Eyebrow tone="repair">Atelier</Eyebrow>
              <h2 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em]">{repairBlock?.title ?? "Réparation par envoi"}</h2>
              <p className="mt-3.5 max-w-[42ch] text-[16.5px] leading-[1.55] text-[#c4bdae]">{repairBlock?.body ?? "Vous décrivez la panne en ligne, vous recevez vos instructions d'envoi. À réception : diagnostic, devis si nécessaire, réparation. Aucune intervention sans votre accord."}</p>
            </div>
            <HowToList steps={howto.slice(0, 4)} />
            <PriceList id="tarifs" items={priceList} />
            <p className="font-mono text-[11.5px] text-ink-muted">
              <Link href={ROUTES.howItWorks} className="hover:text-paper">
                Toutes les étapes
              </Link>
              {" · "}
              <Link href={ROUTES.trust} className="hover:text-paper">
                Pourquoi nous confier votre console
              </Link>
            </p>
          </div>
          <RepairForm models={form.models} conditions={form.conditions} initialCustomer={null} initialAddress={null} isLoggedIn={false} stickyActions={false} />
        </div>
      </section>

      {/* Reprise : l'atelier rachète les consoles, il n'en revend pas. Le
          « mur du rétrogaming » qui accompagnait cette cellule renvoyait au
          rayon de la boutique : il disparaît avec elle. */}
      <section id="reprise" className="border-y border-border">
        <Container className="py-[64px]">
          <div className="flex flex-col gap-3 border border-border bg-bg-alt p-8">
            <Eyebrow>Reprise</Eyebrow>
            <h2 className="text-[clamp(24px,2.6vw,30px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{tradeIn?.title ?? "Vendez-nous votre console"}</h2>
            <p className="max-w-[52ch] text-[16px] leading-[1.55] text-ink-soft">{tradeIn?.body ?? "Estimation en ligne, paiement au comptoir le jour même. Consoles, jeux, manettes, collectors."}</p>
            <Link href={ROUTES.tradeIn} className="mt-2 self-stretch bg-ink-900 px-[22px] py-[15px] text-center text-[15px] font-semibold text-paper hover:bg-sale sm:self-start sm:py-3.5">
              {tradeInData.cta}
            </Link>
          </div>
        </Container>
      </section>

      <ReviewsSection reviews={reviews ?? []} />

      {faq.length ? (
        <section className="border-t border-border">
          <Container className="grid gap-10 py-[72px] [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            <div>
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">Questions fréquentes</h2>
              <p className="mt-3 max-w-[42ch] text-[16px] text-ink-soft">{blocks["trust.intro"]?.body ?? "Envoi, délais, devis complémentaire, garantie : les réponses avant de commander."}</p>
              <Link href={ROUTES.faq} className="mt-4 inline-block font-mono text-[12.5px] uppercase tracking-[0.06em] text-sale underline underline-offset-4">
                Toutes les questions
              </Link>
            </div>
            <FaqList items={faq.slice(0, 6)} />
          </Container>
        </section>
      ) : null}

      <StoreSection brand={brand} photo={gallery.find((g) => g.category === "storefront") ?? gallery[0] ?? null} />

      <CtaBanner title="Prêt à faire réparer votre console ?" text="Choisissez la plateforme et le modèle, la prestation, envoyez la console et suivez chaque étape depuis votre espace client." />
    </>
  );
}
