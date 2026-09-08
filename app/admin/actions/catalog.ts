"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createGenericAdminClient } from "@/lib/supabase/generic";
import { requireAdmin } from "@/lib/security/auth";
import { audit } from "@/lib/security/audit";
import { formDataToObject, getEntity } from "@/lib/admin/entities";
import type { Json } from "@/types/database";

export type EntityActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Generic CRUD: schema-less client, the entity zod schema is the validation layer.
function table(name: string) {
  return createGenericAdminClient().from(name);
}

export async function saveEntityAction(entityKey: string, _prev: EntityActionResult | null, formData: FormData): Promise<EntityActionResult> {
  const user = await requireAdmin();
  const entity = getEntity(entityKey);
  if (!entity) return { ok: false, error: "Entité inconnue" };
  const parsed = entity.schema.safeParse(formDataToObject(entity, formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Merci de corriger les champs signalés.", fieldErrors };
  }
  const idField = entity.idField ?? "id";
  const rawId = formData.get("__id");
  const id = typeof rawId === "string" && rawId && rawId !== "new" ? rawId : null;
  const data = parsed.data;

  if (entity.table === "legal_documents" && data.is_current === true) {
    await table("legal_documents").update({ is_current: false }).eq("slug", String(data.slug));
  }

  let result;
  let old: unknown = null;
  if (id) {
    const { data: existing } = await table(entity.table).select("*").eq(idField, id).maybeSingle();
    old = existing;
    result = await table(entity.table).update(data).eq(idField, id).select("*").single();
  } else {
    result = await table(entity.table).insert(data).select("*").single();
  }
  if (result.error) {
    const msg = result.error.message.includes("duplicate") ? "Une entrée avec ce slug/code existe déjà." : result.error.message;
    return { ok: false, error: msg };
  }
  const row = result.data as Record<string, unknown>;
  const newId = String(row[idField]);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: `${entity.table}.${id ? "updated" : "created"}`, resourceType: entity.table, resourceId: newId, oldValue: old as Json, newValue: data as Json });
  for (const path of entity.revalidate) revalidatePath(path, "layout");
  revalidatePath(entity.basePath, "layout");
  if (!id) redirect(`${entity.basePath}/${encodeURIComponent(newId)}`);
  return { ok: true, message: "Enregistré.", id: newId };
}

export async function deleteEntityAction(entityKey: string, formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const entity = getEntity(entityKey);
  if (!entity) return;
  const idField = entity.idField ?? "id";
  const id = String(formData.get("__id") ?? "");
  if (!id) return;
  const { data: existing } = await table(entity.table).select("*").eq(idField, id).maybeSingle();
  const { error } = await table(entity.table).delete().eq(idField, id);
  if (error) {
    // Referenced rows (e.g. repairs used by orders) cannot be deleted: deactivate instead.
    await table(entity.table).update({ is_active: false }).eq(idField, id);
  }
  await audit({ actorId: user.id, actorRole: user.profile.role, action: `${entity.table}.${error ? "deactivated" : "deleted"}`, resourceType: entity.table, resourceId: id, oldValue: existing as Json });
  for (const path of entity.revalidate) revalidatePath(path, "layout");
  revalidatePath(entity.basePath, "layout");
  redirect(entity.basePath);
}

// ---------------------------------------------------------------------------
// Relations: option compatibility, included options, pack items, checklist items
// ---------------------------------------------------------------------------
const compatSchema = z.object({ option_id: z.string().uuid(), mode: z.enum(["INCLUDE", "EXCLUDE"]), brand_id: z.string().uuid().nullable(), model_id: z.string().uuid().nullable(), fault_id: z.string().uuid().nullable(), repair_id: z.string().uuid().nullable() });

export async function addCompatibilityRuleAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const nul = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v ? v : null;
  };
  const parsed = compatSchema.safeParse({ option_id: formData.get("option_id"), mode: formData.get("mode"), brand_id: nul("brand_id"), model_id: nul("model_id"), fault_id: nul("fault_id"), repair_id: nul("repair_id") });
  if (!parsed.success || (!parsed.data.brand_id && !parsed.data.model_id && !parsed.data.fault_id && !parsed.data.repair_id)) return;
  await createSupabaseAdminClient().from("repair_option_compatibility").insert(parsed.data);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "option.compatibility_added", resourceType: "repair_option_compatibility", resourceId: parsed.data.option_id, newValue: parsed.data });
  revalidatePath(`/admin/options/${parsed.data.option_id}`);
  revalidatePath("/reparation", "layout");
}

export async function removeCompatibilityRuleAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = String(formData.get("rule_id") ?? "");
  const optionId = String(formData.get("option_id") ?? "");
  await createSupabaseAdminClient().from("repair_option_compatibility").delete().eq("id", id);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "option.compatibility_removed", resourceType: "repair_option_compatibility", resourceId: id });
  revalidatePath(`/admin/options/${optionId}`);
  revalidatePath("/reparation", "layout");
}

export async function toggleIncludedOptionAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const repairId = String(formData.get("repair_id") ?? "");
  const optionId = String(formData.get("option_id") ?? "");
  const included = formData.get("included") === "1";
  const db = createSupabaseAdminClient();
  if (included) await db.from("repair_included_options").insert({ repair_id: repairId, option_id: optionId });
  else await db.from("repair_included_options").delete().eq("repair_id", repairId).eq("option_id", optionId);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: included ? "repair.included_option_added" : "repair.included_option_removed", resourceType: "repairs", resourceId: repairId, newValue: { option_id: optionId } });
  revalidatePath(`/admin/catalog/repairs/${repairId}`);
  revalidatePath("/reparation", "layout");
}

export async function togglePackItemAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const packId = String(formData.get("pack_id") ?? "");
  const optionId = String(formData.get("option_id") ?? "");
  const included = formData.get("included") === "1";
  const db = createSupabaseAdminClient();
  if (included) await db.from("pack_items").insert({ pack_id: packId, option_id: optionId });
  else await db.from("pack_items").delete().eq("pack_id", packId).eq("option_id", optionId);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: included ? "pack.item_added" : "pack.item_removed", resourceType: "packs", resourceId: packId, newValue: { option_id: optionId } });
  revalidatePath(`/admin/packs/${packId}`);
  revalidatePath("/reparation", "layout");
}

export async function saveChecklistItemsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const checklistId = String(formData.get("checklist_id") ?? "");
  const lines = String(formData.get("items") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const db = createSupabaseAdminClient();
  await db.from("test_checklist_items").delete().eq("checklist_id", checklistId);
  if (lines.length) await db.from("test_checklist_items").insert(lines.map((label, i) => ({ checklist_id: checklistId, label, display_order: i + 1 })));
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "checklist.items_updated", resourceType: "test_checklists", resourceId: checklistId, newValue: { items: lines } });
  revalidatePath(`/admin/settings/checklists/${checklistId}`);
}
