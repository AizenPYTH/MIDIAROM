import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBusinessRules } from "@/lib/settings";
import { notifyOrderEvent } from "@/lib/notifications";
import { addOrderEvent, getOrderById, SYSTEM_ACTOR, transitionOrder } from "@/lib/orders/service";

/**
 * Daily maintenance job (call with `Authorization: Bearer CRON_SECRET`, e.g.
 * from Vercel Cron or any scheduler):
 *  - sends review requests N days after delivery,
 *  - expires supplementary quotes past their validity,
 *  - marks delivered orders as completed after the review delay + 14 days,
 *  - cancels unpaid orders older than 48 h.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const auth = request.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createSupabaseAdminClient();
  const rules = await getBusinessRules();
  const now = Date.now();
  const report = { reviewRequests: 0, expiredQuotes: 0, completed: 0, cancelledUnpaid: 0 };

  // 1. Review requests
  const reviewCutoff = new Date(now - rules.review_request_delay_days * 86_400_000).toISOString();
  const { data: toReview } = await db.from("reviews").select("id, order_id, review_token, order:repair_orders(*)").is("submitted_at", null).lte("created_at", reviewCutoff).limit(100);
  for (const r of toReview ?? []) {
    const order = r.order as Awaited<ReturnType<typeof getOrderById>> | null;
    if (!order || order.review_requested_at || !["DELIVERED", "COMPLETED"].includes(order.status)) continue;
    await notifyOrderEvent(order, { type: "REVIEW_REQUEST", reviewToken: r.review_token });
    await db.from("repair_orders").update({ review_requested_at: new Date().toISOString() }).eq("id", order.id);
    await addOrderEvent({ orderId: order.id, type: "REVIEW_REQUESTED", title: "Demande d'avis envoyée", isPublic: false });
    report.reviewRequests += 1;
  }

  // 2. Expire quotes
  const { data: expired } = await db.from("supplementary_quotes").select("id, order_id, quote_number").eq("status", "SENT").lt("expires_at", new Date().toISOString()).limit(100);
  for (const q of expired ?? []) {
    await db.from("supplementary_quotes").update({ status: "EXPIRED" }).eq("id", q.id);
    await addOrderEvent({ orderId: q.order_id, type: "QUOTE_EXPIRED", title: `Devis ${q.quote_number} expiré`, description: "Sans réponse dans le délai de validité. Contactez-nous pour le renouveler." });
    report.expiredQuotes += 1;
  }

  // 3. Auto-complete delivered orders
  const completeCutoff = new Date(now - (rules.review_request_delay_days + 14) * 86_400_000).toISOString();
  const { data: delivered } = await db.from("repair_orders").select("id").eq("status", "DELIVERED").lte("delivered_at", completeCutoff).limit(100);
  for (const o of delivered ?? []) {
    try {
      await transitionOrder({ orderId: o.id, to: "COMPLETED", actor: SYSTEM_ACTOR, reason: "Clôture automatique", notify: false });
      report.completed += 1;
    } catch (error) {
      console.error("[cron] complete failed", error);
    }
  }

  // 4. Cancel abandoned unpaid orders
  const unpaidCutoff = new Date(now - 48 * 3_600_000).toISOString();
  const { data: unpaid } = await db.from("repair_orders").select("id").eq("status", "PENDING_PAYMENT").lte("created_at", unpaidCutoff).limit(100);
  for (const o of unpaid ?? []) {
    try {
      await transitionOrder({ orderId: o.id, to: "CANCELLED", actor: SYSTEM_ACTOR, reason: "Paiement non finalisé sous 48 h", notify: false });
      report.cancelledUnpaid += 1;
    } catch (error) {
      console.error("[cron] cancel failed", error);
    }
  }

  return NextResponse.json({ ok: true, ...report });
}
