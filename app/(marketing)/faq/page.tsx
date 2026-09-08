import type { Metadata } from "next";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { FaqList } from "@/components/marketing/sections";
import { getFaqItems, getSeoPage } from "@/lib/content";

export const revalidate = 600;

const CATEGORY_LABELS: Record<string, string> = {
  envoi: "Envoi et transport",
  reparation: "Diagnostic et réparation",
  garantie: "Garantie",
  donnees: "Données personnelles",
  suivi: "Suivi",
  commande: "Commande et annulation",
  general: "Général",
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoPage(ROUTES.faq);
  return {
    title: seo?.title ?? "Questions fréquentes",
    description: seo?.description ?? "Toutes les réponses sur notre service de réparation de consoles à distance.",
    alternates: { canonical: `${SITE_URL}${ROUTES.faq}` },
  };
}

export default async function FaqPage() {
  const items = await getFaqItems();
  const categories = Array.from(new Set(items.map((i) => i.category)));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader eyebrow="FAQ" title="Questions fréquentes" description="Envoi, délais, devis complémentaire, garantie, données : les réponses aux questions que l'on nous pose le plus." />
      <div className="mt-10 space-y-10">
        {categories.map((cat) => (
          <section key={cat}>
            <h2 className="mb-3 text-lg font-semibold text-ink">{CATEGORY_LABELS[cat] ?? cat}</h2>
            <FaqList items={items.filter((i) => i.category === cat)} />
          </section>
        ))}
      </div>
    </Container>
  );
}
