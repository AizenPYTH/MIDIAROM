import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { AddToCartButton } from "@/components/shop/cart-widgets";
import { CONDITION_SHORT, stockLabel, stockState } from "@/lib/shop/status";
import { formatPrice } from "@/lib/utils/format";
import type { Product } from "@/lib/shop/catalog";
import { cn } from "@/lib/utils/cn";

/** Carte produit du handoff : visuel carré, badge d'état, plateforme mono, nom, prix + « Ajouter », stock. */
export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const state = stockState(product.quantity, product.low_stock_threshold);
  return (
    <article className="flex flex-col gap-3 border border-border bg-surface p-4">
      <Link href={`${ROUTES.shop}/${product.slug}`} className="relative block aspect-square overflow-hidden">
        {image ? (
          <Image src={publicMediaUrl(image)} alt={product.name} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <div className="photo-placeholder h-full w-full items-end justify-start p-2.5 text-[10.5px]">photo produit</div>
        )}
        <span className={cn("absolute left-2.5 top-2.5 px-[7px] py-1 font-mono text-[10.5px] uppercase tracking-[0.06em]", product.condition === "NEW" ? "bg-ink-900 text-paper" : "bg-sale text-white")}>{CONDITION_SHORT[product.condition]}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">{product.platform}</span>
        <h3 className="text-[16px] font-semibold leading-[1.25] text-ink">
          <Link href={`${ROUTES.shop}/${product.slug}`} className="hover:text-sale">
            {product.name}
          </Link>
        </h3>
      </div>
      <div className="flex items-center justify-between gap-2.5">
        <span className="font-mono text-[17px] font-semibold text-ink">
          {formatPrice(product.price_cents)}
          {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents ? <span className="ml-2 text-[12px] font-normal text-ink-muted line-through">{formatPrice(product.compare_at_price_cents)}</span> : null}
        </span>
        <AddToCartButton productId={product.id} available={product.quantity} />
      </div>
      <span className={cn("font-mono text-[11px]", state === "OUT" ? "text-danger" : state === "LOW" ? "text-sale" : "text-ink-muted")}>{stockLabel(product.quantity, product.low_stock_threshold, product.condition)}</span>
    </article>
  );
}
