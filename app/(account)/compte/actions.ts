"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, requireUser } from "@/lib/security/auth";
import { registerUploadedMedia } from "@/lib/media/service";
import type { MediaKind } from "@/lib/security/upload";
import { addOrderEvent, getOrderById, transitionOrder } from "@/lib/orders/service";
import { CUSTOMER_CANCELLABLE_STATUSES } from "@/lib/orders/status";
import { createQuoteCheckout } from "@/lib/orders/payments";
import { notifyOrderEvent } from "@/lib/notifications";
import { consequenceForOutcome } from "@/lib/quotes/rules";
import { getBusinessRules } from "@/lib/settings";
import { audit, requestMeta } from "@/lib/security/audit";
import { trackServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { ROUTES } from "@/config/site";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Profile & addresses (RLS-enforced user client)
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(60),
  last_name: z.string().trim().min(1, "Nom requis").max(60),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  marketing_opt_in: z.boolean().optional(),
});

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Session expirée");
  const parsed = profileSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone"),
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: parsed.data.first_name, last_name: parsed.data.last_name, phone: parsed.data.phone || null, marketing_opt_in: parsed.data.marketing_opt_in ?? false })
    .eq("id", user.id);
  if (error) return fail("Mise à jour impossible");
  revalidatePath(ROUTES.accountProfile);
  return { ok: true, message: "Profil mis à jour." };
}

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = z.string().min(8, "8 caractères minimum").max(128).safeParse(formData.get("password"));
  if (!password.success) return fail(password.error.issues[0]?.message ?? "Mot de passe invalide");
  if (password.data !== formData.get("confirm")) return fail("Les deux mots de passe ne correspondent pas.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return fail("Changement impossible. Reconnectez-vous puis réessayez.");
  return { ok: true, message: "Mot de passe modifié." };
}

const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  postal_code: z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres"),
  city: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  is_default: z.boolean().optional(),
});

export async function saveAddressAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Session expirée");
  const parsed = addressSchema.safeParse({
    label: formData.get("label"),
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    line1: formData.get("line1"),
    line2: formData.get("line2"),
    postal_code: formData.get("postal_code"),
    city: formData.get("city"),
    phone: formData.get("phone"),
    is_default: formData.get("is_default") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Adresse invalide");
  const supabase = await createSupabaseServerClient();
  const id = formData.get("id");
  const payload = { ...parsed.data, label: parsed.data.label || null, line2: parsed.data.line2 || null, phone: parsed.data.phone || null, is_default: parsed.data.is_default ?? false, profile_id: user.id };
  if (payload.is_default) await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id);
  const { error } = typeof id === "string" && id ? await supabase.from("addresses").update(payload).eq("id", id).eq("profile_id", user.id) : await supabase.from("addresses").insert(payload);
  if (error) return fail("Enregistrement impossible");
  revalidatePath(ROUTES.accountAddresses);
  return { ok: true, message: "Adresse enregistrée." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  const supabase = await createSupabaseServerClient();
  await supabase.from("addresses").delete().eq("id", id).eq("profile_id", user.id);
  revalidatePath(ROUTES.accountAddresses);
}

/** GDPR: delete the account. Orders are kept for legal/accounting reasons but the profile is anonymised. */
export async function deleteAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Session expirée");
  if (formData.get("confirm") !== "SUPPRIMER") return fail("Tapez SUPPRIMER pour confirmer.");
  const db = createSupabaseAdminClient();
  const { count } = await db.from("repair_orders").select("id", { count: "exact", head: true }).eq("customer_id", user.id).not("status", "in", "(COMPLETED,CANCELLED)");
  if ((count ?? 0) > 0) return fail("Un dossier est encore en cours. La suppression sera possible une fois le dossier terminé.");
  const anonymised = `deleted-${user.id.slice(0, 8)}@anonymised.invalid`;
  await db.from("repair_orders").update({ customer_first_name: "Client", customer_last_name: "supprimé", customer_email: anonymised, customer_phone: null, shipping_address: { line1: "—", postal_code: "00000", city: "—", country_code: "FR" } }).eq("customer_id", user.id);
  await db.from("addresses").delete().eq("profile_id", user.id);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "account.deleted", resourceType: "profiles", resourceId: user.id });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await db.auth.admin.deleteUser(user.id);
  redirect(ROUTES.home);
}

