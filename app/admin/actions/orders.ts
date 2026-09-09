"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaff, requireAdmin, type CurrentUser } from "@/lib/security/auth";
import { addOrderEvent, getOrderById, OrderError, transitionOrder } from "@/lib/orders/service";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/status";
import { createShipmentLabel, recordManualShipment } from "@/lib/shipping/service";
import { notifyOrderEvent } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { deleteMedia } from "@/lib/media/service";
import { consequenceForOutcome, quoteExpiryDate, sumQuoteItems } from "@/lib/quotes/rules";
import { getBusinessRules } from "@/lib/settings";
import { trackServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { normalizeOrderNumber } from "@/lib/orders/order-number";
import { getPaymentProvider } from "@/lib/stripe";
import type { Json } from "@/types/database";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const orderPath = (orderId: string) => `/admin/orders/${orderId}`;
const actorOf = (user: CurrentUser) => ({ id: user.id, role: user.profile.role });

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function optional(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v ? v : null;
}
function cents(formData: FormData, key: string): number {
  const v = str(formData, key).replace(",", ".");
  const n = Math.round(Number(v || "0") * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function int(formData: FormData, key: string, fallback = 0): number {
  const n = Number.parseInt(str(formData, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Status & assignment
// ---------------------------------------------------------------------------
export async function changeStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const to = str(formData, "status") as OrderStatus;
  if (!ORDER_STATUSES.includes(to)) return fail("Statut inconnu");
  try {
    await transitionOrder({ orderId, to, actor: actorOf(user), reason: optional(formData, "reason"), publicDescription: optional(formData, "public_note") });
    revalidatePath(orderPath(orderId));
    return { ok: true, message: "Statut mis à jour." };
  } catch (error) {
    return fail(error instanceof OrderError ? error.message : "Changement impossible");
  }
}

/** Segment « Avancement » du tableau de bord : transition directe puis retour à la vue maître/détail. */
export async function advanceStatusAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const to = str(formData, "status") as OrderStatus;
  const next = str(formData, "next") || `/admin?sel=${orderId}`;
  if (ORDER_STATUSES.includes(to)) {
    try {
      await transitionOrder({ orderId, to, actor: actorOf(user) });
    } catch (error) {
      redirect(`${next}${next.includes("?") ? "&" : "?"}error=${encodeURIComponent(error instanceof OrderError ? error.message : "Changement impossible")}`);
    }
  }
  revalidatePath("/admin");
  revalidatePath(orderPath(orderId));
  redirect(next);
}

export async function assignTechnicianAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const technicianId = optional(formData, "technician_id");
  const db = createSupabaseAdminClient();
  await db.from("repair_orders").update({ assigned_technician_id: technicianId }).eq("id", orderId);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "order.assigned", resourceType: "repair_orders", resourceId: orderId, orderId, newValue: { technician_id: technicianId } });
  revalidatePath(orderPath(orderId));
}

export async function addInternalNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const body = str(formData, "body");
  if (body.length < 2) return fail("Note vide");
  const isInternal = formData.get("internal") === "on";
  const db = createSupabaseAdminClient();
  const { error } = await db.from("order_messages").insert({ order_id: orderId, author_id: user.id, is_from_staff: true, is_internal: isInternal, body });
  if (error) return fail(error.message);
  if (!isInternal) {
    const order = await getOrderById(orderId);
    await notifyOrderEvent(order, { type: "MESSAGE", message: body });
    await addOrderEvent({ orderId, type: "STAFF_MESSAGE", title: "Message de l'atelier", description: body.slice(0, 200), actorId: user.id });
  }
  revalidatePath(orderPath(orderId));
  return { ok: true, message: isInternal ? "Note interne ajoutée." : "Message envoyé au client." };
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const mediaId = str(formData, "media_id");
  const orderId = str(formData, "order_id");
  await deleteMedia(user, mediaId);
  revalidatePath(orderPath(orderId));
}

