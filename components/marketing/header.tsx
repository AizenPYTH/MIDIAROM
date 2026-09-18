import { Suspense } from "react";
import Link from "next/link";
import type { Rayon } from "@/lib/shop/rayons";
import { entreesDesRayons } from "@/lib/shop/menu";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import type { TagProduit } from "@/lib/shop/catalog";
import { AccountLink, MobileNav, NavList, PrimaryNav, SearchField, type EntreeNav } from "@/components/marketing/header-client";
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
 *
 * Chaque rayon porte en plus un volet, construit par `lib/shop/menu.ts` : ce
 * qu'il contient vraiment, pris dans le catalogue. Les règles qui le
 * gouvernent — combien d'entrées, dans quel ordre, avec quel mot — vivent dans
 * ce module pur, où elles se testent.
 */
function navDe(rayons: readonly Rayon[], tags: readonly TagProduit[]): EntreeNav[] {
  return [
    { href: ROUTES.repair, label: "Réparation" },
    { href: ROUTES.shop, label: "Boutique" },
    ...entreesDesRayons(rayons, tags),
    { href: ROUTES.contact, label: "Magasin" },
  ];
}

/**
 * La croix directionnelle : cinq carrés de 5 px, le centre en rouge.
 *
 * C'est la marque du handoff — une manette lue en un coup d'œil, dessinée en
 * CSS, sans image ni police d'icônes. Le centre porte l'accent : le bleu sur
 * fond clair, la menthe sur la bande dégradée de l'en-tête, où le bleu
 * disparaîtrait dans le fond.
 */