// ---------------------------------------------------------------------------
// Orders: messages, cancellation, media
// ---------------------------------------------------------------------------
async function ownOrder(orderId: string) {
  const user = await requireUser();
  const order = await getOrderById(orderId);
  if (order.customer_id !== user.id) throw new Error("Accès refusé");
  return { user, order };
}

export async function sendMessageAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const body = z.string().trim().min(2, "Message trop court").max(4000).safeParse(formData.get("body"));
  const orderId = String(formData.get("order_id") ?? "");
  if (!body.success) return fail(body.error.issues[0]?.message ?? "Message invalide");
  try {
    const { user, order } = await ownOrder(orderId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("order_messages").insert({ order_id: order.id, author_id: user.id, is_from_staff: false, is_internal: false, body: body.data });
    if (error) return fail("Envoi impossible");
    await addOrderEvent({ orderId: order.id, type: "CUSTOMER_MESSAGE", title: "Message du client", isPublic: false, actorId: user.id });
    revalidatePath(`${ROUTES.accountOrders}/${order.id}`);
    return { ok: true, message: "Message envoyé à l'atelier." };
  } catch {
    return fail("Accès refusé");
  }
}

export async function cancelOrderAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const orderId = String(formData.get("order_id") ?? "");
  try {
    const { user, order } = await ownOrder(orderId);
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) return fail("Ce dossier ne peut plus être annulé en ligne. Contactez-nous depuis la messagerie.");
    await transitionOrder({ orderId: order.id, to: "CANCELLED", actor: { id: user.id, role: "ADMIN" }, reason: "Annulation par le client", publicDescription: "Vous avez annulé votre commande. Si un paiement a été effectué, il sera remboursé selon nos conditions." });
    await audit({ actorId: user.id, actorRole: "CUSTOMER", action: "order.cancelled_by_customer", resourceType: "repair_orders", resourceId: order.id, orderId: order.id });
    revalidatePath(`${ROUTES.accountOrders}/${order.id}`);
    return { ok: true, message: "Commande annulée." };
  } catch {
    return fail("Annulation impossible");
  }
}

