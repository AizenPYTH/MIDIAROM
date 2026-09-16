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
 * Deux en-têtes, un par usage, et la bascule se fait à `lg`.
 *
 * Au-dessus : deux lignes. La première porte ce qu'on vient faire — chercher un
 * produit, retrouver son panier, demander un diagnostic ; la seconde porte les
 * rayons. Empiler les deux sur une ligne obligeait à sacrifier la recherche,
 * qui est le premier geste d'un visiteur de boutique.
 *
 * En dessous : logo, panier, bouton menu, puis la recherche sur sa propre
 * ligne. Les rayons partent dans le menu — les afficher *en plus* du bouton
 * menu donnait deux navigations concurrentes et un en-tête de 520 px sur un
 * écran qui en fait 844.
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
      {/*
        Bandeau utilitaire.
        Sur téléphone, les trois promesses s'empilaient en trois lignes pleine
        largeur — quarante pixels pris à l'écran avant même le logo. Le handoff
        mobile n'en garde qu'une, la plus forte ; les deux autres reviennent
        dès qu'il y a la place de les mettre côte à côte.
        Les séparateurs sont décoratifs : ils disparaissent quand la ligne se
        replie, plutôt que de flotter en début de ligne.
      */}
      <div className="flex flex-wrap justify-center gap-x-[22px] gap-y-1 bg-ink px-4 py-2 text-center font-mono text-[10.5px] tracking-[0.05em] text-on-dark-2 sm:px-[22px] sm:py-[9px] sm:text-[11.5px] sm:tracking-[0.04em]">
        {UTILITY_BAR.map((texte, i) => (
          <span key={texte} className="contents">
            {i > 0 ? (
              <span aria-hidden="true" className="hidden text-on-dark-3 min-[1000px]:inline">
                ·
              </span>
            ) : null}
            <span className={i === 0 ? undefined : "hidden sm:inline"}>{texte}</span>
          </span>
        ))}
      </div>

      {/* z-40, au-dessus de la barre d'onglets basse (z-30) : le header pose un
          contexte d'empilement, et le panneau plein écran du menu, qui vit à
          l'intérieur, ne peut pas le dépasser — il passerait sous la barre. */}
      {/*
        Sur téléphone, l'en-tête montrait tout : la barre d'outils, le bouton
        rouge, Suivi, Compte, Panier, le bouton menu **et** les sept rayons sur
        deux lignes. Cinq cent vingt pixels d'un écran qui en fait 844 : plus de
        la moitié de la page occupée en permanence par le chrome, sur toutes les
        pages, à toutes les positions de défilement. Et deux navigations
        concurrentes — le menu et les rayons — qui disaient la même chose.

        Le handoff mobile tranche : logo, panier, bouton menu, puis la recherche
        sur sa propre ligne. C'est une boutique, on y cherche plus qu'on n'y
        navigue ; les rayons partent dans le menu, où ils ont la place d'être
        lisibles. Le bouton rouge quitte l'en-tête : « Réparer » reste sous le
        pouce dans la barre basse.
      */}
      <header className="sticky top-0 z-40 border-b border-border-section bg-bg px-4 py-2.5 sm:px-[22px] sm:py-3.5">
        <div className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2.5 sm:gap-x-[22px]">
          <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="flex min-h-[44px] min-w-0 flex-1 items-center text-ink lg:min-h-0 lg:flex-none">
            <BrandMark name={brand.name} />
          </Link>

          {/* Sous lg, la recherche prend sa ligne entière (order-2, base 100 %). */}
          <SearchField />

          {/* Ordre du handoff : logo, panier, bouton menu — le menu au bord,
              là où le pouce le trouve sans traverser la barre. */}
          <div className="order-1 flex min-w-0 items-center gap-[18px] whitespace-nowrap lg:order-3 min-[1100px]:order-none">
            <Link href={ROUTES.tracking} className="hidden font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft transition-colors hover:text-red lg:inline">
              Suivi
            </Link>
            <AccountLink className="hidden lg:inline" />
            <CartLink />
          </div>

          <Link
            href={ROUTES.repair}
            className="ml-auto hidden whitespace-nowrap rounded-[8px] bg-red px-[18px] py-3 text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-ink lg:inline-block"
          >
            Demander un diagnostic
          </Link>

          <div className="order-2 lg:order-none">
            <MobileNav items={NAV} brand={brand} />
          </div>
        </div>

        {/* La frontière qui garde les pages statiques statiques : `PrimaryNav`
            lit l'adresse pour souligner l'onglet actif, et cette lecture
            bascule toute la page en rendu client si elle n'est pas isolée.
            Masquée sous lg : le menu porte déjà ces sept entrées. */}
        <div className="hidden lg:block">
          <Suspense fallback={<NavList items={NAV} courant="" />}>
            <PrimaryNav items={NAV} />
          </Suspense>
        </div>
      </header>
    </>
  );
}
