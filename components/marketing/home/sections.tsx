import Link from "next/link";
import { ROUTES } from "@/config/site";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";
import { HomeVisual } from "@/components/marketing/home/visual";
import { HOME_VISUAL_ALTS, HOME_VISUAL_FOCUS, HOME_VISUALS, PLATFORM_VISUALS } from "@/lib/content/assets";
import { WorkshopVideo } from "@/components/marketing/home/workshop-video";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { CATEGORIES, HERO_TRUST, PLATFORMS, SAVOIR_FAIRE, SHOP_FILTERS, stepsAvecTarif, TRUST, type Platform } from "@/components/marketing/home/content";
import type { Product } from "@/lib/shop/catalog";
import type { BrandSettings } from "@/config/brand";

/**
 * Les blocs de l'accueil, dans l'ordre de la direction visuelle.
 *
 * Réparation d'abord — c'est le métier principal, et il occupe le plus de
 * surface —, boutique ensuite, avec les produits atteignables sans effort.
 * Entre les deux, la vidéo d'atelier fait la transition : elle montre le
 * savoir-faire qui justifie qu'on achète aussi ici.
 *
 * Aucune ombre au repos, angles nets partout, et un seul rouge : intitulés de
 * section, CTA principal, puces du savoir-faire, flèches de survol. Ailleurs,
 * c'est du noir, du blanc et du gris.
 */

const WRAP = "page-wrap px-[22px]";

/** L'intitulé rouge qui ouvre chaque section. */
function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <span className={`font-mono text-[11.5px] uppercase tracking-[0.14em] ${onDark ? "text-red-on-dark" : "text-red"}`}>{children}</span>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2.5 text-[clamp(26px,3.2vw,40px)] font-bold leading-[1.04] tracking-[-0.032em]">{children}</h2>
  );
}

// ───────────────────────────────── 1 · hero ─────────────────────────────────

/**
 * Le hero. Compact — jamais plein écran : le premier bloc de réparations doit
 * être atteint d'un seul geste.
 *
 * L'identité gaming tient dans trois détails, tous **à l'intérieur du cadre du
 * visuel** : le balayage rouge d'un banc de test, une croix directionnelle dont
 * les touches s'allument, et un HUD qui clignote. Rien sur le titre, rien sur
 * les boutons — une animation qui traverse un CTA le rend moins cliquable, pas
 * plus.
 */
