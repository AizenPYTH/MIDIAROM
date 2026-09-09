import { describe, expect, it } from "vitest";
import { canShopTransition, computeShopTotals, normalizeCart, shopStatusLabel, stockLabel, stockState } from "@/lib/shop/status";
import { computeWorkshopTimeline, workshopStepIndex } from "@/lib/orders/status";

const lines = [
  { productId: "a", quantity: 2, unitPriceCents: 1000 },
  { productId: "b", quantity: 1, unitPriceCents: 5990 },
];

describe("computeShopTotals", () => {
  it("adds shipping below the free-shipping threshold", () => {
    const t = computeShopTotals({ lines, fulfillment: "SHIPPING", shippingFeeCents: 690, freeShippingThresholdCents: 10000, vatRateBp: 2000 });
    expect(t.subtotalCents).toBe(7990);
    expect(t.shippingCents).toBe(690);
    expect(t.totalCents).toBe(8680);
    expect(t.freeShippingReached).toBe(false);
    // VAT is included in the price: total = ht * 1.2
    expect(t.vatCents).toBe(Math.round(8680 - (8680 * 10_000) / 12_000));
  });
  it("offers shipping once the threshold is reached", () => {
    const t = computeShopTotals({ lines, fulfillment: "SHIPPING", shippingFeeCents: 690, freeShippingThresholdCents: 7000, vatRateBp: 2000 });
    expect(t.shippingCents).toBe(0);
    expect(t.freeShippingReached).toBe(true);
    expect(t.totalCents).toBe(7990);
  });
  it("never charges shipping for pickup", () => {
    const t = computeShopTotals({ lines, fulfillment: "PICKUP", shippingFeeCents: 690, freeShippingThresholdCents: null, vatRateBp: 2000 });
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(7990);
  });
});

describe("normalizeCart", () => {
  it("merges duplicates, drops invalid quantities and caps per line", () => {
    const cart = normalizeCart([
      { productId: "a", quantity: 1 },
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 0 },
      { productId: "c", quantity: -3 },
      { productId: "d", quantity: 999 },
    ]);
    expect(cart.find((l) => l.productId === "a")?.quantity).toBe(3);
    expect(cart.some((l) => l.productId === "b")).toBe(false);
    expect(cart.some((l) => l.productId === "c")).toBe(false);
    expect(cart.find((l) => l.productId === "d")?.quantity).toBeLessThanOrEqual(99);
  });
});

describe("stock", () => {
  it("classifies availability", () => {
    expect(stockState(0, 2)).toBe("OUT");
    expect(stockState(1, 2)).toBe("LOW");
    expect(stockState(2, 2)).toBe("LOW");
    expect(stockState(3, 2)).toBe("IN_STOCK");
    expect(stockLabel(0, 2, "NEW")).toMatch(/rupture/i);
    expect(stockLabel(1, 2, "USED_B")).toMatch(/unique/i);
  });
});

describe("shop order status", () => {
  it("follows the fulfillment-aware labels", () => {
    expect(shopStatusLabel("PREPARED", "PICKUP")).toMatch(/retrait/i);
    expect(shopStatusLabel("SHIPPED", "SHIPPING")).toMatch(/exp/i);
  });
  it("allows only the documented transitions", () => {
    expect(canShopTransition("PENDING", "PAID")).toBe(true);
    expect(canShopTransition("PAID", "PREPARED")).toBe(true);
    expect(canShopTransition("PREPARED", "SHIPPED")).toBe(true);
    expect(canShopTransition("SHIPPED", "DELIVERED")).toBe(true);
    expect(canShopTransition("DELIVERED", "PAID")).toBe(false);
    expect(canShopTransition("PENDING", "SHIPPED")).toBe(false);
    expect(canShopTransition("CANCELLED", "PAID")).toBe(false);
  });
});

describe("workshop timeline", () => {
  it("maps statuses to the 8 workshop steps", () => {
    expect(workshopStepIndex("PAID")).toBe(-1);
    expect(workshopStepIndex("RECEIVED")).toBe(0);
    expect(workshopStepIndex("DIAGNOSIS")).toBe(1);
    expect(workshopStepIndex("WAITING_CUSTOMER_APPROVAL")).toBe(2);
    expect(workshopStepIndex("APPROVED")).toBe(3);
    expect(workshopStepIndex("QUALITY_CONTROL")).toBe(4);
    expect(workshopStepIndex("READY_TO_SHIP")).toBe(5);
    expect(workshopStepIndex("DELIVERED")).toBe(6);
    expect(workshopStepIndex("COMPLETED")).toBe(7);
  });
  it("marks previous steps done and the current one current", () => {
    const t = computeWorkshopTimeline("REPAIRING");
    expect(t.map((s) => s.state)).toEqual(["done", "done", "done", "done", "current", "todo", "todo", "todo"]);
    expect(computeWorkshopTimeline("COMPLETED").every((s) => s.state === "done")).toBe(true);
    expect(computeWorkshopTimeline("PAID").every((s) => s.state === "todo")).toBe(true);
  });
});
