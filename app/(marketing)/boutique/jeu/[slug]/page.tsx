import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/misc";
import { GameCard, ProductGrid } from "@/components/shop/product-card";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { ROUTES, SITE_URL } from "@/config/site";
import { getDemoGameBySlug, getDemoGames } from "@/lib/shop/demo-games";
import { genresFr, platformFr, yearOf } from "@/lib/shop/game-fr";
import { DEMO_PRICE_NOTE } from "@/lib/shop/demo-price";
import { youtubeId } from "@/lib/shop/game-scene";
import { CATEGORY_SLUGS } from "@/lib/shop/status";
import { formatPrice } from "@/lib/utils/format";

/**
 * Fiche d'un jeu de la vitrine de démonstration.
 *
 * Le problème qu'elle résout : les jeux affichés en rayon n'avaient aucune
 * page. On voyait une jaquette, on cliquait, il ne se passait rien — ou pire,
 * on atterrissait sur une fiche du catalogue qui n'existait pas.
 *
 * Elle a donc **la structure complète d'une fiche produit** : grand visuel,
 * nom, prix, plateforme, genre, année, disponibilité, description, informations
 * complémentaires, produits similaires. C'est une boutique, elle doit en avoir
 * l'air.
 *
 * Et elle est **honnête sur un point** : ce jeu n'est pas au catalogue. Pas de
 * bouton « Ajouter au panier » — le panier renvoie vers des produits réels, et
 * une commande qu'on ne peut pas honorer n'est pas une commande. Le prix est
 * annoncé comme indicatif, l'encart le dit en toutes lettres, et l'action
 * proposée est celle qu'on peut vraiment tenir : passer au magasin ou demander
 * le titre.
 *
 * `noindex` : ces pages ne sont pas du stock, elles n'ont rien à faire dans les
 * résultats de recherche.
 */

export const dynamic = "force-dynamic";

/** Combien de jeux voisins proposer en bas de fiche. */
const SIMILAIRES = 6;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getDemoGameBySlug(slug);
  if (!game) return { title: "Jeu introuvable", robots: { index: false, follow: false } };
  return {
    title: `${game.name} — sélection MÉDI@ROM`,
    description: `${game.name}${game.platform ? ` sur ${platformFr(game.platform)}` : ""} : fiche de la sélection MÉDI@ROM. Ce titre n'est pas encore en rayon.`,
    alternates: { canonical: `${SITE_URL}${ROUTES.shop}/jeu/${game.slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function DemoGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getDemoGameBySlug(slug);
  if (!game) notFound();

  const genres = genresFr(game.genres, 3);
  const annee = yearOf(game.releaseDate);
  const plateforme = game.platform ? platformFr(game.platform) : null;
  const trailer = youtubeId(game.trailerUrl);

  // Voisins : d'abord le même genre, puis n'importe lesquels, jamais lui-même.
  const tous = await getDemoGames(60);
  const memeGenre = tous.filter((g) => g.slug !== game.slug && g.genres.some((x) => game.genres.includes(x)));
  const autres = tous.filter((g) => g.slug !== game.slug && !memeGenre.includes(g));
  const similaires = [...memeGenre, ...autres].slice(0, SIMILAIRES);

  const infos: { label: string; value: string }[] = [
    plateforme ? { label: "Plateforme", value: plateforme } : null,
    genres.length ? { label: genres.length > 1 ? "Genres" : "Genre", value: genres.join(", ") } : null,
    annee ? { label: "Année de sortie", value: annee } : null,
    game.developer ? { label: "Développeur", value: game.developer } : null,
    game.publisher ? { label: "Éditeur", value: game.publisher } : null,
    game.rating !== null ? { label: "Note des joueurs", value: `${game.rating} / 100` } : null,
  ].filter((x): x is { label: string; value: string } => x !== null);

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 sm:py-12">
      <Breadcrumbs
        items={[
          { label: "Boutique", href: ROUTES.shop },
          { label: "Jeux vidéo", href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}` },
          { label: game.name },
        ]}
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        {/* Visuel */}
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-muted" style={{ aspectRatio: "3 / 4" }}>
            <SafeImage src={game.coverUrl} sizes="(max-width: 1024px) 92vw, 560px" priority fallback={<PhotoSlot label={game.name} accent="rgba(14,116,144,0.10)" />} />
          </div>
          {game.screenshotUrls.length ? (
            <ul className="mt-4 grid list-none grid-cols-3 gap-3 p-0">
              {game.screenshotUrls.slice(0, 3).map((url) => (
                <li key={url} className="relative overflow-hidden rounded-xl border border-border bg-surface-muted" style={{ aspectRatio: "16 / 10" }}>
                  <SafeImage src={url} sizes="200px" fallback={<span className="absolute inset-0 bg-surface-strong" />} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Informations */}
        <div className="min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            {[plateforme, genres[0]].filter(Boolean).join(" · ") || "Jeu vidéo"}
          </span>
          <h1 className="mt-3 font-display text-[clamp(30px,4.4vw,52px)] font-extrabold leading-[0.95] tracking-[-0.04em] text-ink">{game.name}</h1>

          <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="font-display text-[34px] font-extrabold tracking-[-0.03em] text-ink">{formatPrice(game.priceCents)}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">{DEMO_PRICE_NOTE}</span>
          </div>

          {/* L'encart qui dit la vérité. Il est en haut, pas en note de bas de page. */}
          <div className="mt-6 rounded-2xl border border-border bg-surface-muted p-5">
            <p className="font-display text-[16px] font-bold tracking-[-0.02em] text-ink">Ce titre n&apos;est pas encore en rayon.</p>
            <p className="mt-2 text-[14.5px] leading-[1.5] text-ink-soft">
              Il fait partie de notre sélection : la fiche vient d&apos;IGDB, le prix affiché est un ordre de grandeur, et il n&apos;est
              pas commandable en ligne. Passez au magasin ou demandez-nous le titre — on le fait venir.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={ROUTES.contact}
                className="inline-flex min-h-[48px] items-center rounded-[2px] bg-ink px-6 font-semibold text-bg transition-opacity hover:opacity-85"
              >
                Demander ce jeu
              </Link>
              <Link
                href={`${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}`}
                className="inline-flex min-h-[48px] items-center rounded-[2px] border border-border-strong px-6 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink"
              >
                Voir le rayon
              </Link>
              {trailer ? (
                <a
                  href={`https://www.youtube-nocookie.com/watch?v=${trailer}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-[48px] items-center rounded-[2px] border border-border px-6 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  Bande-annonce
                </a>
              ) : null}
            </div>
          </div>

          {infos.length ? (
            <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {infos.map((info) => (
                <div key={info.label} className="border-t border-border pt-3">
                  <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{info.label}</dt>
                  <dd className="mt-1 text-[15px] text-ink">{info.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <p className="mt-8 text-[13px] leading-[1.6] text-ink-faint">
            Jaquettes, captures et informations : IGDB. Le résumé d&apos;IGDB n&apos;est pas repris ici, il n&apos;existe qu&apos;en
            anglais.
          </p>
        </div>
      </div>

      {similaires.length ? (
        <section className="mt-20">
          <h2 className="font-display text-[clamp(20px,2.6vw,30px)] font-extrabold tracking-[-0.03em] text-ink">Dans la même sélection</h2>
          <div className="mt-7">
            <ProductGrid>
              {similaires.map((autre) => (
                <li key={autre.productId} className="min-w-0">
                  <GameCard game={autre} />
                </li>
              ))}
            </ProductGrid>
          </div>
        </section>
      ) : null}
    </div>
  );
}
