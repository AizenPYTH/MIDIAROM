import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { ProductTile } from "@/components/shop/product-tile";
import { AddToCartButton } from "@/components/shop/cart-widgets";
import { CONDITION_SHORT, stockLabel, stockState } from "@/lib/shop/status";
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
 * Le catalogue est entièrement saisi au back-office : une carte porte donc
 * toujours un vrai produit, avec son vrai prix et son vrai stock. Il n'y a plus
 * de variante « démonstration » — elle venait d'un catalogue externe qui
 * n'existe plus.
 */

/**
 * Le cadre visuel : un carré, pour tout le rayon.
 *
 * Il a d'abord suivi le rapport du produit — 3/4 pour un jeu, carré pour le
 * reste — afin de ne pas recadrer une jaquette. C'était juste pour une carte
 * seule, et faux pour une grille : les rayons se mélangent, deux cartes
 * voisines n'avaient donc pas la même hauteur d'image, et la ligne entière
 * partait de travers.
 *
 * Le cadre est désormais **le même partout**, et c'est la photo qui s'y adapte
 * en `object-contain` : une jaquette 3/4 se montre entière, centrée, avec une
 * marge égale de chaque côté, plutôt que recadrée. Rien n'est jamais déformé,
 * rien n'est coupé, et deux produits aux photos de rapports différents pèsent
 * pareil dans la grille.
 *
 * **Fond blanc, comme la carte.** Les photos du magasin sont détourées sur
 * blanc ; sur l'aplat gris d'avant, chacune montrait son rectangle de fichier.
 * Sur le blanc de la carte, la limite du fichier disparaît et l'objet a l'air
 * posé dans la page. Les photos à fond transparent y gagnent aussi.
 */
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
    <Link href={href} className="relative block overflow-hidden bg-surface" style={{ aspectRatio: "1 / 1" }} aria-label={alt}>
      <span data-zoom="1" className="absolute inset-0">
        {children}
      </span>
      {badge ? (
        <span
          className={cn(
            "absolute left-[11px] top-[11px] z-10 px-[9px] py-[5px] font-mono text-[10px] uppercase tracking-[0.07em]",
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
    // `h-full` : sans lui la carte garde sa hauteur naturelle au lieu de
    // remplir sa cellule, et un titre de trois lignes décale toute la rangée.
    <article data-card="1" className="flex h-full min-w-0 flex-col border border-border bg-surface">
      <Frame href={href} alt={product.name} badge={CONDITION_SHORT[product.condition]} badgeTone={enPromo ? "red" : "ink"}>
        {image ? (
          // `object-contain` : on vend l'objet, pas un cadrage. Une jaquette en
          // 3/4 et une console en 4/3 tiennent dans le même carré sans que
          // l'une soit rognée. Le léger retrait évite que la photo touche le
          // filet de la carte.
          <Image
            src={publicMediaUrl(image)}
            alt=""
            fill
            sizes="(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 232px"
            className="object-contain p-[9%]"
          />
        ) : (
          <ProductTile name={product.name} platform={product.platform} category={product.category} />
        )}
      </Frame>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">{product.platform}</span>
        {/* Deux lignes réservées : un titre court et un titre long donnent la
            même hauteur de carte, sans creuser le vide d'une zone de trois
            lignes toujours vide. Un nom qui déborde prend sa troisième ligne. */}
        <h3 className="mt-2 min-h-[2lh] text-[15.5px] font-semibold leading-[1.32] tracking-[-0.014em] text-ink">
          <Link href={href} className="transition-colors hover:text-red">
            {product.name}
          </Link>
        </h3>
        {/* `mt-auto` : le prix, le stock et le bouton sont collés au bas de la
            carte. Un titre d'une ligne et un titre de trois lignes donnent donc
            le même alignement d'un bout à l'autre de la rangée. */}
        <div className="mt-auto flex flex-col gap-2 pt-3">
          <span data-price-row="1">
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
          <AddToCartButton productId={product.id} available={product.quantity} className="w-full" />
        </div>
      </div>
    </article>
  );
}

/** La grille du rayon. Deux colonnes au doigt, jusqu'à six sur grand écran. */
export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    // `items-stretch` (défaut de la grille) + `h-full` sur la carte : toutes
    // les cartes d'une même rangée font la hauteur de la plus haute, sans
    // hauteur fixe qui creuserait du vide sous les plus courtes.
    <ul className="grid list-none gap-[18px] p-0" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(150px, 17vw, 232px), 1fr))" }}>
      {children}
    </ul>
  );
}
