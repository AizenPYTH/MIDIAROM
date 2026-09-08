"use server";

import { redirect } from "next/navigation";
import { isMockPayments } from "@/lib/stripe";
import { confirmPayment } from "@/lib/orders/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isProduction } from "@/lib/env";

/**
 * DEVELOPMENT ONLY — simulates the provider confirming a payment. Goes
 * through the exact same `confirmPayment` path as the Stripe webhook.
 */
export async function simulatePaymentAction(formData: FormData) {
  if (isProduction() || !isMockPayments()) throw new Error("Payment simulation is disabled");
  const paymentId = String(formData.get("payment") ?? "");
  const sessionId = String(formData.get("session") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const successUrl = String(formData.get("success") ?? "/");
  const cancelUrl = String(formData.get("cancel") ?? "/");

  const db = createSupabaseAdminClient();
  const { data: payment } = await db.from("payments").select("*").eq("id", paymentId).eq("provider_session_id", sessionId).maybeSingle();
  if (!payment) throw new Error("Unknown payment session");

  if (outcome === "success") {
    await confirmPayment({
      providerSessionId: sessionId,
      providerPaymentId: `mock_pi_${payment.id}`,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      paymentId: payment.id,
      raw: { simulated: true, at: new Date().toISOString() },
    });
    redirect(successUrl);
  }
  await db.from("payments").update({ status: "CANCELLED" }).eq("id", payment.id).eq("status", "PENDING");
  redirect(cancelUrl);
}
