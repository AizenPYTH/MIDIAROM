import type { Metadata } from "next";
import { CHECKOUT_STEPS, ROUTES, SITE_URL } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { Stepper } from "@/components/ui/stepper";
import { ConsoleGrid } from "@/components/marketing/sections";
import { getActiveBrands, getActiveModels } from "@/lib/repair/catalog";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Réparation de consoles — choisissez votre console",
  description: "PlayStation, Xbox, Nintendo Switch : sélectionnez votre console pour voir les pannes réparables et les prix.",
  alternates: { canonical: `${SITE_URL}${ROUTES.repair}` },
};

export default async function RepairIndexPage() {
  const [brands, models] = await Promise.all([getActiveBrands(), getActiveModels()]);
  return (
    <Container className="py-10 sm:py-14">
      <Stepper steps={CHECKOUT_STEPS} current={0} className="mb-8" />
      <PageHeader eyebrow="Étape 1 sur 8" title="Quelle console souhaitez-vous faire réparer ?" description="Choisissez la marque puis le modèle. Vous verrez ensuite les pannes prises en charge et leur prix." />
      <div className="mt-10">
        <ConsoleGrid brands={brands} models={models} />
      </div>
    </Container>
  );
}
