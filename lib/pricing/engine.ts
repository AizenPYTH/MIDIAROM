/**
 * Central pricing engine. Runs ONLY on the server (server actions / route
 * handlers). The frontend receives the computed result and never sends prices.
 * All amounts are integer cents.
 */
export interface PricingRepair {
  id: string;
  name: string;
  priceCents: number;
  estimatedCostCents?: number;
}

export interface PricingOption {
  id: string;
  name: string;
  priceCents: number;
  estimatedCostCents?: number;
}

export interface PricingPack {
  id: string;
  name: string;
  priceCents: number;
  optionIds: readonly string[];
  estimatedCostCents?: number;
}

export interface PricingShipping {
  id: string;
  name: string;
  priceCents: number;
  estimatedCostCents?: number;
}

export interface PricingInput {
  repair: PricingRepair;
  /** Options that are COMPATIBLE with the repair (already filtered). */
  availableOptions: readonly PricingOption[];
  /** Packs that are COMPATIBLE with the repair (already filtered). */
  availablePacks: readonly PricingPack[];
  selectedOptionIds: readonly string[];
  selectedPackIds: readonly string[];
  shipping: PricingShipping | null;
  /** VAT rate in basis points (2000 = 20 %). Prices are VAT inclusive. */
  vatRateBp: number;
}

export type PriceLineType = "REPAIR" | "OPTION" | "PACK" | "SHIPPING";

export interface PriceLine {
  type: PriceLineType;
  referenceId: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  estimatedCostCents: number;
  /** For packs: the option names bundled. */
  includes?: string[];
}

export interface PricingResult {
  lines: PriceLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  /** VAT amount included in total (informative). */
  vatCents: number;
  vatRateBp: number;
  /** What the customer would have paid buying the pack options separately. */
  packSavingsCents: number;
  warnings: string[];
}

export class PricingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNKNOWN_OPTION"
      | "UNKNOWN_PACK"
      | "PACK_OVERLAP"
      | "INVALID_AMOUNT"
      | "INVALID_SHIPPING",
  ) {
    super(message);
    this.name = "PricingError";
  }
}

function assertCents(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new PricingError(`Montant invalide pour ${label}`, "INVALID_AMOUNT");
  }
}

/** VAT included in a VAT-inclusive amount: total − total / (1 + rate). */
export function vatIncluded(totalCents: number, vatRateBp: number): number {
  if (vatRateBp <= 0) return 0;
  return Math.round(totalCents - (totalCents * 10_000) / (10_000 + vatRateBp));
}

export function computePrice(input: PricingInput): PricingResult {
  const warnings: string[] = [];
  assertCents(input.repair.priceCents, input.repair.name);

  const optionsById = new Map(input.availableOptions.map((o) => [o.id, o]));
  const packsById = new Map(input.availablePacks.map((p) => [p.id, p]));

  // Packs: validate, de-duplicate, refuse overlapping packs (would double-sell an option).
  const selectedPacks: PricingPack[] = [];
  const optionsCoveredByPacks = new Set<string>();
  for (const packId of new Set(input.selectedPackIds)) {
    const pack = packsById.get(packId);
    if (!pack) throw new PricingError("Pack inconnu ou incompatible avec cette réparation", "UNKNOWN_PACK");
    assertCents(pack.priceCents, pack.name);
    for (const optionId of pack.optionIds) {
      if (optionsCoveredByPacks.has(optionId)) {
        throw new PricingError("Deux packs sélectionnés contiennent la même prestation", "PACK_OVERLAP");
      }
      optionsCoveredByPacks.add(optionId);
    }
    selectedPacks.push(pack);
  }

  // Options: validate; drop those already covered by a selected pack (never charged twice).
  const selectedOptions: PricingOption[] = [];
  for (const optionId of new Set(input.selectedOptionIds)) {
    const option = optionsById.get(optionId);
    if (!option) throw new PricingError("Option inconnue ou incompatible avec cette réparation", "UNKNOWN_OPTION");
    assertCents(option.priceCents, option.name);
    if (optionsCoveredByPacks.has(optionId)) {
      warnings.push(`« ${option.name} » est déjà comprise dans un pack sélectionné : elle n'a pas été facturée en plus.`);
      continue;
    }
    selectedOptions.push(option);
  }

  const lines: PriceLine[] = [];
  lines.push({
    type: "REPAIR",
    referenceId: input.repair.id,
    label: input.repair.name,
    quantity: 1,
    unitPriceCents: input.repair.priceCents,
    totalCents: input.repair.priceCents,
    estimatedCostCents: input.repair.estimatedCostCents ?? 0,
  });

  let packSavingsCents = 0;
  for (const pack of selectedPacks) {
    const bundled = pack.optionIds.map((id) => optionsById.get(id)).filter((o): o is PricingOption => Boolean(o));
    const separateTotal = bundled.reduce((sum, o) => sum + o.priceCents, 0);
    packSavingsCents += Math.max(0, separateTotal - pack.priceCents);
    lines.push({
      type: "PACK",
      referenceId: pack.id,
      label: pack.name,
      quantity: 1,
      unitPriceCents: pack.priceCents,
      totalCents: pack.priceCents,
      estimatedCostCents: pack.estimatedCostCents ?? bundled.reduce((s, o) => s + (o.estimatedCostCents ?? 0), 0),
      includes: bundled.map((o) => o.name),
    });
  }

  for (const option of selectedOptions) {
    lines.push({
      type: "OPTION",
      referenceId: option.id,
      label: option.name,
      quantity: 1,
      unitPriceCents: option.priceCents,
      totalCents: option.priceCents,
      estimatedCostCents: option.estimatedCostCents ?? 0,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);

  let shippingCents = 0;
  if (input.shipping) {
    assertCents(input.shipping.priceCents, input.shipping.name);
    shippingCents = input.shipping.priceCents;
    lines.push({
      type: "SHIPPING",
      referenceId: input.shipping.id,
      label: input.shipping.name,
      quantity: 1,
      unitPriceCents: shippingCents,
      totalCents: shippingCents,
      estimatedCostCents: input.shipping.estimatedCostCents ?? 0,
    });
  }

  const totalCents = subtotalCents + shippingCents;
  return {
    lines,
    subtotalCents,
    shippingCents,
    totalCents,
    vatCents: vatIncluded(totalCents, input.vatRateBp),
    vatRateBp: input.vatRateBp,
    packSavingsCents,
    warnings,
  };
}
