import "server-only";
import { z } from "zod";
import type { Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { moveDraftPhotos, signCustomerMedia } from "@/lib/media/drafts";
import { canTradeInTransition, type TradeInStatus } from "@/lib/tradein/status";
import { emailBrand, sendCustomerEmail } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { customerSchema } from "@/lib/orders/schemas";
import * as T from "@/emails/templates";
import { ROUTES, SITE_URL } from "@/config/site";
import { formatDate } from "@/lib/utils/format";
import type { CurrentUser } from "@/lib/security/auth";

export type TradeIn = Tables<"trade_in_requests">;
export type TradeInEvent = Tables<"trade_in_events">;

export const tradeInRequestSchema = z.object({
  item_type: z.enum(["CONSOLE", "GAME", "ACCESSORY", "LOT"]),
  platform: z.string().trim().min(2, "Plateforme requise").max(60),
  model_id: z.string().uuid().nullable().optional(),
  item_title: z.string().trim().min(3, "Décrivez le lot en quelques mots").max(120),
  condition: z.enum(["LIKE_NEW", "GOOD", "FAIR", "FOR_PARTS"]),
  accessories: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  photos: z.array(z.string().max(200)).max(6).default([]),
  customer: customerSchema,
});
export type TradeInRequestInput = z.infer<typeof tradeInRequestSchema>;

const trackingUrl = (t: TradeIn) => `${SITE_URL}${ROUTES.tradeInTracking}/${t.access_token}`;

async function emailContext(t: TradeIn): Promise<T.TradeInEmailContext> {
  return { brand: await emailBrand(), firstName: t.customer_first_name, requestNumber: t.request_number, itemTitle: t.item_title, trackingUrl: trackingUrl(t) };
}

async function addEvent(requestId: string, input: { type: string; title: string; description?: string | null; isPublic?: boolean; actorId?: string | null }): Promise<void> {
  await createSupabaseAdminClient().from("trade_in_events").insert({ request_id: requestId, event_type: input.type, title: input.title, description: input.description ?? null, is_public: input.isPublic ?? true, actor_id: input.actorId ?? null });
}

/** Crée la demande (statut NEW), rattache les photos, notifie le client. Le compte n'est pas obligatoire : rattachement par e-mail si un profil existe. */
export async function createTradeInRequest(input: TradeInRequestInput, currentUser: CurrentUser | null): Promise<TradeIn> {
  const db = createSupabaseAdminClient();
  const email = input.customer.email.toLowerCase();
  let customerId = currentUser?.id ?? null;
  if (!customerId) {
    const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    customerId = existing?.id ?? null;
  }
  const { data: created, error } = await db
    .from("trade_in_requests")
    .insert({
      customer_id: customerId,
      customer_first_name: input.customer.first_name,
      customer_last_name: input.customer.last_name,
      customer_email: email,
      customer_phone: input.customer.phone || null,
      item_type: input.item_type,
      platform: input.platform,
      model_id: input.model_id ?? null,
      item_title: input.item_title,
      condition: input.condition,
      accessories: input.accessories,
      description: input.description || null,
      status: "NEW",
    })
    .select("*")
    .single();
  if (error || !created) throw new Error("La demande n'a pas pu être enregistrée. Merci de réessayer.");
  const photos = await moveDraftPhotos(input.photos, `trade-ins/${created.id}`);
  const { data: request } = photos.length ? await db.from("trade_in_requests").update({ photos }).eq("id", created.id).select("*").single() : { data: created };
  const t = request ?? created;
  await addEvent(t.id, { type: "CREATED", title: "Demande de reprise envoyée", description: `${input.item_title} · ${photos.length} photo(s)` });
  await audit({ actorId: currentUser?.id ?? null, actorRole: currentUser?.profile.role ?? null, action: "trade_in.created", resourceType: "trade_in_requests", resourceId: t.id, newValue: { request_number: t.request_number, item_title: t.item_title } });
  await sendCustomerEmail({ to: t.customer_email, recipientId: t.customer_id, eventType: "TRADE_IN_RECEIVED", tradeInId: t.id, rendered: T.tradeInReceived(await emailContext(t)) });
  return t;
}

export async function getTradeInById(id: string): Promise<TradeIn> {
  const { data, error } = await createSupabaseAdminClient().from("trade_in_requests").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Demande introuvable");
  return data;
}

export async function getTradeInEvents(id: string, publicOnly = false): Promise<TradeInEvent[]> {
  let q = createSupabaseAdminClient().from("trade_in_events").select("*").eq("request_id", id).order("created_at", { ascending: false });
  if (publicOnly) q = q.eq("is_public", true);
  const { data } = await q;
  return data ?? [];
}

export async function signTradeInPhotos(t: TradeIn) {
  return signCustomerMedia(t.photos);
}

/** Offre de l'atelier : montant + note, e-mail au client avec le lien de décision. */
export async function sendTradeInOffer(input: { id: string; offerCents: number; note: string | null; validityDays: number; actor: CurrentUser }): Promise<TradeIn> {
  const db = createSupabaseAdminClient();
  const t = await getTradeInById(input.id);
  if (!canTradeInTransition(t.status, "ESTIMATED")) throw new Error(`Impossible d'envoyer une offre depuis le statut ${t.status}`);
  const expires = new Date(Date.now() + input.validityDays * 86_400_000).toISOString();
  const { data: updated, error } = await db.from("trade_in_requests").update({ status: "ESTIMATED", offer_cents: input.offerCents, offer_note: input.note, offered_at: new Date().toISOString(), offer_expires_at: expires, decided_at: null, decision_note: null }).eq("id", t.id).select("*").single();
  if (error || !updated) throw new Error("Mise à jour impossible");
  await addEvent(t.id, { type: "OFFER_SENT", title: `Offre envoyée : ${(input.offerCents / 100).toFixed(2).replace(".", ",")} €`, description: input.note, actorId: input.actor.id });
  await audit({ actorId: input.actor.id, actorRole: input.actor.profile.role, action: "trade_in.offer", resourceType: "trade_in_requests", resourceId: t.id, oldValue: { status: t.status }, newValue: { status: "ESTIMATED", offer_cents: input.offerCents } });
  await sendCustomerEmail({ to: updated.customer_email, recipientId: updated.customer_id, eventType: "TRADE_IN_OFFER", tradeInId: t.id, rendered: T.tradeInOffer({ ...(await emailContext(updated)), offerCents: input.offerCents, offerNote: input.note, expiresAt: formatDate(expires) }) });
  return updated;
}

/** Décision du client (via le lien de suivi ou l'espace client). */
export async function decideTradeIn(input: { id: string; accepted: boolean; note: string | null; actorId: string | null }): Promise<TradeIn> {
  const db = createSupabaseAdminClient();
  const t = await getTradeInById(input.id);
  const to: TradeInStatus = input.accepted ? "ACCEPTED" : "REFUSED";
  if (t.status !== "ESTIMATED") throw new Error("Aucune offre en attente de décision.");
  if (t.offer_expires_at && new Date(t.offer_expires_at).getTime() < Date.now()) throw new Error("Cette offre a expiré : contactez le magasin pour une nouvelle estimation.");
  const { data: updated, error } = await db.from("trade_in_requests").update({ status: to, decided_at: new Date().toISOString(), decision_note: input.note }).eq("id", t.id).select("*").single();
  if (error || !updated) throw new Error("Mise à jour impossible");
  await addEvent(t.id, { type: input.accepted ? "ACCEPTED" : "REFUSED", title: input.accepted ? "Offre acceptée par le client" : "Offre refusée par le client", description: input.note, actorId: input.actorId });
  await audit({ actorId: input.actorId, actorRole: null, action: input.accepted ? "trade_in.accepted" : "trade_in.refused", resourceType: "trade_in_requests", resourceId: t.id, newValue: { status: to } });
  await sendCustomerEmail({ to: updated.customer_email, recipientId: updated.customer_id, eventType: input.accepted ? "TRADE_IN_ACCEPTED" : "TRADE_IN_REFUSED", tradeInId: t.id, rendered: T.tradeInDecision({ ...(await emailContext(updated)), accepted: input.accepted, offerCents: updated.offer_cents }) });
  return updated;
}

/** Refus par l'atelier (lot non repris) ou clôture après dépôt / paiement au comptoir. */
export async function setTradeInStatus(input: { id: string; to: "REFUSED" | "CLOSED"; note: string | null; actor: CurrentUser }): Promise<TradeIn> {
  const db = createSupabaseAdminClient();
  const t = await getTradeInById(input.id);
  if (!canTradeInTransition(t.status, input.to)) throw new Error(`Transition ${t.status} → ${input.to} non autorisée`);
  const { data: updated, error } = await db.from("trade_in_requests").update({ status: input.to, decided_at: input.to === "REFUSED" ? new Date().toISOString() : t.decided_at, decision_note: input.to === "REFUSED" ? input.note : t.decision_note }).eq("id", t.id).select("*").single();
  if (error || !updated) throw new Error("Mise à jour impossible");
  await addEvent(t.id, { type: input.to, title: input.to === "REFUSED" ? "Reprise refusée par le magasin" : "Reprise terminée — lot déposé et payé au comptoir", description: input.note, actorId: input.actor.id });
  await audit({ actorId: input.actor.id, actorRole: input.actor.profile.role, action: `trade_in.${input.to.toLowerCase()}`, resourceType: "trade_in_requests", resourceId: t.id, oldValue: { status: t.status }, newValue: { status: input.to } });
  if (input.to === "REFUSED") await sendCustomerEmail({ to: updated.customer_email, recipientId: updated.customer_id, eventType: "TRADE_IN_REFUSED_BY_SHOP", tradeInId: t.id, rendered: T.tradeInDecision({ ...(await emailContext(updated)), accepted: false, offerCents: null }) });
  return updated;
}

export async function addTradeInNote(input: { id: string; body: string; actor: CurrentUser }): Promise<void> {
  const db = createSupabaseAdminClient();
  const t = await getTradeInById(input.id);
  await db.from("trade_in_requests").update({ internal_notes: [t.internal_notes, `${new Date().toLocaleString("fr-FR")} — ${input.body}`].filter(Boolean).join("\n") }).eq("id", t.id);
  await addEvent(t.id, { type: "NOTE", title: "Note interne", description: input.body, isPublic: false, actorId: input.actor.id });
}
