import { Suspense } from "react";
import Link from "next/link";
import { courtLabel, type Rayon } from "@/lib/shop/rayons";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import { AccountLink, MobileNav, NavList, PrimaryNav, SearchField } from "@/components/marketing/header-client";
import { CartLink } from "@/components/shop/cart-widgets";
import { UTILITY_BAR } from "@/components/marketing/home/content";

/**
 * L'en-tête d'un atelier qui tient aussi boutique.
 *
 * **Une seule ligne sur ordinateur.** Logo, six rayons, recherche, les trois
 * utilitaires en mono, et le bouton rouge. L'en-tête précédent en prenait deux
 * — une pour les outils, une pour les rayons — et coûtait 150 px de haut, en
 * permanence, sur toutes les pages. Tout tient sur une ligne parce que la nav
 * est passée de sept entrées à six : « Accueil » est le logo, et « Contact »
 * est devenu « Magasin », qui dit ce qu'on y trouve.
 *
 * **Deux lignes sur téléphone**, parce qu'une recherche partagée avec le logo,
 * le panier et le bouton menu n'est plus une recherche. Ligne 1 : logo, panier,
 * bouton menu au bord, là où le pouce le trouve. Ligne 2 : la recherche seule.
 * Les rayons partent dans le tiroir — les afficher *en plus* du bouton menu
 * donnait deux navigations concurrentes.
 */
/**
 * Les entrées de la barre : réparation, boutique, un rayon par rayon public,
 * puis le magasin.
 *
 * Les rayons ne sont plus écrits ici : ils viennent de `product_categories` et
 * se gèrent au back-office. Un rayon ouvert un matin est dans le menu l'après-
 * midi. Le libellé du menu est court — « Figurines », pas « Figurines Manga /
 * Anime » — parce que six entrées doivent tenir sur une ligne de 1440 px ; on
 * garde donc le premier mot du libellé de section.
 */
function navDe(rayons: readonly Rayon[]): { href: string; label: string }[] {
  return [
    { href: ROUTES.repair, label: "Réparation" },
    { href: ROUTES.shop, label: "Boutique" },
    ...rayons.map((r) => ({ href: `${ROUTES.shop}?cat=${r.slug}`, label: courtLabel(r.label) })),
    { href: ROUTES.contact, label: "Magasin" },
  ];
}

/**
 * La croix directionnelle : cinq carrés de 5 px, le centre en rouge.
 *
 * C'est la marque du handoff — une manette lue en un coup d'œil, dessinée en
 * CSS, sans image ni police d'icônes. Le rouge du centre est l'un des rares
 * emplois autorisés de l'accent.
 */
export function DPad({ arms = "#c9c9ce" }: { arms?: string }) {
  return (
    <span aria-hidden="true" className="grid shrink-0" style={{ gridTemplateColumns: "5px 5px 5px", gridTemplateRows: "5px 5px 5px", gap: "2px" }}>
      <span style={{ gridArea: "1/2", backgroundColor: arms }} />
      <span style={{ gridArea: "2/1", backgroundColor: arms }} />
      <span style={{ gridArea: "2/2", backgroundColor: "var(--red)" }} />
      <span style={{ gridArea: "2/3", backgroundColor: arms }} />
      <span style={{ gridArea: "3/2", backgroundColor: arms }} />
    </span>
  );
}

/**
 * Le logo : la croix directionnelle puis le nom, en 800.
 *
 * Le nom vient des réglages — rien n'écrit une enseigne en dur. `mark="square"`
 * rend le carré rouge plein : c'est ce que le handoff garde là où la croix
 * serait illisible, dans le pied de page et sur la ligne serrée du téléphone.
 */
export function BrandMark({ name, size = "md", mark = "square" }: { name: string; inverted?: boolean; size?: "md" | "sm"; mark?: "square" | "dpad" }) {
  return (
    <span className="flex items-center gap-[9px] whitespace-nowrap">
      {mark === "dpad" ? <DPad /> : <span aria-hidden="true" className={`block shrink-0 bg-red ${size === "sm" ? "h-[11px] w-[11px]" : "h-3 w-3"}`} />}
      <span className={`font-display font-extrabold uppercase tracking-[-0.026em] ${size === "sm" ? "text-[17.5px]" : "text-[16.5px] lg:text-[19px]"}`}>{name}</span>
    </span>
  );
}

