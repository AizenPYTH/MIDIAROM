"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { useCart } from "@/components/shop/cart-provider";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { priceCartAction, type PriceCartState } from "@/app/(marketing)/panier/actions";
import { formatPrice } from "@/lib/utils/format";

/** Page panier : lignes chiffrées par le serveur, quantités modifiables, récapitulatif encre. */
export function CartPage() {
  const cart = useCart();
  const [state, setState] = useState<PriceCartState | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!cart.ready) return;
    startTransition(async () => {
      setState(await priceCartAction({ lines: cart.lines, fulfillment: "PICKUP" }));
    });
  }, [cart.lines, cart.ready]);

  if (!cart.ready || !state) return <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-muted">Chargement du panier…</p>;
  if (!state.ok) return <p className="border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{state.error}</p>;

  if (!state.lines.length && !state.unavailable.length) {
    return (
      <div className="border border-dashed border-border-strong bg-surface-muted px-6 py-8">
        <p className="text-[15.5px] font-semibold text-ink">Votre panier est vide.</p>
        <Link href={ROUTES.shop} className="mt-4 inline-block bg-ink-900 px-[22px] py-3.5 text-[15px] font-semibold text-paper hover:bg-sale">
          Voir la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
      <div className="flex flex-col gap-2">
        {state.unavailable.length ? (
          <p className="border border-warning bg-warning-soft px-4 py-3 text-[13.5px] text-warning">
            Indisponible ou stock insuffisant : {state.unavailable.join(", ")}.{" "}
            <button type="button" className="cursor-pointer underline" onClick={() => cart.lines.forEach((l) => !state.lines.some((s) => s.productId === l.productId) && cart.remove(l.productId))}>
              Retirer du panier
            </button>
          </p>
        ) : null}
        {state.lines.map((line) => (
          <div key={line.productId} className="flex gap-4 border border-border bg-surface p-4">
            <Link href={`${ROUTES.shop}/${line.slug}`} className="relative block h-20 w-20 shrink-0">
              {line.image ? <Image src={publicMediaUrl(line.image)} alt={line.label} fill sizes="80px" className="object-cover" /> : <div className="photo-placeholder h-full w-full text-[9px]">photo</div>}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                {line.platform} · {line.condition}
              </span>
              <Link href={`${ROUTES.shop}/${line.slug}`} className="text-[15.5px] font-semibold text-ink hover:text-sale">
                {line.label}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                  Qté
                  <select value={line.quantity} onChange={(e) => cart.setQuantity(line.productId, Number(e.target.value))} aria-label={`Quantité pour ${line.label}`} className="border border-border-strong bg-field px-2 py-1 font-mono text-[12px] text-ink">
                    {Array.from({ length: Math.min(10, line.available) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => cart.remove(line.productId)} className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted underline underline-offset-4 hover:text-danger">
                  Retirer
                </button>
              </div>
            </div>
            <span className="whitespace-nowrap font-mono text-[15px] font-semibold text-ink">{formatPrice(line.totalCents)}</span>
          </div>
        ))}
      </div>
      <aside className="flex flex-col gap-4">
        <div className="bg-ink-900 p-4 text-paper">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Récapitulatif</span>
          <div className="mt-[11px] flex flex-col gap-[7px] text-[14.5px]">
            <div className="flex justify-between gap-3.5">
              <span className="text-[#c4bdae]">Sous-total</span>
              <span className="font-mono">{formatPrice(state.subtotalCents)}</span>
            </div>
            <div className="flex justify-between gap-3.5">
              <span className="text-[#c4bdae]">Retrait au magasin</span>
              <span className="font-mono">0 €</span>
            </div>
            {state.shippingEnabled ? (
              <div className="flex justify-between gap-3.5 text-[12.5px]">
                <span className="text-[#c4bdae]">ou envoi</span>
                <span className="font-mono">{state.freeShippingReached ? "offert" : formatPrice(state.shippingFeeCents)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3.5 border-t border-ink-700 pt-2 text-[16px] font-semibold">
              <span>Total TTC (retrait)</span>
              <span className="font-mono">{formatPrice(state.totalCents)}</span>
            </div>
          </div>
        </div>
        <Link href={state.lines.length ? ROUTES.shopCheckout : ROUTES.shop} className="block bg-sale px-4 py-[14px] text-center font-mono text-[12.5px] uppercase tracking-[0.06em] text-white hover:bg-ink-900" aria-disabled={!state.lines.length}>
          Commander
        </Link>
        <Link href={ROUTES.shop} className="text-center font-mono text-[12px] uppercase tracking-[0.06em] text-ink-muted hover:text-ink">
          Continuer mes achats
        </Link>
        <p className="text-[13px] text-ink-faint">Le mode de retrait (magasin ou envoi) et le paiement sécurisé sont choisis à l&apos;étape suivante. Les prix et le stock sont vérifiés par nos serveurs.</p>
      </aside>
    </div>
  );
}
