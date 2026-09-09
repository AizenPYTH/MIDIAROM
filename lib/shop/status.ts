import type { Enums } from "@/types/database";

/** Libellés, tons et règles pures de la boutique (utilisables côté client et dans les tests). */
export type ShopOrderStatus = Enums<"shop_order_status">;
export type ProductCondition = Enums<"product_condition">;
export type ProductCategory = Enums<"product_category">;
export type ShopFulfillment = Enums<"shop_fulfillment">;

export const SHOP_ORDER_STATUSES: readonly ShopOrderStatus[] = ["PENDING", "PAID", "PREPARED", "SHIPPED", "DELIVERED", "CANCELLED"];

export const SHOP_ORDER_STATUS_LABELS: Record<ShopOrderStatus, string> = {
  PENDING: "En attente de paiement",
  PAID: "Payée",
  PREPARED: "Préparée",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

/** Libellé client selon le mode de retrait. */
export function shopStatusLabel(status: ShopOrderStatus, fulfillment: ShopFulfillment): string {
  if (fulfillment === "PICKUP") {
    if (status === "PREPARED") return "Prête au retrait";
    if (status === "SHIPPED" || status === "DELIVERED") return "Retirée";
  }
  return SHOP_ORDER_STATUS_LABELS[status];
}

const SHOP_TRANSITIONS: Record<ShopOrderStatus, readonly ShopOrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["PREPARED", "CANCELLED"],
  PREPARED: ["SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canShopTransition(from: ShopOrderStatus, to: ShopOrderStatus): boolean {
  return from !== to && SHOP_TRANSITIONS[from].includes(to);
}

export function allowedShopTransitions(from: ShopOrderStatus): readonly ShopOrderStatus[] {
  return SHOP_TRANSITIONS[from];
}

export function shopStatusTone(status: ShopOrderStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "PAID":
      return "success";
    case "PREPARED":
      return "info";
    case "SHIPPED":
      return "neutral";
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "danger";
  }
}

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  NEW: "Neuf",
  REFURBISHED: "Révisé",
  USED_A: "Occasion · grade A",
  USED_B: "Occasion · grade B",
  USED_C: "Occasion · grade C",
};

export const CONDITION_SHORT: Record<ProductCondition, string> = {
  NEW: "Neuf",
  REFURBISHED: "Révisé",
  USED_A: "Occasion A",
  USED_B: "Occasion B",
  USED_C: "Occasion C",
};

export const CONDITION_DESCRIPTIONS: Record<ProductCondition, string> = {
  NEW: "Produit neuf, jamais utilisé, emballage d'origine.",
  REFURBISHED: "Produit d'occasion révisé en atelier : pièces d'usure remplacées, testé, garanti.",
  USED_A: "Occasion en très bon état : traces d'usage à peine visibles, entièrement fonctionnel.",
  USED_B: "Occasion en bon état : traces d'usage visibles (rayures, marques), entièrement fonctionnel.",
  USED_C: "Occasion avec défauts esthétiques marqués ou accessoires manquants, fonctionnel. Défauts détaillés sur la fiche.",
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  CONSOLE: "Consoles",
  GAME: "Jeux",
  ACCESSORY: "Accessoires",
  PART: "Pièces",
  COLLECTIBLE: "Collector",
};

export const CATEGORY_SLUGS: Record<ProductCategory, string> = {
  CONSOLE: "consoles",
  GAME: "jeux",
  ACCESSORY: "accessoires",
  PART: "pieces",
  COLLECTIBLE: "collector",
};

export function categoryFromSlug(slug: string | undefined): ProductCategory | null {
  const entry = (Object.entries(CATEGORY_SLUGS) as [ProductCategory, string][]).find(([, s]) => s === slug);
  return entry ? entry[0] : null;
}

export type StockState = "IN_STOCK" | "LOW" | "OUT";

export function stockState(quantity: number, lowThreshold: number): StockState {
  if (quantity <= 0) return "OUT";
  if (quantity <= lowThreshold) return "LOW";
  return "IN_STOCK";
}

export function stockLabel(quantity: number, lowThreshold: number, condition: ProductCondition): string {
  const state = stockState(quantity, lowThreshold);
  if (state === "OUT") return "Rupture";
  if (quantity === 1 && condition !== "NEW") return "Pièce unique";
  if (state === "LOW") return `Plus que ${quantity}`;
  return `En stock · ${quantity}`;
}

export const FULFILLMENT_LABELS: Record<ShopFulfillment, string> = {
  PICKUP: "Retrait au magasin",
  SHIPPING: "Envoi à domicile",
};

/** Panier côté client : uniquement des identifiants et quantités ; les prix viennent du serveur. */
export interface CartLine {
  productId: string;
  quantity: number;
}

export interface PricedLine extends CartLine {
  label: string;
  unitPriceCents: number;
  totalCents: number;
  available: number;
}

export interface ShopTotals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  vatCents: number;
  freeShippingReached: boolean;
}

export interface ShopTotalsInput {
  lines: { unitPriceCents: number; quantity: number }[];
  fulfillment: ShopFulfillment;
  shippingFeeCents: number;
  freeShippingThresholdCents: number | null;
  vatRateBp: number;
}

/** Totaux de commande (TVA incluse dans les prix). Fonction pure, testée unitairement. */
export function computeShopTotals(input: ShopTotalsInput): ShopTotals {
  const subtotalCents = input.lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const freeShippingReached = input.freeShippingThresholdCents !== null && subtotalCents >= input.freeShippingThresholdCents;
  const shippingCents = input.fulfillment === "SHIPPING" && !freeShippingReached ? input.shippingFeeCents : 0;
  const totalCents = subtotalCents + shippingCents;
  const vatCents = Math.round(totalCents - (totalCents * 10_000) / (10_000 + input.vatRateBp));
  return { subtotalCents, shippingCents, totalCents, vatCents, freeShippingReached };
}

/** Fusionne / borne les lignes du panier (quantité ≥ 1, pas de doublon). */
export function normalizeCart(lines: CartLine[]): CartLine[] {
  const map = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId || !Number.isFinite(line.quantity)) continue;
    const q = Math.max(0, Math.min(99, Math.floor(line.quantity)));
    if (q === 0) continue;
    map.set(line.productId, (map.get(line.productId) ?? 0) + q);
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}
