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

/**
 * `?console=playstation` — la console déjà choisie depuis l'accueil.
 *
 * Le paramètre porte le **slug** de la marque, lisible et stable, pas son
 * identifiant : une adresse partagée doit rester compréhensible. Il est résolu
 * ici, côté serveur, contre les marques actives ; inconnu, il est ignoré et le
 * parcours reprend à la première question.
 */
function plateformeDemandee(brands: { id: string; slug: string }[], demande: string | undefined): string | null {
  if (!demande) return null;
  if (demande === "retro") return "retro";
  return brands.find((b) => b.slug === demande)?.id ?? null;
}

export default async function RepairIndexPage({ searchParams }: { searchParams: Promise<{ console?: string }> }) {
  const [sp, brands, models, form, repairBlock] = await Promise.all([
    searchParams,
    getActiveBrands(),
    getActiveModels(),
    getRepairFormBase(),
    getContentBlock("homepage.repair"),
  ]);
  const howto = blockData(repairBlock, { howto: [] as { title: string; text: string }[] }).howto;
  const plateforme = plateformeDemandee(brands, sp.console);
  return (
    <>
      {/*
        La fiche **est** la page.
        Ce qui la précédait — eyebrow, titre, paragraphe, les quatre étapes de
        « comment ça marche », deux liens en mono — racontait ce que la
        progression de la fiche raconte déjà, en six cellules. Reste une phrase,
        celle qui dit au visiteur ce qu'on attend de lui.
      */}
      <section className="bg-bg px-[clamp(16px,2.08vw,26px)] pb-0 pt-[clamp(20px,2.16vw,27px)] text-ink">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="mb-[clamp(18px,1.68vw,21px)]">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.19em]" style={{ color: "var(--brand)" }}>
              Réparation console
            </span>
            <h1 className="m-0 mt-2.5 text-[clamp(26px,2.8vw,35px)] font-extrabold leading-none tracking-[-0.042em]">
              Identifiez votre console.
              <br />
              Nous nous occupons du reste.
            </h1>
          </div>

          <RepairForm models={form.models} conditions={form.conditions} initialPlatform={plateforme} initialCustomer={null} initialAddress={null} isLoggedIn={false} catalogueCount={models.length} />

          {howto.length ? (
            <div className="mt-0.5 bg-surface p-[clamp(18px,2.08vw,26px)]">
              <span className="block font-mono text-[10px] uppercase tracking-[0.19em] text-ink-faint">Comment ça se passe</span>
              <div className="mt-3.5">
                <HowToList steps={howto.slice(0, 4)} />
              </div>
              <p className="mt-4 font-mono text-[11.5px] text-ink-muted">
                <Link href={ROUTES.howItWorks} className="hover:text-ink">
                  Toutes les étapes
                </Link>
                {" · "}
                <Link href={ROUTES.packaging} className="hover:text-ink">
                  Instructions d&apos;emballage
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </section>
      {/*
        La grille des consoles reste, mais elle ne s'impose plus : la première
        étape de la fiche pose déjà la question. Masquée par défaut
        (`#catalogue` dans `globals.css`), elle s'ouvre par le lien du bas.
      */}
      <Container id="catalogue" className="py-[64px]">
        <Eyebrow tone="repair">Catalogue</Eyebrow>
        <h2 className="mt-2 text-[clamp(24px,2.08vw,26px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">Toutes les consoles prises en charge</h2>
        <p className="mt-3 max-w-[42ch] text-[16px] text-ink-soft">Chaque modèle a sa page : pannes réparables, prix, garantie et délais.</p>
        <div className="mt-8">
          <ConsoleGrid brands={brands} models={models} />
        </div>
      </Container>
    </>
  );
}
