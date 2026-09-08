import { describe, expect, it } from "vitest";
import { isValidOrderNumber, normalizeOrderNumber } from "@/lib/orders/order-number";

describe("order number", () => {
  it("validates the REP-000001 format", () => {
    expect(isValidOrderNumber("REP-000001")).toBe(true);
    expect(isValidOrderNumber("REP-1")).toBe(false);
    expect(isValidOrderNumber("rep-000001")).toBe(false);
    expect(isValidOrderNumber("D-000001")).toBe(false);
  });

  it("normalises user input", () => {
    expect(normalizeOrderNumber(" rep-000152 ")).toBe("REP-000152");
    expect(normalizeOrderNumber("152")).toBe("REP-000152");
    expect(normalizeOrderNumber("REP 000152")).toBe("REP-000152");
    expect(normalizeOrderNumber("hello")).toBeNull();
  });
});
