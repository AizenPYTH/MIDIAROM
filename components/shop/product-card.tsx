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
 * Une seule grammaire : visuel carré, badge d'état en haut à gauche, une ligne
 * de métadonnées en mono, le nom, le prix face au stock, une action pleine
 * largeur. Elles servent partout — accueil, catalogue, produits similaires —
 * pour que le rayon se lise pareil d'un bout à l'autre.
 *
 * Aucune ombre au repos : c'est le filet qui tient la carte. `data-card` porte
 * le survol défini dans globals.css — la tuile se soulève de 3 px, la photo
 * passe à 1.05, et le bouton d'achat vire au rouge. Le rouge n'apparaît que
 * là, sur la carte visée, jamais sur les huit à la fois.
 *
 * `ProductCard` porte un vrai produit : il s'ajoute au panier.
 * `GameCard` porte un jeu de la vitrine de démonstration : il mène à sa fiche,
 * et son prix est annoncé comme indicatif. Aucune ne se fait passer pour
 * l'autre.
 */

/** Le cadre visuel commun : carré, zoom au survol, badge. */
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
  badgeTone?: "ink" | "red" | "outline";
}) {
  return (
    <Link href={href} className="relative block aspect-square overflow-hidden bg-surface-strong" aria-label={alt}>
      <span data-zoom="1" className="absolute inset-0">
        {children}
      </span>
      {badge ? (
        <span
          className={cn(
            "absolute left-[11px] top-[11px] px-[9px] py-[5px] font-mono text-[10px] uppercase tracking-[0.07em]",
            badgeTone === "red" ? "bg-red text-white" : badgeTone === "outline" ? "bg-bg/92 text-ink ring-1 ring-border" : "bg-ink text-white",
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
  // Une remise est la seule information de la carte qui mérite le rouge.
  const enPromo = Boolean(product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents);
  return (
    <article data-card="1" className="flex min-w-0 flex-col border border-border bg-surface">
      <Frame href={href} alt={product.name} badge={CONDITION_SHORT[product.condition]} badgeTone={enPromo ? "red" : "ink"}>
        {image ? (
          <Image src={publicMediaUrl(image)} alt="" fill sizes="(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 232px" className="object-cover" />
        ) : (
          <PhotoSlot label={product.name} />
        )}
      </Frame>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">{product.platform}</span>
        <h3 className="flex-1 text-[15.5px] font-semibold leading-[1.32] tracking-[-0.014em] text-ink">
          <Link href={href} className="transition-colors hover:text-red">
            {product.name}
          </Link>
        </h3>
        <span className="flex items-baseline justify-between gap-2.5">
          <span className="flex items-baseline gap-2">
            <span className="text-[19px] font-bold tracking-[-0.028em] text-ink">{formatPrice(product.price_cents)}</span>
            {enPromo ? <span className="font-mono text-[11.5px] text-ink-muted line-through">{formatPrice(product.compare_at_price_cents!)}</span> : null}
          </span>
          <span
            className={cn(
              "whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.05em]",
              state === "OUT" ? "text-red" : state === "LOW" ? "text-warning" : "text-ink-muted",
            )}
          >
            {stockLabel(product.quantity, product.low_stock_threshold, product.condition)}
          </span>
        </span>
        <AddToCartButton productId={product.id} available={product.quantity} className="mt-0.5 w-full" />
      </div>
    </article>
  );
}

/**
 * Une carte de la vitrine de démonstration.
 *
 * Même allure qu'un produit — c'est le but : la boutique doit avoir l'air d'une
 * boutique. Mais pas de bouton « Ajouter » : ce jeu n'est pas au catalogue, et
 * un panier qu'on ne peut pas honorer serait un mensonge. Le prix porte sa
 * mention, le badge dit « Démo ».
 */
export function GameCard({ game }: { game: GameListing }) {
  const href = `${ROUTES.shop}/jeu/${game.slug}`;
  const meta = [game.platform ? platformFr(game.platform) : null, genresFr(game.genres, 1)[0] ?? null, yearOf(game.releaseDate)]
    .filter(Boolean)
    .join(" · ");
  return (
    <article data-card="1" className="flex min-w-0 flex-col border border-border bg-surface">
      <Frame href={href} alt={game.name} badge="Démo" badgeTone="outline">
        <SafeImage src={game.coverUrl} sizes="(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 232px" fallback={<PhotoSlot label={game.name} />} />
      </Frame>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        {meta ? <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">{meta}</span> : null}
        <h3 className="flex-1 text-[15.5px] font-semibold leading-[1.32] tracking-[-0.014em] text-ink">
          <Link href={href} className="transition-colors hover:text-red">
            {game.name}
          </Link>
        </h3>
        <span className="flex items-baseline justify-between gap-2.5">
          <span className="text-[19px] font-bold tracking-[-0.028em] text-ink">{formatPrice(game.priceCents)}</span>
          <span className="whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.05em] text-ink-muted">{DEMO_PRICE_NOTE}</span>
        </span>
        <Link
          href={href}
          data-buy="1"
          className="mt-0.5 inline-flex min-h-[44px] w-full items-center justify-center border border-ink px-3 text-[14px] font-semibold text-ink"
        >
          Voir le jeu
        </Link>
      </div>
    </article>
  );
}

/** La grille du rayon. Deux colonnes au doigt, jusqu'à six sur grand écran. */
export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid list-none gap-[18px] p-0" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(150px, 17vw, 232px), 1fr))" }}>
      {children}
    </ul>
  );
}
