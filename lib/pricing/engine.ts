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
  /**
   * `repairs.price_is_provisional` — le prix n'a pas été arbitré.
   *
   * Ce n'est pas « le prix vaut zéro », c'est « il n'y a pas de prix ». La
   * distinction décide de tout : une prestation provisoire n'est pas payable,
   * donc pas commandable, donc elle ouvre une demande de devis gratuite.
   */
  isProvisional?: boolean;
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
  /**
   * La prestation choisie n'a pas de prix ferme : rien n'est payable, et le
   * parcours qui s'ouvre est la demande de devis gratuite.
   *
   * Quand ce drapeau est levé, tous les montants du résultat valent zéro —
   * ce n'est pas une gratuité, c'est l'absence de montant. Le reste du code
   * doit lire ce booléen, jamais `totalCents === 0`, pour faire la différence
   * entre « offert » et « à devis ».
   */
  requiresQuote: boolean;
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

  /*
    Prestation sur devis : plus rien n'est facturable, on s'arrête là.

    Le moteur empilait jusqu'ici `repair.priceCents` sans regarder ce drapeau.
    Comme le catalogue crée toutes les prestations à `price_cents = 0` et
    `price_is_provisional = true`, un dossier « sur devis » repartait avec un
    total égal aux seuls frais de port — payable, donc payé, donc traité comme
    une réparation commandée. Le client envoyait sa console sans qu'un prix ait
    jamais été fixé.

    **Cette sortie vient après les validations, et non avant.** Court-circuiter
    en tête de fonction faisait bien tomber le total à zéro, mais cessait du
    même coup de refuser une option incompatible, inconnue ou désactivée : une
    garantie du parcours payant disparaissait par effet de bord sur l'autre.
    Ici, une sélection trafiquée est toujours rejetée ; une sélection valable
    est simplement non facturée, et le client est prévenu que l'atelier la
    chiffrera dans le devis.
  */
  if (input.repair.isProvisional) {
    if (selectedOptions.length || selectedPacks.length) {
      warnings.push("Les options seront chiffrées par l'atelier dans le devis.");
    }
    return {
      lines: [
        { type: "REPAIR", referenceId: input.repair.id, label: input.repair.name, quantity: 1, unitPriceCents: 0, totalCents: 0, estimatedCostCents: 0 },
      ],
      requiresQuote: true,
      subtotalCents: 0,
      shippingCents: 0,
      totalCents: 0,
      vatCents: 0,
      vatRateBp: input.vatRateBp,
      packSavingsCents: 0,
      warnings,
    };
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
    requiresQuote: false,
    subtotalCents,
    shippingCents,
    totalCents,
    vatCents: vatIncluded(totalCents, input.vatRateBp),
    vatRateBp: input.vatRateBp,
    packSavingsCents,
    warnings,
  };
}
