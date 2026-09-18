import Link from "next/link";
import { ROUTES } from "@/config/site";
import { HomeVisual } from "@/components/marketing/home/visual";
import { HOME_VISUAL_ALTS, HOME_VISUALS, PLATFORM_VISUALS } from "@/lib/content/assets";
import { RayonV9 } from "@/components/marketing/home/rayon-v9";
import type { Rayon } from "@/lib/shop/rayons";
import type { Product } from "@/lib/shop/catalog";
import type { BrandSettings } from "@/config/brand";
import type { FamilleVitrine, PanneVitrine } from "@/lib/repair/vitrine";
import { formatPrice } from "@/lib/utils/format";

/**
 * L'accueil, direction « 207 MÉDI@ROME final ».
 *
 * Le parti pris tient en une phrase : **page claire, imagerie sombre**. Le fond
 * est gris très clair, l'encre presque noire, et il n'y a qu'un rouge. Ce sont
 * les photographies d'atelier — sombres, néon rouge — qui apportent l'univers
 * jeu, pas l'interface. C'est ce qui résout la tension entre « on dirait un
 * jeu » et « pas sombre, pas enfantin ».
 *
 * Le spectaculaire vient de l'échelle, pas des effets : un titre à 92 px, des
 * photos pleine largeur, des gouttières de 2 px, et beaucoup de blanc. Aucune
 * ombre, aucun angle arrondi.
 *
 * **La règle la plus importante est celle des cadres.** Chaque cadre reprend le
 * format de sa source : les sept scènes d'atelier sont en 1536 × 1024, donc
 * `3/2` ; le hero en 1372 × 1147, donc ce rapport exact ; la façade en 765 × 1020, donc
 * `3/4` ; les produits en carré avec `object-contain`. Un cadre au mauvais
 * format ampute la scène — c'est le défaut qui avait tué la version précédente.
 *
 * Les grilles sont dans `globals.css` (`[data-g-*]`), toutes en `auto-fit` +
 * `minmax` : elles se réorganisent seules de 360 px à 1560 px sans une seule
 * requête de média, et elles ne peuvent pas être battues par un style en ligne.
 */

const SHELL = "mx-auto w-full max-w-[var(--page-max)]";
const PAD = "px-[clamp(16px,4.08vw,51px)]";