export function SiteHeader({ brand, rayons }: { brand: BrandSettings; rayons: Rayon[] }) {
  const NAV = navDe(rayons);
  // Le tiroir du téléphone porte toute la navigation : il rouvre donc l'accueil,
  // que le logo assure sur grand écran mais qu'un menu ouvert masque.
  const NAV_MOBILE = [{ href: ROUTES.home, label: "Accueil" }, ...NAV];

  return (
    <>
      {/*
        Bandeau utilitaire — téléphone et tablette seulement, une seule ligne.
        Sur ordinateur, le hero porte déjà les quatre promesses chiffrées en
        grand : répéter les mêmes phrases dans un bandeau au-dessus revenait à
        occuper une ligne à ne rien dire. En dessous, il reste — mais réduit à
        la promesse la plus forte, celle qui décide : diagnostic sous 48 h,
        devis avant intervention. Les trois se repliaient sur deux lignes dès
        768 px, soit 52 px de bande noire pour dire ce qu'une phrase dit.
      */}
      <div className="bg-ink px-4 py-2 text-center font-mono text-[10.5px] tracking-[0.05em] text-on-dark-2 lg:hidden">{UTILITY_BAR[1]}</div>

      {/*
        z-40, au-dessus de la barre d'onglets basse (z-30) : l'en-tête pose un
        contexte d'empilement, et le tiroir du menu, qui vit à l'intérieur, ne
        peut pas le dépasser — il passerait sous la barre.

        Le fond est translucide et flouté : le contenu qui défile dessous reste
        deviné sans jamais gêner la lecture. Le repli opaque est posé d'abord,
        pour les navigateurs sans `backdrop-filter`.
      */}
      <header
        className="sticky top-0 z-40 border-b border-border-section bg-bg px-4 py-3 lg:px-[26px] lg:py-[14px]"
        style={{ backgroundColor: "var(--bg-blur)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      >
        <div className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-3 lg:gap-x-[26px]">
          <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="flex min-h-[44px] min-w-0 flex-1 items-center text-ink lg:min-h-0 lg:flex-none">
            <span className="hidden lg:block">
              <BrandMark name={brand.name} mark="dpad" />
            </span>
            <span className="lg:hidden">
              <BrandMark name={brand.name} />
            </span>
          </Link>

          {/* La frontière qui garde les pages statiques statiques : `PrimaryNav`
              lit l'adresse pour souligner l'onglet actif, et cette lecture
              bascule toute la page en rendu client si elle n'est pas isolée.
              Masquée sous lg : le tiroir porte déjà ces entrées. */}
          {/*
            Une ligne au-dessus de 1400 px, deux en dessous.
            Mesuré : à 1440 px tout tient sur une ligne et la recherche garde
            204 px ; à 1280 px le bouton rouge tombait déjà tout seul sur une
            deuxième ligne, à gauche, ce qui est pire que deux lignes assumées.
            En dessous du seuil, la nav passe en dernière position et prend la
            largeur entière : ligne 1 les outils, ligne 2 les rayons.
          */}
          <div className="order-4 hidden basis-full lg:block min-[1400px]:order-none min-[1400px]:basis-auto">
            <Suspense fallback={<NavList items={NAV} courant="" />}>
              <PrimaryNav items={NAV} />
            </Suspense>
          </div>

          {/* Sous lg, la recherche prend sa ligne entière (order-3, base 100 %). */}
          <SearchField />

          <div className="order-1 flex min-w-0 items-center gap-[18px] whitespace-nowrap lg:order-none">
            <Link href={ROUTES.tracking} className="hidden font-mono text-[11px] uppercase tracking-[0.07em] text-ink-soft transition-colors hover:text-red lg:inline">
              Suivi
            </Link>
            <AccountLink className="hidden font-mono text-[11px] uppercase tracking-[0.07em] text-ink-soft transition-colors hover:text-red lg:inline" />
            <CartLink className="lg:text-[11px] lg:tracking-[0.07em]" />
          </div>

          <Link
            href={ROUTES.repair}
            /* `ml-auto` seulement sur la ligne unique : au-delà de 1560 px la
               recherche est à son plafond et il restait 36 px de vide après le
               bouton, qui ne tombait plus sur le bord de la colonne. */
            className="hidden whitespace-nowrap bg-red px-5 py-[13px] text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-ink lg:inline-block min-[1400px]:ml-auto"
          >
            Demander un diagnostic
          </Link>

          <div className="order-2 lg:hidden">
            <MobileNav items={NAV_MOBILE} brand={brand} />
          </div>
        </div>
      </header>
    </>
  );
}
