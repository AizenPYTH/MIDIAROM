"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaff } from "@/lib/security/auth";
import { audit } from "@/lib/security/audit";
import { addOrderEvent, getOrderById } from "@/lib/orders/service";
import { notifyOrderEvent } from "@/lib/notifications";
import { SAV_STATUS_LABELS, type SavStatus, type UserRole } from "@/lib/orders/status";
import type { Json } from "@/types/database";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

// ---------------------------------------------------------------------------
// Site settings (JSON per key, validated per key)
// ---------------------------------------------------------------------------
const SETTINGS_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  brand: z.object({ name: z.string().trim().min(1).max(80), tagline: z.string().trim().max(120), description: z.string().trim().max(500), email: z.string().trim().email().or(z.literal("")), phone: z.string().trim().max(30), address_line1: z.string().trim().max(120), postal_code: z.string().trim().max(10), city: z.string().trim().max(80), country: z.string().trim().max(60), hours: z.string().trim().max(200), founded_year: z.string().trim().max(4), siret: z.string().trim().max(20), legal_form: z.string().trim().max(60), logo_path: z.string().trim().max(300).transform((v) => v || null) }),
  social: z.object({ instagram: z.string().trim().max(300), facebook: z.string().trim().max(300), tiktok: z.string().trim().max(300), youtube: z.string().trim().max(300), google_business: z.string().trim().max(300) }),
  business_rules: z.object({ vat_rate_bp: z.coerce.number().int().min(0).max(10000), prices_include_vat: z.boolean(), diagnostic_fee_cents: z.coerce.number().int().min(0), diagnostic_fee_deducted_when_repaired: z.boolean(), refused_quote_return_fee_cents: z.coerce.number().int().min(0), unrepairable_return_fee_cents: z.coerce.number().int().min(0), no_fault_found_fee_cents: z.coerce.number().int().min(0), quote_validity_days: z.coerce.number().int().min(1).max(90), review_request_delay_days: z.coerce.number().int().min(0).max(60), unclaimed_console_days: z.coerce.number().int().min(7).max(365) }),
  warranty: z.object({ default_months: z.coerce.number().int().min(0).max(60), scope: z.string().trim().max(1000), exclusions: z.string().trim().max(1000) }),
  shipping_info: z.object({ intro: z.string().trim().max(1000), return_carrier_note: z.string().trim().max(500), workshop_receiving_name: z.string().trim().max(120), workshop_receiving_address: z.string().trim().max(300) }),
  trust: z.object({ company_story: z.string().trim().max(5000), years_of_experience: z.union([z.literal(""), z.coerce.number().int().min(0).max(100)]).transform((v) => (v === "" ? null : v)), team_intro: z.string().trim().max(3000), workshop_intro: z.string().trim().max(3000), new_management_note: z.string().trim().max(3000) }),
  checkout: z.object({ terms_version: z.string().trim().min(1).max(40), show_terms_summary: z.boolean() }),
  shop: z.object({ shipping_enabled: z.boolean(), shipping_fee_cents: z.coerce.number().int().min(0), free_shipping_threshold_cents: z.coerce.number().int().min(0).transform((v) => (v > 0 ? v : null)), pickup_enabled: z.boolean(), pickup_note: z.string().trim().max(500), shipping_note: z.string().trim().max(500) }),
};

