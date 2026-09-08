import { NextResponse } from "next/server";
import { z } from "zod";
import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics/events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security/rate-limit";
import { getCurrentUser } from "@/lib/security/auth";

const schema = z.object({
  event_name: z.enum(ANALYTICS_EVENT_NAMES as [string, ...string[]]),
  session_id: z.string().max(64),
  path: z.string().max(512).nullable().optional(),
  referrer: z.string().max(1024).nullable().optional(),
  landing_page: z.string().max(512).nullable().optional(),
  utm_source: z.string().max(128).nullable().optional(),
  utm_medium: z.string().max(128).nullable().optional(),
  utm_campaign: z.string().max(256).nullable().optional(),
  utm_term: z.string().max(256).nullable().optional(),
  utm_content: z.string().max(256).nullable().optional(),
  value_cents: z.number().int().nonnegative().nullable().optional(),
  order_id: z.string().uuid().nullable().optional(),
  repair_id: z.string().uuid().nullable().optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`analytics:${ip}`, 120, 60_000);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await getCurrentUser().catch(() => null);
  const data = parsed.data;
  const { error } = await createSupabaseAdminClient().from("analytics_events").insert({
    event_name: data.event_name,
    session_id: data.session_id,
    user_id: user?.id ?? null,
    path: data.path ?? null,
    referrer: data.referrer ?? null,
    landing_page: data.landing_page ?? null,
    utm_source: data.utm_source ?? null,
    utm_medium: data.utm_medium ?? null,
    utm_campaign: data.utm_campaign ?? null,
    utm_term: data.utm_term ?? null,
    utm_content: data.utm_content ?? null,
    value_cents: data.value_cents ?? null,
    order_id: data.order_id ?? null,
    repair_id: data.repair_id ?? null,
    properties: data.properties ?? {},
  });
  if (error) console.error("[analytics] insert failed", error.message);
  return NextResponse.json({ ok: true });
}