/** Le numéro de section, en mono bleu — la ponctuation de la page. */
function Numero({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return <span className={`font-mono text-[11px] uppercase tracking-[0.16em] ${onDark ? "text-brand-on-dark" : "text-brand"}`}>{children}</span>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 text-[clamp(27px,3.2vw,40px)] font-extrabold leading-[0.98] tracking-[-0.042em]">{children}</h2>;
}

/**
 * L'en-tête d'une section : intitulé à gauche, précision à droite.
 *
 * `items-end` et non `items-center` : les deux blocs n'ont pas la même hauteur,
 * et c'est leur ligne de base commune qui tient la composition.
 */
function TeteDeSection({ numero, titre, aside, serre = false }: { numero: string; titre: React.ReactNode; aside?: React.ReactNode; serre?: boolean }) {
  return (
    <div className={`${serre ? "mb-[18px]" : "mb-7"} flex flex-wrap items-end justify-between gap-6`}>
      <div className="min-w-0">
        <Numero>{numero}</Numero>
        <H2>{titre}</H2>
      </div>
      {aside}
    </div>
  );
}

// ─────────────────────────────── 2 · hero ────────────────────────────────────

const PROMESSES = [
  { k: "48 h", v: "Diagnostic" },
  { k: "3 mois", v: "Garantie" },
  { k: "20 €", v: "Offert si réparation" },
  { k: "1997", v: "Atelier ouvert depuis" },
] as const;

export function HeroV9({ diagnostic, familles }: { diagnostic?: string | null; familles: FamilleVitrine[] }) {
  // Le tarif affiché est celui que la caisse applique : il vient des réglages,
  // jamais d'une constante. Sans tarif configuré, la promesse disparaît plutôt
  // que d'annoncer « 0 € ».
  const promesses = PROMESSES.map((p) => (p.v.startsWith("Offert si") && diagnostic ? { ...p, k: diagnostic } : p)).filter((p) => !(p.v.startsWith("Offert si") && !diagnostic));

  return (
    <section id="top" data-hero-v9="1" className="border-b border-border-section bg-surface">
      {/*
        Trois blocs, et non deux, pour une raison de lecture.
        Sur ordinateur, le texte est à gauche et la photographie à droite. Sur
        téléphone, le handoff intercale la photographie **entre le paragraphe et
        les boutons** : on montre les machines avant de demander un geste. Avec
        deux blocs seulement, la photo ne pouvait que passer après tout le
        texte. La grille de `globals.css` remet A et B dans la colonne de gauche
        dès 900 px ; ici, l'ordre du balisage est celui du téléphone.
      */}
      <div data-hero-a="1" className="gouttiere-page flex min-w-0 flex-col gap-[22px] pt-[clamp(22px,4.88vw,61px)]">
        <span data-up="1" className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
          <span data-blip="1" aria-hidden="true" className="block h-[7px] w-[7px] bg-brand" />
          Atelier ouvert · Marseille · depuis 1997
        </span>

        <h1 data-up="1" className="m-0 text-[clamp(36px,5.92vw,74px)] font-extrabold leading-[0.93] tracking-[-0.045em]">
          Réparation
          <br />
          de consoles
        </h1>

        <p data-up="2" className="m-0 max-w-[46ch] text-[16.5px] leading-[1.5] text-ink-soft">
          Vous décrivez la panne, on diagnostique, vous recevez un devis avant toute intervention.
        </p>

        {/*
          Le choix de la console, dans le premier écran du téléphone.
          Sur ordinateur, les tuiles de la section « 01 » sont déjà sous le pli
          à 1440 px : rien à remonter. Au doigt, elles arrivaient à 970 px — un
          écran et demi de défilement avant la première vraie question, alors
          que c'est **la** question du site. Trois boutons de 48 px la posent
          tout de suite ; les tuiles illustrées restent en dessous, pour qui
          fait défiler.

          Les familles viennent du catalogue : celle qu'on n'a pas en atelier
          ne s'affiche pas, et l'atelier n'annonce pas ce qu'il ne répare pas.
        */}
        {familles.length ? (
          <div data-up="2" className="flex flex-col gap-2.5 sm:hidden">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Réparez votre console</span>
            <div className="flex flex-wrap gap-0.5">
              {familles.map((f) => (
                <Link
                  key={f.cle}
                  href={f.href}
                  className="flex min-h-[50px] flex-1 basis-[calc(50%-2px)] items-center justify-center whitespace-nowrap border border-ink bg-surface px-3 text-[15.5px] font-semibold text-ink"
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/*
        Le format **exact** du fichier : 1254 × 1254, soit 1/1.
        La règle du handoff — « chaque cadre reprend le format de sa source » —
        n'a pas changé, seule la source a : le visuel déposé est carré, donc le
        cadre l'est aussi. Le recadrage reste nul et rien n'est étiré.

        Le carré est en revanche un format **haut** : à la largeur de colonne du
        hero (≈ 650 px à 1440), il aurait mesuré 650 px de haut là où l'ancien
        visuel en faisait 543. On borne donc le cadre à 520 px — le visuel reste
        compact et le texte de gauche n'est pas dominé par lui.

        Ce qui reste de la colonne se met à gauche du cadre, pas autour : le
        bord droit du visuel retrouve ainsi la gouttière de la page, exactement
        là où le cadre pleine colonne le posait. Sous 900 px il n'y a plus de
        colonne, et le cadre se centre.
      */}
      {/* Au doigt, la photographie reste dans la marge de 16 px du handoff : le
          retrait est porté par l'enveloppe, jamais par le cadre — un `padding`
          sur une boîte en `aspect-ratio` fausserait le rapport. Dès 900 px,
          elle va au bord et la colonne de droite est pleine. */}
      <div data-hero-img="1" className={`min-w-0 ${PAD} pt-[18px] min-[900px]:p-0`}>
        <div data-frame="1" className="relative mx-auto min-w-0 max-w-[520px] self-start overflow-hidden bg-surface-strong min-[900px]:mr-0" style={{ aspectRatio: "1 / 1" }}>
          <HomeVisual
            src={HOME_VISUALS.hero}
            alt={HOME_VISUAL_ALTS.hero}
            label="Atelier"
            priority
            sizes="(max-width: 552px) 100vw, 520px"
          />
          {/* Le balayage de diagnostic : le trait rouge est déjà un signe de la
            marque dans vos propres photographies. */}
          <span
            data-scan="1"
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
            style={{
              background: "linear-gradient(90deg, rgba(15,94,215,0) 0%, #0f5ed7 20%, #0b7f63 80%, rgba(11,127,99,0) 100%)",
            }}
          />
          {/*
          Pas de pastille « Diagnostic en cours » ici, et c'est délibéré.
          Le handoff en pose une en bas à gauche — mais ce visuel porte **déjà**,
          exactement à cet endroit, sa propre pancarte « GOOD GAMES BETTER
          DAYS », et en haut le bloc « 207 MÉDI@ROM · JEUX · CONSOLES ·
          RÉPARATION », tous deux incrustés dans le fichier. La règle la plus
          ferme du handoff sur les images est de ne pas recouvrir la
          typographie incrustée de vos posters : elle l'emporte sur l'ornement
          qui la contredit. Le carré clignotant reste, lui, dans la pastille
          « Atelier ouvert » de la colonne de gauche.
        */}
        </div>
      </div>

      {/* Bloc B : ce qu'on demande au visiteur, et ce qu'on lui promet. */}
      <div data-hero-b="1" className="gouttiere-page flex min-w-0 flex-col gap-[22px] pb-[clamp(26px,4.88vw,61px)] pt-[18px] sm:pt-[22px]">
        {/*
          Pleine largeur au doigt, côte à côte dès qu'il y a la place.
          Deux boutons de 17 px empilés à leur largeur de texte laissaient une
          colonne dentelée sur 390 px ; le handoff mobile les met l'un sous
          l'autre, pleine largeur, séparés des mêmes 2 px que le reste de la
          page.
        */}
        <div data-up="3" className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:gap-[11px]">
          <Link href={ROUTES.repair} data-btn="1" className="block bg-brand px-[26px] py-[15px] text-center text-[15.5px] font-semibold text-white hover:bg-ink sm:inline-block sm:w-auto">
            Demander un diagnostic
          </Link>
          <Link
            href="#pannes"
            data-btn="1"
            className="block border border-ink px-[24px] py-[14px] text-center text-[15.5px] font-semibold text-ink hover:bg-ink hover:text-white sm:inline-block sm:w-auto"
          >
            Voir les tarifs
          </Link>
        </div>

        {/* Les quatre promesses chiffrées. Rail qui glisse au doigt sous `sm` :
            empilées, elles repoussaient la première section d'un écran. */}
        {/*
          Les quatre promesses restent sur **une** ligne à partir de `sm`.
          En `flex-wrap`, le navigateur préfère renvoyer « 1997 · Atelier ouvert
          depuis » à la ligne plutôt que de rétrécir les cellules : sur un écran
          de 1152 px, la quatrième promesse tombait seule sous les trois autres,
          avec un trou au-dessus. En `nowrap` avec des cellules qui peuvent
          rétrécir (`min-w-0`), c'est l'étiquette en petites capitales qui passe
          sur deux lignes — et une étiquette sur deux lignes se lit, une
          promesse orpheline non. Le chiffre, lui, ne se coupe jamais.
        */}
        <ul
          data-up="4"
          data-rail="1"
          className="-mx-[clamp(16px,4.08vw,51px)] mt-2.5 flex list-none gap-[26px] overflow-x-auto border-t border-border px-[clamp(16px,4.08vw,51px)] pt-[22px] sm:mx-0 sm:flex-nowrap sm:gap-[18px] sm:overflow-visible sm:px-0 min-[1560px]:gap-[26px]"
        >
          {promesses.map((p) => (
            <li key={p.v} className="flex shrink-0 flex-col gap-px sm:min-w-0 sm:shrink">
              <span className="whitespace-nowrap text-[21px] font-bold tracking-[-0.03em]">{p.k}</span>
              <span className="font-mono text-[10px] uppercase leading-[1.35] tracking-[0.1em] text-ink-faint">{p.v}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ────────────────────────── 3 · 01 votre machine ─────────────────────────────

/**
 * Le dégradé qui tient le texte blanc sur la photo.
 *
 * **Il n'est pas décoratif** : c'est lui qui maintient le contraste au-dessus
 * de 4,5:1 sur une scène d'atelier dont le bas peut être clair. L'alléger
 * rendrait le titre illisible sur certaines photos.
 */
const VOILE = "linear-gradient(180deg, rgba(16,17,20,0) 26%, rgba(16,17,20,0.88) 72%, rgba(16,17,20,0.97) 100%)";

/**
 * « Réparez votre console » — le premier geste du site.
 *
 * Les familles viennent du catalogue : leurs modèles sont ceux que l'atelier
 * référence vraiment, et une famille sans modèle publié ne s'affiche pas. La
 * ligne du bas ne porte un prix que là où l'atelier en a arbitré un ; partout
 * ailleurs elle dit combien de modèles sont pris en charge, ce qui répond à la
 * seule question que le visiteur se pose devant une tuile : « la mienne en
 * fait-elle partie ? ». La version précédente y écrivait « dès 49 € » pour des
 * prestations dont aucune n'avait de tarif.
 *
 * La tuile mène au parcours, la console déjà choisie : reste le modèle, puis
 * le problème.
 */
export function MachinesV9({ familles }: { familles: FamilleVitrine[] }) {
  if (!familles.length) return null;
  return (
    /* Cette section-ci respire moins que les autres, et c'est voulu : c'est la
       seule dont la place se joue au pixel. Trente pixels de gouttière en moins
       font passer les tuiles au-dessus du pli d'un portable de 900 px de haut,
       où elles tombaient douze pixels en dessous. */
    <section id="reparation" className={`${SHELL} ${PAD} pt-[clamp(26px,2.96vw,37px)]`}>
      <TeteDeSection
        serre
        numero="01 — Votre machine"
        titre={
          <>
            Réparez
            <br />
            votre console
          </>
        }
        aside={<span className="max-w-[34ch] font-mono text-[11.5px] leading-[1.6] text-ink-faint">Consoles uniquement. Ni téléphones, ni ordinateurs.</span>}
      />

      <div data-g-pf="1">
        {familles.map((f) => {
          const visuel = PLATFORM_VISUALS[f.cle];
          return (
            <Link key={f.cle} href={f.href} data-tile="1" data-shot="1" className="relative block overflow-hidden bg-ink text-white">
              <HomeVisual
                src={visuel?.src ?? null}
                alt={visuel?.alt ?? f.label}
                label={f.label}
                position={visuel?.position}
                positionMobile={visuel?.mobile}
                sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 380px"
              />
              <span aria-hidden="true" className="absolute inset-0" style={{ background: VOILE }} />
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-[22px]">
                <span data-rule="1" aria-hidden="true" className="block h-0.5 w-10 bg-brand" />
                <strong className="mt-1 text-[clamp(19px,1.6vw,20px)] font-bold tracking-[-0.03em]">{f.label}</strong>
                <span className="font-mono text-[10.5px] tracking-[0.05em]" style={{ color: "#d3d3d8" }}>
                  {f.modeles.join(" · ")}
                </span>
                <span className="mt-1 font-mono text-[12.5px] text-white">
                  {f.prixMinCents ? `dès ${formatPrice(f.prixMinCents)}` : `${f.modeles.length} modèle${f.modeles.length > 1 ? "s" : ""} pris en charge`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-[26px] flex flex-wrap items-center gap-[11px]">
        <Link href={ROUTES.repair} data-btn="1" className="bg-brand px-[24px] py-[14px] text-[15.5px] font-semibold text-white hover:bg-ink">
          Commencer une réparation
        </Link>
        <span className="font-mono text-[11.5px] text-ink-faint">Diagnostic sous 48 h · devis avant intervention</span>
      </div>
    </section>
  );
}

// ─────────────────────────── 4 · 02 votre panne ──────────────────────────────

/**
 * « 02 — Votre panne » : ce que l'atelier traite le plus souvent.
 *
 * Six lignes, prises dans les prestations que le back-office met en avant et
 * regroupées par panne — « Aucun signal HDMI » vaut pour quatorze consoles,
 * elle n'a pas à s'écrire quatorze fois. Ce que porte chaque ligne est vrai :
 * les familles concernées, le nombre de consoles, et un prix **seulement** là
 * où l'atelier en a arbitré un. Partout ailleurs, « Sur devis » — le même mot
 * que l'étape 2 du parcours, et la même règle : jamais de tarif inventé, jamais
 * de « 0,00 € » pour une prestation qui n'en a pas.
 */
export function PannesV9({ pannes }: { pannes: PanneVitrine[] }) {
  if (!pannes.length) return null;
  return (
    <section id="pannes" className={`${SHELL} ${PAD} pt-[clamp(40px,5.36vw,67px)]`}>
      <TeteDeSection
        numero="02 — Votre panne"
        titre={
          <>
            Les interventions
            <br />
            les plus demandées
          </>
        }
        aside={<span className="font-mono text-[11.5px] text-ink-faint">Devis avant intervention · garantie 3 mois</span>}
      />

      <div data-g-fault="1">
        {pannes.map((f) => (
          <Link key={f.nom} href={ROUTES.repair} data-line="1" className="flex min-h-[44px] items-center gap-[18px] border-t border-border-strong py-[19px]">
            <span className="min-w-0 flex-1">
              <strong className="block text-[19px] font-semibold tracking-[-0.022em]">{f.nom}</strong>
              <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">
                {[f.familles.join(" · "), `${f.consoles} console${f.consoles > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="whitespace-nowrap text-[20px] font-bold tracking-[-0.03em]">{f.prixMinCents ? `dès ${formatPrice(f.prixMinCents)}` : <span className="text-[15px] font-semibold text-ink-soft">Sur devis</span>}</span>
            <span data-go="1" aria-hidden="true" className="text-[17px] text-ink-faint">
              →
            </span>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-[22px] border-t border-border-strong pt-[26px]">
        <p className="m-0 max-w-[62ch] text-[16px] leading-[1.5] text-ink-soft">
          Une panne absente de la liste, ou une console qui ne démarre plus sans raison identifiable&#8239;? Décrivez-la, le diagnostic tranchera.
        </p>
        <Link href={ROUTES.repair} data-btn="1" className="whitespace-nowrap bg-ink px-6 py-[15px] font-mono text-[11.5px] uppercase tracking-[0.07em] text-white hover:bg-brand">
          Décrire ma panne
        </Link>
      </div>
    </section>
  );
}

// ────────────────────────── 5 · 03 le parcours ───────────────────────────────

const ETAPES = [
  {
    n: "01",
    t: "Vous décrivez la panne",
    b: "Console, modèle, symptôme, photos si vous voulez. Deux minutes, sans créer de compte.",
  },
  {
    n: "02",
    t: "Dépôt ou colis suivi",
    b: "Au comptoir rue de Rome, ou par colis prépayé partout en France.",
  },
  {
    n: "03",
    t: "Diagnostic et devis",
    b: "Banc de test, puis un devis détaillé pièce par pièce. Rien n'est entrepris sans votre accord.",
  },
  {
    n: "04",
    t: "Réparation et retour",
    b: "Deux heures de test sous charge avant fermeture, puis retour suivi. Garantie trois mois.",
  },
] as const;

export function ParcoursV9() {
  return (
    <section id="devis" className="mt-[clamp(40px,5.36vw,67px)] bg-ink text-on-dark">
      <div className={`${SHELL} ${PAD} py-[clamp(44px,4.88vw,61px)]`}>
        <div className="mb-[38px] flex flex-wrap items-end justify-between gap-[26px]">
          <div className="min-w-0">
            <Numero onDark>03 — Le parcours</Numero>
            <H2>
              De la panne au retour
              <br />
              de votre console
            </H2>
          </div>
          <Link href={ROUTES.repair} data-btn="1" className="whitespace-nowrap bg-brand px-6 py-[14px] text-[15.5px] font-semibold text-white hover:bg-white hover:text-ink">
            Commencer mon diagnostic
          </Link>
        </div>

        <div data-g-step="1">
          {ETAPES.map((s) => (
            <div key={s.n} className="flex flex-col gap-2.5">
              <span aria-hidden="true" className="block h-0.5 w-[34px] bg-brand" />
              <span className="font-mono text-[11.5px] tracking-[0.08em] text-brand-on-dark">{s.n}</span>
              <strong className="text-[19px] font-semibold tracking-[-0.022em]">{s.t}</strong>
              <span className="text-[15px] leading-[1.55] text-on-dark-2">{s.b}</span>
            </div>
          ))}
        </div>

        {/* Le suivi : un vrai formulaire en GET vers la page de suivi, pas une
            décoration. Il fonctionne sans JavaScript. */}
        <form action={ROUTES.tracking} className="mt-11 flex flex-wrap items-center justify-between gap-5 border-t pt-[26px]" style={{ borderColor: "rgba(244,244,246,0.16)" }}>
          <span className="font-mono text-[11.5px] uppercase tracking-[0.07em] text-on-dark-2">Déjà déposé&#8239;? Suivez votre réparation</span>
          <span className="flex flex-wrap gap-2.5">
            <label htmlFor="suivi-ref" className="sr-only">
              Numéro de dossier
            </label>
            <input
              id="suivi-ref"
              name="ref"
              placeholder="R-0000"
              className="w-[150px] border bg-transparent px-[17px] py-[15px] font-mono text-[16px] text-on-dark outline-none placeholder:text-on-dark-3"
              style={{ borderColor: "rgba(244,244,246,0.3)" }}
            />
            <button
              type="submit"
              data-btn="1"
              className="cursor-pointer border border-on-dark bg-transparent px-[26px] py-[15px] text-[16px] font-semibold text-on-dark hover:bg-on-dark hover:text-ink"
            >
              Suivre
            </button>
          </span>
        </form>
      </div>
    </section>
  );
}

// ───────────────────────────── 6 · la boutique ───────────────────────────────

/**
 * Ce qu'on sait dire d'un rayon, au-delà de son nom.
 *
 * L'affiche et la phrase sont rédigées et photographiées pour les trois rayons
 * d'origine — ce sont de vraies photographies du magasin, elles ne se
 * fabriquent pas. Un rayon ouvert au back-office n'en a pas : sa tuile porte
 * alors son libellé sur la plaque d'attente, ce qui est honnête, plutôt qu'une
 * phrase inventée sur une image empruntée.
 */
const RAYONS_REDIGES: Record<string, { cle: "jeux" | "consoles" | "figurines"; texte: string }> = {
  GAME: { cle: "jeux", texte: "Neuf, occasion testée, import et collector." },
  CONSOLE: { cle: "consoles", texte: "Récentes et rétro, révisées en atelier, manettes et accessoires." },
  COLLECTIBLE: { cle: "figurines", texte: "One Piece, Naruto, Dragon Ball, Demon Slayer, Jujutsu Kaisen." },
};

/**
 * Les rayons en tuiles photo, format 3/2, gouttières de 2 px.
 *
 * Partagé par l'accueil et la page boutique : c'était la même rangée dessinée
 * deux fois, et la copie de la boutique portait encore les trois rayons écrits
 * en dur — un rayon ouvert au back-office n'y serait jamais apparu.
 */
export function RayonsEnTuiles({ rayons }: { rayons: Rayon[] }) {
  return (
    <div data-g-shop="1">
      {rayons.map((r) => {
        const redige = RAYONS_REDIGES[r.code];
        return (
          <Link key={r.code} href={`${ROUTES.shop}?cat=${r.slug}`} data-tile="1" data-shot="1" className="relative block overflow-hidden bg-ink text-white">
            <HomeVisual
              src={redige ? HOME_VISUALS[redige.cle] : null}
              alt={`Rayon ${r.label.toLowerCase()}`}
              label={r.label}
              sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 500px"
            />
            <span aria-hidden="true" className="absolute inset-0" style={{ background: VOILE }} />
            <span className="absolute inset-x-0 bottom-0 flex flex-col gap-[7px] p-[26px]">
              <span data-rule="1" aria-hidden="true" className="block h-0.5 w-11 bg-brand" />
              <strong className="mt-1 text-[clamp(22px,2.08vw,26px)] font-extrabold tracking-[-0.034em]">{r.label}</strong>
              {redige ? (
                <span className="text-[14.5px] leading-[1.4]" style={{ color: "#d3d3d8" }}>
                  {redige.texte}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function BoutiqueV9({ rayons }: { rayons: Rayon[] }) {
  return (
    <section id="boutique" className={`${SHELL} ${PAD} pt-[clamp(40px,5.36vw,67px)]`}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <Numero>La boutique</Numero>
          <H2>
            Et quand elle remarche,
            <br />
            on a de quoi jouer
          </H2>
        </div>
        <Link
          href={ROUTES.shop}
          className="inline-flex min-h-[44px] items-center whitespace-nowrap border-b-2 border-brand pb-[3px] font-mono text-[11.5px] uppercase tracking-[0.07em] sm:min-h-0"
        >
          Tout le catalogue
        </Link>
      </div>

      <RayonsEnTuiles rayons={rayons} />
    </section>
  );
}

// ──────────────────────────── 8 · le magasin ─────────────────────────────────

export function MagasinV9({ brand }: { brand: BrandSettings }) {
  const tel = brand.phone?.replace(/\s/g, "") ?? "";
  return (
    <section id="magasin" className={`${SHELL} ${PAD} py-[clamp(40px,5.36vw,67px)]`}>
      <div data-store-v9="1">
        {/* 3/4 : le format de la façade. Un cadre paysage couperait l'enseigne. */}
        <div className="relative overflow-hidden bg-surface-strong" style={{ aspectRatio: "3 / 4" }}>
          <HomeVisual src={HOME_VISUALS.magasin} alt={`Façade du magasin ${brand.name}, rue de Rome à Marseille`} label="Magasin" sizes="(max-width: 700px) 100vw, 40vw" />
        </div>
        <div className="flex flex-col justify-center gap-[13px] bg-surface p-[clamp(22px,2.8vw,35px)]">
          <Numero>Le magasin</Numero>
          <strong className="text-[clamp(23px,2.4vw,30px)] font-extrabold leading-[1.06] tracking-[-0.036em]">
            {brand.address_line1}
            <br />
            {brand.city} 6ᵉ
          </strong>
          {brand.hours ? <span className="font-mono text-[13.5px] text-ink-soft">{brand.hours}</span> : null}
          <span className="max-w-[44ch] text-[16px] leading-[1.5] text-ink-soft">
            Dépôt de console sans rendez-vous, retrait des commandes en deux heures, et le reste du catalogue en rayon.
          </span>
          <div className="mt-2 flex flex-wrap gap-[11px]">
            {brand.phone ? (
              <a href={`tel:${tel}`} data-btn="1" className="whitespace-nowrap bg-ink px-[22px] py-[14px] text-[15.5px] font-semibold text-white hover:bg-brand">
                {brand.phone}
              </a>
            ) : null}
            <Link href={ROUTES.contact} data-btn="1" className="whitespace-nowrap border border-ink px-[22px] py-[13px] text-[15.5px] font-semibold text-ink hover:bg-ink hover:text-white">
              Nous écrire
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export { RayonV9 };
export type { Product };
