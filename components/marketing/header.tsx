import Link from "next/link";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import { AccountLink, MobileNav } from "@/components/marketing/header-client";
import { PulseDot } from "@/components/marketing/backdrop";

const NAV = [
  { href: ROUTES.repair, label: "Réparation" },
  { href: ROUTES.consoles, label: "Consoles" },
  { href: ROUTES.tradeIn, label: "Reprise" },
  { href: ROUTES.tracking, label: "Suivi" },
  { href: ROUTES.contact, label: "Le magasin" },
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
      <header className="sticky top-0 z-40 flex items-center gap-x-8 gap-y-3 border-b border-border px-4 py-3 backdrop-blur-[14px] sm:px-8 lg:flex-wrap" style={{ background: "rgba(7,6,10,0.5)" }}>
        <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="min-w-0 text-ink">
          <BrandMark name={brand.name} />
        </Link>
        <nav className="hidden flex-1 flex-wrap items-center gap-7 whitespace-nowrap font-mono text-[11.5px] uppercase tracking-[0.12em] lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink-muted transition-colors hover:text-sale">
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
            className="hidden whitespace-nowrap rounded-full bg-paper px-5 py-2.5 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-900 transition-all duration-300 hover:brightness-95 sm:inline-block"
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