export function Hero() {
  return (
    <section id="top" className="border-b border-border-section">
      <div className={`${WRAP} grid items-center gap-11 pb-10 pt-11`} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="flex min-w-0 flex-col gap-[18px]">
          <span data-enter="1">
            <Eyebrow>Atelier de réparation — consoles uniquement</Eyebrow>
          </span>
          <h1 data-enter="1" className="text-[clamp(38px,5.2vw,68px)] font-bold leading-none tracking-[-0.038em]">
            Réparation de consoles
          </h1>
          <p data-enter="2" className="max-w-[46ch] text-[clamp(16.5px,1.6vw,19px)] leading-[1.5] text-ink-soft">
            PlayStation, Nintendo Switch, Xbox et consoles rétro. Vous décrivez la panne, nous diagnostiquons, vous recevez un devis
            avant toute intervention. Garantie trois mois, colis suivi à l&apos;aller comme au retour.
          </p>
          <div data-enter="3" className="mt-0.5 flex flex-wrap gap-3">
            <Link
              href={ROUTES.repair}
              className="rounded-[9px] bg-red px-[26px] py-4 text-[16.5px] font-semibold text-white transition-colors duration-200 hover:bg-ink"
            >
              Demander un diagnostic
            </Link>
            <Link
              href="#reparation"
              className="rounded-[9px] border border-ink px-6 py-[15px] text-[16.5px] font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-white"
            >
              Voir les réparations
            </Link>
          </div>
          <ul data-enter="4" className="mt-1.5 flex list-none flex-wrap gap-2.5 p-0">
            {HERO_TRUST.map((t) => (
              <li key={t} className="border border-border px-3.5 py-2.5 font-mono text-[11.5px] tracking-[0.04em] text-ink-soft">
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* `overflow-hidden` est ici, sur le cadre, et nulle part au-dessus :
            un ancêtre qui clippe devient un conteneur de défilement et fige les
            révélations `view()` à mi-course. */}
        <div data-enter="2" className="relative min-w-0 overflow-hidden border border-border-section bg-surface-strong" style={{ aspectRatio: "5 / 4", maxHeight: 460 }}>
          <HomeVisual
            src={HOME_VISUALS.hero}
            alt={HOME_VISUAL_ALTS.hero}
            label="Atelier"
            position={HOME_VISUAL_FOCUS.hero.position}
            positionMobile={HOME_VISUAL_FOCUS.hero.mobile}
            priority
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 640px"
          />

          {/* Le balayage de diagnostic : la lecture d'un banc de test. */}
          <span
            data-scan="1"
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
            style={{ background: "linear-gradient(90deg, rgba(216,31,38,0) 0%, #d81f26 22%, #d81f26 78%, rgba(216,31,38,0) 100%)" }}
          />

          {/* La croix directionnelle : une séquence de touches, en détail. */}
          <span
            data-pad="1"
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-3.5 grid gap-[3px]"
            style={{ gridTemplateColumns: "repeat(3, 7px)", gridTemplateRows: "repeat(3, 7px)" }}
          >
            <span style={{ gridArea: "1 / 2", background: "#d2d2d7" }} />
            <span style={{ gridArea: "2 / 1", background: "#d2d2d7" }} />
            <span style={{ gridArea: "2 / 3", background: "#d2d2d7" }} />
            <span style={{ gridArea: "3 / 2", background: "#d2d2d7" }} />
            <span style={{ gridArea: "2 / 2", background: "#d2d2d7" }} />
          </span>

          <span className="pointer-events-none absolute bottom-3.5 left-3.5 flex items-center gap-2 bg-ink/90 px-[11px] py-[7px]">
            <span data-hud-dot="1" aria-hidden="true" className="block h-1.5 w-1.5 bg-red" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-on-dark">Diagnostic en cours</span>
          </span>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────── 2 · réparations ──────────────────────────────

/**
 * Les pannes prises en charge, console par console.
 *
 * Chaque ligne est cliquable et porte son prix : une réparation s'achète comme
 * un produit, elle ne se demande pas dans le vide. Toutes mènent au parcours de
 * devis réel, qui recalcule le prix ferme depuis la base après diagnostic —
 * les montants affichés ici sont des repères de vitrine.
 */
/**
 * Où mène une carte de plateforme.
 *
 * Vers la page de la console la plus récente de la famille — `/reparation/ps5`
 * — et non vers `/reparation`, qui rouvre le choix de la marque. Cliquer sur
 * « Diagnostic PlayStation » pour retomber sur « choisissez votre marque » n'a
 * aucun sens, et c'est ce que faisait la première version.
 *
 * Le rattachement se fait sur le début du slug, parce que c'est ce que la base
 * garantit (`ps5`, `ps5-slim`, `switch-oled`, `xbox-series-x`). Le rétro prend
 * ce qui reste. Sans modèle publié pour une famille, on retombe sur le
 * parcours général : un lien vers une page inexistante serait pire.
 */
export function modelHref(platform: Platform, models: { slug: string }[]): string {
  const pris = PLATFORMS.flatMap((p) => p.slugPrefixes);
  const correspond = platform.slugPrefixes.length
    ? models.filter((m) => platform.slugPrefixes.some((p) => m.slug.startsWith(p)))
    : models.filter((m) => !pris.some((p) => m.slug.startsWith(p)));
  return correspond[0] ? `${ROUTES.repair}/${correspond[0].slug}` : ROUTES.repair;
}

export function Repairs({ models = [], diagnostic }: { models?: { slug: string }[]; diagnostic?: string | null }) {
  return (
    <section id="reparation" className={`${WRAP} pt-14`}>
      <div data-rise="1" className="mb-[26px] flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <Eyebrow>Réparations</Eyebrow>
          <H2>Votre panne est probablement prise en charge</H2>
        </div>
        <span className="font-mono text-[11.5px] tracking-[0.04em] text-ink-muted">
          Prix indicatifs, hors pièces{diagnostic ? ` · diagnostic ${diagnostic}` : ""}
        </span>
      </div>

      <ul className="grid list-none gap-[18px] p-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
        {PLATFORMS.map((p) => {
          const href = modelHref(p, models);
          // Switch n'a pas encore sa photo : la plaque tient la place plutôt
          // que la console d'une autre marque.
          const visuel = PLATFORM_VISUALS[p.key];
          return (
          <li key={p.key} data-rise="1" data-card="1" className="flex min-w-0 flex-col border border-border bg-surface">
            <span className="relative block overflow-hidden border-b border-border" style={{ aspectRatio: "16 / 10" }}>
              <span data-zoom="1" className="absolute inset-0">
                <HomeVisual
                  src={visuel?.src ?? null}
                  alt={visuel?.alt ?? ""}
                  label={p.name}
                  position={visuel?.position}
                  positionMobile={visuel?.mobile}
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 380px"
                />
              </span>
            </span>
            <div className="flex flex-1 flex-col gap-[13px] p-5">
              <span className="flex items-baseline justify-between gap-3">
                <strong className="text-[20px] font-bold tracking-[-0.025em]">{p.name}</strong>
                <span className="whitespace-nowrap font-mono text-[12px] text-ink-muted">{p.from}</span>
              </span>
              <span className="font-mono text-[11px] tracking-[0.04em] text-ink-muted">{p.models}</span>

              <div className="flex flex-col">
                {p.faults.map((f) => (
                  <Link
                    key={f.label}
                    href={href}
                    data-row="1"
                    className="flex items-center justify-between gap-3 border-t border-border-hairline py-[11px] text-ink"
                  >
                    <span className="min-w-0 text-[14.5px]">{f.label}</span>
                    <span className="flex items-center gap-[11px] whitespace-nowrap">
                      <span className="font-mono text-[13.5px]">{f.price}</span>
                      <span data-arrow="1" aria-hidden="true" className="inline-block text-[15px] text-ink-muted">
                        →
                      </span>
                    </span>
                  </Link>
                ))}
              </div>

              <Link
                href={href}
                className="mt-auto border border-ink p-[13px] text-center text-[14.5px] font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-white"
              >
                Diagnostic {p.name}
              </Link>
            </div>
          </li>
          );
        })}
      </ul>

      <div data-rise="1" className="mt-[18px] flex flex-wrap items-center justify-between gap-[18px] border border-border bg-surface-muted px-[22px] py-[18px]">
        <p className="max-w-[70ch] text-[15px] leading-[1.5] text-ink-soft">
          Une panne qui n&apos;est pas dans la liste, ou une console qui ne démarre plus sans raison identifiable&#8239;? Décrivez-la, le
          diagnostic tranchera. <strong className="font-semibold text-ink">L&apos;atelier ne répare que des consoles</strong> — ni
          téléphones, ni ordinateurs, ni tablettes.
        </p>
        <Link
          href={ROUTES.repair}
          className="whitespace-nowrap bg-ink px-5 py-[13px] font-mono text-[11.5px] uppercase tracking-[0.06em] text-white transition-colors duration-200 hover:bg-red"
        >
          Décrire ma panne
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────── 3 · parcours ────────────────────────────────

/** De la panne au retour de la console. Fond noir : c'est la promesse du site. */
export function Journey({ diagnostic }: { diagnostic?: string | null }) {
  return (
    <section id="diagnostic" className="mt-14 bg-ink text-on-dark">
      <div className={`${WRAP} py-[52px]`}>
        <div data-rise="1" className="mb-[34px] flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <Eyebrow onDark>Parcours</Eyebrow>
            <H2>De la panne au retour de la console</H2>
          </div>
          <Link
            href={ROUTES.repair}
            className="whitespace-nowrap rounded-[9px] bg-red px-6 py-[15px] text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-white hover:text-ink"
          >
            Commencer mon diagnostic
          </Link>
        </div>

        <ol className="grid list-none gap-[26px] p-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(224px, 1fr))" }}>
          {stepsAvecTarif(diagnostic ?? null).map((s) => (
            <li key={s.n} data-rise="1" className="flex flex-col gap-2.5 pt-4" style={{ borderTop: "1px solid rgba(242,242,244,0.26)" }}>
              <span className="font-mono text-[12px] tracking-[0.06em] text-red-on-dark">{s.n}</span>
              <strong className="text-[18px] font-semibold tracking-[-0.02em]">{s.title}</strong>
              <span className="text-[14.5px] leading-[1.55] text-on-dark-2">{s.body}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ──────────────────────────────── 4 · confiance ──────────────────────────────

/**
 * Quatre cellules blanches sur une gouttière d'1 px.
 *
 * Les pistes sont **fixées** — 4, puis 2, puis 1 — et non `auto-fit` : c'est ce
 * qui empêche une cinquième colonne fantôme, et aucune cellule ne porte de
 * bordure, donc un retour à la ligne ne peut pas laisser un filet dans le vide.
 */
export function TrustBand() {
  return (
    <section aria-label="Nos engagements" className="border-b border-border-section">
      <div data-trust-grid="1" className={`${WRAP} grid gap-px bg-border-hairline px-0`}>
        {TRUST.map((t) => (
          <div key={t.title} className="flex flex-col gap-[5px] bg-surface px-[22px] py-[26px]">
            <strong className="text-[15.5px] font-semibold tracking-[-0.012em]">{t.title}</strong>
            <span className="text-[14px] leading-[1.5] text-ink-soft">{t.body}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────── 5 · savoir-faire ──────────────────────────────

/** La transition atelier → savoir-faire → boutique. */
export function Workshop({ video }: { video?: { src: string; poster?: string } }) {
  return (
    <section id="savoir-faire" className={`${WRAP} pt-14`}>
      <div className="grid items-stretch gap-[26px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div data-rise="1" className="flex min-w-0 flex-col justify-center gap-3.5">
          <Eyebrow>Savoir-faire</Eyebrow>
          <H2>Dans l&apos;atelier</H2>
          <p className="max-w-[42ch] text-[15.5px] leading-[1.55] text-ink-soft">
            Ce qui se passe entre le moment où votre console arrive et celui où elle repart.
          </p>
          <ul className="mt-1 flex list-none flex-col p-0">
            {SAVOIR_FAIRE.map((s) => (
              <li key={s} className="flex items-baseline gap-[11px] border-t border-border-hairline py-[11px]">
                <span aria-hidden="true" className="mt-[7px] block h-1.5 w-1.5 shrink-0 bg-red" />
                <span className="text-[14.5px] leading-[1.45]">{s}</span>
              </li>
            ))}
            <li className="border-t border-border-hairline" />
          </ul>
          <Link
            href={ROUTES.repair}
            className="mt-2.5 self-start border border-ink px-6 py-3.5 text-[15.5px] font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-white"
          >
            Demander un diagnostic
          </Link>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5">
          <WorkshopVideo src={video?.src} poster={video?.poster}>
            <HomeVisual
              src={HOME_VISUALS.atelier}
              alt={HOME_VISUAL_ALTS.atelier}
              label="Atelier"
              position={HOME_VISUAL_FOCUS.atelier.position}
              positionMobile={HOME_VISUAL_FOCUS.atelier.mobile}
              sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 700px"
            />
          </WorkshopVideo>
          <span className="font-mono text-[10.5px] tracking-[0.05em] text-ink-muted">
            Muette, en boucle, 20 à 40 secondes. Elle se met en pause dès qu&apos;elle quitte l&apos;écran.
          </span>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────── 6 · boutique ───────────────────────────────

/** Les trois rayons, en cartes pleine image. Pas un de plus. */
export function ShopCategories() {
  return (
    <section id="boutique" className={`${WRAP} pt-14`}>
      <div data-rise="1" className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <Eyebrow>Boutique</Eyebrow>
          <H2>Jeux vidéo, consoles et figurines</H2>
        </div>
        <Link
          href={ROUTES.shop}
          className="whitespace-nowrap border-b-2 border-red pb-[3px] font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink"
        >
          Tout le catalogue
        </Link>
      </div>

      <ul className="grid list-none gap-[18px] p-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(268px, 1fr))" }}>
        {CATEGORIES.map((c) => (
          <li key={c.key} className="min-w-0">
            <Link
              href={c.href}
              data-card="1"
              data-rise="1"
              className="relative block overflow-hidden border border-border bg-surface-strong text-white"
              style={{ aspectRatio: "4 / 3" }}
            >
              <span data-zoom="1" className="absolute inset-0">
                <HomeVisual
                  src={HOME_VISUALS[c.visual]}
                  alt={HOME_VISUAL_ALTS[c.visual]}
                  label={c.name}
                  position={HOME_VISUAL_FOCUS[c.visual].position}
                  positionMobile={HOME_VISUAL_FOCUS[c.visual].mobile}
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 440px"
                />
              </span>
              {/* Le voile : c'est lui qui garantit la lisibilité du texte blanc
                  sur la photo que le magasin déposera. Il reste utile sur la
                  plaque d'attente, qui est claire. */}
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(15,15,17,0.04) 0%, rgba(15,15,17,0.32) 46%, rgba(15,15,17,0.9) 100%)" }}
              />
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
                <strong className="text-[21px] font-bold tracking-[-0.026em]">{c.name}</strong>
                <span className="text-[14px] leading-[1.4] text-[#eaeaee]">{c.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Le mur de produits.
 *
 * Les filtres ne décorent pas : chacun mène au catalogue réel avec sa requête.
 * Un filtre qui ne filtre rien serait pire qu'absent.
 *
 * Tout vient du catalogue saisi au back-office : il n'y a plus de sélection de
 * démonstration à afficher quand le rayon est vide, et c'est voulu — un rayon
 * vide le dit, plutôt que de montrer des titres qu'on ne vend pas.
 */
export function ProductWall({ products, total }: { products: Product[]; total: number }) {
  const rien = !products.length;

  return (
    <section aria-label="En rayon" className={`${WRAP} pt-10`}>
      <div data-rise="1" className="mb-5 flex flex-wrap items-center justify-between gap-4 border-t border-border-section pt-[22px]">
        <ul className="flex list-none flex-wrap gap-2 p-0">
          {SHOP_FILTERS.map((f, i) => (
            <li key={f.label}>
              <Link
                href={f.href}
                data-chip={i === 0 ? undefined : "1"}
                className={
                  i === 0
                    ? "block border border-ink bg-ink px-[15px] py-2.5 font-mono text-[11.5px] uppercase tracking-[0.05em] text-white"
                    : "block border border-border-strong px-[15px] py-2.5 font-mono text-[11.5px] uppercase tracking-[0.05em] text-ink-soft"
                }
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href={`${ROUTES.shop}?tri=recent`} className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted transition-colors hover:text-red">
          Trier : nouveautés
        </Link>
      </div>

      {rien ? (
        <p className="border border-border bg-surface-muted px-[22px] py-[18px] text-[15px] leading-[1.5] text-ink-soft">
          Les arrivages ne sont pas encore en ligne. Passez au 207 rue de Rome&#8239;: le rayon, lui, est plein.
        </p>
      ) : (
        <>
          <ProductGrid>
            {products.map((p) => (
              <li key={p.id} className="min-w-0">
                <ProductCard product={p} />
              </li>
            ))}
          </ProductGrid>

          <div data-rise="1" className="mt-[26px] flex justify-center">
            <Link
              href={ROUTES.shop}
              className="border border-ink px-[30px] py-[15px] text-[15.5px] font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-white"
            >
              {total > products.length ? `Voir les ${total} références` : "Voir tout le catalogue"}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

// ──────────────────────────────── 7 · magasin ────────────────────────────────

/**
 * Le magasin. Adresse, horaires et téléphone viennent des réglages : une
 * information absente ne laisse pas de ligne vide, elle n'apparaît pas.
 */
export function Store({ brand }: { brand: BrandSettings }) {
  const adresse = [brand.address_line1, [brand.postal_code, brand.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <section aria-label="Le magasin" className={`${WRAP} py-14`}>
      <div className="grid border border-border" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div data-rise="1" className="flex flex-col justify-center gap-3 p-[34px]">
          <Eyebrow>Le magasin</Eyebrow>
          {adresse ? (
            <strong className="text-[clamp(23px,2.6vw,32px)] font-bold leading-[1.1] tracking-[-0.03em]">{adresse}</strong>
          ) : null}
          {brand.hours ? <span className="font-mono text-[13.5px] text-ink-soft">{brand.hours}</span> : null}
          <p className="max-w-[44ch] text-[15px] leading-[1.55] text-ink-soft">
            Dépôt de console sans rendez-vous, retrait des commandes en boutique, et le reste du catalogue en rayon.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-[11px]">
            {brand.phone ? (
              <a
                href={`tel:${brand.phone.replace(/\s/g, "")}`}
                className="whitespace-nowrap bg-ink px-[22px] py-3.5 text-[15.5px] font-semibold text-white transition-colors duration-200 hover:bg-red"
              >
                {brand.phone}
              </a>
            ) : null}
            <Link
              href={ROUTES.contact}
              className="whitespace-nowrap border border-ink px-5 py-[13px] text-[15.5px] font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-white"
            >
              Nous écrire
            </Link>
          </div>
        </div>
        <div className="relative min-h-[280px] overflow-hidden border-l border-border">
          <PhotoSlot label="Magasin" />
        </div>
      </div>
    </section>
  );
}
