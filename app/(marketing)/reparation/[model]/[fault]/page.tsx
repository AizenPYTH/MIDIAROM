import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { CHECKOUT_STEPS, ROUTES, SITE_URL } from "@/config/site";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { Stepper } from "@/components/ui/stepper";
import { ButtonLink } from "@/components/ui/button";
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
  return value.filter(
    (v): v is FaqEntry => typeof v === "object" && v !== null && typeof (v as FaqEntry).question === "string" && typeof (v as FaqEntry).answer === "string",
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
    ...(repairFaq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: repairFaq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
          },
        ]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackOnMount event={ANALYTICS_EVENTS.VIEW_REPAIR} props={{ repair_id: repair.id, value_cents: repair.price_cents, repair_name: repair.name }} />
      <Container className="py-10 pb-28 sm:py-14 lg:pb-14">
        <Stepper steps={CHECKOUT_STEPS} current={3} className="mb-8" />
        <Breadcrumbs
          items={[
            { label: "Accueil", href: ROUTES.home },
            { label: "Réparation", href: ROUTES.repair },
            { label: repair.model.name, href: `${ROUTES.repair}/${repair.model.slug}` },
            { label: repair.fault.name },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
          <article className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {repair.model.brand.name} · {repair.model.name} · Étape 4 sur 8
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{repair.seo_h1 ?? repair.name}</h1>
            {repair.summary ? <p className="mt-3 text-lg text-ink-soft">{repair.summary}</p> : null}

            {/* Mobile price */}
            <div className="mt-6 rounded-lg border border-border bg-surface p-5 lg:hidden">
              <PriceTag cents={repair.price_cents} compareAt={repair.compare_at_price_cents} />
              <div className="mt-4">
                <RepairFacts repair={repair} />
              </div>
            </div>

            {repair.description ? (
              <div className="prose-cms mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(repair.description) }} />
            ) : null}

            {repair.included_items.length ? (
              <section className="mt-8">
                <h2 className="text-xl font-semibold text-ink">Ce qui est inclus</h2>
                <div className="mt-3">
                  <IncludedList items={repair.included_items} />
                </div>
              </section>
            ) : null}

            {repair.important_notes ? (
              <Alert tone="info" title="Bon à savoir" className="mt-8">
                {repair.important_notes}
              </Alert>
            ) : null}

            {repair.seo_symptoms ? (
              <section className="mt-8">
                <h2 className="text-xl font-semibold text-ink">Symptômes</h2>
                <p className="mt-2 text-ink-soft">{repair.seo_symptoms}</p>
              </section>
            ) : null}
            {repair.seo_causes ? (
              <section className="mt-6">
                <h2 className="text-xl font-semibold text-ink">Causes fréquentes</h2>
                <p className="mt-2 text-ink-soft">{repair.seo_causes}</p>
              </section>
            ) : null}
            {repair.seo_process ? (
              <section className="mt-6">
                <h2 className="text-xl font-semibold text-ink">Comment nous réparons</h2>
                <p className="mt-2 text-ink-soft">{repair.seo_process}</p>
              </section>
            ) : null}

            <section className="mt-8">
              <h2 className="text-xl font-semibold text-ink">Garantie</h2>
              <p className="mt-2 text-ink-soft">
                {repair.warranty_months > 0
                  ? `${repair.warranty_months} mois sur l'intervention. ${repair.warranty_scope ?? warranty.scope}`
                  : "Cette prestation de diagnostic n'est pas couverte par une garantie spécifique : la garantie s'applique à la réparation qui en découle."}
              </p>
              {repair.warranty_exclusions || warranty.exclusions ? (
                <p className="mt-1 text-sm text-ink-muted">Exclusions : {repair.warranty_exclusions ?? warranty.exclusions}</p>
              ) : null}
              <p className="mt-1 text-xs text-ink-muted">La garantie porte sur l&apos;intervention réalisée, pas sur l&apos;ensemble de la console.</p>
            </section>

            {steps.length ? (
              <section className="mt-10">
                <h2 className="mb-4 text-xl font-semibold text-ink">Comment ça marche ?</h2>
                <StepsList steps={steps.slice(0, 4)} />
                <Link href={ROUTES.howItWorks} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                  Toutes les étapes <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </section>
            ) : null}

            {recommended.length ? (
              <section className="mt-10">
                <h2 className="text-xl font-semibold text-ink">{blocks["upsell.title"]?.title ?? "Options compatibles"}</h2>
                <p className="mt-1 text-sm text-ink-muted">Proposées lors de la commande. Facultatives.</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {recommended.map((item) => (
                    <li key={item.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
                      <span className="text-sm">
                        <span className="block font-medium text-ink">{item.name}</span>
                        <span className="block text-ink-muted">{item.short_description}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-primary">{formatPriceDelta(item.price_cents)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {faq.length ? (
              <section className="mt-10">
                <h2 className="mb-4 text-xl font-semibold text-ink">Questions fréquentes</h2>
                <FaqList items={faq} />
              </section>
            ) : null}
          </article>

          {/* Desktop sticky card */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-border bg-surface p-6 shadow-sm">
              <p className="text-sm font-medium text-ink-muted">{repair.model.name}</p>
              <p className="text-lg font-semibold text-ink">{repair.name}</p>
              <div className="mt-3">
                <PriceTag cents={repair.price_cents} compareAt={repair.compare_at_price_cents} />
              </div>
              {repair.is_diagnostic_only ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Diagnostic puis devis. Le montant du diagnostic est traité selon les conditions affichées avant paiement.
                </p>
              ) : null}
              <div className="mt-4">
                <RepairFacts repair={repair} />
              </div>
              <ButtonLink href={checkoutHref} variant="accent" size="lg" fullWidth className="mt-5">
                {cta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <p className="mt-3 text-center text-xs text-ink-muted">Transport en sus selon la formule choisie · Paiement sécurisé</p>
            </div>
          </aside>
        </div>
      </Container>
      <StickyCta label={repair.name} priceCents={repair.price_cents} href={checkoutHref} cta="Commander" />
    </>
  );
}
