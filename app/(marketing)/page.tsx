import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { CtaBanner, FaqList, GuaranteeStrip, HowToList, PriceList, ReviewsSection, StoreSection } from "@/components/marketing/sections";
import { ProductCard } from "@/components/shop/product-card";
import { RepairForm } from "@/components/repair/repair-form";
import { getRepairFormBase } from "@/lib/repair/form-data";
import { blockData, getContentBlocks, getFaqItems, getGalleryItems, getSeoPage } from "@/lib/content";
import { getBrandSettings } from "@/lib/settings";
import { getFeaturedProducts, getProductCategoryCounts, getProductPlatforms, getProducts } from "@/lib/shop/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/utils/format";

/**
 * Rendu à la demande, pour la même raison que /reparation : consoles prises en
 * charge, produits en rayon et blocs éditoriaux viennent tous de la base. Un
 * rendu statique fige l'état du catalogue au moment du build.
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

const DEFAULT_GUARANTEES = ["Occasion révisée et garantie", "Devis avant toute intervention", "Retrait boutique ou envoi", "Reprise de vos jeux au comptoir"];
const DEFAULT_HOWTO = [
  { title: "Vous décrivez la panne", text: "Console, prestation, symptômes. Trois minutes." },
  { title: "Étiquette prépayée", text: "Reçue par e-mail selon la formule choisie, à imprimer et coller sur le colis." },
  { title: "Diagnostic à réception", text: "Photos, constat, devis complémentaire par e-mail si nécessaire, validation en un clic." },
  { title: "Retour suivi", text: "Tests de contrôle qualité, garantie sur l'intervention, numéro de suivi du colis." },
];

export default async function HomePage() {
  const [blocks, faq, brand, form, gallery, featured, platforms, counts] = await Promise.all([
    getContentBlocks(["homepage.hero", "homepage.sale", "homepage.tradein", "homepage.retro", "homepage.repair", "homepage.reassurance", "trust.intro"]),
    getFaqItems(),
    getBrandSettings(),
    getRepairFormBase(),
    getGalleryItems(),
    getFeaturedProducts(8),
    getProductPlatforms(),
    getProductCategoryCounts(),
  ]);
  const hero = blocks["homepage.hero"];
  const heroData = blockData(hero, { cta_primary: "Démarrer une réparation", cta_secondary: "Grille tarifaire" });
  const sale = blocks["homepage.sale"];
  const saleData = blockData(sale, { cta_primary: "Voir la boutique", cta_secondary: "Je revends ma console" });
  const tradeIn = blocks["homepage.tradein"];
  const tradeInData = blockData(tradeIn, { cta: "Estimer mon lot" });
  const retro = blocks["homepage.retro"];
  const shelf = featured.length ? featured : await getProducts({ availability: "stock", sort: "recent" }, 8);
  const totalProducts = Object.values(counts).reduce((a, b) => a + b, 0);
  const shopChips = [
    { label: "Tout", href: ROUTES.shop },
    ...platforms.slice(0, 3).map((p) => ({ label: p, href: `${ROUTES.shop}?plateforme=${encodeURIComponent(p)}` })),
    { label: "Rétro", href: `${ROUTES.shop}?retro=1` },
    { label: "Jeux", href: `${ROUTES.shop}?cat=jeux` },
    { label: "Accessoires", href: `${ROUTES.shop}?cat=accessoires` },
    { label: "Occasion", href: `${ROUTES.shop}?etat=occasion` },
  ];
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

      {/* Hero deux colonnes du handoff : vente (papier, orange) / réparation (encre, bleu) */}
      <section id="top" className="grid [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <div className="flex flex-col gap-[18px] border-r border-border bg-bg-alt px-11 pb-13 pt-16 max-sm:px-6">
          <Eyebrow>01 — Vente</Eyebrow>
          <h1 className="text-[clamp(38px,5vw,62px)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">{sale?.title ?? "Jeux, consoles et rétro."}</h1>
          <p className="max-w-[38ch] text-[17px] leading-[1.5] text-ink-soft">{sale?.body ?? "Le stock du magasin, en ligne. Neuf, occasion révisée et garantie, accessoires et collector. Retrait boutique ou envoi partout en France."}</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            <Link href={ROUTES.shop} className="bg-sale px-[22px] py-3.5 text-[15px] font-semibold text-white hover:bg-ink-900">
              {saleData.cta_primary}
            </Link>
            <Link href={ROUTES.tradeIn} className="border border-ink px-[22px] py-3.5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-paper">
              {saleData.cta_secondary}
            </Link>
          </div>
          <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
            <Link href={`${ROUTES.shop}?cat=consoles`} className="hover:text-ink">
              Consoles
            </Link>
            {" · "}
            <Link href={`${ROUTES.shop}?cat=jeux`} className="hover:text-ink">
              Jeux
            </Link>
            {" · "}
            <Link href={`${ROUTES.shop}?cat=accessoires`} className="hover:text-ink">
              Accessoires
            </Link>
            {" · "}
            <Link href={`${ROUTES.shop}?retro=1`} className="hover:text-ink">
              Rétro
            </Link>
            {" · "}
            <Link href={ROUTES.consoles} className="hover:text-ink">
              Fiches consoles
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-[18px] bg-ink-900 px-11 pb-13 pt-16 text-paper max-sm:px-6">
          <Eyebrow tone="repair">02 — Réparation</Eyebrow>
          <h1 className="text-[clamp(38px,5vw,62px)] font-extrabold leading-[0.98] tracking-[-0.03em]">{hero?.title ?? "Envoyez-nous votre console."}</h1>
          <p className="max-w-[38ch] text-[17px] leading-[1.5] text-[#c4bdae]">{hero?.body ?? "Décrivez la panne, choisissez la prestation, imprimez l'étiquette. Diagnostic à réception, devis avant toute intervention complémentaire."}</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            <Link href="#reparation" className="bg-accent px-[22px] py-3.5 text-[15px] font-semibold text-white hover:bg-paper hover:text-ink-900">
              {heroData.cta_primary}
            </Link>
            <Link href="#tarifs" className="border border-[#55503f] px-[22px] py-3.5 text-[15px] font-semibold text-paper hover:border-paper">
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

      {/* Boutique : sélection réelle du stock + filtres vers le catalogue */}
      <section id="boutique" className="bg-bg" style={{ scrollMarginTop: 80 }}>
        <Container className="py-[72px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Boutique</Eyebrow>
              <h2 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">En rayon cette semaine</h2>
            </div>
            <Link href={ROUTES.shop} className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-sale underline underline-offset-4">
              Tout le catalogue ({totalProducts} réf.)
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {shopChips.map((c, i) => (
              <Link key={c.label} href={c.href} className={`whitespace-nowrap border border-border-strong px-3.5 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:border-ink ${i === 0 ? "bg-paper-strong" : ""}`}>
                {c.label}
              </Link>
            ))}
          </div>
          {shelf.length ? (
            <div className="mt-6 grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
              {shelf.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <p className="mt-6 text-[14.5px] text-ink-faint">Le rayon en ligne est en cours de mise à jour. Passez au magasin ou revenez bientôt.</p>
          )}
        </Container>
      </section>

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
          <RepairForm models={form.models} conditions={form.conditions} initialCustomer={null} initialAddress={null} isLoggedIn={false} />
        </div>
      </section>

      {/* Reprise & rétro : deux cellules dans un cadre */}
      <section id="retro" className="border-y border-border">
        <Container className="py-[64px]">
          <div className="grid gap-px border border-border bg-border [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            <div className="flex flex-col gap-3 bg-bg-alt p-8">
              <Eyebrow>Reprise</Eyebrow>
              <h2 className="text-[clamp(24px,2.6vw,30px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{tradeIn?.title ?? "Vendez-nous votre console"}</h2>
              <p className="max-w-[42ch] text-[16px] leading-[1.55] text-ink-soft">{tradeIn?.body ?? "Estimation en ligne, paiement au comptoir le jour même. Consoles, jeux, manettes, collectors."}</p>
              <Link href={ROUTES.tradeIn} className="mt-2 self-start bg-ink-900 px-[22px] py-3.5 text-[15px] font-semibold text-paper hover:bg-sale">
                {tradeInData.cta}
              </Link>
            </div>
            <div className="grid gap-6 bg-bg p-8 [grid-template-columns:minmax(0,1fr)_120px] max-sm:[grid-template-columns:1fr]">
              <div className="flex flex-col gap-3">
                <Eyebrow>Rétro</Eyebrow>
                <h2 className="text-[clamp(24px,2.6vw,30px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{retro?.title ?? "Le mur du rétrogaming"}</h2>
                <p className="max-w-[42ch] text-[16px] leading-[1.55] text-ink-soft">{retro?.body ?? "Cartouches testées une à une, consoles recapées, notices d'origine."}</p>
                <p className="font-mono text-[11.5px] uppercase tracking-[0.06em]">
                  <Link href={`${ROUTES.shop}?retro=1`} className="text-sale underline underline-offset-4">
                    Voir le rayon rétro
                  </Link>
                  {" · "}
                  <Link href={`${ROUTES.consoles}?f=retro`} className="text-ink-muted hover:text-ink">
                    Consoles rétro réparables
                  </Link>
                </p>
              </div>
              <div className="photo-placeholder min-h-[120px] text-[10.5px]">photo vitrine rétro</div>
            </div>
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
