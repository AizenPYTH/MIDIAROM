import { Suspense } from "react";
import Link from "next/link";
import { CATEGORY_SLUGS } from "@/lib/shop/status";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import { AccountLink, MobileNav, NavList, PrimaryNav, SearchField } from "@/components/marketing/header-client";
import { CartLink } from "@/components/shop/cart-widgets";
import { UTILITY_BAR } from "@/components/marketing/home/content";

/**
 * L'en-tête d'une boutique qui répare aussi des consoles.
 *
 * Deux lignes, et c'est délibéré. La première porte ce qu'on vient faire —
 * chercher un produit, retrouver son panier, demander un diagnostic. La
 * seconde porte les rayons. Empiler les deux sur une ligne obligeait à
 * sacrifier la recherche, qui est le premier geste d'un visiteur de boutique.
 *
 * Sous 1100px, Suivi / Compte / Panier passent sur leur propre ligne
 * (`order-3`) pour que le bouton rouge reste à droite du champ de recherche :
 * c'est l'action que l'atelier veut voir cliquée, elle ne descend pas.
 */
const NAV = [
  { href: ROUTES.home, label: "Accueil" },
  { href: ROUTES.shop, label: "Boutique" },
  { href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}`, label: "Jeux vidéo" },
  { href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.CONSOLE}`, label: "Consoles" },
  { href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.COLLECTIBLE}`, label: "Figurines" },
  { href: ROUTES.repair, label: "Réparation" },
  { href: ROUTES.contact, label: "Contact" },
];

/**
 * Le logo : un carré rouge plein de 12 px, puis le nom en capitales.
 *
 * Le carré est l'une des six seules choses auxquelles le rouge a droit. Le nom
 * vient des réglages — rien n'écrit une enseigne en dur — et seule sa mise en
 * capitales est une affaire d'affichage.
 */
export function BrandMark({ name, size = "md" }: { name: string; inverted?: boolean; size?: "md" | "sm" }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true" className="block h-3 w-3 shrink-0 bg-red" />
      <span className={`font-display font-bold uppercase tracking-[-0.02em] ${size === "sm" ? "text-[17px]" : "text-[19px] sm:text-[20px]"}`}>{name}</span>
    </span>
  );
}

export function SiteHeader({ brand }: { brand: BrandSettings }) {
  return (
    <>
      {/* Bandeau utilitaire. Les séparateurs sont décoratifs : ils disparaissent
          quand la ligne se replie, plutôt que de flotter en début de ligne. */}
      <div className="flex flex-wrap justify-center gap-x-[22px] gap-y-1 bg-ink px-[22px] py-[9px] text-center font-mono text-[11.5px] tracking-[0.04em] text-on-dark-2">
        {UTILITY_BAR.map((texte, i) => (
          <span key={texte} className="contents">
            {i > 0 ? (
              <span aria-hidden="true" className="hidden text-on-dark-3 min-[1000px]:inline">
                ·
              </span>
            ) : null}
            <span>{texte}</span>
          </span>
        ))}
      </div>

      {/* z-40, au-dessus de la barre d'onglets basse (z-30) : le header pose un
          contexte d'empilement, et le panneau plein écran du menu, qui vit à
          l'intérieur, ne peut pas le dépasser — il passerait sous la barre. */}
      <header className="sticky top-0 z-40 border-b border-border-section bg-bg px-[22px] py-3.5">
        <div className="page-wrap flex flex-wrap items-center gap-x-[22px] gap-y-2.5">
          <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="min-w-0 text-ink">
            <BrandMark name={brand.name} />
          </Link>

          <SearchField />

          <div className="order-3 flex min-w-0 items-center gap-[18px] whitespace-nowrap min-[1100px]:order-none">
            <Link href={ROUTES.tracking} className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft transition-colors hover:text-red">
              Suivi
            </Link>
            <AccountLink />
            <CartLink />
          </div>

          <Link
            href={ROUTES.repair}
            className="ml-auto whitespace-nowrap rounded-[8px] bg-red px-[18px] py-3 text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-ink"
          >
            Demander un diagnostic
          </Link>

          <MobileNav items={NAV} brand={brand} />
        </div>

        {/* La frontière qui garde les pages statiques statiques : `PrimaryNav`
            lit l'adresse pour souligner l'onglet actif, et cette lecture
            bascule toute la page en rendu client si elle n'est pas isolée. */}
        <Suspense fallback={<NavList items={NAV} courant="" />}>
          <PrimaryNav items={NAV} />
        </Suspense>
      </header>
    </>
  );
}