export async function toggleMediaVisibilityAction(formData: FormData): Promise<void> {
  await requireStaff();
  const mediaId = str(formData, "media_id");
  const orderId = str(formData, "order_id");
  const visible = formData.get("visible") === "1";
  await createSupabaseAdminClient().from("order_media").update({ is_visible_to_customer: visible }).eq("id", mediaId);
  revalidatePath(orderPath(orderId));
}

// ---------------------------------------------------------------------------
// Reception
// ---------------------------------------------------------------------------
export async function lookupForReceptionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const raw = str(formData, "query");
  const db = createSupabaseAdminClient();
  const number = normalizeOrderNumber(raw);
  let orderId: string | null = null;
  if (number) {
    const { data } = await db.from("repair_orders").select("id").eq("order_number", number).maybeSingle();
    orderId = data?.id ?? null;
  }
  if (!orderId && raw) {
    const { data } = await db.from("shipments").select("order_id").eq("tracking_number", raw.toUpperCase()).maybeSingle();
    orderId = data?.order_id ?? null;
  }
  if (!orderId) return fail("Aucun dossier ne correspond à ce numéro de dossier ou de suivi.");
  redirect(`${orderPath(orderId)}?tab=reception`);
}

export async function saveReceptionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const db = createSupabaseAdminClient();
  const { data: tech } = await db.from("technicians").select("id").eq("profile_id", user.id).maybeSingle();
  const accessories = str(formData, "accessories")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const payload = {
    order_id: orderId,
    technician_id: tech?.id ?? null,
    package_condition: optional(formData, "package_condition"),
    exterior_condition: optional(formData, "exterior_condition"),
    serial_number: optional(formData, "serial_number"),
    accessories,
    visible_damage: optional(formData, "visible_damage"),
    initial_test: optional(formData, "initial_test"),
    comments: optional(formData, "comments"),
    tracking_number_scanned: optional(formData, "tracking_number_scanned"),
  };
  const { data: existing } = await db.from("reception_reports").select("*").eq("order_id", orderId).maybeSingle();
  const { error } = await db.from("reception_reports").upsert(payload, { onConflict: "order_id" });
  if (error) return fail(error.message);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: existing ? "reception.updated" : "reception.created", resourceType: "reception_reports", resourceId: orderId, orderId, oldValue: existing as unknown as Json, newValue: payload as unknown as Json });

  const order = await getOrderById(orderId);
  if (["AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"].includes(order.status)) {
    await transitionOrder({ orderId, to: "RECEIVED", actor: actorOf(user), publicDescription: "Votre console est bien arrivée à l'atelier." });
    await transitionOrder({ orderId, to: "RECEPTION_CHECK", actor: actorOf(user), notify: false });
  }
  if (!existing) await addOrderEvent({ orderId, type: "RECEPTION_DOCUMENTED", title: "Réception documentée", description: "État du colis, numéro de série et accessoires enregistrés.", actorId: user.id });
  // Mark inbound shipment delivered
  await db.from("shipments").update({ status: "DELIVERED", delivered_at: new Date().toISOString() }).eq("order_id", orderId).eq("direction", "TO_WORKSHOP").neq("status", "DELIVERED");
  revalidatePath(orderPath(orderId));
  return { ok: true, message: "Réception enregistrée." };
}

// ---------------------------------------------------------------------------
// Diagnostic
// ---------------------------------------------------------------------------
const outcomes = ["REPAIRABLE", "UNREPAIRABLE", "NOT_ECONOMICAL", "NO_FAULT_FOUND", "FURTHER_DIAGNOSIS_NEEDED"] as const;

