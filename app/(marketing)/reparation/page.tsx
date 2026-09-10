import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { ConsoleGrid, HowToList } from "@/components/marketing/sections";
import { RepairForm } from "@/components/repair/repair-form";
import { getActiveBrands, getActiveModels } from "@/lib/repair/catalog";
import { getRepairFormBase } from "@/lib/repair/form-data";
import { blockData, getContentBlock } from "@/lib/content";

/**
 * Rendu à la demande, comme /consoles.
 *
 * Cette page n'affiche presque que du catalogue vivant : les plateformes et les
 * modèles de l'étape 1, puis la grille des consoles prises en charge. Un rendu
 * statique fige l'état de la base au moment du build — un déploiement joué
 * avant le chargement du catalogue livre donc un HTML qui annonce « Aucune
 * console publiée », et le sert tant qu'aucune régénération n'a eu lieu, alors
 * que la base est pleine.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réparation de consoles — démarrer une demande",
  description: "PlayStation, Xbox, Nintendo Switch : choisissez votre console et la prestation, décrivez la panne et envoyez-nous votre console.",
  alternates: { canonical: `${SITE_URL}${ROUTES.repair}` },
};

export default async function RepairIndexPage() {
  const [brands, models, form, repairBlock] = await Promise.all([getActiveBrands(), getActiveModels(), getRepairFormBase(), getContentBlock("homepage.repair")]);
  const howto = blockData(repairBlock, { howto: [] as { title: string; text: string }[] }).howto;
  return (
    <>
      <section className="bg-ink-900 px-6 py-[64px] text-paper">
        <div className="mx-auto grid max-w-[1280px] items-start gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="flex flex-col gap-[26px]">
            <div>
              <Eyebrow tone="repair">Atelier</Eyebrow>
              <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em]">Démarrer une réparation</h1>
              <p className="mt-3.5 max-w-[42ch] text-[16.5px] leading-[1.55] text-[#c4bdae]">Choisissez votre console, la prestation et décrivez la panne : le prix s&apos;affiche immédiatement, le paiement se fait en ligne et vous recevez vos instructions d&apos;envoi.</p>
            </div>
            {howto.length ? <HowToList steps={howto.slice(0, 4)} /> : null}
            <p className="font-mono text-[11.5px] text-ink-muted">
              <Link href={ROUTES.howItWorks} className="hover:text-paper">
                Toutes les étapes
              </Link>
              {" · "}
              <Link href={ROUTES.packaging} className="hover:text-paper">
                Instructions d&apos;emballage
              </Link>
            </p>
          </div>
          <RepairForm models={form.models} conditions={form.conditions} initialCustomer={null} initialAddress={null} isLoggedIn={false} />
        </div>
      </section>
      <Container className="py-[64px]">
        <Eyebrow tone="repair">Catalogue</Eyebrow>
        <h2 className="mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">Toutes les consoles prises en charge</h2>
        <p className="mt-3 max-w-[42ch] text-[16px] text-ink-soft">Chaque modèle a sa page : pannes réparables, prix, garantie et délais.</p>
        <div className="mt-8">
          <ConsoleGrid brands={brands} models={models} />
        </div>
      </Container>
    </>
  );
}
