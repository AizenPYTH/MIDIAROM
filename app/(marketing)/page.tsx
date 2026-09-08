import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, SectionTitle } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { ConsoleGrid, CtaBanner, FaqList, PopularRepairs, ReassuranceGrid, ReviewsSection, StepsList } from "@/components/marketing/sections";
import { getActiveBrands, getActiveModels } from "@/lib/repair/catalog";
import { blockData, getContentBlocks, getFaqItems, getSeoPage } from "@/lib/content";
import { getBrandSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeoPage("/"), getBrandSettings()]);
  return {
    title: { absolute: seo?.title ?? `${brand.name} — ${brand.tagline}` },
    description: seo?.description ?? brand.description,
    alternates: { canonical: SITE_URL },
  };
}

const DEFAULT_REASSURANCE = [
  { icon: "Truck", title: "Réparation à distance", text: "Envoyez votre console depuis n'importe où en France." },
  { icon: "Wrench", title: "Atelier spécialisé", text: "Des techniciens équipés pour la micro-soudure et les consoles récentes." },
  { icon: "Eye", title: "Suivi du dossier", text: "Photos à réception, diagnostic, devis, tests : tout est tracé." },
  { icon: "ShieldCheck", title: "Garantie sur l'intervention", text: "Chaque réparation précise sa garantie." },
  { icon: "Lock", title: "Paiement sécurisé", text: "Paiement en ligne sécurisé." },
];

export default async function HomePage() {
  const [brands, models, blocks, faq, brand] = await Promise.all([
    getActiveBrands(),
    getActiveModels(),
    getContentBlocks(["homepage.hero", "homepage.reassurance", "how_it_works.steps", "trust.intro"]),
    getFaqItems(),
    getBrandSettings(),
  ]);
  const hero = blocks["homepage.hero"];
  const heroData = blockData(hero, { cta_primary: "Faire réparer ma console", cta_secondary: "Comment ça marche ?" });
  const reassurance = blockData(blocks["homepage.reassurance"], { items: DEFAULT_REASSURANCE }).items;
  const steps = blockData(blocks["how_it_works.steps"], { steps: [] as { title: string; text: string }[] }).steps;
  const trust = blocks["trust.intro"];

  const db = createSupabaseAdminClient();
  const [{ data: popular }, { data: reviews }] = await Promise.all([
    db
      .from("repairs")
      .select("id, name, price_cents, summary, slug, model:console_models!inner(slug, name, is_active), fault:faults!inner(slug, is_active)")
      .eq("is_active", true)
      .eq("is_seo_published", true)
      .order("display_order")
      .limit(6),
    db.from("public_reviews").select("*").order("is_featured", { ascending: false }).limit(6),
  ]);

  const popularRepairs = (popular ?? [])
    .filter((r) => (r.model as { is_active: boolean }).is_active && (r.fault as { is_active: boolean }).is_active)
    .map((r) => ({
      id: r.id,
      name: r.name,
      price_cents: r.price_cents,
      summary: r.summary,
      modelSlug: (r.model as { slug: string }).slug,
      modelName: (r.model as { name: string }).name,
      faultSlug: (r.fault as { slug: string }).slug,
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brand.name,
    description: brand.description,
    url: SITE_URL,
    ...(brand.email ? { email: brand.email } : {}),
    ...(brand.phone ? { telephone: brand.phone } : {}),
    areaServed: "FR",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">{brand.tagline}</p>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl">
              {hero?.title ?? "Faites réparer votre console, où que vous soyez en France."}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-soft">
              {hero?.body ?? "Choisissez votre console et votre panne, commandez en ligne et suivez votre réparation de l'envoi jusqu'au retour."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={ROUTES.repair} variant="accent" size="lg">
                {heroData.cta_primary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href={ROUTES.howItWorks} variant="outline" size="lg">
                {heroData.cta_secondary}
              </ButtonLink>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg p-5 sm:p-6">
            <p className="text-sm font-semibold text-ink">Exemple de parcours</p>
            <ol className="mt-3 space-y-2 text-sm text-ink-soft">
              <li className="flex gap-2"><span className="font-semibold text-ink">1.</span> « Ma PS5 n&apos;affiche plus d&apos;image. »</li>
              <li className="flex gap-2"><span className="font-semibold text-ink">2.</span> Réparation PS5 → Port HDMI → prix affiché immédiatement.</li>
              <li className="flex gap-2"><span className="font-semibold text-ink">3.</span> Options d&apos;entretien compatibles proposées, sans obligation.</li>
              <li className="flex gap-2"><span className="font-semibold text-ink">4.</span> Paiement, numéro de dossier REP-XXXXXX, instructions d&apos;envoi.</li>
              <li className="flex gap-2"><span className="font-semibold text-ink">5.</span> Réception photographiée, diagnostic, réparation, tests, retour suivi.</li>
            </ol>
            <Link href={ROUTES.tracking} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Suivre un dossier existant <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container>
          <ReassuranceGrid items={reassurance} />
        </Container>
      </section>

      <section className="border-y border-border bg-surface py-12 sm:py-16">
        <Container>
          <SectionTitle title="Choisissez votre console" description="Sélectionnez votre modèle pour voir les pannes prises en charge et les prix." />
          <ConsoleGrid brands={brands} models={models} />
        </Container>
      </section>

      {popularRepairs.length ? (
        <section className="py-12 sm:py-16">
          <Container>
            <SectionTitle title="Réparations les plus demandées" description="Prix affichés TTC, transport en sus selon la formule choisie." />
            <PopularRepairs repairs={popularRepairs} />
          </Container>
        </section>
      ) : null}

      {steps.length ? (
        <section className="border-y border-border bg-surface py-12 sm:py-16">
          <Container>
            <SectionTitle title="Comment ça marche ?" description="Un parcours simple, documenté à chaque étape." />
            <StepsList steps={steps.slice(0, 6)} compact />
            <ButtonLink href={ROUTES.howItWorks} variant="link" className="mt-6">
              Voir toutes les étapes →
            </ButtonLink>
          </Container>
        </section>
      ) : null}

      {trust ? (
        <section className="py-12 sm:py-16">
          <Container className="max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{trust.title}</h2>
            <p className="mt-3 text-ink-soft">{trust.body}</p>
            <ButtonLink href={ROUTES.trust} variant="outline" className="mt-6">
              Pourquoi nous confier votre console
            </ButtonLink>
          </Container>
        </section>
      ) : null}

      <ReviewsSection reviews={reviews ?? []} />

      {faq.length ? (
        <section className="border-t border-border bg-surface py-12 sm:py-16">
          <Container className="max-w-3xl">
            <SectionTitle title="Questions fréquentes" />
            <FaqList items={faq.slice(0, 6)} />
            <ButtonLink href={ROUTES.faq} variant="link" className="mt-4">
              Toutes les questions →
            </ButtonLink>
          </Container>
        </section>
      ) : null}

      <CtaBanner title="Prêt à faire réparer votre console ?" text="Choisissez votre panne, commandez en ligne et suivez chaque étape depuis votre espace client." />
    </>
  );
}
