import type { Metadata } from "next";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { CtaBanner, FaqList } from "@/components/marketing/sections";
import { GalleryGrid } from "@/components/marketing/gallery";
import { getContentBlock, getFaqItems, getGalleryItems, getSeoPage } from "@/lib/content";
import { getSetting } from "@/lib/settings";
import { formatWarranty } from "@/lib/utils/format";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoPage(ROUTES.trust);
  return {
    title: seo?.title ?? "Pourquoi nous confier votre console ?",
    description: seo?.description ?? "Atelier, techniciens, traçabilité, garantie et paiement sécurisé.",
    alternates: { canonical: `${SITE_URL}${ROUTES.trust}` },
  };
}

export default async function TrustPage() {
  const [brand, trust, warranty, shippingInfo, intro, faq, gallery, team] = await Promise.all([
    getSetting("brand"),
    getSetting("trust"),
    getSetting("warranty"),
    getSetting("shipping_info"),
    getContentBlock("trust.intro"),
    getFaqItems(),
    getGalleryItems("workshop"),
    getGalleryItems("team"),
  ]);

  const pillars = [
    { title: "Réception documentée", text: "Colis et console photographiés à l'arrivée, numéro de série et accessoires enregistrés." },
    { title: "Diagnostic écrit", text: "Panne reproduite ou non, constat, travaux recommandés : le diagnostic est consultable dans votre dossier." },
    { title: "Aucune intervention sans accord", text: "Toute prestation supplémentaire passe par un devis que vous acceptez ou refusez en ligne." },
    { title: "Garantie sur l'intervention", text: warranty.scope || formatWarranty(warranty.default_months) },
    { title: "Transport suivi", text: shippingInfo.return_carrier_note || "Retour en colis suivi." },
    { title: "Paiement sécurisé", text: "Paiement en ligne par un prestataire certifié. Nous ne stockons aucune donnée bancaire." },
  ];

  const identity = [
    brand.legal_form ? `${brand.legal_form}` : null,
    brand.siret ? `SIRET ${brand.siret}` : null,
    [brand.address_line1, brand.postal_code, brand.city].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <>
      <Container className="py-10 sm:py-14">
        <PageHeader eyebrow="Confiance" title={intro?.title ?? "Vous savez où va votre console, et ce qui lui arrive."} description={intro?.body ?? undefined} />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(({ title, text }, i) => (
            <div key={title} className="rounded-lg border border-border bg-surface p-5">
              <span className="font-mono text-[12px] text-accent">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-3 font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink-soft">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              L&apos;entreprise
            </h2>
            <p className="mt-2 font-medium text-ink">{brand.name}</p>
            {identity.length ? <p className="text-sm text-ink-muted">{identity.join(" · ")}</p> : null}
            {trust.company_story ? <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{trust.company_story}</p> : null}
            {trust.years_of_experience ? (
              <p className="mt-3 text-sm text-ink-soft">
                <span className="font-semibold text-ink">{trust.years_of_experience} ans</span> d&apos;expérience en réparation.
              </p>
            ) : null}
            {trust.new_management_note ? <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{trust.new_management_note}</p> : null}
            {!trust.company_story && !trust.years_of_experience ? (
              <p className="mt-3 text-sm text-ink-muted">Les informations sur l&apos;historique de l&apos;entreprise sont renseignées depuis le back-office (Réglages → Confiance).</p>
            ) : null}
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              L&apos;atelier et l&apos;équipe
            </h2>
            {trust.workshop_intro ? <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{trust.workshop_intro}</p> : null}
            {trust.team_intro ? <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{trust.team_intro}</p> : null}
            {!trust.workshop_intro && !trust.team_intro ? (
              <p className="mt-3 text-sm text-ink-muted">La présentation de l&apos;atelier et des techniciens sera ajoutée depuis le back-office.</p>
            ) : null}
          </div>
        </div>

        {gallery.length || team.length ? (
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold text-ink">En images</h2>
            <GalleryGrid items={[...gallery, ...team]} />
          </div>
        ) : null}

        {warranty.exclusions ? (
          <div className="mt-12 rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink">Garantie : périmètre et exclusions</h2>
            <p className="mt-2 text-sm text-ink-soft">{warranty.scope}</p>
            <p className="mt-2 text-sm text-ink-muted">Exclusions : {warranty.exclusions}</p>
            <p className="mt-2 text-xs text-ink-muted">La garantie porte sur l&apos;intervention réalisée, pas sur l&apos;ensemble de la console.</p>
          </div>
        ) : null}
      </Container>
      {faq.length ? (
        <section className="border-t border-border bg-surface py-12">
          <Container className="max-w-3xl">
            <h2 className="mb-4 text-xl font-bold text-ink">Vos questions</h2>
            <FaqList items={faq.filter((f) => ["garantie", "donnees", "reparation"].includes(f.category)).slice(0, 8)} />
          </Container>
        </section>
      ) : null}
      <CtaBanner title="Envoyez votre console en toute confiance" text="Chaque étape est documentée et accessible depuis votre espace client." />
    </>
  );
}
