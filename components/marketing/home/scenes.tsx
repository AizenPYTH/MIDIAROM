import Link from "next/link";
import { ROUTES } from "@/config/site";
import { categoryHref } from "@/components/marketing/home/shop-sections";

/**
 * Le hero.
 *
 * Il tenait un écran entier de récit — trois lignes de titre, un sous-titre,
 * deux boutons, trois chiffres, un visuel et deux pastilles en verre — avant
 * qu'on voie le premier produit. Un visiteur doit comprendre en une seconde ce
 * que le magasin vend, puis atteindre le rayon. Il est donc court, et les
 * cartes de catégorie commencent juste en dessous, dans le même écran sur un
 * grand format.
 */
export function HeroShop() {
  return (
    <section id="top" className="mx-auto max-w-[1240px] px-5 pb-10 pt-[clamp(96px,14svh,136px)] sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
        207 rue de Rome · Marseille · depuis 1997
      </p>
      <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(38px,6.4vw,84px)] font-extrabold leading-[0.94] tracking-[-0.045em] text-ink">
        Jeux vidéo, consoles et figurines.
      </h1>
      <p className="mt-5 max-w-[52ch] text-[clamp(16px,1.7vw,20px)] leading-[1.45] text-ink-soft">
        La boutique gaming et pop culture de Marseille. Et l&apos;atelier qui répare vos machines depuis près de trente ans.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={ROUTES.shop}
          className="inline-flex min-h-[54px] items-center rounded-full bg-ink px-8 text-[16.5px] font-semibold text-bg transition-opacity hover:opacity-85"
        >
          Découvrir la boutique
        </Link>
        <Link
          href={ROUTES.repair}
          className="inline-flex min-h-[54px] items-center rounded-full border border-border-strong px-7 text-[15.5px] font-medium text-ink transition-colors hover:border-ink"
        >
          Faire réparer mon appareil
        </Link>
      </div>
      <nav aria-label="Accès rapide aux rayons" className="mt-8 flex flex-wrap gap-2">
        {(["GAME", "CONSOLE", "COLLECTIBLE"] as const).map((category, i) => (
          <Link
            key={category}
            href={categoryHref(category)}
            className="inline-flex min-h-[40px] items-center rounded-full border border-border px-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {["Jeux vidéo", "Consoles", "Figurines Manga / Anime"][i]}
          </Link>
        ))}
      </nav>
    </section>
  );
}
