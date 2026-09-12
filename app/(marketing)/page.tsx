import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { FaqList, MethodCards, PriceLines, ReviewsSection, StoreCards } from "@/components/marketing/sections";
import { ConsoleMarquee } from "@/components/marketing/marquee";
import { PulseDot } from "@/components/marketing/backdrop";
import { Counter, CursorHalo, Magnetic, Tilt } from "@/components/marketing/motion";
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

/**
 * Les quatre temps de la méthode, avec leur accent. Texte du handoff v4, repris
 * mot pour mot ; le bloc éditorial `homepage.repair` peut le remplacer depuis
 * Contenu → Blocs.
 */
const DEFAULT_HOWTO = [
  { title: "Vous décrivez", text: "Appareil, panne, photographies si vous le souhaitez." },
  { title: "Vous expédiez", text: "Étiquette prépayée par courriel, ou dépôt rue de Rome." },
  { title: "Nous diagnostiquons", text: "Devis détaillé sous 48 heures. Vous validez, ou non." },
  { title: "Elle vous revient", text: "Testée, garantie trois mois, suivi de colis inclus." },
];

export default async function HomePage() {
  const [blocks, faq, brand, form, gallery] = await Promise.all([
    getContentBlocks(["homepage.hero", "homepage.tradein", "homepage.repair", "trust.intro"]),
    getFaqItems(),
    getBrandSettings(),
    getRepairFormBase(),
    getGalleryItems(),
  ]);
  const tradeIn = blocks["homepage.tradein"];
  const tradeInData = blockData(tradeIn, { cta: "Estimer mon lot" });
  const repairBlock = blocks["homepage.repair"];
  const howto = blockData(repairBlock, { howto: DEFAULT_HOWTO }).howto;

  const db = createSupabaseAdminClient();
  const [{ data: popular }, { data: reviews }] = await Promise.all([
    db
      .from("repairs")
      .select("id, name, price_cents, price_is_provisional, is_diagnostic_only, model:console_models!inner(slug, name, is_active), fault:faults!inner(slug, is_active)")
      .eq("is_active", true)
      .eq("is_seo_published", true)
      .order("display_order")
      .limit(12),
    db.from("public_reviews").select("*").order("is_featured", { ascending: false }).limit(6),
  ]);
  const priceList = (popular ?? [])
    .filter((r) => (r.model as { is_active: boolean }).is_active && (r.fault as { is_active: boolean }).is_active)
    .slice(0, 6)
    .map((r) => ({
      label: `${r.name}${r.is_diagnostic_only ? " (déduit si réparation)" : ""}`,
      // Aucun prix n'est inventé : une prestation non chiffrée reste « sur devis ».
      price: r.price_is_provisional ? "sur devis" : formatPrice(r.price_cents),
      href: `${ROUTES.repair}/${(r.model as { slug: string }).slug}/${(r.fault as { slug: string }).slug}`,
    }));

  // Le bandeau défilant ne montre que des consoles réellement au catalogue.
  const marquee = form.models.map((m) => m.name);
  const storePhoto = gallery.find((g) => g.category === "storefront") ?? gallery[0] ?? null;

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

  /** Les quatre chiffres du panneau du hero. « Depuis » ne s'incrémente pas :
   *  une année qui défile de 0 à 1997 se lit comme un compteur cassé. */
  const stats: { value: number; label: string; tone: string; suffix?: string; decimals?: number; raw?: boolean }[] = [
    { value: 48, suffix: " h", label: "Diagnostic", tone: "text-lime" },
    { value: 3, suffix: " mois", label: "Garantie", tone: "text-cyan" },
    { value: 5, decimals: 1, suffix: " j", label: "Délai moyen", tone: "text-violet" },
    { value: Number(brand.founded_year ?? 1997), label: "Depuis", tone: "text-rose", raw: true },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ------------------------------------------------------------------
          Hero. Le halo suit le curseur dans toute la section ; le panneau de
          statistiques s'incline vers lui. Les deux se taisent au doigt.
      ------------------------------------------------------------------ */}
      <section id="top" className="relative overflow-hidden">
        <CursorHalo />
        <Container className="relative pb-[72px] pt-10 sm:pt-[92px]">
          <span className="anim-rise chip border border-border text-ink-soft">
            <PulseDot />
            Atelier ouvert · {brand.city ?? "Marseille"} · depuis {brand.founded_year ?? 1997}
          </span>
          <h1 className="anim-rise mt-7 max-w-[15ch] font-display text-[clamp(52px,10.5vw,158px)] font-extrabold leading-[0.84] tracking-[-0.05em]" style={{ animationDelay: "0.05s" }}>
            Votre console
            <br />
            revient <span className="shimmer-text">vivante</span>.
          </h1>
          <p className="anim-rise mt-7 max-w-[30ch] text-[clamp(17px,1.7vw,22px)] leading-[1.4] text-ink-soft" style={{ animationDelay: "0.1s" }}>
            Diagnostic sous 48 heures. Devis avant toute intervention. Garantie trois mois.
          </p>
          <div className="anim-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.18s" }}>
            <Magnetic className="max-sm:w-full">
              <Link href="#devis" className="btn-gradient flex items-center justify-center rounded-full px-9 py-5 text-[17px] font-semibold max-sm:w-full">
                Démarrer mon devis
              </Link>
            </Magnetic>
            <Link
              href="#tarifs"
              className="flex items-center justify-center rounded-full border border-border-strong px-7 py-[17px] font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-soft transition-colors duration-300 hover:border-sale hover:text-sale max-sm:w-full"
            >
              Tarifs
            </Link>
          </div>

          {/* Le panneau de statistiques s'incline vers le curseur ; au doigt il
              reste immobile. Les trois premiers chiffres s'incrémentent. */}
          <Tilt className="glass mt-14 rounded-[28px] p-6 sm:p-9">
            {/* 2 × 2 au téléphone (écran M1), une rangée de quatre au-delà. */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className={`font-display text-[clamp(38px,4.6vw,62px)] font-bold leading-none tracking-[-0.035em] ${s.tone}`}>
                    {s.raw ? s.value : <Counter value={s.value} decimals={s.decimals ?? 0} suffix={s.suffix ?? ""} />}
                  </p>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </Tilt>
        </Container>
      </section>

      <ConsoleMarquee items={marquee} />

      {/* Méthode ------------------------------------------------------- */}
      <section id="methode" className="scroll-mt-24">
        <Container className="py-[92px]">
          <Eyebrow tone="repair">Méthode</Eyebrow>
          <h2 className="reveal mt-3 max-w-[18ch] font-display text-[clamp(34px,5.4vw,78px)] font-extrabold leading-[0.9] tracking-[-0.04em]">Quatre temps, zéro surprise.</h2>
          <MethodCards steps={howto.slice(0, 4)} className="mt-12" />
        </Container>
      </section>

      {/* Devis : le parcours principal ---------------------------------- */}
      <section id="devis" className="scroll-mt-24">
        <Container className="py-[92px]">
          <RepairForm models={form.models} conditions={form.conditions} initialCustomer={null} initialAddress={null} isLoggedIn={false} stickyActions={false} />
        </Container>
      </section>

      {/* Tarifs --------------------------------------------------------- */}
      <section id="tarifs" className="scroll-mt-24">
        <Container className="py-[92px]">
          <Eyebrow>Tarifs</Eyebrow>
          <h2 className="reveal mt-3 font-display text-[clamp(34px,5.4vw,78px)] font-extrabold leading-[0.9] tracking-[-0.04em]">Tarifs, hors pièces.</h2>
          <p className="reveal mt-4 max-w-[52ch] text-[17px] leading-[1.45] text-ink-soft">
            {repairBlock?.body ?? "Le devis définitif vous est adressé après diagnostic. Une prestation dont le tarif n'est pas encore arbitré s'affiche « sur devis »."}
          </p>
          <PriceLines items={priceList} className="mt-10" />
        </Container>
      </section>

      {/* Atelier -------------------------------------------------------- */}
      <section id="atelier" className="scroll-mt-24">
        <Container className="py-[92px]">
          <Eyebrow tone="repair">Atelier</Eyebrow>
          <h2 className="reveal mt-3 font-display text-[clamp(34px,5.4vw,78px)] font-extrabold leading-[0.9] tracking-[-0.04em]">{brand.address_line1 ?? "207 rue de Rome"}</h2>
          <StoreCards brand={brand} photo={storePhoto} className="mt-12" />
        </Container>
      </section>

      <ReviewsSection reviews={reviews ?? []} />

      {faq.length ? (
        <section className="scroll-mt-24">
          <Container className="grid gap-12 py-[92px] lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="reveal mt-3 font-display text-[clamp(30px,4vw,54px)] font-extrabold leading-[0.92] tracking-[-0.04em]">Questions fréquentes</h2>
              <p className="reveal mt-4 max-w-[42ch] text-[16px] text-ink-soft">{blocks["trust.intro"]?.body ?? "Envoi, délais, devis complémentaire, garantie : les réponses avant de confier votre console."}</p>
              <Link href={ROUTES.faq} className="reveal mt-5 inline-block font-mono text-[11.5px] uppercase tracking-[0.12em] text-sale underline underline-offset-4">
                Toutes les questions
              </Link>
            </div>
            <FaqList items={faq.slice(0, 6)} />
          </Container>
        </section>
      ) : null}

      {/* Reprise : l'atelier rachète des consoles, il n'en revend pas. --- */}
      <section id="reprise" className="scroll-mt-24">
        <Container className="pb-[92px]">
          <div className="glass reveal flex flex-col gap-4 rounded-[28px] p-8 sm:p-10">
            <Eyebrow>Reprise</Eyebrow>
            <h2 className="font-display text-[clamp(26px,3.4vw,42px)] font-bold leading-[0.95] tracking-[-0.035em]">{tradeIn?.title ?? "Vendez-nous votre console"}</h2>
            <p className="max-w-[52ch] text-[16px] leading-[1.45] text-ink-soft">{tradeIn?.body ?? "Estimation en ligne, paiement au comptoir le jour même. Consoles, jeux, manettes, collectors."}</p>
            <Link href={ROUTES.tradeIn} className="btn-gradient mt-2 self-stretch rounded-full px-[22px] py-[15px] text-center text-[15px] font-semibold sm:self-start">
              {tradeInData.cta}
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