export async function saveDiagnosticAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const complete = formData.get("complete") === "1";
  const db = createSupabaseAdminClient();
  const { data: tech } = await db.from("technicians").select("id").eq("profile_id", user.id).maybeSingle();
  const outcomeRaw = str(formData, "outcome");
  const outcome = outcomes.includes(outcomeRaw as (typeof outcomes)[number]) ? (outcomeRaw as (typeof outcomes)[number]) : null;
  if (complete && !outcome) return fail("Choisissez une conclusion pour terminer le diagnostic.");
  const severityRaw = str(formData, "severity");
  const severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severityRaw) ? (severityRaw as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") : null;
  const reproducedRaw = str(formData, "fault_reproduced");
  const payload = {
    order_id: orderId,
    technician_id: tech?.id ?? null,
    declared_fault: optional(formData, "declared_fault"),
    fault_reproduced: reproducedRaw === "yes" ? true : reproducedRaw === "no" ? false : null,
    findings: optional(formData, "findings"),
    severity,
    outcome,
    recommended_work: optional(formData, "recommended_work"),
    parts_needed: optional(formData, "parts_needed"),
    internal_notes: optional(formData, "internal_notes"),
    customer_summary: optional(formData, "customer_summary"),
    ...(complete ? { completed_at: new Date().toISOString() } : {}),
  };
  const { data: existing } = await db.from("diagnostics").select("*").eq("order_id", orderId).maybeSingle();
  const { error } = await db.from("diagnostics").upsert(payload, { onConflict: "order_id" });
  if (error) return fail(error.message);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "diagnostic.saved", resourceType: "diagnostics", resourceId: orderId, orderId, oldValue: existing as unknown as Json, newValue: payload as unknown as Json });

  const order = await getOrderById(orderId);
  if (["RECEIVED", "RECEPTION_CHECK"].includes(order.status)) {
    await transitionOrder({ orderId, to: "DIAGNOSIS", actor: actorOf(user), notify: false });
  }
  if (complete && outcome) {
    await db.from("repair_orders").update({ diagnosed_at: new Date().toISOString() }).eq("id", orderId);
    await addOrderEvent({ orderId, type: "DIAGNOSIS_DONE", title: "Diagnostic effectué", description: payload.customer_summary, actorId: user.id });
    const fresh = await getOrderById(orderId);
    await notifyOrderEvent(fresh, { type: "DIAGNOSIS_DONE", customerSummary: payload.customer_summary });
    if (outcome === "UNREPAIRABLE" || outcome === "NOT_ECONOMICAL" || outcome === "NO_FAULT_FOUND") {
      const rules = await getBusinessRules();
      const { data: repair } = fresh.repair_id ? await db.from("repairs").select("is_diagnostic_only").eq("id", fresh.repair_id).maybeSingle() : { data: null };
      const consequence = consequenceForOutcome(outcome, rules, repair?.is_diagnostic_only ?? false);
      if (outcome !== "NO_FAULT_FOUND" && fresh.status === "DIAGNOSIS") {
        await transitionOrder({ orderId, to: "UNREPAIRABLE", actor: actorOf(user), publicDescription: consequence.explanation, notify: false });
        await notifyOrderEvent(await getOrderById(orderId), { type: "UNREPAIRABLE", explanation: `${payload.customer_summary ?? ""} ${consequence.explanation}`.trim() });
      }
    } else if (outcome === "REPAIRABLE" && fresh.status === "DIAGNOSIS" && formData.get("start_repair") === "on") {
      await transitionOrder({ orderId, to: "REPAIRING", actor: actorOf(user), publicDescription: "La réparation commandée est lancée." });
    }
  }
  revalidatePath(orderPath(orderId));
  return { ok: true, message: complete ? "Diagnostic terminé et client notifié." : "Diagnostic enregistré (brouillon)." };
}

// ---------------------------------------------------------------------------
// Supplementary quotes
// ---------------------------------------------------------------------------
const quoteItemSchema = z.object({ label: z.string().trim().min(1).max(200), description: z.string().trim().max(500).optional(), quantity: z.number().int().min(1).max(20), unit_price_cents: z.number().int().min(0), estimated_cost_cents: z.number().int().min(0).default(0), option_id: z.string().uuid().nullable().default(null) });

