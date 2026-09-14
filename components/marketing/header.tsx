import Link from "next/link";
import { CATEGORY_SLUGS } from "@/lib/shop/status";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import { AccountLink, MobileNav } from "@/components/marketing/header-client";
import { PulseDot } from "@/components/marketing/backdrop";

/**
 * La navigation d'une boutique.
 *
 * Elle listait cinq services à égalité — réparation, boutique, reprise, suivi,
 * magasin — et la boutique s'y perdait. Elle mène maintenant d'abord aux trois
 * rayons, puis au service. Reprise, suivi et magasin restent accessibles par le
 * pied de page et la barre d'onglets mobile : ce sont des destinations qu'on
 * cherche, pas des rayons qu'on parcourt.
 */
const NAV = [
  { href: ROUTES.shop, label: "Boutique" },
  { href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}`, label: "Jeux vidéo" },
  { href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.CONSOLE}`, label: "Consoles" },
  { href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.COLLECTIBLE}`, label: "Figurines Manga / Anime" },
  { href: ROUTES.repair, label: "Réparation" },
];

/**
 * Logo typographique de la charte v4 : un point lime qui bat, puis le nom de
 * l'enseigne en capitales. L'arobase vient du nom enregistré dans Réglages
 * (« 207 Médi@roM ») ; seule la mise en capitales est une affaire d'affichage.
 */
export function BrandMark({ name, size = "md" }: { name: string; inverted?: boolean; size?: "md" | "sm" }) {
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap">
      <PulseDot />
      <span className={`font-display font-extrabold uppercase tracking-[-0.01em] ${size === "sm" ? "text-[15px]" : "text-[17px] sm:text-[18px]"}`}>{name}</span>
    </span>
  );
}

/** En-tête sticky en verre : filet bas, fond translucide, flou d'arrière-plan. */
export function SiteHeader({ brand }: { brand: BrandSettings }) {
  return (
    <>
      {/* z-40, au-dessus de la barre d'onglets basse (z-30) : le header pose un
          contexte d'empilement, et le panneau plein écran du menu, qui vit à
          l'intérieur, ne peut pas le dépasser — il passerait sous la barre. */}
      <header className="sticky top-0 z-40 flex items-center gap-x-8 gap-y-3 border-b border-border px-4 py-3 backdrop-blur-[14px] sm:px-8 lg:flex-wrap" style={{ background: "rgba(255,255,255,0.82)" }}>
        <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="min-w-0 text-ink">
          <BrandMark name={brand.name} />
        </Link>
        <nav className="hidden flex-1 flex-wrap items-center gap-7 whitespace-nowrap font-mono text-[11.5px] uppercase tracking-[0.12em] lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink-soft transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <AccountLink />
          </div>
          {/* La pilule claire du handoff : l'action que l'on vient chercher. */}
          <Link
            href={ROUTES.repair}
            className="hidden whitespace-nowrap rounded-full bg-ink px-5 py-2.5 font-mono text-[11.5px] uppercase tracking-[0.12em] text-bg transition-opacity duration-300 hover:opacity-85 sm:inline-block"
            style={{ boxShadow: "var(--glow-button)" }}
          >
            Confier ma console
          </Link>
          <MobileNav items={NAV} brand={brand} />
        </div>
      </header>
    </>
  );
}
