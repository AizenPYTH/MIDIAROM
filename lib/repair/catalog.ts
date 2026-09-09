import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";
import {
  filterCompatibleOptions,
  filterCompatiblePacks,
  type CompatibilityContext,
  type CompatibilityRule,
} from "@/lib/repair/compatibility";

export type Brand = Tables<"brands">;
export type ConsoleModel = Tables<"console_models">;
export type Fault = Tables<"faults">;
export type Repair = Tables<"repairs">;
export type RepairOption = Tables<"repair_options">;
export type Pack = Tables<"packs">;
export type ShippingMethod = Tables<"shipping_methods">;

export interface RepairWithRelations extends Repair {
  model: ConsoleModel & { brand: Brand };
  fault: Fault;
}

export interface PackWithItems extends Pack {
  optionIds: string[];
  options: RepairOption[];
}

export interface RepairOffer {
  repair: RepairWithRelations;
  options: RepairOption[];
  packs: PackWithItems[];
  includedOptionIds: string[];
  shippingMethods: ShippingMethod[];
}

/**
 * Catalog reads use the admin client on purpose: the catalog is public data
 * (RLS also allows anonymous reads of active rows) and these queries run in
 * Server Components / actions only. Inactive rows are filtered explicitly.
 */
const db = () => createSupabaseAdminClient();

export const getActiveBrands = cache(async (): Promise<Brand[]> => {
  const { data } = await db().from("brands").select("*").eq("is_active", true).order("display_order");
  return data ?? [];
});

export const getActiveModels = cache(async (brandId?: string): Promise<ConsoleModel[]> => {
  let query = db().from("console_models").select("*").eq("is_active", true).order("display_order");
  if (brandId) query = query.eq("brand_id", brandId);
  const { data } = await query;
  return data ?? [];
});