export async function saveSettingsAction(key: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const schema = SETTINGS_SCHEMAS[key];
  if (!schema) return fail("Réglage inconnu");
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("__")) continue;
    raw[k] = typeof v === "string" ? v : "";
  }
  // Checkboxes: absent = false, present = true; cents fields arrive in euros
  for (const k of Object.keys(schema instanceof z.ZodObject ? schema.shape : {})) {
    if (k.endsWith("_cents")) raw[k] = Math.round(Number(String(raw[k] ?? "0").replace(",", ".")) * 100);
    if (["prices_include_vat", "diagnostic_fee_deducted_when_repaired", "show_terms_summary", "shipping_enabled", "pickup_enabled"].includes(k)) raw[k] = raw[k] === "on";
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
  const db = createSupabaseAdminClient();
  const { data: old } = await db.from("site_settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db.from("site_settings").upsert({ key, value: parsed.data as Json, is_public: true, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return fail(error.message);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "settings.updated", resourceType: "site_settings", resourceId: key, oldValue: old?.value ?? null, newValue: parsed.data as Json });
  revalidatePath("/", "layout");
  return { ok: true, message: "Réglages enregistrés." };
}

// ---------------------------------------------------------------------------
// Users, roles, technicians
// ---------------------------------------------------------------------------
export async function setUserRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const email = str(formData, "email").toLowerCase();
  const role = str(formData, "role") as UserRole;
  if (!["CUSTOMER", "TECHNICIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) return fail("Rôle invalide");
  if ((role === "SUPER_ADMIN" || role === "ADMIN") && user.profile.role !== "SUPER_ADMIN") return fail("Seul un super administrateur peut nommer un administrateur.");
  const db = createSupabaseAdminClient();
  const { data: profile } = await db.from("profiles").select("*").eq("email", email).maybeSingle();
  if (!profile) return fail("Aucun compte avec cet e-mail. La personne doit d'abord créer son compte.");
  if (profile.id === user.id) return fail("Vous ne pouvez pas modifier votre propre rôle.");
  if (profile.role === "SUPER_ADMIN" && user.profile.role !== "SUPER_ADMIN") return fail("Action réservée au super administrateur.");
  const { error } = await db.from("profiles").update({ role }).eq("id", profile.id);
  if (error) return fail(error.message);
  if (role === "TECHNICIAN" || role === "ADMIN" || role === "SUPER_ADMIN") {
    const { data: workshop } = await db.from("workshops").select("id").eq("is_default", true).maybeSingle();
    await db.from("technicians").upsert({ profile_id: profile.id, workshop_id: workshop?.id ?? null, display_name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || email, is_active: true }, { onConflict: "profile_id" });
  } else {
    await db.from("technicians").update({ is_active: false }).eq("profile_id", profile.id);
  }
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "user.role_changed", resourceType: "profiles", resourceId: profile.id, oldValue: { role: profile.role }, newValue: { role } });
  revalidatePath("/admin/technicians");
  return { ok: true, message: `${email} est maintenant ${role}.` };
}

export async function updateTechnicianAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = str(formData, "technician_id");
  const db = createSupabaseAdminClient();
  await db.from("technicians").update({ display_name: str(formData, "display_name") || "Technicien", specialties: str(formData, "specialties").split(",").map((s) => s.trim()).filter(Boolean), is_active: formData.get("is_active") === "on" }).eq("id", id);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "technician.updated", resourceType: "technicians", resourceId: id });
  revalidatePath("/admin/technicians");
}

// ---------------------------------------------------------------------------
// Reviews moderation
// ---------------------------------------------------------------------------
export async function moderateReviewAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = str(formData, "review_id");
  const decision = str(formData, "decision");
  const db = createSupabaseAdminClient();
  const patch = decision === "approve" ? { status: "APPROVED" as const } : decision === "reject" ? { status: "REJECTED" as const } : decision === "feature" ? { is_featured: true } : decision === "unfeature" ? { is_featured: false } : null;
  if (!patch) return;
  await db.from("reviews").update({ ...patch, moderated_by: user.id, moderated_at: new Date().toISOString() }).eq("id", id);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: `review.${decision}`, resourceType: "reviews", resourceId: id });
  revalidatePath("/admin/reviews");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// SAV handling
// ---------------------------------------------------------------------------
export async function updateSavAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const savId = str(formData, "sav_id");
  const status = str(formData, "status") as SavStatus;
  const body = str(formData, "body");
  const internal = formData.get("internal") === "on";
  if (!Object.keys(SAV_STATUS_LABELS).includes(status)) return fail("Statut invalide");
  const db = createSupabaseAdminClient();
  const { data: sav } = await db.from("sav_requests").select("*").eq("id", savId).maybeSingle();
  if (!sav) return fail("Demande introuvable");
  await db.from("sav_requests").update({ status, assigned_to: user.id, closed_at: status === "CLOSED" ? new Date().toISOString() : null }).eq("id", savId);
  if (body) await db.from("sav_messages").insert({ sav_request_id: savId, author_id: user.id, is_from_staff: true, is_internal: internal, body });
  const order = await getOrderById(sav.order_id);
  if (status !== sav.status || (body && !internal)) {
    await notifyOrderEvent(order, { type: "SAV_UPDATE", status: SAV_STATUS_LABELS[status], message: !internal && body ? body : null });
  }
  await addOrderEvent({ orderId: order.id, type: "SAV_UPDATED", title: `SAV : ${SAV_STATUS_LABELS[status]}`, description: !internal && body ? body.slice(0, 200) : null, isPublic: !internal, actorId: user.id });
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "sav.updated", resourceType: "sav_requests", resourceId: savId, orderId: order.id, oldValue: { status: sav.status }, newValue: { status } });
  revalidatePath(`/admin/sav/${savId}`);
  revalidatePath("/admin/sav");
  return { ok: true, message: "Demande SAV mise à jour." };
}