export async function createQuoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const title = str(formData, "title");
  if (title.length < 3) return fail("Titre requis");
  const items: z.infer<typeof quoteItemSchema>[] = [];
  for (let i = 0; i < 10; i++) {
    const label = str(formData, `item_label_${i}`);
    if (!label) continue;
    const parsed = quoteItemSchema.safeParse({
      label,
      description: optional(formData, `item_description_${i}`) ?? undefined,
      quantity: int(formData, `item_quantity_${i}`, 1) || 1,
      unit_price_cents: cents(formData, `item_price_${i}`),
      estimated_cost_cents: cents(formData, `item_cost_${i}`),
      option_id: optional(formData, `item_option_${i}`),
    });
    if (!parsed.success) return fail(`Ligne ${i + 1} invalide`);
    items.push(parsed.data);
  }
  if (!items.length) return fail("Ajoutez au moins une ligne au devis.");
  const total = sumQuoteItems(items.map((i) => ({ quantity: i.quantity, unitPriceCents: i.unit_price_cents })));
  const db = createSupabaseAdminClient();
  const { data: quote, error } = await db
    .from("supplementary_quotes")
    .insert({
      order_id: orderId,
      status: "DRAFT",
      title,
      diagnosis_summary: optional(formData, "diagnosis_summary"),
      message: optional(formData, "message"),
      total_cents: total,
      requires_payment: formData.get("requires_payment") === "on",
      is_required_for_repair: formData.get("is_required_for_repair") === "on",
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !quote) return fail(error?.message ?? "Création impossible");
  await db.from("supplementary_quote_items").insert(items.map((i) => ({ quote_id: quote.id, option_id: i.option_id, label: i.label, description: i.description ?? null, quantity: i.quantity, unit_price_cents: i.unit_price_cents, total_cents: i.quantity * i.unit_price_cents, estimated_cost_cents: i.estimated_cost_cents })));
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "quote.created", resourceType: "supplementary_quotes", resourceId: quote.id, orderId, newValue: { total_cents: total, items: items.length } });
  await addOrderEvent({ orderId, type: "QUOTE_DRAFTED", title: `Devis ${quote.quote_number} préparé`, isPublic: false, actorId: user.id });
  if (formData.get("send_now") === "on") return sendQuote(user, quote.id);
  revalidatePath(orderPath(orderId));
  return { ok: true, message: `Devis ${quote.quote_number} enregistré en brouillon.` };
}

async function sendQuote(user: CurrentUser, quoteId: string): Promise<ActionResult> {
  const db = createSupabaseAdminClient();
  const { data: quote } = await db.from("supplementary_quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!quote) return fail("Devis introuvable");
  if (quote.status !== "DRAFT") return fail("Ce devis a déjà été envoyé.");
  const rules = await getBusinessRules();
  const now = new Date();
  const { data: sent, error } = await db
    .from("supplementary_quotes")
    .update({ status: "SENT", sent_at: now.toISOString(), expires_at: quoteExpiryDate(now, rules).toISOString() })
    .eq("id", quoteId)
    .select("*")
    .single();
  if (error || !sent) return fail(error?.message ?? "Envoi impossible");
  const order = await getOrderById(quote.order_id);
  if (["DIAGNOSIS", "APPROVED", "REPAIRING"].includes(order.status)) {
    await transitionOrder({ orderId: order.id, to: "WAITING_CUSTOMER_APPROVAL", actor: actorOf(user), publicDescription: `Devis ${sent.quote_number} : ${sent.title}`, notify: false });
  }
  await addOrderEvent({ orderId: order.id, type: "QUOTE_SENT", title: `Devis ${sent.quote_number} envoyé`, description: sent.title, actorId: user.id, metadata: { quote_id: sent.id, amount_cents: sent.total_cents } });
  await notifyOrderEvent(await getOrderById(order.id), { type: "QUOTE_SENT", quote: sent });
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "quote.sent", resourceType: "supplementary_quotes", resourceId: sent.id, orderId: order.id, newValue: { total_cents: sent.total_cents } });
  await trackServerEvent({ event: ANALYTICS_EVENTS.QUOTE_SENT, orderId: order.id, repairId: order.repair_id, valueCents: sent.total_cents });
  revalidatePath(orderPath(order.id));
  return { ok: true, message: `Devis ${sent.quote_number} envoyé au client.` };
}

export async function sendQuoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  return sendQuote(user, str(formData, "quote_id"));
}

