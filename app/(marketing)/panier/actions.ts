"use server";

import { z } from "zod";
import { priceCart, createShopOrderAndCheckout } from "@/lib/shop/orders";
import { CreateOrderError } from "@/lib/orders/create-order";
import { shopOrderSchema } from "@/lib/orders/schemas";
import { getCurrentUser } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/audit";
import { CONDITION_SHORT } from "@/lib/shop/status";

const cartSchema = z.object({
  lines: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).max(30),
  fulfillment: z.enum(["PICKUP", "SHIPPING"]).default("PICKUP"),
});

export interface PricedCartLine {
  productId: string;
  quantity: number;
  label: string;
  slug: string;
  platform: string;
  condition: string;
  image: string | null;
  unitPriceCents: number;
  totalCents: number;
  available: number;
}

export type PriceCartState =
  | { ok: true; lines: PricedCartLine[]; subtotalCents: number; shippingCents: number; totalCents: number; vatCents: number; freeShippingReached: boolean; shippingFeeCents: number; freeShippingThresholdCents: number | null; pickupEnabled: boolean; shippingEnabled: boolean; pickupNote: string; shippingNote: string; unavailable: string[] }
  | { ok: false; error: string };

/** Prix et disponibilité du panier, calculés par le serveur. Les lignes indisponibles sont signalées, pas silencieusement retirées. */
export async function priceCartAction(input: unknown): Promise<PriceCartState> {
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Panier invalide" };
  if (!parsed.data.lines.length) {
    const shop = await (await import("@/lib/settings")).getSetting("shop");
    return { ok: true, lines: [], subtotalCents: 0, shippingCents: 0, totalCents: 0, vatCents: 0, freeShippingReached: false, shippingFeeCents: shop.shipping_fee_cents, freeShippingThresholdCents: shop.free_shipping_threshold_cents, pickupEnabled: shop.pickup_enabled, shippingEnabled: shop.shipping_enabled, pickupNote: shop.pickup_note, shippingNote: shop.shipping_note, unavailable: [] };
  }
  // Lignes en rupture : on les isole pour les afficher, puis on chiffre le reste.
  const { getProductsByIds } = await import("@/lib/shop/catalog");
  const products = await getProductsByIds(parsed.data.lines.map((l) => l.productId));
  const byId = new Map(products.map((p) => [p.id, p]));
  const unavailable: string[] = [];
  const valid = parsed.data.lines.filter((l) => {
    const p = byId.get(l.productId);
    if (!p || !p.is_active || p.quantity < l.quantity) {
      unavailable.push(p?.name ?? "Article retiré du catalogue");
      return false;
    }
    return true;
  });
  try {
    const { lines, totals, shop } = valid.length
      ? await priceCart(valid, parsed.data.fulfillment)
      : { lines: [], totals: { subtotalCents: 0, shippingCents: 0, totalCents: 0, vatCents: 0, freeShippingReached: false }, shop: await (await import("@/lib/settings")).getSetting("shop") };
    return {
      ok: true,
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, label: l.product.name, slug: l.product.slug, platform: l.product.platform, condition: CONDITION_SHORT[l.product.condition], image: l.product.images[0] ?? null, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents, available: l.available })),
      ...totals,
      shippingFeeCents: shop.shipping_fee_cents,
      freeShippingThresholdCents: shop.free_shipping_threshold_cents,
      pickupEnabled: shop.pickup_enabled,
      shippingEnabled: shop.shipping_enabled,
      pickupNote: shop.pickup_note,
      shippingNote: shop.shipping_note,
      unavailable,
    };
  } catch (error) {
    return { ok: false, error: error instanceof CreateOrderError ? error.message : "Calcul impossible" };
  }
}

export type CreateShopOrderState = { ok: true; redirectUrl: string; orderNumber: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createShopOrderAction(input: unknown): Promise<CreateShopOrderState> {
  const meta = await requestMeta();
  const limit = rateLimit(`shop-checkout:${meta.ip ?? "unknown"}`, 10, 10 * 60_000);
  if (!limit.allowed) return { ok: false, error: "Trop de tentatives. Merci de patienter quelques minutes." };
  const parsed = shopOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Merci de corriger les champs signalés.", fieldErrors };
  }
  try {
    const user = await getCurrentUser();
    const result = await createShopOrderAndCheckout(parsed.data, user);
    return { ok: true, redirectUrl: result.redirectUrl, orderNumber: result.orderNumber };
  } catch (error) {
    if (error instanceof CreateOrderError) return { ok: false, error: error.message, fieldErrors: error.field ? { [error.field]: error.message } : undefined };
    console.error("[shop] createOrder failed", error);
    return { ok: false, error: "Une erreur est survenue. Merci de réessayer." };
  }
}
