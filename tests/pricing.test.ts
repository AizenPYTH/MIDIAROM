import { describe, expect, it } from "vitest";
import { computePrice, PricingError, vatIncluded } from "@/lib/pricing/engine";

const repair = { id: "r1", name: "Réparation HDMI PS5", priceCents: 5000, estimatedCostCents: 600 };
const cleaning = { id: "o1", name: "Nettoyage complet", priceCents: 2490 };
const fan = { id: "o2", name: "Nettoyage ventilateur", priceCents: 990 };
const exterior = { id: "o3", name: "Nettoyage extérieur", priceCents: 690 };
const preventive = { id: "o4", name: "Contrôle préventif", priceCents: 1490 };
const pack = { id: "p1", name: "Pack Entretien complet", priceCents: 3490, optionIds: ["o1", "o2", "o3"] };
const pack2 = { id: "p2", name: "Pack Premium", priceCents: 4990, optionIds: ["o1", "o4"] };
const shipping = { id: "s1", name: "Aller-retour", priceCents: 990 };

const base = {
  repair,
  availableOptions: [cleaning, fan, exterior, preventive],
  availablePacks: [pack, pack2],
  vatRateBp: 2000,
};

describe("computePrice", () => {
  it("computes the example from the spec: 50 + 24.90 + 34.90 + 9.90 = 119.70", () => {
    const result = computePrice({
      ...base,
      selectedOptionIds: ["o4"],
      selectedPackIds: ["p1"],
      shipping: { ...shipping, priceCents: 990 },
    });
    // 5000 + 3490 + 1490 + 990
    expect(result.subtotalCents).toBe(5000 + 3490 + 1490);
    expect(result.shippingCents).toBe(990);
    expect(result.totalCents).toBe(10970);
    expect(result.lines.map((l) => l.type)).toEqual(["REPAIR", "PACK", "OPTION", "SHIPPING"]);
  });

  it("matches the exact numeric example: repair 50 + option 24.90 + pack 34.90 + shipping 9.90", () => {
    const result = computePrice({
      ...base,
      availablePacks: [{ id: "p3", name: "Pack", priceCents: 3490, optionIds: ["o4"] }],
      selectedOptionIds: ["o1"],
      selectedPackIds: ["p3"],
      shipping,
    });
    expect(result.totalCents).toBe(11970);
  });

  it("never charges an option already bundled in a selected pack", () => {
    const result = computePrice({ ...base, selectedOptionIds: ["o1", "o2"], selectedPackIds: ["p1"], shipping: null });
    expect(result.totalCents).toBe(5000 + 3490);
    expect(result.warnings).toHaveLength(2);
    expect(result.lines.filter((l) => l.type === "OPTION")).toHaveLength(0);
  });

  it("rejects unknown or incompatible options", () => {
    expect(() =>
      computePrice({ ...base, selectedOptionIds: ["nope"], selectedPackIds: [], shipping: null }),
    ).toThrowError(PricingError);
  });

  it("rejects overlapping packs", () => {
    expect(() =>
      computePrice({ ...base, selectedOptionIds: [], selectedPackIds: ["p1", "p2"], shipping: null }),
    ).toThrow(/même prestation/);
  });

  it("de-duplicates selections", () => {
    const result = computePrice({ ...base, selectedOptionIds: ["o4", "o4"], selectedPackIds: [], shipping: null });
    expect(result.totalCents).toBe(5000 + 1490);
  });

  it("computes pack savings vs. separate options", () => {
    const result = computePrice({ ...base, selectedOptionIds: [], selectedPackIds: ["p1"], shipping: null });
    expect(result.packSavingsCents).toBe(2490 + 990 + 690 - 3490);
    expect(result.lines[1]?.includes).toEqual(["Nettoyage complet", "Nettoyage ventilateur", "Nettoyage extérieur"]);
  });

  it("refuses negative or non-integer amounts", () => {
    expect(() =>
      computePrice({ ...base, repair: { ...repair, priceCents: -1 }, selectedOptionIds: [], selectedPackIds: [], shipping: null }),
    ).toThrow(PricingError);
    expect(() =>
      computePrice({ ...base, repair: { ...repair, priceCents: 10.5 }, selectedOptionIds: [], selectedPackIds: [], shipping: null }),
    ).toThrow(PricingError);
  });

  it("computes VAT included", () => {
    expect(vatIncluded(12000, 2000)).toBe(2000);
    expect(vatIncluded(5000, 0)).toBe(0);
    const result = computePrice({ ...base, selectedOptionIds: [], selectedPackIds: [], shipping: null });
    expect(result.vatCents).toBe(833);
  });
});
