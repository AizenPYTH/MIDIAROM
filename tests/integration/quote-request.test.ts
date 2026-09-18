import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import type { Database } from "@/types/database";

/**
 * Le parcours de devis, sur une vraie base.
 *
 * Ce que les tests unitaires ne peuvent pas prouver vit ici : que la fonction
 * SQL verrouille, qu'un jeton d'un autre client ne décide rien, qu'un refus
 * archive son montant, et surtout qu'une demande de devis ne crée **aucune**
 * ligne de paiement. Ces règles sont dans la base : c'est là qu'il faut les
 * mettre à l'épreuve.
 *
 *   INTEGRATION=1 npm run test:integration
 */
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const d = enabled ? describe : describe.skip;

function admin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

const CUSTOMER_ID = "10000000-0000-4000-8000-000000000003";

/** Une demande de devis nue, telle que `createQuoteRequest` la crée. */
async function demandeDeDevis(db: ReturnType<typeof admin>, suffixe = "") {
  const { data: repair } = await db.from("repairs").select("id, name, model_id, fault_id, price_is_provisional").eq("price_is_provisional", true).eq("is_active", true).limit(1).single();
  const { data: model } = await db.from("console_models").select("id, name, brand_id, brand:brands(id, name)").eq("id", repair!.model_id).single();
  const { data: fault } = await db.from("faults").select("id, name").eq("id", repair!.fault_id).single();
  const { data: order, error } = await db
    .from("repair_orders")
    .insert({
      customer_id: CUSTOMER_ID,
      status: "QUOTE_REQUESTED",
      is_quote_request: true,
      brand_id: model!.brand_id,
      model_id: model!.id,
      fault_id: fault!.id,
      repair_id: repair!.id,
      brand_name: (model!.brand as unknown as { name: string }).name,
      model_name: model!.name,
      fault_name: fault!.name,
      repair_name: repair!.name,
      customer_first_name: "Test",
      customer_last_name: `Devis${suffixe}`,
      customer_email: `devis${suffixe || ""}@test.local`,
      shipping_address: {},
      customer_notes: "L'écran reste noir depuis la dernière mise à jour, le voyant clignote.",
      subtotal_cents: 0,
      shipping_cents: 0,
      total_cents: 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return order!;
}

/** Un devis envoyé avec son jeton, tel que `sendQuote` le produit. */
async function devisEnvoye(db: ReturnType<typeof admin>, orderId: string, totalCents = 8900) {
  const jeton = randomBytes(32).toString("base64url");
  const { data: quote, error } = await db
    .from("supplementary_quotes")
    .insert({
      order_id: orderId,
      status: "SENT",
      title: "Remplacement du port HDMI",
      total_cents: totalCents,
      requires_payment: false,
      is_required_for_repair: true,
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      decision_token: jeton,
      decision_token_expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  await db.from("supplementary_quote_items").insert({ quote_id: quote!.id, label: "Port HDMI + main d'œuvre", quantity: 1, unit_price_cents: totalCents, total_cents: totalCents });
  return { quote: quote!, jeton };
}

d("une demande de devis n'engage rien", () => {
  it("naît à zéro, sans paiement, et sans mode d'envoi", async () => {
    const db = admin();
    const order = await demandeDeDevis(db, "-zero");
    try {
      expect(order.status).toBe("QUOTE_REQUESTED");
      expect(order.is_quote_request).toBe(true);
      expect(order.total_cents).toBe(0);
      expect(order.shipping_method_id).toBeNull();

      // La règle centrale du parcours : aucune ligne de paiement n'existe.
      const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("order_id", order.id);
      expect(count).toBe(0);
    } finally {
      await db.from("repair_orders").delete().eq("id", order.id);
    }
  });
});

d("le jeton de décision", () => {
  it("accepte le devis, ajoute ses lignes au dossier et réclame alors la console", async () => {
    const db = admin();
    const order = await demandeDeDevis(db, "-ok");
    try {
      const { quote, jeton } = await devisEnvoye(db, order.id, 8900);
      await db.from("repair_orders").update({ status: "WAITING_CUSTOMER_APPROVAL" }).eq("id", order.id);

      const { data, error } = await db.rpc("decide_quote_by_token", { p_token: jeton, p_decision: "ACCEPTED" });
      expect(error).toBeNull();
      expect(data?.status).toBe("ACCEPTED");

      const { data: apres } = await db.from("repair_orders").select("status, total_cents").eq("id", order.id).single();
      // Le seul chemin par lequel une demande de devis réclame la console.
      expect(apres?.status).toBe("AWAITING_SHIPMENT");
      expect(apres?.total_cents).toBe(8900);

      const { data: lignes } = await db.from("repair_order_items").select("item_type, total_cents").eq("order_id", order.id).eq("source", "QUOTE");
      expect(lignes).toHaveLength(1);
      expect(lignes?.[0]?.item_type).toBe("QUOTE_ITEM");

      // Le jeton a servi : il n'ouvre plus rien.
      const { data: relu } = await db.from("supplementary_quotes").select("decision_token").eq("id", quote.id).single();
      expect(relu?.decision_token).toBeNull();
      const rejeu = await db.rpc("decide_quote_by_token", { p_token: jeton, p_decision: "ACCEPTED" });
      expect(rejeu.error).not.toBeNull();
    } finally {
      await db.from("repair_orders").delete().eq("id", order.id);
    }
  });

  it("archive le refus avec son montant, sa date et son motif, et n'expédie rien", async () => {
    const db = admin();
    const order = await demandeDeDevis(db, "-refus");
    try {
      const { quote, jeton } = await devisEnvoye(db, order.id, 12900);
      await db.from("repair_orders").update({ status: "WAITING_CUSTOMER_APPROVAL" }).eq("id", order.id);

      const motif = "Trop cher par rapport au prix d'une console d'occasion.";
      const { error } = await db.rpc("decide_quote_by_token", { p_token: jeton, p_decision: "REFUSED", p_comment: motif });
      expect(error).toBeNull();

      const { data: decision } = await db.from("quote_decisions").select("*").eq("quote_id", quote.id).single();
      expect(decision?.decision).toBe("REFUSED");
      expect(decision?.amount_cents).toBe(12900);
      expect(decision?.comment).toBe(motif);
      expect(decision?.decided_by).toBe(CUSTOMER_ID);
      expect(decision?.created_at).toBeTruthy();

      const { data: apres } = await db.from("repair_orders").select("status, total_cents").eq("id", order.id).single();
      expect(apres?.status).toBe("REFUSED_QUOTE");
      // Refuser ne facture rien : le total du dossier n'a pas bougé.
      expect(apres?.total_cents).toBe(0);
      const { count } = await db.from("shipments").select("id", { count: "exact", head: true }).eq("order_id", order.id);
      expect(count).toBe(0);
    } finally {
      await db.from("repair_orders").delete().eq("id", order.id);
    }
  });

  it("refuse un jeton inventé, tronqué ou vide", async () => {
    const db = admin();
    for (const faux of ["", "abc", randomBytes(32).toString("base64url")]) {
      const { error } = await db.rpc("decide_quote_by_token", { p_token: faux, p_decision: "ACCEPTED" });
      expect(error).not.toBeNull();
    }
  });

  it("refuse un devis qui n'attend plus de décision", async () => {
    const db = admin();
    const order = await demandeDeDevis(db, "-annule");
    try {
      const { quote, jeton } = await devisEnvoye(db, order.id);
      await db.from("supplementary_quotes").update({ status: "CANCELLED" }).eq("id", quote.id);
      const { error } = await db.rpc("decide_quote_by_token", { p_token: jeton, p_decision: "ACCEPTED" });
      expect(error).not.toBeNull();
    } finally {
      await db.from("repair_orders").delete().eq("id", order.id);
    }
  });

  it("refuse un jeton expiré", async () => {
    const db = admin();
    const order = await demandeDeDevis(db, "-expire");
    try {
      const { quote, jeton } = await devisEnvoye(db, order.id);
      await db.from("supplementary_quotes").update({ decision_token_expires_at: new Date(Date.now() - 864e5).toISOString() }).eq("id", quote.id);
      const { error } = await db.rpc("decide_quote_by_token", { p_token: jeton, p_decision: "ACCEPTED" });
      expect(error).not.toBeNull();
    } finally {
      await db.from("repair_orders").delete().eq("id", order.id);
    }
  });

  it("ne laisse pas le montant se décider côté navigateur", async () => {
    // La signature de la fonction n'accepte aucun montant : le total archivé
    // est toujours celui que la base relit sur le devis.
    const db = admin();
    const order = await demandeDeDevis(db, "-montant");
    try {
      const { quote, jeton } = await devisEnvoye(db, order.id, 4900);
      await db.from("repair_orders").update({ status: "WAITING_CUSTOMER_APPROVAL" }).eq("id", order.id);
      await db.rpc("decide_quote_by_token", { p_token: jeton, p_decision: "ACCEPTED" });
      const { data: decision } = await db.from("quote_decisions").select("amount_cents").eq("quote_id", quote.id).single();
      expect(decision?.amount_cents).toBe(4900);
    } finally {
      await db.from("repair_orders").delete().eq("id", order.id);
    }
  });
});

d("un client ne décide que pour lui", () => {
  it("refuse au client connecté le devis d'un autre dossier", async () => {
    const db = admin();
    const order = await demandeDeDevis(db, "-autrui");
    try {
      const { quote } = await devisEnvoye(db, order.id);
      // `decide_supplementary_quote` lit `auth.uid()`. Appelée avec la clé
      // anonyme, sans session, elle n'a pas d'identité : elle doit refuser
      // plutôt que de décider au nom du propriétaire du dossier.
      const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const { error } = await anon.rpc("decide_supplementary_quote", { p_quote_id: quote.id, p_decision: "ACCEPTED" });
      expect(error).not.toBeNull();

      const { data: intact } = await db.from("supplementary_quotes").select("status").eq("id", quote.id).single();
      expect(intact?.status).toBe("SENT");
    } finally {
      await db.from("repair_orders").delete().eq("id", order.id);
    }
  });
});
