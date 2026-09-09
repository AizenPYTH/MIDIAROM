import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES, SITE_URL } from "@/config/site";
import { Breadcrumbs, Container, Eyebrow } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { FaqList, StepsList } from "@/components/marketing/sections";
import { IncludedList, PriceTag, RepairFacts } from "@/components/repair/repair-summary";
import { StickyCta } from "@/components/repair/sticky-cta";
import { TrackOnMount } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getRepairBySlugs, getRepairOffer, getSeoPublishedRepairs } from "@/lib/repair/catalog";
import { blockData, getContentBlock, getContentBlocks, getFaqItems } from "@/lib/content";
import { getBrandSettings, getSetting } from "@/lib/settings";
import { formatPrice, formatPriceDelta } from "@/lib/utils/format";
import { renderMarkdown } from "@/lib/utils/markdown";

export const revalidate = 600;

export async function generateStaticParams() {
  const repairs = await getSeoPublishedRepairs().catch(() => []);
  return repairs.map((r) => ({ model: r.modelSlug, fault: r.faultSlug }));
}

export async function generateMetadata({ params }: { params: Promise<{ model: string; fault: string }> }): Promise<Metadata> {
  const { model, fault } = await params;
  const repair = await getRepairBySlugs(model, fault);
  if (!repair) return { title: "Réparation introuvable" };
  const url = `${SITE_URL}${ROUTES.repair}/${repair.model.slug}/${repair.fault.slug}`;
  return {
    title: repair.seo_title ?? `${repair.name} — ${formatPrice(repair.price_cents)}`,
    description: repair.seo_description ?? repair.summary ?? `${repair.name} en atelier, envoi depuis toute la France et suivi en ligne.`,
    alternates: { canonical: url },
    robots: repair.is_seo_published ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title: repair.seo_h1 ?? repair.name, description: repair.seo_description ?? repair.summary ?? undefined, url },
  };
}

interface FaqEntry {
  question: string;
  answer: string;
}

function parseFaq(value: unknown): FaqEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is FaqEntry => typeof v === "object" && v !== null && typeof (v as FaqEntry).question === "string" && typeof (v as FaqEntry).answer === "string");
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-[22px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
      <div className="mt-3 text-[15.5px] leading-[1.55] text-ink-soft">{children}</div>
    </section>
  );
}

