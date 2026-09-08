import { describe, expect, it } from "vitest";
import { consequenceForOutcome, DEFAULT_BUSINESS_RULES, quoteExpiryDate, sumQuoteItems } from "@/lib/quotes/rules";

const rules = { ...DEFAULT_BUSINESS_RULES, diagnostic_fee_cents: 2900, refused_quote_return_fee_cents: 990, unrepairable_return_fee_cents: 0 };

describe("business rules", () => {
  it("deducts the diagnostic when the repair goes ahead (configurable)", () => {
    expect(consequenceForOutcome("REPAIRABLE", rules, false).diagnosticFeeCents).toBe(0);
    expect(consequenceForOutcome("REPAIRABLE", { ...rules, diagnostic_fee_deducted_when_repaired: false }, false).diagnosticFeeCents).toBe(2900);
  });

  it("applies refusal fees from configuration", () => {
    const c = consequenceForOutcome("QUOTE_REFUSED", rules, false);
    expect(c.diagnosticFeeCents).toBe(2900);
    expect(c.returnFeeCents).toBe(990);
  });

  it("does not charge the diagnostic twice on diagnostic-only orders", () => {
    expect(consequenceForOutcome("UNREPAIRABLE", rules, true).diagnosticFeeCents).toBe(0);
  });

  it("computes quote expiry and totals", () => {
    const sent = new Date("2026-09-08T10:00:00Z");
    expect(quoteExpiryDate(sent, { ...rules, quote_validity_days: 7 }).toISOString()).toBe("2026-09-15T10:00:00.000Z");
    expect(sumQuoteItems([{ quantity: 2, unitPriceCents: 1000 }, { quantity: 1, unitPriceCents: 500 }])).toBe(2500);
  });
});