export async function cancelQuoteAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const quoteId = str(formData, "quote_id");
  const db = createSupabaseAdminClient();
  const { data: quote } = await db.from("supplementary_quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!quote || !["DRAFT", "SENT"].includes(quote.status)) return;
  await db.from("supplementary_quotes").update({ status: "CANCELLED" }).eq("id", quoteId);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "quote.cancelled", resourceType: "supplementary_quotes", resourceId: quoteId, orderId: quote.order_id });
  await addOrderEvent({ orderId: quote.order_id, type: "QUOTE_CANCELLED", title: `Devis ${quote.quote_number} annulé`, isPublic: quote.status === "SENT", actorId: user.id });
  const order = await getOrderById(quote.order_id);
  const { count } = await db.from("supplementary_quotes").select("id", { count: "exact", head: true }).eq("order_id", order.id).eq("status", "SENT");
  if (order.status === "WAITING_CUSTOMER_APPROVAL" && (count ?? 0) === 0) {
    await transitionOrder({ orderId: order.id, to: "APPROVED", actor: actorOf(user), notify: false });
  }
  revalidatePath(orderPath(quote.order_id));
}

// ---------------------------------------------------------------------------
// Repair work: parts & work logs
// ---------------------------------------------------------------------------
export async function addPartAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const name = str(formData, "name");
  if (!name) return fail("Nom de la pièce requis");
  const { error } = await createSupabaseAdminClient().from("repair_parts").insert({ order_id: orderId, name, reference: optional(formData, "reference"), supplier: optional(formData, "supplier"), quantity: int(formData, "quantity", 1) || 1, unit_cost_cents: cents(formData, "unit_cost"), created_by: user.id });
  if (error) return fail(error.message);
  revalidatePath(orderPath(orderId));
  return { ok: true, message: "Pièce ajoutée." };
}

export async function deletePartAction(formData: FormData): Promise<void> {
  await requireStaff();
  const orderId = str(formData, "order_id");
  await createSupabaseAdminClient().from("repair_parts").delete().eq("id", str(formData, "part_id"));
  revalidatePath(orderPath(orderId));
}

export async function addWorkLogAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const description = str(formData, "description");
  if (description.length < 2) return fail("Description requise");
  const db = createSupabaseAdminClient();
  const { data: tech } = await db.from("technicians").select("id").eq("profile_id", user.id).maybeSingle();
  const visible = formData.get("visible") === "on";
  const { error } = await db.from("repair_work_logs").insert({ order_id: orderId, technician_id: tech?.id ?? null, description, minutes_spent: int(formData, "minutes", 0), is_visible_to_customer: visible });
  if (error) return fail(error.message);
  if (visible) await addOrderEvent({ orderId, type: "REPAIR_PROGRESS", title: "Avancement de la réparation", description, actorId: user.id });
  revalidatePath(orderPath(orderId));
  return { ok: true, message: "Intervention enregistrée." };
}

// ---------------------------------------------------------------------------
// Quality control
// ---------------------------------------------------------------------------
export async function startTestsAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const checklistId = optional(formData, "checklist_id");
  const db = createSupabaseAdminClient();
  const { data: existing } = await db.from("repair_tests").select("id").eq("order_id", orderId).maybeSingle();
  if (existing) return;
  const { data: tech } = await db.from("technicians").select("id").eq("profile_id", user.id).maybeSingle();
  const { data: test } = await db.from("repair_tests").insert({ order_id: orderId, checklist_id: checklistId, technician_id: tech?.id ?? null }).select("id").single();
  if (test && checklistId) {
    const { data: items } = await db.from("test_checklist_items").select("*").eq("checklist_id", checklistId).order("display_order");
    if (items?.length) await db.from("repair_test_results").insert(items.map((i) => ({ repair_test_id: test.id, checklist_item_id: i.id, label: i.label, display_order: i.display_order })));
  }
  const order = await getOrderById(orderId);
  if (order.status === "REPAIRING") await transitionOrder({ orderId, to: "QUALITY_CONTROL", actor: actorOf(user) });
  revalidatePath(orderPath(orderId));
}

