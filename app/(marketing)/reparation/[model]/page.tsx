import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES, SITE_URL } from "@/config/site";
import { Breadcrumbs, Container, Eyebrow } from "@/components/ui/misc";
import { RepairForm } from "@/components/repair/repair-form";
import { getActiveModels, getModelBySlug, getRepairsForModel } from "@/lib/repair/catalog";
import { getRepairFormBase, toFormRepair } from "@/lib/repair/form-data";
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
  const [repairs, brand, form] = await Promise.all([getRepairsForModel(model.id), getBrandSettings(), getRepairFormBase()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Réparation ${model.name}`,
    provider: { "@type": "LocalBusiness", name: brand.name },
    areaServed: "FR",
    serviceType: "Réparation de console de jeux",
    offers: repairs.map((r) => ({ "@type": "Offer", name: r.name, price: (r.price_cents / 100).toFixed(2), priceCurrency: "EUR", url: `${SITE_URL}${ROUTES.repair}/${model.slug}/${r.fault.slug}` })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-ink-900 px-6 py-[64px] text-paper">
        <div className="mx-auto grid max-w-[1280px] items-start gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="flex flex-col gap-[26px]">
            <div className="text-[#a39c8c]">
              <Breadcrumbs items={[{ label: "Accueil", href: ROUTES.home }, { label: "Réparation", href: ROUTES.repair }, { label: model.name }]} />
            </div>
            <div>
              <Eyebrow tone="repair">{model.brand.name}</Eyebrow>
              <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em]">Réparation {model.name} : quelle est la panne ?</h1>
              <p className="mt-3.5 max-w-[42ch] text-[16.5px] leading-[1.55] text-[#c4bdae]">{model.seo_intro ?? `Sélectionnez le symptôme qui correspond le mieux à votre ${model.name}. En cas de doute, choisissez « Autre panne » : nous diagnostiquons.`}</p>
            </div>
            {repairs.length ? (
              <div className="border border-ink-650 p-[18px]">
                <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Pannes prises en charge — {model.name}</span>
                <ul className="mt-3 flex flex-col gap-[9px]">
                  {repairs.map((r) => (
                    <li key={r.id} className="flex justify-between gap-4 border-b border-dotted border-[#3a3529] pb-[7px] text-[14.5px]">
                      <Link href={`${ROUTES.repair}/${model.slug}/${r.fault.slug}`} className="hover:text-accent-light">
                        {r.fault.name}
                        {r.summary ? <span className="block text-[13px] text-[#a39c8c]">{r.summary}</span> : null}
                      </Link>
                      <span className="whitespace-nowrap font-mono text-[#e4dccb]">{r.is_diagnostic_only ? `Diagnostic ${formatPrice(r.price_cents)}` : formatPrice(r.price_cents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="border border-ink-650 p-[18px] text-[14.5px] text-[#c4bdae]">
                Aucune réparation publiée pour ce modèle pour le moment. Votre {model.name} est en panne ? Écrivez-nous depuis la page{" "}
                <Link href={ROUTES.contact} className="text-accent-light underline">
                  contact
                </Link>
                .
              </p>
            )}
          </div>
          <RepairForm models={form.models} conditions={form.conditions} initialModelId={model.id} initialRepairs={repairs.map(toFormRepair)} initialStep={2} initialCustomer={null} initialAddress={null} isLoggedIn={false} />
        </div>
      </section>
      <Container className="py-10">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
          <Link href={ROUTES.repair} className="hover:text-ink">
            ← Toutes les consoles
          </Link>
        </p>
      </Container>
    </>
  );
}