export default async function RepairPage({ params }: { params: Promise<{ model: string; fault: string }> }) {
  const { model, fault } = await params;
  const repair = await getRepairBySlugs(model, fault);
  if (!repair) notFound();

  const [offer, blocks, brand, warranty, globalFaq, ctaBlock] = await Promise.all([
    getRepairOffer(repair),
    getContentBlocks(["how_it_works.steps", "upsell.title"]),
    getBrandSettings(),
    getSetting("warranty"),
    getFaqItems("reparation"),
    getContentBlock("repair.cta"),
  ]);
  const steps = blockData(blocks["how_it_works.steps"], { steps: [] as { title: string; text: string }[] }).steps;
  const repairFaq = parseFaq(repair.seo_faq);
  const faq = [...repairFaq.map((f, i) => ({ id: `r-${i}`, ...f })), ...globalFaq.slice(0, 4)];
  const cta = ctaBlock?.title ?? "Commander cette réparation";
  const checkoutHref = `${ROUTES.checkout}/${repair.id}`;
  const recommended = [...offer.packs.filter((p) => p.is_recommended), ...offer.options.filter((o) => o.is_recommended)].slice(0, 3);
  const url = `${SITE_URL}${ROUTES.repair}/${repair.model.slug}/${repair.fault.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: repair.name,
      description: repair.seo_description ?? repair.summary ?? undefined,
      provider: { "@type": "LocalBusiness", name: brand.name, url: SITE_URL },
      areaServed: "FR",
      url,
      offers: { "@type": "Offer", price: (repair.price_cents / 100).toFixed(2), priceCurrency: "EUR", availability: "https://schema.org/InStock", url },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Réparation", item: `${SITE_URL}${ROUTES.repair}` },
        { "@type": "ListItem", position: 2, name: repair.model.name, item: `${SITE_URL}${ROUTES.repair}/${repair.model.slug}` },
        { "@type": "ListItem", position: 3, name: repair.fault.name, item: url },
      ],
    },
    ...(repairFaq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: repairFaq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackOnMount event={ANALYTICS_EVENTS.VIEW_REPAIR} props={{ repair_id: repair.id, value_cents: repair.price_cents, repair_name: repair.name }} />

      {/* En-tête encre : fil d'Ariane, titre, résumé, carte prix */}
      <section className="bg-ink-900 px-6 py-[56px] text-paper">
        <div className="mx-auto grid max-w-[1280px] items-start gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="flex flex-col gap-[18px]">
            <div className="text-[#a39c8c]">
              <Breadcrumbs items={[{ label: "Accueil", href: ROUTES.home }, { label: "Réparation", href: ROUTES.repair }, { label: repair.model.name, href: `${ROUTES.repair}/${repair.model.slug}` }, { label: repair.fault.name }]} />
            </div>
            <Eyebrow tone="repair">
              {repair.model.brand.name} · {repair.model.name}
            </Eyebrow>
            <h1 className="text-[clamp(32px,4vw,52px)] font-extrabold leading-[1] tracking-[-0.03em]">{repair.seo_h1 ?? repair.name}</h1>
            {repair.summary ? <p className="max-w-[42ch] text-[17px] leading-[1.5] text-[#c4bdae]">{repair.summary}</p> : null}
            {repair.included_items.length ? (
              <ul className="flex flex-wrap gap-2">
                {repair.included_items.map((item) => (
                  <li key={item} className="border border-ink-650 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[#c4bdae]">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <aside className="bg-paper p-[26px] text-ink-900">
            <span className="font-mono text-[12px] uppercase tracking-[0.08em]">Prestation</span>
            <p className="mt-2 text-[22px] font-extrabold tracking-[-0.01em]">{repair.name}</p>
            <div className="mt-3">
              <PriceTag cents={repair.price_cents} compareAt={repair.compare_at_price_cents} />
            </div>
            {repair.is_diagnostic_only ? <p className="mt-2 text-[13px] text-ink-faint">Diagnostic puis devis. Le montant du diagnostic est traité selon les conditions affichées avant paiement.</p> : null}
            <div className="mt-4">
              <RepairFacts repair={repair} />
            </div>
            <Link href={checkoutHref} className="mt-5 block bg-accent px-4 py-[14px] text-center font-mono text-[12.5px] uppercase tracking-[0.06em] text-white hover:bg-ink-900">
              {cta}
            </Link>
            <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">Transport en sus selon la formule · Paiement sécurisé</p>
          </aside>
        </div>
      </section>

      <Container className="pb-28 pt-4 lg:pb-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <article className="min-w-0">
            {repair.description ? <div className="prose-cms mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(repair.description) }} /> : null}

            {repair.included_items.length ? (
              <SectionBlock title="Ce qui est inclus">
                <IncludedList items={repair.included_items} />
              </SectionBlock>
            ) : null}

            {repair.important_notes ? (
              <Alert tone="info" title="Bon à savoir" className="mt-8">
                {repair.important_notes}
              </Alert>
            ) : null}

            {repair.seo_symptoms ? <SectionBlock title="Symptômes">{repair.seo_symptoms}</SectionBlock> : null}
            {repair.seo_causes ? <SectionBlock title="Causes fréquentes">{repair.seo_causes}</SectionBlock> : null}
            {repair.seo_process ? <SectionBlock title="Comment nous réparons">{repair.seo_process}</SectionBlock> : null}

            <SectionBlock title="Garantie">
              <p>
                {repair.warranty_months > 0
                  ? `${repair.warranty_months} mois sur l'intervention. ${repair.warranty_scope ?? warranty.scope}`
                  : "Cette prestation de diagnostic n'est pas couverte par une garantie spécifique : la garantie s'applique à la réparation qui en découle."}
              </p>
              {repair.warranty_exclusions || warranty.exclusions ? <p className="mt-1 text-[13.5px] text-ink-muted">Exclusions : {repair.warranty_exclusions ?? warranty.exclusions}</p> : null}
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">La garantie porte sur l&apos;intervention réalisée, pas sur l&apos;ensemble de la console.</p>
            </SectionBlock>

            {steps.length ? (
              <SectionBlock title="Comment ça marche ?">
                <StepsList steps={steps.slice(0, 4)} />
                <Link href={ROUTES.howItWorks} className="mt-3 inline-block font-mono text-[12px] uppercase tracking-[0.06em] text-sale underline underline-offset-4">
                  Toutes les étapes
                </Link>
              </SectionBlock>
            ) : null}

            {recommended.length ? (
              <SectionBlock title={blocks["upsell.title"]?.title ?? "Options compatibles"}>
                <p className="text-[13.5px] text-ink-muted">Proposées lors de la commande. Facultatives.</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {recommended.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 border border-border-strong px-3.5 py-3">
                      <span>
                        <span className="block text-[15px] font-semibold text-ink">{item.name}</span>
                        <span className="block text-[13px] text-ink-faint">{item.short_description}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[14px] text-ink">{formatPriceDelta(item.price_cents)}</span>
                    </li>
                  ))}
                </ul>
              </SectionBlock>
            ) : null}

            {faq.length ? (
              <SectionBlock title="Questions fréquentes">
                <FaqList items={faq} />
              </SectionBlock>
            ) : null}
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-24 mt-6 border border-border bg-surface p-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">{repair.model.name}</span>
              <p className="mt-1 text-[16px] font-semibold text-ink">{repair.name}</p>
              <div className="mt-3">
                <PriceTag cents={repair.price_cents} compareAt={repair.compare_at_price_cents} size="md" />
              </div>
              <Link href={checkoutHref} className="mt-4 block bg-accent px-4 py-3 text-center font-mono text-[12px] uppercase tracking-[0.06em] text-white hover:bg-ink-900">
                {cta}
              </Link>
            </div>
          </aside>
        </div>
      </Container>
      <StickyCta label={repair.name} priceCents={repair.price_cents} href={checkoutHref} cta="Commander" />
    </>
  );
}