export async function saveTestResultsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const testId = str(formData, "test_id");
  const complete = formData.get("complete") === "1";
  const db = createSupabaseAdminClient();
  const { data: results } = await db.from("repair_test_results").select("id").eq("repair_test_id", testId);
  const now = new Date().toISOString();
  let hasFail = false;
  let hasPending = false;
  for (const r of results ?? []) {
    const status = str(formData, `result_${r.id}`);
    if (!["PASS", "FAIL", "NA", "PENDING"].includes(status)) continue;
    if (status === "FAIL") hasFail = true;
    if (status === "PENDING") hasPending = true;
    await db.from("repair_test_results").update({ status: status as "PASS" | "FAIL" | "NA" | "PENDING", comment: optional(formData, `comment_${r.id}`), tested_by: user.id, tested_at: status === "PENDING" ? null : now }).eq("id", r.id);
  }
  await db.from("repair_tests").update({ notes: optional(formData, "notes") }).eq("id", testId);
  if (complete) {
    if (hasPending) return fail("Tous les tests doivent être renseignés avant validation.");
    if (hasFail) return fail("Un test est en échec : corrigez puis relancez les tests, ou repassez le dossier en réparation.");
    await db.from("repair_tests").update({ is_completed: true, completed_at: now }).eq("id", testId);
    await addOrderEvent({ orderId, type: "TESTS_DONE", title: "Contrôle qualité validé", actorId: user.id });
    const order = await getOrderById(orderId);
    if (order.status === "QUALITY_CONTROL") await transitionOrder({ orderId, to: "READY_TO_SHIP", actor: actorOf(user) });
  }
  await audit({ actorId: user.id, actorRole: user.profile.role, action: complete ? "tests.completed" : "tests.saved", resourceType: "repair_tests", resourceId: testId, orderId });
  revalidatePath(orderPath(orderId));
  return { ok: true, message: complete ? "Tests validés, dossier prêt à expédier." : "Résultats enregistrés." };
}

// ---------------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------------
export async function createReturnLabelAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  try {
    const order = await getOrderById(orderId);
    await createShipmentLabel({
      order,
      direction: "TO_CUSTOMER",
      actor: actorOf(user),
      parcel: { weightGrams: int(formData, "weight_grams", 3000) || 3000, lengthCm: int(formData, "length_cm") || undefined, widthCm: int(formData, "width_cm") || undefined, heightCm: int(formData, "height_cm") || undefined, declaredValueCents: cents(formData, "declared_value") || undefined, insured: formData.get("insured") === "on" },
    });
    revalidatePath(orderPath(orderId));
    return { ok: true, message: "Étiquette de retour créée." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Création impossible");
  }
}

export async function recordShipmentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const direction = str(formData, "direction") === "TO_WORKSHOP" ? "TO_WORKSHOP" : "TO_CUSTOMER";
  const carrier = str(formData, "carrier_name");
  const tracking = str(formData, "tracking_number");
  if (!carrier || !tracking) return fail("Transporteur et numéro de suivi requis");
  try {
    const order = await getOrderById(orderId);
    await recordManualShipment({ order, direction, carrierName: carrier, trackingNumber: tracking, trackingUrl: optional(formData, "tracking_url"), costCents: cents(formData, "cost"), weightGrams: int(formData, "weight_grams") || null, actor: actorOf(user) });
    revalidatePath(orderPath(orderId));
    return { ok: true, message: "Expédition enregistrée." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Enregistrement impossible");
  }
}

