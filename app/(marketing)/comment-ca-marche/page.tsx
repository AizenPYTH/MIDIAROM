import type { Metadata } from "next";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { CtaBanner, FaqList, StepsList } from "@/components/marketing/sections";
import { blockData, getContentBlock, getFaqItems, getGalleryItems, getSeoPage } from "@/lib/content";
import { GalleryGrid } from "@/components/marketing/gallery";

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoPage(ROUTES.howItWorks);
  return {
    title: seo?.title ?? "Comment ça marche ?",
    description: seo?.description ?? "De la commande au retour : les étapes de votre réparation à distance.",
    alternates: { canonical: `${SITE_URL}${ROUTES.howItWorks}` },
  };
}

export default async function HowItWorksPage() {
  const [block, faq, gallery] = await Promise.all([getContentBlock("how_it_works.steps"), getFaqItems(), getGalleryItems("workshop")]);
  const steps = blockData(block, { steps: [] as { title: string; text: string }[] }).steps;
  return (
    <>
      <Container className="py-10 sm:py-14">
        <PageHeader eyebrow="Le parcours" title={block?.title ?? "Comment ça marche ?"} description="Chaque étape est enregistrée dans votre dossier et vous êtes notifié par e-mail." />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <StepsList steps={steps} />
          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="font-semibold text-ink">Ce que vous recevez</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                <li>Un numéro de dossier unique (REP-XXXXXX)</li>
                <li>Les instructions d&apos;emballage et d&apos;envoi</li>
                <li>Une étiquette de transport selon la formule choisie</li>
                <li>Des notifications à chaque étape</li>
                <li>Les photos de réception, le diagnostic et les tests</li>
                <li>Le numéro de suivi du retour</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="font-semibold text-ink">Si une autre panne est découverte</p>
              <p className="mt-2 text-sm text-ink-soft">
                Vous recevez un devis complémentaire avec explications et photos. Rien n&apos;est réalisé sans votre accord explicite,
                enregistré et horodaté.
              </p>
            </div>
          </aside>
        </div>
      </Container>
      {gallery.length ? (
        <Container className="pb-12">
          <h2 className="mb-4 text-xl font-bold text-ink">L&apos;atelier</h2>
          <GalleryGrid items={gallery} />
        </Container>
      ) : null}
      {faq.length ? (
        <section className="border-t border-border bg-surface py-12">
          <Container className="max-w-3xl">
            <h2 className="mb-4 text-xl font-bold text-ink">Questions fréquentes</h2>
            <FaqList items={faq.slice(0, 8)} />
          </Container>
        </section>
      ) : null}
      <CtaBanner title="Commencez par choisir votre console" text="Le prix s'affiche immédiatement, sans devis préalable pour les réparations standard." />
    </>
  );
}
