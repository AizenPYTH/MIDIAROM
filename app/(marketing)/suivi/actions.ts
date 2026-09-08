"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeOrderNumber } from "@/lib/orders/order-number";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/audit";
import { trackServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { ROUTES } from "@/config/site";

export type TrackingState = { error?: string } | null;

const schema = z.object({ order_number: z.string().min(1), email: z.string().trim().email("E-mail invalide") });

/**
 * Public tracking lookup: order number + e-mail must BOTH match. A number
 * alone never reveals anything. Rate limited. On success we redirect to the
 * token URL (the same one sent by e-mail).
 */
export async function lookupOrderAction(_prev: TrackingState, formData: FormData): Promise<TrackingState> {
  const meta = await requestMeta();
  if (!rateLimit(`tracking:${meta.ip ?? "unknown"}`, 10, 10 * 60_000).allowed) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  const parsed = schema.safeParse({ order_number: formData.get("order_number"), email: formData.get("email") });
  if (!parsed.success) return { error: "Numéro de dossier et e-mail requis." };
  const orderNumber = normalizeOrderNumber(parsed.data.order_number);
  if (!orderNumber) return { error: "Format de numéro invalide (ex : REP-000152)." };

  const { data } = await createSupabaseAdminClient()
    .from("repair_orders")
    .select("tracking_token")
    .eq("order_number", orderNumber)
    .eq("customer_email", parsed.data.email.toLowerCase())
    .maybeSingle();
  await trackServerEvent({ event: ANALYTICS_EVENTS.TRACKING_LOOKUP, properties: { found: Boolean(data) } });
  if (!data) return { error: "Aucun dossier ne correspond à ce numéro et cet e-mail." };
  redirect(`${ROUTES.tracking}/${data.tracking_token}`);
}