/** Marks the return as shipped: requires QC done, final photos, a return shipment with tracking. */
export async function markShippedAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const db = createSupabaseAdminClient();
  const order = await getOrderById(orderId);
  const [{ data: tests }, { count: finalPhotos }, { data: shipment }] = await Promise.all([
    db.from("repair_tests").select("is_completed").eq("order_id", orderId).maybeSingle(),
    // Only real photos count: shipping labels are stored as SHIPPING media (PDF) and must not satisfy the guard.
    db.from("order_media").select("id", { count: "exact", head: true }).eq("order_id", orderId).in("kind", ["FINAL", "SHIPPING"]).like("mime_type", "image/%"),
    db.from("shipments").select("*").eq("order_id", orderId).eq("direction", "TO_CUSTOMER").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const missing: string[] = [];
  if (!["READY_TO_SHIP", "REFUSED_QUOTE", "UNREPAIRABLE", "RETURN_REQUIRED"].includes(order.status)) missing.push("le dossier doit être « Prêt à expédier » (ou retour sans réparation)");
  if (order.status === "READY_TO_SHIP" && !tests?.is_completed) missing.push("contrôle qualité validé");
  if ((finalPhotos ?? 0) === 0) missing.push("photo de l'état final / du colis fermé");
  if (!shipment?.tracking_number) missing.push("expédition retour avec numéro de suivi");
  if (missing.length) return fail(`Avant expédition : ${missing.join(", ")}.`);

  await db.from("shipments").update({ status: "IN_TRANSIT", shipped_at: shipment!.shipped_at ?? new Date().toISOString() }).eq("id", shipment!.id);
  await transitionOrder({ orderId, to: "SHIPPED", actor: actorOf(user), publicDescription: `${shipment!.carrier_name ?? "Transporteur"} — suivi ${shipment!.tracking_number}`, notify: false });
  await notifyOrderEvent(await getOrderById(orderId), { type: "SHIPPED", trackingNumber: shipment!.tracking_number, carrierName: shipment!.carrier_name, carrierTrackingUrl: shipment!.tracking_url });
  revalidatePath(orderPath(orderId));
  return { ok: true, message: "Console expédiée, client notifié." };
}

export async function markDeliveredAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const db = createSupabaseAdminClient();
  await db.from("shipments").update({ status: "DELIVERED", delivered_at: new Date().toISOString() }).eq("order_id", orderId).eq("direction", "TO_CUSTOMER");
  const order = await getOrderById(orderId);
  if (order.status === "SHIPPED") {
    await transitionOrder({ orderId, to: "DELIVERED", actor: actorOf(user) });
    // Review row is created now; the request e-mail is sent later by the cron job (review_request_delay_days).
    await db.from("reviews").upsert({ order_id: orderId, customer_id: order.customer_id }, { onConflict: "order_id", ignoreDuplicates: true });
  }
  revalidatePath(orderPath(orderId));
}

// ---------------------------------------------------------------------------
// Payments (admin): refund
// ---------------------------------------------------------------------------
export async function refundPaymentAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const paymentId = str(formData, "payment_id");
  const amount = cents(formData, "amount");
  const reason = optional(formData, "reason");
  const db = createSupabaseAdminClient();
  const { data: payment } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment || payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") return fail("Paiement non remboursable");
  if (amount <= 0 || amount > payment.amount_cents - payment.refunded_cents) return fail("Montant invalide");
  if (!payment.provider_payment_id) return fail("Référence prestataire manquante");
  try {
    const { refundId } = await getPaymentProvider().refund(payment.provider_payment_id, amount, reason ?? undefined);
    const refunded = payment.refunded_cents + amount;
    await db.from("payments").update({ refunded_cents: refunded, status: refunded >= payment.amount_cents ? "REFUNDED" : "PARTIALLY_REFUNDED" }).eq("id", paymentId);
    await db.from("invoices").insert({ order_id: payment.order_id, shop_order_id: payment.shop_order_id, payment_id: payment.id, invoice_type: "CREDIT_NOTE", status: "ISSUED", amount_cents: -amount, currency: payment.currency, lines: [{ label: reason ?? "Remboursement", total_cents: -amount }] as unknown as Json, external_ref: refundId });
    if (payment.order_id) {
      await addOrderEvent({ orderId: payment.order_id, type: "REFUND", title: "Remboursement effectué", description: reason, actorId: user.id, metadata: { amount_cents: amount } });
      revalidatePath(orderPath(payment.order_id));
    }
    if (payment.shop_order_id) revalidatePath(`/admin/shop-orders/${payment.shop_order_id}`);
    await audit({ actorId: user.id, actorRole: user.profile.role, action: "payment.refunded", resourceType: "payments", resourceId: paymentId, orderId: payment.order_id, newValue: { amount_cents: amount, reason, refund_id: refundId } });
    return { ok: true, message: "Remboursement effectué." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Remboursement impossible");
  }
}
