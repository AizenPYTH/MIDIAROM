"use server";

import { z } from "zod";
import { createTradeInRequest, decideTradeIn, tradeInRequestSchema } from "@/lib/tradein/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/audit";

export type TradeInFormState = { ok: true; requestNumber: string; redirectUrl: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createTradeInAction(input: unknown): Promise<TradeInFormState> {
  const meta = await requestMeta();
  const limit = rateLimit(`trade-in:${meta.ip ?? "unknown"}`, 10, 10 * 60_000);
  if (!limit.allowed) return { ok: false, error: "Trop de tentatives. Merci de patienter quelques minutes." };
  const parsed = tradeInRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Merci de corriger les champs signalés.", fieldErrors };
  }
  try {
    const user = await getCurrentUser();
    const request = await createTradeInRequest(parsed.data, user);
    return { ok: true, requestNumber: request.request_number, redirectUrl: `/reprise/confirmation/${request.id}?token=${request.access_token}` };
  } catch (error) {
    console.error("[trade-in] create failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "Une erreur est survenue. Merci de réessayer." };
  }
}

const decisionSchema = z.object({ token: z.string().min(20).max(80), accepted: z.boolean(), note: z.string().trim().max(500).optional().or(z.literal("")) });

/** Décision du client depuis le lien de suivi (jeton) ou l'espace client. */
export async function decideTradeInAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide" };
  const db = createSupabaseAdminClient();
  const { data: request } = await db.from("trade_in_requests").select("id").eq("access_token", parsed.data.token).maybeSingle();
  if (!request) return { ok: false, error: "Demande introuvable" };
  try {
    const user = await getCurrentUser();
    await decideTradeIn({ id: request.id, accepted: parsed.data.accepted, note: parsed.data.note || null, actorId: user?.id ?? null });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Décision impossible" };
  }
}
