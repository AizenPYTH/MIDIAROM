import "server-only";
import type { Json, Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addOrderEvent, getOrderById, SYSTEM_ACTOR, transitionOrder } from "@/lib/orders/service";
import { createShipmentLabel } from "@/lib/shipping/service";
import { notifyOrderEvent } from "@/lib/notifications";
import { trackServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { audit } from "@/lib/security/audit";
import { getPaymentProvider } from "@/lib/stripe";
import type { PaymentConfirmation } from "@/lib/stripe/types";
import { ROUTES, SITE_URL } from "@/config/site";
import { getShopOrderById, handleShopPaymentConfirmed } from "@/lib/shop/orders";

type Payment = Tables<"payments">;

/**
 * Single entry point that turns a PROVIDER-CONFIRMED payment into business
 * state. Called by the Stripe webhook, by the server-side session
 * verification fallback and by the dev-only mock. Idempotent.
 */
export async function confirmPayment(confirmation: PaymentConfirmation): Promise<{ status: "confirmed" | "already_confirmed" | "ignored"; payment: Payment | null }> {
  const db = createSupabaseAdminClient();
  const { data: payment } = await db.from("payments").select("*").eq("id", confirmation.paymentId).maybeSingle();
  if (!payment) {
    console.error("[payments] unknown payment", confirmation.paymentId);
    return { status: "ignored", payment: null };
  }
  if (payment.status === "SUCCEEDED") return { status: "already_confirmed", payment };

  if (confirmation.amountCents !== payment.amount_cents) {
    // Never accept a partial / different amount silently.
    await db.from("payments").update({ status: "FAILED", raw: { reason: "amount_mismatch", confirmation: confirmation.raw as Json } }).eq("id", payment.id);
    await audit({ actorId: null, actorRole: null, action: "payment.amount_mismatch", resourceType: "payments", resourceId: payment.id, orderId: payment.order_id ?? undefined, newValue: { expected: payment.amount_cents, received: confirmation.amountCents } });
    return { status: "ignored", payment };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from("payments")
    .update({
      status: "SUCCEEDED",
      succeeded_at: now,
      provider_session_id: confirmation.providerSessionId,
      provider_payment_id: confirmation.providerPaymentId,
      raw: confirmation.raw as Json,
    })
    .eq("id", payment.id)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();
  if (error || !updated) return { status: "already_confirmed", payment };

  // Commande boutique : encaissement, facture, stock et e-mail dédiés.
  if (payment.shop_order_id) {
    const shopOrder = await getShopOrderById(payment.shop_order_id);
    await db.from("shop_orders").update({ paid_cents: shopOrder.paid_cents + payment.amount_cents }).eq("id", shopOrder.id);
    const { data: shopItems } = await db.from("shop_order_items").select("label, quantity, unit_price_cents, total_cents").eq("order_id", shopOrder.id);
    await db.from("invoices").insert({
      order_id: null,
      shop_order_id: shopOrder.id,
      payment_id: payment.id,
      invoice_type: "SHOP",
      status: "PAID",
      amount_cents: payment.amount_cents,
      vat_cents: Math.round(payment.amount_cents - (payment.amount_cents * 10_000) / (10_000 + shopOrder.vat_rate_bp)),
      currency: payment.currency,
      lines: (shopItems ?? []) as unknown as Json,
    });
    await audit({ actorId: null, actorRole: null, action: "payment.succeeded", resourceType: "payments", resourceId: payment.id, newValue: { amount_cents: payment.amount_cents, purpose: "SHOP", shop_order_id: shopOrder.id } });
    await handleShopPaymentConfirmed(shopOrder.id);
    return { status: "confirmed", payment: updated };
  }
  if (!payment.order_id) return { status: "ignored", payment };

  const order = await getOrderById(payment.order_id);
  await db.from("repair_orders").update({ paid_cents: order.paid_cents + payment.amount_cents }).eq("id", order.id);

  // Invoice record (PDF generation / accounting sync can be plugged later).
  const { data: items } = await db.from("repair_order_items").select("label, quantity, unit_price_cents, total_cents").eq("order_id", order.id).eq("source", payment.purpose === "QUOTE" ? "QUOTE" : "INITIAL");
  await db.from("invoices").insert({
    order_id: order.id,
    payment_id: payment.id,
    invoice_type: payment.purpose === "QUOTE" ? "SUPPLEMENTARY" : "INITIAL",
    status: "PAID",
    amount_cents: payment.amount_cents,
    vat_cents: Math.round(payment.amount_cents - (payment.amount_cents * 10_000) / (10_000 + order.vat_rate_bp)),
    currency: payment.currency,
    lines: (items ?? []) as unknown as Json,
  });

  await audit({ actorId: null, actorRole: null, action: "payment.succeeded", resourceType: "payments", resourceId: payment.id, orderId: order.id, newValue: { amount_cents: payment.amount_cents, purpose: payment.purpose } });

  if (payment.purpose === "INITIAL") {
    await handleInitialPaymentConfirmed(order.id);
  } else if (payment.purpose === "QUOTE" && payment.quote_id) {
    await handleQuotePaymentConfirmed(order.id, payment.quote_id, payment.amount_cents);
  }
  return { status: "confirmed", payment: updated };
}

async function handleInitialPaymentConfirmed(orderId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  let order = await getOrderById(orderId);
  if (order.status === "PENDING_PAYMENT") {
    order = await transitionOrder({ orderId, to: "PAID", actor: SYSTEM_ACTOR, publicDescription: "Votre paiement est confirmé.", notify: false });
  }

  // Outbound label when the chosen shipping method includes it.
  let hasLabel = false;
  let trackingNumber: string | null = null;
  const { data: method } = order.shipping_method_id ? await db.from("shipping_methods").select("*").eq("id", order.shipping_method_id).maybeSingle() : { data: null };
  if (method?.includes_outbound && method.provider_code !== "none") {
    try {
      const shipment = await createShipmentLabel({ order, direction: "TO_WORKSHOP", actor: SYSTEM_ACTOR });
      hasLabel = Boolean(shipment.label_path);
      trackingNumber = shipment.tracking_number;
    } catch (error) {
      console.error("[payments] outbound label failed", error);
      await addOrderEvent({ orderId, type: "LABEL_FAILED", title: "Étiquette à générer manuellement", description: String(error), isPublic: false });
    }
  }

  if (order.status === "PAID") {
    order = await transitionOrder({ orderId, to: "AWAITING_SHIPMENT", actor: SYSTEM_ACTOR, publicDescription: "Emballez votre console et envoyez-la en suivant les instructions.", notify: false });
  }

  await notifyOrderEvent(order, { type: "ORDER_PAID", hasLabel });
  if (hasLabel && trackingNumber) await notifyOrderEvent(order, { type: "LABEL_AVAILABLE", trackingNumber });

  await trackServerEvent({
    event: ANALYTICS_EVENTS.PURCHASE,
    orderId: order.id,
    repairId: order.repair_id,
    userId: order.customer_id,
    sessionId: order.analytics_session_id,
    valueCents: order.total_cents,
    attribution: {
      utm_source: order.utm_source,
      utm_medium: order.utm_medium,
      utm_campaign: order.utm_campaign,
      utm_term: order.utm_term,
      utm_content: order.utm_content,
      landing_page: order.landing_page,
      referrer: order.referrer,
    },
  });
}

async function handleQuotePaymentConfirmed(orderId: string, quoteId: string, amountCents: number): Promise<void> {
  const db = createSupabaseAdminClient();
  const { data: quote } = await db.from("supplementary_quotes").update({ paid_at: new Date().toISOString() }).eq("id", quoteId).select("*").single();
  await addOrderEvent({ orderId, type: "QUOTE_PAID", title: `Complément réglé${quote ? ` — devis ${quote.quote_number}` : ""}`, metadata: { quote_id: quoteId, amount_cents: amountCents } });

  const { count: pending } = await db.from("supplementary_quotes").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("status", "SENT");
  const order = await getOrderById(orderId);
  if (order.status === "WAITING_CUSTOMER_APPROVAL" && (pending ?? 0) === 0) {
    await transitionOrder({ orderId, to: "APPROVED", actor: SYSTEM_ACTOR, publicDescription: "Votre accord et votre règlement sont enregistrés. L'intervention complémentaire est programmée.", notify: false });
  }
  await trackServerEvent({ event: ANALYTICS_EVENTS.QUOTE_PAID, orderId, repairId: order.repair_id, userId: order.customer_id, valueCents: amountCents });
}

/**
 * Creates the checkout for an ACCEPTED quote that requires payment.
 * Reuses a pending payment if one exists (idempotent).
 */
export async function createQuoteCheckout(quoteId: string, customerId: string): Promise<{ redirectUrl: string }> {
  const db = createSupabaseAdminClient();
  const { data: quote } = await db.from("supplementary_quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!quote) throw new Error("Devis introuvable");
  const order = await getOrderById(quote.order_id);
  if (order.customer_id !== customerId) throw new Error("Accès refusé");
  if (quote.status !== "ACCEPTED") throw new Error("Ce devis n'est pas accepté");
  if (quote.paid_at || !quote.requires_payment || quote.total_cents === 0) throw new Error("Aucun paiement attendu pour ce devis");

  const provider = getPaymentProvider();
  let { data: payment } = await db.from("payments").select("*").eq("quote_id", quote.id).eq("status", "PENDING").maybeSingle();
  if (!payment) {
    const { data: created, error } = await db
      .from("payments")
      .insert({ order_id: order.id, quote_id: quote.id, purpose: "QUOTE", provider: provider.code, amount_cents: quote.total_cents, currency: quote.currency, status: "PENDING" })
      .select("*")
      .single();
    if (error || !created) throw new Error("Initialisation du paiement impossible");
    payment = created;
  }
  const { data: items } = await db.from("supplementary_quote_items").select("*").eq("quote_id", quote.id);
  const successUrl = `${SITE_URL}${ROUTES.accountOrders}/${order.id}/devis/${quote.id}?paid=1&payment=${payment.id}`;
  const cancelUrl = `${SITE_URL}${ROUTES.accountOrders}/${order.id}/devis/${quote.id}?cancelled=1`;
  const session = await provider.createCheckout({
    paymentId: payment.id,
    orderId: order.id,
    orderNumber: order.order_number,
    purpose: "QUOTE",
    quoteId: quote.id,
    customerEmail: order.customer_email,
    amountCents: quote.total_cents,
    currency: quote.currency,
    description: `${order.order_number} — devis ${quote.quote_number}`,
    lineItems: (items ?? []).map((i) => ({ label: i.label, amountCents: i.unit_price_cents, quantity: i.quantity })),
    successUrl,
    cancelUrl,
  });
  await db.from("payments").update({ provider_session_id: session.providerSessionId }).eq("id", payment.id);
  return { redirectUrl: session.redirectUrl };
}

/** Fallback used by success pages: ask the provider whether the session is paid. */
export async function verifyPendingPayment(paymentId: string): Promise<boolean> {
  const db = createSupabaseAdminClient();
  const { data: payment } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return false;
  if (payment.status === "SUCCEEDED") return true;
  if (!payment.provider_session_id) return false;
  try {
    const confirmation = await getPaymentProvider().verifySession(payment.provider_session_id);
    if (!confirmation) return false;
    const result = await confirmPayment({ ...confirmation, paymentId: payment.id });
    return result.status !== "ignored";
  } catch (error) {
    console.error("[payments] verify failed", error);
    return false;
  }
}
