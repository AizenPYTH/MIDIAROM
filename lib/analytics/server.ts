import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import type { Json } from "@/types/database";

/** Server-side conversion events (purchase, quote accepted…) — source of truth for revenue. */
export async function trackServerEvent(input: {
  event: AnalyticsEventName;
  orderId?: string | null;
  repairId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  valueCents?: number | null;
  properties?: Record<string, Json>;
  attribution?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
    landing_page?: string | null;
    referrer?: string | null;
  } | null;
}): Promise<void> {
  try {
    await createSupabaseAdminClient().from("analytics_events").insert({
      event_name: input.event,
      order_id: input.orderId ?? null,
      repair_id: input.repairId ?? null,
      user_id: input.userId ?? null,
      session_id: input.sessionId ?? null,
      value_cents: input.valueCents ?? null,
      properties: input.properties ?? {},
      utm_source: input.attribution?.utm_source ?? null,
      utm_medium: input.attribution?.utm_medium ?? null,
      utm_campaign: input.attribution?.utm_campaign ?? null,
      utm_term: input.attribution?.utm_term ?? null,
      utm_content: input.attribution?.utm_content ?? null,
      landing_page: input.attribution?.landing_page ?? null,
      referrer: input.attribution?.referrer ?? null,
    });
  } catch (error) {
    console.error("[analytics] server event failed", error);
  }
}
