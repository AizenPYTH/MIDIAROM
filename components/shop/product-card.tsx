import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { AddToCartButton } from "@/components/shop/cart-widgets";
import { CONDITION_SHORT, stockLabel, stockState } from "@/lib/shop/status";
import { DEMO_PRICE_NOTE } from "@/lib/shop/demo-price";
import type { GameListing } from "@/lib/shop/games";
import { genresFr, platformFr, yearOf } from "@/lib/shop/game-fr";
import { formatPrice } from "@/lib/utils/format";
import type { Product } from "@/lib/shop/catalog";
import { cn } from "@/lib/utils/cn";

/**
 * Les cartes du rayon.
 *
 * Deux variantes, une seule grammaire visuelle : image dominante en 3/4,
 * pastille d'état, une ligne d'information, un prix très lisible, une action.
 * Elles servent partout — accueil, catalogue, produits similaires — pour que le
 * rayon se lise pareil d'un bout à l'autre.
 *
 * `ProductCard` porte un vrai produit : il s'ajoute au panier.
 * `GameCard` porte un jeu de la vitrine de démonstration : il mène à sa fiche,
 * et son prix est annoncé comme indicatif. Aucune ne se fait passer pour
 * l'autre.
 */

/** Le cadre visuel commun : image, zoom léger au survol, pastille. */
function Frame({
  href,
  alt,
  children,
  badge,
  badgeTone = "ink",
}: {
  href: string;
  alt: string;
  children: React.ReactNode;
  badge?: string | null;
  badgeTone?: "ink" | "muted";
}) {
  return (
    <Link
      href={href}
      // Rien au repos : ni ombre, ni contour épais. La hiérarchie vient du
      // rayon, du fond et de l'espace. Au survol, la tuile se soulève et la
      // photo respire — deux effets, pas trois.
      className="group relative block overflow-hidden rounded-2xl border border-border bg-surface-muted transition-[transform,box-shadow] duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[5px] hover:shadow-[0_22px_44px_rgba(24,30,45,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
      style={{ aspectRatio: "3 / 4" }}
      aria-label={alt}
    >
      <span className="absolute inset-0 transition-transform duration-[600ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        {children}
      </span>
      {badge ? (
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em]",
            badgeTone === "ink" ? "bg-ink text-bg" : "bg-bg/90 text-ink-soft ring-1 ring-border",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Une carte de vrai produit : prix réel, stock réel, ajout au panier. */
export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const state = stockState(product.quantity, product.low_stock_threshold);
  const href = `${ROUTES.shop}/${product.slug}`;
  return (
    <article className="flex min-w-0 flex-col gap-3">
      <Frame href={href} alt={product.name} badge={CONDITION_SHORT[product.condition]}>
        {image ? (
          <Image src={publicMediaUrl(image)} alt="" fill sizes="(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 230px" className="object-cover" />
        ) : (
          <PhotoSlot label={product.name} accent="rgba(91,61,245,0.10)" />
        )}
      </Frame>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{product.platform}</span>
        <h3 className="font-display text-[16px] font-bold leading-[1.2] tracking-[-0.02em] text-ink">
          <Link href={href} className="transition-colors hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <span className="mt-auto flex flex-wrap items-baseline gap-x-2.5 pt-2">
          <span className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">{formatPrice(product.price_cents)}</span>
          {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents ? (
            <span className="font-mono text-[12px] text-ink-faint line-through">{formatPrice(product.compare_at_price_cents)}</span>
          ) : null}
        </span>
        <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.1em]", state === "OUT" ? "text-danger" : state === "LOW" ? "text-warning" : "text-ink-muted")}>
          {stockLabel(product.quantity, product.low_stock_threshold, product.condition)}
        </span>
      </div>

      <AddToCartButton productId={product.id} available={product.quantity} className="w-full" />
    </article>
  );
}

/**
 * Une carte de la vitrine de démonstration.
 *
 * Même allure qu'un produit — c'est le but : la boutique doit avoir l'air d'une
 * boutique. Mais pas de bouton « Ajouter » : ce jeu n'est pas au catalogue, et
 * un panier qu'on ne peut pas honorer serait un mensonge. Le prix porte sa
 * mention, la pastille dit « Démo ».
 */
export function GameCard({ game }: { game: GameListing }) {
  const href = `${ROUTES.shop}/jeu/${game.slug}`;
  const meta = [game.platform ? platformFr(game.platform) : null, genresFr(game.genres, 1)[0] ?? null, yearOf(game.releaseDate)]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="flex min-w-0 flex-col gap-3">
      <Frame href={href} alt={game.name} badge="Démo" badgeTone="muted">
        <SafeImage src={game.coverUrl} sizes="(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 230px" fallback={<PhotoSlot label={game.name} accent="rgba(14,116,144,0.10)" />} />
      </Frame>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {meta ? <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{meta}</span> : null}
        <h3 className="font-display text-[16px] font-bold leading-[1.2] tracking-[-0.02em] text-ink">
          <Link href={href} className="transition-colors hover:text-primary">
            {game.name}
          </Link>
        </h3>
        <span className="mt-auto flex flex-wrap items-baseline gap-x-2.5 pt-2">
          <span className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">{formatPrice(game.priceCents)}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{DEMO_PRICE_NOTE}</span>
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Pas encore en rayon</span>
      </div>

      <Link
        href={href}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-border-strong px-5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-bg"
      >
        Voir le jeu
      </Link>
    </article>
  );
}

/** La grille du rayon. Deux colonnes au doigt, jusqu'à six sur grand écran. */
export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid list-none gap-x-5 gap-y-10 p-0" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(150px, 17vw, 230px), 1fr))" }}>
      {children}
    </ul>
  );
}
