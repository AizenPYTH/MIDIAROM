"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { useCart } from "@/components/shop/cart-provider";
import { cn } from "@/lib/utils/cn";

/**
 * Lien « Panier (N) » de l'en-tête.
 *
 * Il portait un aplat noir, qui le mettait au même niveau visuel que le bouton
 * de diagnostic. Cette direction n'a qu'une action principale par écran : le
 * panier redevient un lien utilitaire, en mono, comme Suivi et Compte.
 *
 * `ready` évite d'afficher 0 puis le vrai compte : le panier vit dans le
 * stockage local, donc il n'est connu qu'après l'hydratation.
 */
export function CartLink({ className }: { className?: string }) {
  const { count, ready } = useCart();
  return (
    <Link
      href={ROUTES.cart}
      className={cn("inline-flex min-h-[44px] items-center whitespace-nowrap font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft transition-colors hover:text-red lg:min-h-0", className)}
      aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
    >
      Panier ({ready ? count : 0})
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
        // Contour au repos, rouge au survol de la carte entière (`[data-buy]`
        // dans globals.css) : le rouge marque l'action visée, pas huit boutons
        // à la fois dans une grille.
        "cursor-pointer whitespace-nowrap border border-ink bg-transparent font-semibold text-ink transition-colors hover:border-red hover:bg-red hover:text-white disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-transparent disabled:text-ink-muted disabled:opacity-100",
        // Au doigt le bouton « Ajouter » fait 44 px de haut ; à la souris il reprend
        // les proportions compactes de la carte du handoff.
        size === "sm" ? "px-3 py-[13px] text-[14px]" : "px-5 py-[15px] text-[15px]",
        className,
      )}
    >
      {/* « Ajouter au panier » en toutes lettres : sur une carte, « Ajouter »
          seul laisse au visiteur le soin de deviner où. */}
      {available <= 0 ? (
        "Indisponible"
      ) : added ? (
        "Ajouté ✓"
      ) : inCart >= available ? (
        "Maximum atteint"
      ) : (
        <>
          {/* Deux colonnes de cartes à 155 px : « Ajouter au panier » y passe à
              la ligne et double la hauteur du bouton. Le handoff mobile dit
              « Ajouter » — le panier est le seul endroit où l'on ajoute. */}
          <span className="sm:hidden">Ajouter</span>
          <span className="hidden sm:inline">Ajouter au panier</span>
        </>
      )}
    </button>
  );
}