export const getModelBySlug = cache(async (slug: string): Promise<(ConsoleModel & { brand: Brand }) | null> => {
  const { data } = await db()
    .from("console_models")
    .select("*, brand:brands(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!data || !data.brand) return null;
  return { ...data, brand: data.brand as Brand };
});

/** Active repairs for a model with their fault (used by /reparation/[model]). */
export const getRepairsForModel = cache(async (modelId: string): Promise<(Repair & { fault: Fault })[]> => {
  const { data } = await db()
    .from("repairs")
    .select("*, fault:faults(*)")
    .eq("model_id", modelId)
    .eq("is_active", true)
    .order("display_order");
  return (data ?? [])
    .filter((r) => r.fault && (r.fault as Fault).is_active)
    .map((r) => ({ ...r, fault: r.fault as Fault }));
});

export const getRepairBySlugs = cache(async (modelSlug: string, faultSlug: string): Promise<RepairWithRelations | null> => {
  const model = await getModelBySlug(modelSlug);
  if (!model) return null;
  const { data } = await db()
    .from("repairs")
    .select("*, fault:faults!inner(*)")
    .eq("model_id", model.id)
    .eq("is_active", true)
    .eq("fault.slug", faultSlug)
    .maybeSingle();
  if (!data || !data.fault) return null;
  return { ...data, model, fault: data.fault as Fault };
});

export const getRepairById = cache(async (repairId: string): Promise<RepairWithRelations | null> => {
  const { data } = await db()
    .from("repairs")
    .select("*, fault:faults(*), model:console_models(*, brand:brands(*))")
    .eq("id", repairId)
    .maybeSingle();
  if (!data || !data.fault || !data.model) return null;
  const model = data.model as ConsoleModel & { brand: Brand | null };
  if (!model.brand) return null;
  return { ...data, fault: data.fault as Fault, model: { ...model, brand: model.brand } };
});

/** Models that have at least one active repair (the only ones worth indexing). */
export const getModelsWithActiveRepairs = cache(async (): Promise<ConsoleModel[]> => {
  const [models, { data: repairs }] = await Promise.all([getActiveModels(), db().from("repairs").select("model_id").eq("is_active", true)]);
  const withRepairs = new Set((repairs ?? []).map((r) => r.model_id));
  return models.filter((m) => withRepairs.has(m.id));
});

export const getActiveShippingMethods = cache(async (): Promise<ShippingMethod[]> => {
  const { data } = await db().from("shipping_methods").select("*").eq("is_active", true).order("display_order");
  return data ?? [];
});

export const getSeoPublishedRepairs = cache(async () => {
  const { data } = await db()
    .from("repairs")
    .select("id, slug, updated_at, fault:faults!inner(slug, is_active), model:console_models!inner(slug, is_active)")
    .eq("is_active", true)
    .eq("is_seo_published", true);
  return (data ?? [])
    .map((r) => ({
      id: r.id,
      updatedAt: r.updated_at,
      modelSlug: (r.model as { slug: string; is_active: boolean }).slug,
      faultSlug: (r.fault as { slug: string; is_active: boolean }).slug,
      modelActive: (r.model as { is_active: boolean }).is_active,
      faultActive: (r.fault as { is_active: boolean }).is_active,
    }))
    .filter((r) => r.modelActive && r.faultActive);
});

/**
 * Builds the complete offer for a repair: compatible options, compatible
 * packs, included options and shipping methods. Used by the repair page,
 * the checkout AND the server-side pricing (single source of truth).
 */
export async function getRepairOffer(repair: RepairWithRelations): Promise<RepairOffer> {
  const client = db();
  const [{ data: options }, { data: rules }, { data: included }, { data: packs }, { data: packItems }, shippingMethods] =
    await Promise.all([
      client.from("repair_options").select("*").eq("is_active", true).order("display_order"),
      client.from("repair_option_compatibility").select("*"),
      client.from("repair_included_options").select("option_id").eq("repair_id", repair.id),
      client.from("packs").select("*").eq("is_active", true).order("display_order"),
      client.from("pack_items").select("*").order("display_order"),
      getActiveShippingMethods(),
    ]);

  const includedOptionIds = (included ?? []).map((i) => i.option_id);
  const ctx: CompatibilityContext = {
    brandId: repair.model.brand_id,
    modelId: repair.model_id,
    faultId: repair.fault_id,
    repairId: repair.id,
    includedOptionIds,
  };
  const compatRules: CompatibilityRule[] = (rules ?? []).map((r) => ({
    optionId: r.option_id,
    mode: r.mode,
    brandId: r.brand_id,
    modelId: r.model_id,
    faultId: r.fault_id,
    repairId: r.repair_id,
  }));

  const allOptions = (options ?? []).map((o) => ({ ...o, appliesToAll: o.applies_to_all, isActive: o.is_active }));
  const optionsById = new Map(allOptions.map((o) => [o.id, o]));
  const compatibleOptions = filterCompatibleOptions(allOptions, compatRules, ctx);

  const packsWithItems = (packs ?? []).map((p) => {
    const optionIds = (packItems ?? []).filter((pi) => pi.pack_id === p.id).map((pi) => pi.option_id);
    return {
      ...p,
      isActive: p.is_active,
      optionIds,
      options: optionIds.map((id) => optionsById.get(id)).filter((o): o is (typeof allOptions)[number] => Boolean(o)),
    };
  });
  const compatiblePacks = filterCompatiblePacks(packsWithItems, optionsById, compatRules, ctx);

  const strip = <T extends { appliesToAll?: boolean; isActive?: boolean }>(o: T) => {
    const { appliesToAll: _a, isActive: _b, ...rest } = o;
    return rest;
  };

  return {
    repair,
    options: compatibleOptions.map((o) => strip(o) as RepairOption),
    packs: compatiblePacks.map((p) => ({ ...(strip(p) as Pack), optionIds: p.optionIds, options: p.options.map((o) => strip(o) as RepairOption) })),
    includedOptionIds,
    shippingMethods,
  };
}

export const getFaults = cache(async (): Promise<Fault[]> => {
  const { data } = await db().from("faults").select("*").eq("is_active", true).order("display_order");
  return data ?? [];
});
