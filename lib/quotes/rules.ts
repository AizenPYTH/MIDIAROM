import type { Enums } from "@/types/database";

/**
 * Business rules for diagnostics, refusals and unrepairable consoles.
 * Values come from site_settings.business_rules (admin editable) — nothing
 * is hard-coded. These helpers compute what applies, they never charge.
 */
export interface BusinessRules {
  vat_rate_bp: number;
  prices_include_vat: boolean;
  diagnostic_fee_cents: number;
  diagnostic_fee_deducted_when_repaired: boolean;
  refused_quote_return_fee_cents: number;
  unrepairable_return_fee_cents: number;
  no_fault_found_fee_cents: number;
  quote_validity_days: number;
  review_request_delay_days: number;
  unclaimed_console_days: number;
}

export const DEFAULT_BUSINESS_RULES: BusinessRules = {
  vat_rate_bp: 2000,
  prices_include_vat: true,
  diagnostic_fee_cents: 0,
  diagnostic_fee_deducted_when_repaired: true,
  refused_quote_return_fee_cents: 0,
  unrepairable_return_fee_cents: 0,
  no_fault_found_fee_cents: 0,
  quote_validity_days: 7,
  review_request_delay_days: 3,
  unclaimed_console_days: 90,
};

export type DiagnosticOutcome = Enums<"diagnostic_outcome">;

export interface OutcomeConsequence {
  /** Amount the customer keeps paying / owes for the diagnostic step. */
  diagnosticFeeCents: number;
  /** Extra return fee to charge, if any. */
  returnFeeCents: number;
  /** Customer facing explanation. */
  explanation: string;
}

/**
 * What happens financially when a repair does NOT go ahead.
 * `alreadyPaidCents` is what the customer paid at order time (diagnostic-only
 * orders already cover the diagnostic fee).
 */
export function consequenceForOutcome(
  outcome: DiagnosticOutcome | "QUOTE_REFUSED",
  rules: BusinessRules,
  isDiagnosticOnlyOrder: boolean,
): OutcomeConsequence {
  const diagnosticFeeCents = isDiagnosticOnlyOrder ? 0 : rules.diagnostic_fee_cents;
  switch (outcome) {
    case "UNREPAIRABLE":
    case "NOT_ECONOMICAL":
      return {
        diagnosticFeeCents,
        returnFeeCents: rules.unrepairable_return_fee_cents,
        explanation:
          "La réparation n'est pas possible ou n'est pas rentable. Les frais de diagnostic et de retour éventuels s'appliquent selon les conditions affichées avant la commande.",
      };
    case "NO_FAULT_FOUND":
      return {
        diagnosticFeeCents: isDiagnosticOnlyOrder ? 0 : rules.no_fault_found_fee_cents,
        returnFeeCents: 0,
        explanation: "Aucune panne n'a été constatée après tests. La console vous est retournée.",
      };
    case "QUOTE_REFUSED":
      return {
        diagnosticFeeCents,
        returnFeeCents: rules.refused_quote_return_fee_cents,
        explanation:
          "Vous avez refusé le devis. La console vous est retournée ; les frais de diagnostic et de retour éventuels s'appliquent selon les conditions en vigueur.",
      };
    case "REPAIRABLE":
    case "FURTHER_DIAGNOSIS_NEEDED":
    default:
      return {
        diagnosticFeeCents: rules.diagnostic_fee_deducted_when_repaired ? 0 : diagnosticFeeCents,
        returnFeeCents: 0,
        explanation: rules.diagnostic_fee_deducted_when_repaired
          ? "Le diagnostic est inclus dans la réparation."
          : "Le diagnostic est facturé en plus de la réparation.",
      };
  }
}

export function quoteExpiryDate(sentAt: Date, rules: BusinessRules): Date {
  const d = new Date(sentAt);
  d.setDate(d.getDate() + Math.max(1, rules.quote_validity_days));
  return d;
}

export function sumQuoteItems(items: readonly { quantity: number; unitPriceCents: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
}
