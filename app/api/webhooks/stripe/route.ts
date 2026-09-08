import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getServerEnv } from "@/lib/env";
import { getPaymentProvider } from "@/lib/stripe";
import { StripePaymentProvider, confirmationFromSession } from "@/lib/stripe/providers/stripe";
import { confirmPayment } from "@/lib/orders/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Stripe webhook: the ONLY trusted source of payment confirmation in
 * production. Signature verified, events de-duplicated in
 * payment_provider_events.
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  const provider = getPaymentProvider();
  if (!(provider instanceof StripePaymentProvider) || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = provider.constructWebhookEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("[stripe] invalid signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: existing } = await db.from("payment_provider_events").select("id, processed_at").eq("id", event.id).maybeSingle();
  if (existing?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  await db.from("payment_provider_events").upsert({ id: event.id, provider: "stripe", event_type: event.type, payload: event as unknown as Json });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status === "paid") {
          const confirmation = confirmationFromSession(session);
          if (confirmation) await confirmPayment(confirmation);
        }
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object;
        const paymentId = session.metadata?.payment_id ?? session.client_reference_id;
        if (paymentId) {
          await db.from("payments").update({ status: event.type === "checkout.session.expired" ? "CANCELLED" : "FAILED" }).eq("id", paymentId).eq("status", "PENDING");
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intentId) {
          const refunded = charge.amount_refunded ?? 0;
          await db
            .from("payments")
            .update({ refunded_cents: refunded, status: refunded >= charge.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" })
            .eq("provider_payment_id", intentId);
        }
        break;
      }
      default:
        break;
    }
    await db.from("payment_provider_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  } catch (error) {
    console.error("[stripe] handler failed", error);
    await db.from("payment_provider_events").update({ error: String(error) }).eq("id", event.id);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
