import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Runs against a live Supabase-compatible stack (INTEGRATION=1).
 * Verifies what unit tests cannot: that the backend refuses manipulated
 * selections, and that order / quote / invoice numbers stay unique under
 * concurrent inserts.
 */
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const d = enabled ? describe : describe.skip;

function admin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

const CUSTOMER_ID = "10000000-0000-4000-8000-000000000003"; // seed dev customer

d("server-side pricing and compatibility guards", () => {
  let getRepairById: typeof import("@/lib/repair/catalog").getRepairById;
  let getRepairOffer: typeof import("@/lib/repair/catalog").getRepairOffer;
  let priceSelection: typeof import("@/lib/pricing/service").priceSelection;
  let createOrderAndCheckout: typeof import("@/lib/orders/create-order").createOrderAndCheckout;

  /**
   * Résout une prestation par (modèle, panne) plutôt que par identifiant.
   *
   * Les prestations de démonstration du seed (46000000-…) ne survivent pas à
   * supabase/cleanup-strict-pdf.sql : après remise au périmètre du catalogue
   * client, seules restent les prestations du document et celles de la gamme
   * PS5. Figer leurs identifiants faisait échouer ces tests sur toute base
   * réellement à jour.
   */
  async function repairIdFor(modelSlug: string, faultSlug: string): Promise<string> {
    const { data } = await admin()
      .from("repairs")
      .select("id, model:console_models!inner(slug), fault:faults!inner(slug)")
      .eq("is_active", true)
      .eq("console_models.slug", modelSlug)
      .eq("faults.slug", faultSlug)
      .limit(1)
      .maybeSingle();
    if (!data?.id) throw new Error(`Prestation introuvable au catalogue : ${modelSlug} / ${faultSlug}`);
    return data.id;
  }

  beforeAll(async () => {
    ({ getRepairById, getRepairOffer } = await import("@/lib/repair/catalog"));
    ({ priceSelection } = await import("@/lib/pricing/service"));
    ({ createOrderAndCheckout } = await import("@/lib/orders/create-order"));
    const { data } = await admin()
      .from("repairs")
      .select("id, model:console_models!inner(slug)")
      .eq("is_active", true)
      .eq("console_models.slug", "switch")
      .limit(1)
      .maybeSingle();
    switchRepairId = data?.id ?? "";
    ps5HdmiId = await repairIdFor("ps5", "port-hdmi-endommage");
    ps5ThermalId = await repairIdFor("ps5", "surchauffe");
  });

  // Le catalogue de réparation du client (PDF) fait foi pour la Switch : la
  // prestation de test est donc résolue dynamiquement plutôt que figée sur un
  // identifiant du seed, qui peut être désactivé au profit du catalogue client.
  let switchRepairId = "";
  let ps5HdmiId = "";
  let ps5ThermalId = "";
  const LIQUID_METAL = "44000000-0000-4000-8000-000000000006"; // PS5 only
  const SSD = "44000000-0000-4000-8000-000000000011"; // PS5 only
  const CLEANING = "44000000-0000-4000-8000-000000000002";
  const DUSTING = "44000000-0000-4000-8000-000000000001";
  const CONNECTORS = "44000000-0000-4000-8000-000000000007";
  const PACK_ENTRETIEN = "45000000-0000-4000-8000-000000000001";
  const SHIPPING_LABEL = "47000000-0000-4000-8000-000000000001";

  it("prices PS5 HDMI + option + shipping exactly like the UI (79,80 €)", async () => {
    // Les 1 189 prestations du catalogue arrivent « sur devis » : le tarif est
    // posé ici le temps du test, puis rendu à son état d'origine. L'assertion
    // porte sur l'arithmétique du moteur, pas sur le prix saisi par l'atelier.
    const db = admin();
    const { data: before } = await db.from("repairs").select("price_cents, price_is_provisional").eq("id", ps5HdmiId).single();
    await db.from("repairs").update({ price_cents: 5000, price_is_provisional: false }).eq("id", ps5HdmiId);
    try {
      const repair = await getRepairById(ps5HdmiId);
      const offer = await getRepairOffer(repair!);
      // 50,00 € (prestation) + 14,90 € (contrôle des connectiques) + 14,90 €
      // (étiquette aller-retour) = 79,80 €, dont 13,30 € de TVA à 20 %.
      const result = await priceSelection(offer, { optionIds: [CONNECTORS], packIds: [], shippingMethodId: SHIPPING_LABEL });
      expect(result.totalCents).toBe(7980);
      expect(result.vatCents).toBe(1330);
    } finally {
      await db.from("repairs").update({ price_cents: before!.price_cents, price_is_provisional: before!.price_is_provisional }).eq("id", ps5HdmiId);
    }
  });

  it("refuses an option that is not compatible with the console (PS5-only option on a Switch)", async () => {
    const repair = await getRepairById(switchRepairId);
    const offer = await getRepairOffer(repair!);
    expect(offer.options.map((o) => o.id)).not.toContain(LIQUID_METAL);
    await expect(priceSelection(offer, { optionIds: [LIQUID_METAL], packIds: [], shippingMethodId: SHIPPING_LABEL })).rejects.toThrow(/incompatible/);
    await expect(priceSelection(offer, { optionIds: [SSD], packIds: [], shippingMethodId: SHIPPING_LABEL })).rejects.toThrow(/incompatible/);
  });

  it("never sells an option already included in the repair, nor a pack containing it", async () => {
    // Une réparation de surchauffe PS5 comprend le métal liquide et le
    // dépoussiérage : ni l'un ni l'autre, ni un pack qui les contient, ne doit
    // pouvoir être revendu par-dessus. Les inclusions sont posées ici puis
    // retirées — le catalogue client n'en déclare aucune.
    const db = admin();
    await db.from("repair_included_options").upsert(
      [LIQUID_METAL, DUSTING].map((option_id) => ({ repair_id: ps5ThermalId, option_id })),
      { onConflict: "repair_id,option_id" },
    );
    try {
      const repair = await getRepairById(ps5ThermalId);
      const offer = await getRepairOffer(repair!);
      expect(offer.includedOptionIds).toContain(LIQUID_METAL);
      expect(offer.options.map((o) => o.id)).not.toContain(LIQUID_METAL);
      expect(offer.packs.map((p) => p.id)).not.toContain(PACK_ENTRETIEN);
      await expect(priceSelection(offer, { optionIds: [], packIds: [PACK_ENTRETIEN], shippingMethodId: SHIPPING_LABEL })).rejects.toThrow(/Pack inconnu/);
    } finally {
      await db.from("repair_included_options").delete().eq("repair_id", ps5ThermalId).in("option_id", [LIQUID_METAL, DUSTING]);
    }
  });

  it("refuses inactive options and packs even when their ids are known", async () => {
    const db = admin();
    await db.from("repair_options").update({ is_active: false }).eq("id", CLEANING);
    await db.from("packs").update({ is_active: false }).eq("id", PACK_ENTRETIEN);
    try {
      const repair = await getRepairById(ps5HdmiId);
      const offer = await getRepairOffer(repair!);
      expect(offer.options.map((o) => o.id)).not.toContain(CLEANING);
      await expect(priceSelection(offer, { optionIds: [CLEANING], packIds: [], shippingMethodId: SHIPPING_LABEL })).rejects.toThrow();
      await expect(priceSelection(offer, { optionIds: [], packIds: [PACK_ENTRETIEN], shippingMethodId: SHIPPING_LABEL })).rejects.toThrow();
    } finally {
      await db.from("repair_options").update({ is_active: true }).eq("id", CLEANING);
      await db.from("packs").update({ is_active: true }).eq("id", PACK_ENTRETIEN);
    }
  });

  it("refuses an unknown shipping method and an incompatible option at order creation", async () => {
    const base = {
      customer: { first_name: "Test", last_name: "Injection", email: `injection-${Date.now()}@example.com`, phone: "" },
      address: { line1: "1 rue Test", line2: "", postal_code: "75001", city: "Paris", country_code: "FR" as const },
      customer_notes: "",
      console_serial_number: "",
      console_already_opened: false,
      accept_terms: true as const,
      attribution: null,
      symptoms: [] as string[],
      photos: [] as string[],
    };
    await expect(createOrderAndCheckout({ ...base, selection: { repairId: switchRepairId, optionIds: [LIQUID_METAL], packIds: [], shippingMethodId: SHIPPING_LABEL } }, null)).rejects.toThrow(/incompatible/);
    await expect(createOrderAndCheckout({ ...base, selection: { repairId: ps5HdmiId, optionIds: [], packIds: [], shippingMethodId: "00000000-0000-4000-8000-000000000000" } }, null)).rejects.toThrow();
    // Nothing must have been persisted for these refused attempts.
    const { data } = await admin().from("repair_orders").select("id").eq("customer_email", base.customer.email);
    expect(data ?? []).toHaveLength(0);
  });
});

