"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { useCart } from "@/components/shop/cart-provider";
import { cn } from "@/lib/utils/cn";

/** Lien « Panier · N » du header (handoff). */
export function CartLink({ className }: { className?: string }) {
  const { count, ready } = useCart();
  return (
    <Link href={ROUTES.cart} className={cn("whitespace-nowrap bg-ink-900 px-3.5 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-paper hover:bg-sale", className)} aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}>
      Panier · {ready ? count : 0}
    </Link>
  );
}

/** Bouton « Ajouter » d'une carte ou fiche produit ; désactivé en rupture. */
export function AddToCartButton({ productId, available, className, size = "sm" }: { productId: string; available: number; className?: string; size?: "sm" | "md" }) {
  const { add, lines } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = lines.find((l) => l.productId === productId)?.quantity ?? 0;
  const disabled = available <= 0 || inCart >= available;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        add(productId, 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1500);
      }}
      className={cn(
        "cursor-pointer whitespace-nowrap border-0 bg-ink-900 font-mono uppercase tracking-[0.06em] text-paper transition-colors hover:bg-sale disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-3 py-[9px] text-[11.5px]" : "px-5 py-[14px] text-[12.5px]",
        className,
      )}
    >
      {available <= 0 ? "Rupture" : added ? "Ajouté ✓" : inCart >= available ? "Maximum atteint" : "Ajouter"}
    </button>
  );
}
