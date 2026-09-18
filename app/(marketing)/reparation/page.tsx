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
        Au téléphone, la fiche **est** la page.
        L'ordre précédent faisait traverser un mur d'explication avant
        d'atteindre le but : eyebrow, titre, paragraphe de 42 caractères de
        large, les quatre étapes de « comment ça marche », deux liens en mono —
        puis seulement la fiche. Or ces quatre étapes sont déjà racontées par la
        progression en haut de la fiche : elles la répétaient. Le fond sombre
        part avec elles, la fiche portant sa propre bande d'en-tête.
      */}
      <section className="bg-bg px-0 py-0 text-ink sm:bg-ink-900 sm:px-6 sm:py-[64px] sm:text-paper">
        <div className="mx-auto grid max-w-[1280px] items-start gap-0 sm:gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <div className="hidden flex-col gap-[26px] sm:flex">
            <div>
              <Eyebrow tone="repair">Atelier</Eyebrow>
              <h1 className="mt-2 text-[clamp(25px,2.6vw,34px)] font-extrabold leading-[1.02] tracking-[-0.02em]">Démarrer une réparation</h1>
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
          <RepairForm models={form.models} conditions={form.conditions} initialPlatform={plateforme} initialCustomer={null} initialAddress={null} isLoggedIn={false} catalogueCount={models.length} />
        </div>
      </section>
      {/*
        La grille des consoles reste, mais elle ne s'impose plus.
        Au téléphone elle reposait, tout en bas, la question déjà posée par le
        premier écran de la fiche : deux sélecteurs de console sur la même page.
        Elle est masquée par défaut (`#catalogue` dans `globals.css`) et
        s'ouvre quand on suit le lien « Voir les N consoles prises en charge »
        posé au bas du premier écran. Sur ordinateur, rien ne change.
      */}
      <Container id="catalogue" className="py-[64px]">
        <Eyebrow tone="repair">Catalogue</Eyebrow>
        <h2 className="mt-2 text-[clamp(24px,2.4vw,32px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">Toutes les consoles prises en charge</h2>
        <p className="mt-3 max-w-[42ch] text-[16px] text-ink-soft">Chaque modèle a sa page : pannes réparables, prix, garantie et délais.</p>
        <div className="mt-8">
          <ConsoleGrid brands={brands} models={models} />
        </div>
      </Container>
    </>
  );
}
