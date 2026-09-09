import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CHECKOUT_STEPS, ROUTES, SITE_URL } from "@/config/site";
import { Breadcrumbs, Container, EmptyState, PageHeader } from "@/components/ui/misc";
import { Stepper } from "@/components/ui/stepper";
import { DynamicIcon } from "@/components/marketing/icons";
import { getActiveModels, getModelBySlug, getRepairsForModel } from "@/lib/repair/catalog";
import { Alert } from "@/components/ui/alert";
import { formatPrice } from "@/lib/utils/format";
import { getBrandSettings } from "@/lib/settings";

export const revalidate = 600;

export async function generateStaticParams() {
  const models = await getActiveModels().catch(() => []);
  return models.map((m) => ({ model: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ model: string }> }): Promise<Metadata> {
  const { model: slug } = await params;
  const model = await getModelBySlug(slug);
  if (!model) return { title: "Console introuvable" };
  const repairs = await getRepairsForModel(model.id);
  return {
    title: model.seo_title ?? `Réparation ${model.name} à distance — pannes et prix`,
    description: model.seo_description ?? `Faites réparer votre ${model.name} partout en France : choisissez la panne, commandez en ligne et suivez la réparation.`,
    alternates: { canonical: `${SITE_URL}${ROUTES.repair}/${model.slug}` },
    // A model without any published repair is a thin page: keep it out of the index until the catalogue is filled.
    robots: repairs.length ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function ModelPage({ params }: { params: Promise<{ model: string }> }) {
  const { model: slug } = await params;
  const model = await getModelBySlug(slug);
  if (!model) notFound();
  const [repairs, brand] = await Promise.all([getRepairsForModel(model.id), getBrandSettings()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Réparation ${model.name}`,
    provider: { "@type": "LocalBusiness", name: brand.name },
    areaServed: "FR",
    serviceType: "Réparation de console de jeux",
    offers: repairs.map((r) => ({
      "@type": "Offer",
      name: r.name,
      price: (r.price_cents / 100).toFixed(2),
      priceCurrency: "EUR",
      url: `${SITE_URL}${ROUTES.repair}/${model.slug}/${r.fault.slug}`,
    })),
  };

  return (
    <Container className="py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Stepper steps={CHECKOUT_STEPS} current={2} className="mb-8" />
      <Breadcrumbs items={[{ label: "Accueil", href: ROUTES.home }, { label: "Réparation", href: ROUTES.repair }, { label: model.name }]} />
      <PageHeader
        className="mt-4"
        eyebrow={`${model.brand.name} · Étape 3 sur 8`}
        title={`Réparation ${model.name} : quelle est la panne ?`}
        description={model.seo_intro ?? `Sélectionnez le symptôme qui correspond le mieux à votre ${model.name}. En cas de doute, choisissez « Autre panne » : nous diagnostiquons.`}
      />
      {repairs.length ? (
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {repairs.map((repair) => (
            <li key={repair.id}>
              <Link
                href={`${ROUTES.repair}/${model.slug}/${repair.fault.slug}`}
                className="group flex h-full items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <DynamicIcon name={repair.fault.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{repair.fault.name}</span>
                  <span className="block text-sm text-ink-muted">{repair.summary ?? repair.fault.short_description}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-bold text-primary">{repair.is_diagnostic_only ? `Diagnostic ${formatPrice(repair.price_cents)}` : formatPrice(repair.price_cents)}</span>
                  <ArrowRight className="mt-1 h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 space-y-4">
          <EmptyState title="Aucune réparation publiée pour ce modèle" description="Le catalogue de ce modèle est en cours de préparation." />
          <Alert tone="info">
            Votre {model.name} est en panne ? Écrivez-nous depuis la page <a href={ROUTES.contact} className="font-medium text-accent underline">contact</a> : nous vous indiquerons si un diagnostic est possible.
          </Alert>
        </div>
      )}
    </Container>
  );
}
