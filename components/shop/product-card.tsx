import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { AddToCartButton } from "@/components/shop/cart-widgets";
import { CONDITION_SHORT, stockLabel, stockState } from "@/lib/shop/status";
import { formatPrice } from "@/lib/utils/format";
import type { Product } from "@/lib/shop/catalog";
import { cn } from "@/lib/utils/cn";

/**
 * Carte produit du handoff : visuel carré, badge d'état, plateforme mono, nom,
 * prix + « Ajouter », stock.
 *
 * Au téléphone, la grille passe à deux colonnes : la carte se resserre et le
 * bouton « Ajouter » descend sous le prix, en pleine largeur. Côte à côte dans
 * 160 px, le prix et le bouton se chevauchaient.
 */
export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const state = stockState(product.quantity, product.low_stock_threshold);
  return (
    <article className="flex flex-col gap-[9px] border border-border bg-surface p-3 sm:gap-3 sm:p-4">
      <Link href={`${ROUTES.shop}/${product.slug}`} className="relative block aspect-square overflow-hidden">
        {image ? (
          <Image src={publicMediaUrl(image)} alt={product.name} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <div className="photo-placeholder h-full w-full items-end justify-start p-2.5 text-[10.5px]">photo produit</div>
        )}
        <span className={cn("absolute left-2 top-2 px-[6px] py-1 font-mono text-[9.5px] uppercase tracking-[0.06em] sm:left-2.5 sm:top-2.5 sm:px-[7px] sm:text-[10.5px]", product.condition === "NEW" ? "bg-ink-900 text-paper" : "bg-sale text-white")}>{CONDITION_SHORT[product.condition]}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted sm:text-[11px]">{product.platform}</span>
        <h3 className="text-[14px] font-semibold leading-[1.25] text-ink sm:text-[16px]">
          <Link href={`${ROUTES.shop}/${product.slug}`} className="hover:text-sale">
            {product.name}
          </Link>
        </h3>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5">
        <span className="font-mono text-[15px] font-semibold text-ink sm:text-[17px]">
          {formatPrice(product.price_cents)}
          {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents ? <span className="ml-2 text-[12px] font-normal text-ink-muted line-through">{formatPrice(product.compare_at_price_cents)}</span> : null}
        </span>
        <AddToCartButton productId={product.id} available={product.quantity} className="w-full sm:w-auto" />
      </div>
      <span className={cn("font-mono text-[10.5px] sm:text-[11px]", state === "OUT" ? "text-danger" : state === "LOW" ? "text-sale" : "text-ink-muted")}>{stockLabel(product.quantity, product.low_stock_threshold, product.condition)}</span>
    </article>
  );
}