export async function registerMediaAction(input: { orderId: string; kind: MediaKind; path: string; mimeType: string; sizeBytes: number; originalName: string | null; caption: string | null; visibleToCustomer?: boolean }): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await registerUploadedMedia({ user, ...input });
    revalidatePath(`${ROUTES.accountOrders}/${input.orderId}`);
    revalidatePath(`${ROUTES.admin}/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Enregistrement impossible");
  }
}

// ---------------------------------------------------------------------------
// Supplementary quotes: decision (atomic RPC) + payment
// ---------------------------------------------------------------------------
export async function decideQuoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const quoteId = String(formData.get("quote_id") ?? "");
  const decision = formData.get("decision") === "ACCEPTED" ? "ACCEPTED" : formData.get("decision") === "REFUSED" ? "REFUSED" : null;
  if (!decision || !quoteId) return fail("Décision invalide");
  if (formData.get("confirm") !== "on") return fail("Merci de cocher la case de confirmation.");
  const user = await getCurrentUser();
  if (!user) return fail("Session expirée");
  const meta = await requestMeta();
  const supabase = await createSupabaseServerClient();
  const { data: quote, error } = await supabase.rpc("decide_supplementary_quote", { p_quote_id: quoteId, p_decision: decision, p_user_agent: meta.userAgent ?? undefined, p_ip_address: meta.ip ?? undefined });
  if (error || !quote) return fail(error?.message.includes("expired") ? "Ce devis a expiré. Contactez-nous depuis la messagerie." : "Décision impossible : le devis n'est peut-être plus en attente.");

  const order = await getOrderById(quote.order_id);
  if (decision === "ACCEPTED") {
    await notifyOrderEvent(order, { type: "QUOTE_ACCEPTED", quote });
    await trackServerEvent({ event: ANALYTICS_EVENTS.QUOTE_ACCEPTED, orderId: order.id, repairId: order.repair_id, userId: user.id, valueCents: quote.total_cents });
    if (quote.requires_payment && quote.total_cents > 0) {
      const { redirectUrl } = await createQuoteCheckout(quote.id, user.id);
      redirect(redirectUrl);
    }
  } else {
    const rules = await getBusinessRules();
    const consequence = consequenceForOutcome("QUOTE_REFUSED", rules, false);
    await notifyOrderEvent(order, { type: "QUOTE_REFUSED", quote, consequence: quote.is_required_for_repair ? consequence.explanation : "La réparation initialement commandée se poursuit normalement." });
    await trackServerEvent({ event: ANALYTICS_EVENTS.QUOTE_REFUSED, orderId: order.id, repairId: order.repair_id, userId: user.id, valueCents: quote.total_cents });
  }
  revalidatePath(`${ROUTES.accountOrders}/${order.id}`);
  return { ok: true, message: decision === "ACCEPTED" ? `Vous avez accepté le devis complémentaire.` : "Votre refus est enregistré." };
}

export async function payQuoteAction(formData: FormData): Promise<void> {
  const quoteId = String(formData.get("quote_id") ?? "");
  const user = await requireUser();
  const { redirectUrl } = await createQuoteCheckout(quoteId, user.id);
  redirect(redirectUrl);
}

// ---------------------------------------------------------------------------
// SAV
// ---------------------------------------------------------------------------
const savSchema = z.object({ subject: z.string().trim().min(3, "Objet requis").max(120), description: z.string().trim().min(10, "Décrivez le problème (10 caractères minimum)").max(4000) });

export async function openSavAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const orderId = String(formData.get("order_id") ?? "");
  const parsed = savSchema.safeParse({ subject: formData.get("subject"), description: formData.get("description") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  try {
    const { user, order } = await ownOrder(orderId);
    if (!["DELIVERED", "COMPLETED", "SAV"].includes(order.status)) return fail("Une demande SAV ne peut être ouverte qu'après la livraison de la console.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("sav_requests").insert({ order_id: order.id, customer_id: user.id, subject: parsed.data.subject, description: parsed.data.description }).select("id").single();
    if (error || !data) return fail("Ouverture impossible");
    if (order.status !== "SAV") await transitionOrder({ orderId: order.id, to: "SAV", actor: { id: user.id, role: "ADMIN" }, reason: "Demande SAV du client", publicDescription: parsed.data.subject, notify: false });
    await audit({ actorId: user.id, actorRole: "CUSTOMER", action: "sav.opened", resourceType: "sav_requests", resourceId: data.id, orderId: order.id });
    revalidatePath(`${ROUTES.accountOrders}/${order.id}`);
    return { ok: true, message: "Votre demande SAV est enregistrée. Vous pouvez y ajouter des photos ou vidéos." };
  } catch {
    return fail("Accès refusé");
  }
}

export async function savReplyAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const savId = String(formData.get("sav_id") ?? "");
  const body = z.string().trim().min(2).max(4000).safeParse(formData.get("body"));
  if (!body.success) return fail("Message invalide");
  const user = await getCurrentUser();
  if (!user) return fail("Session expirée");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("sav_messages").insert({ sav_request_id: savId, author_id: user.id, is_from_staff: false, is_internal: false, body: body.data });
  if (error) return fail("Envoi impossible");
  const orderId = String(formData.get("order_id") ?? "");
  revalidatePath(`${ROUTES.accountOrders}/${orderId}/sav`);
  return { ok: true, message: "Message envoyé." };
}

// ---------------------------------------------------------------------------
// Reviews (token from e-mail; also usable when logged in)
// ---------------------------------------------------------------------------
const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), title: z.string().trim().max(120).optional().or(z.literal("")), body: z.string().trim().min(10, "10 caractères minimum").max(2000), display_name: z.string().trim().max(60).optional().or(z.literal("")) });

export async function submitReviewAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), title: formData.get("title"), body: formData.get("body"), display_name: formData.get("display_name") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  const db = createSupabaseAdminClient();
  const { data: review } = await db.from("reviews").select("*").eq("review_token", token).maybeSingle();
  if (!review) return fail("Lien d'avis invalide.");
  if (review.submitted_at) return fail("Un avis a déjà été déposé pour ce dossier. Merci !");
  const { error } = await db.from("reviews").update({ rating: parsed.data.rating, title: parsed.data.title || null, body: parsed.data.body, display_name: parsed.data.display_name || null, submitted_at: new Date().toISOString(), status: "PENDING" }).eq("id", review.id);
  if (error) return fail("Enregistrement impossible");
  await trackServerEvent({ event: ANALYTICS_EVENTS.REVIEW_SUBMITTED, orderId: review.order_id, userId: review.customer_id, properties: { rating: parsed.data.rating } });
  return { ok: true, message: "Merci pour votre avis ! Il sera publié après modération." };
}
