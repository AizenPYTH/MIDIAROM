import "server-only";
import { computePrice, type PricingResult } from "@/lib/pricing/engine";
import type { RepairOffer } from "@/lib/repair/catalog";
import { getBusinessRules } from "@/lib/settings";

/**
 * Server-side quote for a selection. The result is what gets displayed and
 * what gets stored on the order — the client never sends prices.
 */
export async function priceSelection(
  offer: RepairOffer,
  selection: { optionIds: readonly string[]; packIds: readonly string[]; shippingMethodId: string | null },
): Promise<PricingResult> {
  const rules = await getBusinessRules();
  const shipping = selection.shippingMethodId
    ? (offer.shippingMethods.find((m) => m.id === selection.shippingMethodId) ?? null)
    : null;
  if (selection.shippingMethodId && !shipping) {
    throw new Error("Mode de transport inconnu ou indisponible");
  }
  return computePrice({
    repair: {
      id: offer.repair.id,
      name: offer.repair.name,
      priceCents: offer.repair.price_cents,
      estimatedCostCents: offer.repair.estimated_cost_cents,
    },
    availableOptions: offer.options.map((o) => ({
      id: o.id,
      name: o.name,
      priceCents: o.price_cents,
      estimatedCostCents: o.estimated_cost_cents,
    })),
    availablePacks: offer.packs.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: p.price_cents,
      optionIds: p.optionIds,
      estimatedCostCents: p.options.reduce((s, o) => s + o.estimated_cost_cents, 0),
    })),
    selectedOptionIds: selection.optionIds,
    selectedPackIds: selection.packIds,
    shipping: shipping
      ? { id: shipping.id, name: shipping.name, priceCents: shipping.price_cents, estimatedCostCents: shipping.estimated_cost_cents }
      : null,
    vatRateBp: rules.vat_rate_bp,
  });
}
