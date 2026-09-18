import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES, SITE_URL } from "@/config/site";
import { Breadcrumbs, Container, Eyebrow } from "@/components/ui/misc";
import { RepairForm } from "@/components/repair/repair-form";
import { ConsolePhoto } from "@/components/repair/console-photo";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { getActiveModels, getModelBySlug, getRepairsForModel } from "@/lib/repair/catalog";
import { getRepairFormBase, toFormRepair } from "@/lib/repair/form-data";
import { listeCourte, listeLongue } from "@/lib/repair/selection";
import type { FormRepair } from "@/components/repair/repair-form-types";
import { formatRepairPrice } from "@/lib/utils/format";
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
  // La même coupure que la fiche, pour que la page ne raconte pas deux
  // histoires : les pannes fréquentes d'abord, le reste replié.
  const formulaire = repairs.map(toFormRepair);
  const frequentes = listeCourte(formulaire);
  const rares = listeLongue(formulaire, frequentes);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Réparation ${model.name}`,
    provider: { "@type": "LocalBusiness", name: brand.name },
    areaServed: "FR",
    serviceType: "Réparation de console de jeux",
    // Une prestation « Nécessite un devis » n'a pas de prix : rien à publier.
    // Une prestation à 0 € en a bien un — elle est offerte, et l'annoncer est
    // exact. Le drapeau décide, pas le montant.
    offers: repairs
      .filter((r) => !r.price_is_provisional)
      .map((r) => ({ "@type": "Offer", name: r.name, price: (r.price_cents / 100).toFixed(2), priceCurrency: "EUR", url: `${SITE_URL}${ROUTES.repair}/${model.slug}/${r.fault.slug}` })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Au téléphone, la fiche de réparation va d'un bord à l'autre, comme sur
          `/reparation` : c'est la même trame en cinq écrans, elle ne doit pas
          apparaître ici encadrée de deux marges sombres. La présentation du
          modèle garde son propre retrait, et rien ne change au-delà de 640 px. */}
      <section className="bg-ink-900 px-0 pb-0 pt-[34px] text-paper sm:px-6 sm:py-[64px]">
        <div className="mx-auto grid max-w-[1280px] items-start gap-8 sm:gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="flex flex-col gap-[26px] px-4 sm:px-0">
            <div className="text-[#a39c8c]">
              <Breadcrumbs items={[{ label: "Accueil", href: ROUTES.home }, { label: "Réparation", href: ROUTES.repair }, { label: model.name }]} />
            </div>
            {/* Le détouré du modèle choisi, en repère.
                Petit, et sur une plaque claire : les fichiers sont détourés sur
                fond transparent, et une PS4 noire posée directement sur ce
                bandeau sombre disparaîtrait. La plaque fait le contraste, et
                donne à toutes les consoles la même place quel que soit le
                rapport de leur fichier. */}
            <span className="relative block w-[132px] shrink-0 overflow-hidden border border-ink-650 bg-paper-strong" style={{ aspectRatio: "5 / 4" }}>
              <ConsolePhoto
                src={model.image_path ? publicMediaUrl(model.image_path) : null}
                alt={`Console ${model.name}`}
                label={model.name}
                sizes="132px"
                className="p-[11%]"
              />
            </span>
            <div>
              <Eyebrow tone="repair">{model.brand.name}</Eyebrow>
              <h1 className="mt-2 text-[clamp(25px,2.6vw,34px)] font-extrabold leading-[1.02] tracking-[-0.02em]">Réparation {model.name} : quelle est la panne ?</h1>
              <p className="mt-3.5 max-w-[42ch] text-[16.5px] leading-[1.55] text-[#c4bdae]">{model.seo_intro ?? `Sélectionnez le symptôme qui correspond le mieux à votre ${model.name}. En cas de doute, choisissez « Autre panne » : nous diagnostiquons.`}</p>
            </div>
            {repairs.length ? (
              /*
                Les pannes fréquentes, et les autres repliées.
                Cette liste servait de sommaire indexable et montrait les
                cinquante-cinq prestations d'un coup — le mur que la fiche, à
                droite, vient précisément de remplacer par neuf lignes. Un
                `<details>` réconcilie les deux : tous les liens restent dans le
                HTML, donc indexables et atteignables sans JavaScript, mais la
                page s'ouvre sur ce qui se lit.
              */
              <div className="border border-ink-650 p-[18px]">
                <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Pannes prises en charge — {model.name}</span>
                <ul className="mt-3 flex flex-col gap-[9px]">
                  {frequentes.map((r) => (
                    <LignePanne key={r.id} modelSlug={model.slug} repair={r} />
                  ))}
                </ul>
                {rares.length ? (
                  <details className="mt-3 border-t border-dotted border-[#3a3529] pt-3">
                    <summary className="cursor-pointer font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted hover:text-accent-light">{rares.length} autres pannes prises en charge</summary>
                    <ul className="mt-3 flex flex-col gap-[9px]">
                      {rares.map((r) => (
                        <LignePanne key={r.id} modelSlug={model.slug} repair={r} />
                      ))}
                    </ul>
                  </details>
                ) : null}
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
          <RepairForm models={form.models} conditions={form.conditions} initialModelId={model.id} initialRepairs={formulaire} initialStep={2} initialCustomer={null} initialAddress={null} isLoggedIn={false} />
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

/**
 * Une ligne du sommaire des pannes : le nom, son résumé, son tarif.
 *
 * Le tarif suit la règle du catalogue au mot près — « Nécessite un devis »,
 * « Gratuit » ou le montant. Aucun « 0,00 € » ne passe pour un prix qui n'a pas
 * été arbitré, ici comme dans la fiche.
 */
function LignePanne({ modelSlug, repair }: { modelSlug: string; repair: FormRepair }) {
  const prix = formatRepairPrice(repair.priceCents, repair.priceProvisional);
  return (
    <li className="flex justify-between gap-4 border-b border-dotted border-[#3a3529] pb-[7px] text-[14.5px]">
      <Link href={`${ROUTES.repair}/${modelSlug}/${repair.faultSlug}`} className="hover:text-accent-light">
        {repair.faultName}
        {repair.note ? <span className="block text-[13px] text-[#a39c8c]">{repair.note}</span> : null}
      </Link>
      <span className="whitespace-nowrap font-mono text-ink">{repair.isDiagnosticOnly ? `Diagnostic ${prix}` : prix}</span>
    </li>
  );
}
