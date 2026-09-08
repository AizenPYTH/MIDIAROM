import { describe, expect, it } from "vitest";
import { canRoleTransition, canTransition, computeTimeline, ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orders/status";

describe("order status machine", () => {
  it("follows the happy path", () => {
    const path = [
      "PENDING_PAYMENT", "PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS",
      "WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "QUALITY_CONTROL", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it("refuses skipping critical steps", () => {
    expect(canTransition("PAID", "SHIPPED")).toBe(false);
    expect(canTransition("DIAGNOSIS", "SHIPPED")).toBe(false);
    expect(canTransition("REPAIRING", "SHIPPED")).toBe(false); // must pass QC + READY_TO_SHIP
    expect(canTransition("PENDING_PAYMENT", "AWAITING_SHIPMENT")).toBe(false); // must be PAID first
    expect(canTransition("COMPLETED", "REPAIRING")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
  });

  it("technicians cannot perform admin-only transitions", () => {
    expect(canRoleTransition("TECHNICIAN", "REPAIRING", "QUALITY_CONTROL")).toBe(true);
    expect(canRoleTransition("TECHNICIAN", "AWAITING_SHIPMENT", "CANCELLED")).toBe(false);
    expect(canRoleTransition("ADMIN", "AWAITING_SHIPMENT", "CANCELLED")).toBe(true);
    expect(canRoleTransition("CUSTOMER", "REPAIRING", "QUALITY_CONTROL")).toBe(false);
  });

  it("has a label for every status", () => {
    for (const s of ORDER_STATUSES) expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
  });

  it("computes the customer timeline", () => {
    const t = computeTimeline("REPAIRING");
    expect(t.map((s) => s.state)).toEqual(["done", "done", "done", "done", "current", "todo", "todo", "todo"]);
    expect(computeTimeline("COMPLETED").every((s) => s.state === "done")).toBe(true);
    expect(computeTimeline("PAID")[0]?.state).toBe("current");
  });
});