export function DPad({ arms = "#c9c9ce", centre = "var(--brand)" }: { arms?: string; centre?: string }) {
  return (
    <span aria-hidden="true" className="grid shrink-0" style={{ gridTemplateColumns: "5px 5px 5px", gridTemplateRows: "5px 5px 5px", gap: "2px" }}>
      <span style={{ gridArea: "1/2", backgroundColor: arms }} />
      <span style={{ gridArea: "2/1", backgroundColor: arms }} />
      <span style={{ gridArea: "2/2", backgroundColor: centre }} />
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
export function BrandMark({
  name,
  size = "md",
  mark = "square",
  accent,
  bras,
}: {
  name: string;
  inverted?: boolean;
  size?: "md" | "sm";
  mark?: "square" | "dpad";
  /** La couleur du repère — menthe sur la bande de l'en-tête, bleu ailleurs. */
  accent?: string;
  /** Les branches de la croix, éclaircies sur fond sombre. */
  bras?: string;
}) {
  return (
    <span className="flex items-center gap-[9px] whitespace-nowrap">
      {mark === "dpad" ? (
        <DPad arms={bras ?? "#c9c9ce"} centre={accent ?? "var(--brand)"} />
      ) : (
        <span
          aria-hidden="true"
          className={`block shrink-0 ${size === "sm" ? "h-[11px] w-[11px]" : "h-3 w-3"}`}
          style={{ backgroundColor: accent ?? "var(--brand)" }}
        />
      )}
      <span className={`font-display font-extrabold uppercase tracking-[-0.026em] ${size === "sm" ? "text-[17.5px]" : "text-[16.5px] lg:text-[19px]"}`}>{name}</span>
    </span>
  );
}

export function SiteHeader({ brand, rayons, tags }: { brand: BrandSettings; rayons: Rayon[]; tags: TagProduit[] }) {
  const NAV = navDe(rayons, tags);
  // Le tiroir du téléphone porte toute la navigation : il rouvre donc l'accueil,
  // que le logo assure sur grand écran mais qu'un menu ouvert masque. Sans
  // volet : un téléphone n'a pas de survol, et déplier trois sous-listes
  // ferait du tiroir une page à défilement là où il tient aujourd'hui d'un
  // coup d'œil. Les filtres de la boutique y donnent accès.
  const NAV_MOBILE = [{ href: ROUTES.home, label: "Accueil" }, ...NAV.map((e) => ({ href: e.href, label: e.label }))];

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

        Il porte le bleu nuit d'où part le dégradé de l'en-tête, et non plus
        l'encre : deux bandes de familles différentes empilées donnaient un haut
        de page en deux morceaux.
      */}
      <div className="bg-brand-night px-4 py-2 text-center font-mono text-[10.5px] tracking-[0.05em] text-on-brand-2 lg:hidden">{UTILITY_BAR[1]}</div>

      {/*
        z-40, au-dessus de la barre d'onglets basse (z-30) : l'en-tête pose un
        contexte d'empilement, et le tiroir du menu, qui vit à l'intérieur, ne
        peut pas le dépasser — il passerait sous la barre.

        **La bande dégradée du handoff** : bleu nuit à gauche, bleu de marque au
        trois quarts, vert foncé au bord droit. Elle remplace le gris translucide
        et flouté qui tenait la place — un en-tête gris sur un fond gris ne
        signait rien, et le jeton du dégradé existait sans être posé nulle part.

        Le dégradé est **opaque** : un fond translucide et flouté sur une bande
        colorée laisse remonter la teinte de ce qui défile dessous, et la bande
        change de couleur au fil de la page. Le seul flou conservé est celui du
        filet du bas.

        Le dégradé s'arrête à `--brand-deep` (#0b7f63) et non au vert vif : la
        fin de la bande porte du texte blanc, et le vert vif y tombe à 2,1:1.
      */}
      <header
        /* Repère lu par la fiche de réparation du téléphone : elle remonte en
           haut de l'écran à chaque étape, et doit s'arrêter juste sous cet
           en-tête plutôt que dessous. */
        data-entete-site="1"
        className="sticky top-0 z-40 border-b border-on-brand-line px-4 py-3 text-on-brand lg:px-[18px] lg:py-[14px] min-[1560px]:px-[26px]"
        style={{ background: "var(--brand-gradient-bar)" }}
      >
        <div className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-3 lg:gap-x-[14px] min-[1560px]:gap-x-[26px]">
          {/* Sur la bande, la croix passe en blancs translucides et son centre
              en menthe — le bleu de l'accent se fondrait dans le fond. */}
          <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="flex min-h-[44px] min-w-0 flex-1 items-center text-on-brand lg:min-h-0 lg:flex-none">
            <span className="hidden lg:block">
              <BrandMark name={brand.name} mark="dpad" bras="rgba(255,255,255,0.55)" accent="var(--brand-mint)" />
            </span>
            <span className="lg:hidden">
              <BrandMark name={brand.name} accent="var(--brand-mint)" />
            </span>
          </Link>

          {/* La frontière qui garde les pages statiques statiques : `PrimaryNav`
              lit l'adresse pour souligner l'onglet actif, et cette lecture
              bascule toute la page en rendu client si elle n'est pas isolée.
              Masquée sous lg : le tiroir porte déjà ces entrées. */}
          {/*
            Une ligne au-dessus de 1280 px, deux en dessous.
            Le seuil était à 1400 px : un écran de 1366 ou de 1280 — c'est-à-dire
            la plupart des portables à 100 % de zoom — recevait donc un en-tête
            sur deux lignes, alors que le même écran à 80 % en recevait un sur
            une seule. Les espacements se resserrent en dessous de 1560 px
            (gouttières, filets de la nav, retrait latéral) : mesuré, cela rend
            122 px, assez pour que tout tienne sur une ligne dès 1280 px avec
            une recherche encore utilisable.
            En dessous du seuil, la nav passe en dernière position et prend la
            largeur entière : ligne 1 les outils, ligne 2 les rayons.
          */}
          <div className="order-4 hidden basis-full lg:block min-[1280px]:order-none min-[1280px]:basis-auto">
            <Suspense fallback={<NavList items={NAV} courant="" />}>
              <PrimaryNav items={NAV} />
            </Suspense>
          </div>

          {/* Sous lg, la recherche prend sa ligne entière (order-3, base 100 %). */}
          <SearchField />

          <div className="order-1 flex min-w-0 items-center gap-[18px] whitespace-nowrap lg:order-none lg:gap-3 min-[1560px]:gap-[18px]">
            <Link href={ROUTES.tracking} className="hidden font-mono text-[11px] uppercase tracking-[0.07em] text-on-brand-2 transition-colors hover:text-on-brand lg:inline">
              Suivi
            </Link>
            <AccountLink className="hidden font-mono text-[11px] uppercase tracking-[0.07em] text-on-brand-2 transition-colors hover:text-on-brand lg:inline" />
            <CartLink className="text-on-brand-2 hover:text-on-brand lg:text-[11px] lg:tracking-[0.07em]" />
          </div>

          <Link
            href={ROUTES.repair}
            /* `ml-auto` dès `lg` : sur une ligne unique il pousse le bouton au
               bord de la colonne quand la recherche est à son plafond ; sur
               deux lignes il évite le trou de 180 px qui s'ouvrait à sa droite
               et donnait un en-tête qui semble s'arrêter au milieu. */
            /* Blanc plein, texte bleu : sur la bande, le bouton bleu de la
               version claire se confondait avec son fond. Au survol il passe à
               la menthe avec du texte encre — le seul autre couple qui garde
               son contraste d'un bout à l'autre du dégradé. */
            className="hidden whitespace-nowrap bg-white px-[17px] py-[13px] text-[14.5px] font-semibold text-brand transition-colors duration-200 hover:bg-brand-mint hover:text-ink lg:ml-auto lg:inline-block min-[1560px]:px-5"
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