d("unique numbers under concurrency", () => {
  it("generates distinct sequential REP numbers for 20 concurrent orders", async () => {
    const db = admin();
    const rows = Array.from({ length: 20 }, (_, i) => ({
      customer_id: CUSTOMER_ID,
      status: "PENDING_PAYMENT" as const,
      brand_name: "PlayStation",
      model_name: "PS5",
      fault_name: "HDMI",
      repair_name: `Concurrence ${i}`,
      customer_first_name: "C",
      customer_last_name: "C",
      customer_email: "client@example.com",
      shipping_address: { line1: "x", postal_code: "75001", city: "Paris", country_code: "FR" },
    }));
    const results = await Promise.all(rows.map((r) => db.from("repair_orders").insert(r).select("id, order_number").single()));
    const numbers = results.map((r) => r.data!.order_number);
    expect(new Set(numbers).size).toBe(20);
    expect(numbers.every((n) => /^REP-\d{6}$/.test(n))).toBe(true);
    const sorted = numbers.map((n) => Number(n.slice(4))).sort((a, b) => a - b);
    expect(sorted[sorted.length - 1]! - sorted[0]!).toBe(19);
    await db.from("repair_orders").delete().in("id", results.map((r) => r.data!.id));
  });

  it("generates distinct quote and invoice numbers concurrently", async () => {
    const db = admin();
    const { data: order } = await db.from("repair_orders").select("id").limit(1).single();
    const quotes = await Promise.all(Array.from({ length: 10 }, (_, i) => db.from("supplementary_quotes").insert({ order_id: order!.id, title: `Q${i}`, status: "DRAFT" }).select("id, quote_number").single()));
    const qn = quotes.map((q) => q.data!.quote_number);
    expect(new Set(qn).size).toBe(10);
    expect(qn.every((n) => /^D-\d{6}$/.test(n))).toBe(true);
    const invoices = await Promise.all(Array.from({ length: 10 }, () => db.from("invoices").insert({ order_id: order!.id, amount_cents: 100, status: "DRAFT" }).select("id, invoice_number").single()));
    const inv = invoices.map((i) => i.data!.invoice_number);
    expect(new Set(inv).size).toBe(10);
    expect(inv.every((n) => /^F-\d{4}-\d{6}$/.test(n))).toBe(true);
    await db.from("supplementary_quotes").delete().in("id", quotes.map((q) => q.data!.id));
    await db.from("invoices").delete().in("id", invoices.map((i) => i.data!.id));
  });
});
