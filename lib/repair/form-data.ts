import "server-only";
import type { ConsoleModel, Brand, RepairOffer, Fault, Repair, RepairCategory } from "@/lib/repair/catalog";
import type { FormModel, FormOffer, FormRepair } from "@/components/repair/repair-form-types";

/** Sérialisation du catalogue pour la fiche de réparation (composant client). */
export function toFormModels(models: ConsoleModel[], brands: Brand[]): FormModel[] {
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const brandRank = new Map(brands.map((b, i) => [b.id, i]));
  const brandSlug = new Map(brands.map((b) => [b.id, b.slug]));
  return [...models]
    .sort((a, b) => (brandRank.get(a.brand_id) ?? 99) - (brandRank.get(b.brand_id) ?? 99) || a.display_order - b.display_order)
    .map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      tag: m.variants.length ? m.variants.join(", ") : m.release_year ? String(m.release_year) : (brandName.get(m.brand_id) ?? ""),
      brandId: m.brand_id,
      brandName: brandName.get(m.brand_id) ?? "",
      brandSlug: brandSlug.get(m.brand_id) ?? "",
      isRetro: m.is_retro,
      commonIssues: m.common_issues,
    }));
}

export function toFormRepair(r: Repair & { fault: Fault; category?: RepairCategory | null }): FormRepair {
  return {
    id: r.id,
    name: r.name,
    faultName: r.fault.name,
    faultSlug: r.fault.slug,
    note: r.summary ?? r.fault.short_description ?? "",
    priceCents: r.price_cents,
    categoryName: r.category?.name ?? null,
    categoryOrder: r.category?.display_order ?? 999,
    priceProvisional: r.price_is_provisional,
    isDiagnosticOnly: r.is_diagnostic_only,
    warrantyMonths: r.warranty_months,
    leadTimeMin: r.lead_time_days_min,
    leadTimeMax: r.lead_time_days_max,
    includedItems: r.included_items,
  };
}

export function toFormOffer(offer: RepairOffer): FormOffer {
  return {
    repairId: offer.repair.id,
    options: offer.options.map((o) => ({ id: o.id, name: o.name, note: o.short_description ?? "", priceCents: o.price_cents, isRecommended: o.is_recommended })),
    packs: offer.packs.map((p) => ({ id: p.id, name: p.name, note: p.short_description ?? `Comprend : ${p.options.map((o) => o.name).join(", ")}`, priceCents: p.price_cents, isRecommended: p.is_recommended, optionIds: p.optionIds })),
    shippingMethods: offer.shippingMethods.map((m) => ({ id: m.id, name: m.name, note: m.description ?? "", priceCents: m.price_cents, includesOutbound: m.includes_outbound, includesReturn: m.includes_return })),
  };
}

import { getActiveBrands, getActiveModels } from "@/lib/repair/catalog";
import { getSetting } from "@/lib/settings";
import { getLegalDocument } from "@/lib/content";
import { consequenceForOutcome } from "@/lib/quotes/rules";
import type { FormConditions } from "@/components/repair/repair-form-types";

/** Données communes à toutes les pages qui affichent la fiche de réparation. */
export async function getRepairFormBase(isDiagnosticOnly = false): Promise<{ models: FormModel[]; conditions: FormConditions }> {
  const [brands, models, rules, cgv] = await Promise.all([getActiveBrands(), getActiveModels(), getSetting("business_rules"), getLegalDocument("cgv")]);
  const refusal = consequenceForOutcome("QUOTE_REFUSED", rules, isDiagnosticOnly);
  const unrepairable = consequenceForOutcome("UNREPAIRABLE", rules, isDiagnosticOnly);
  return {
    models: toFormModels(models, brands),
    conditions: {
      refusalExplanation: refusal.explanation,
      refusalFeeCents: refusal.diagnosticFeeCents + refusal.returnFeeCents,
      unrepairableFeeCents: unrepairable.diagnosticFeeCents + unrepairable.returnFeeCents,
      quoteValidityDays: rules.quote_validity_days,
      cgvVersion: cgv?.version ?? null,
    },
  };
}
