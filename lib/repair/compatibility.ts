import type { Enums } from "@/types/database";

/**
 * Option / pack compatibility engine.
 * Pure functions: no database access, fully unit-tested.
 */
export type CompatibilityMode = Enums<"compatibility_mode">;

export interface CompatibilityRule {
  optionId: string;
  mode: CompatibilityMode;
  brandId?: string | null;
  modelId?: string | null;
  faultId?: string | null;
  repairId?: string | null;
}

export interface CompatibilityContext {
  brandId: string;
  modelId: string;
  faultId: string;
  repairId: string;
  /** Options already included in the base repair (never sold on top). */
  includedOptionIds: readonly string[];
}

export interface OptionLike {
  id: string;
  appliesToAll: boolean;
  isActive: boolean;
}

export interface PackLike {
  id: string;
  isActive: boolean;
  optionIds: readonly string[];
}

function ruleMatches(rule: CompatibilityRule, ctx: CompatibilityContext): boolean {
  if (rule.brandId && rule.brandId !== ctx.brandId) return false;
  if (rule.modelId && rule.modelId !== ctx.modelId) return false;
  if (rule.faultId && rule.faultId !== ctx.faultId) return false;
  if (rule.repairId && rule.repairId !== ctx.repairId) return false;
  // A rule with no constraint at all is invalid (DB check prevents it); treat as non-matching.
  return Boolean(rule.brandId || rule.modelId || rule.faultId || rule.repairId);
}

export type IncompatibilityReason = "inactive" | "included" | "excluded" | "no_include_rule";

export function checkOptionCompatibility(
  option: OptionLike,
  rules: readonly CompatibilityRule[],
  ctx: CompatibilityContext,
): { compatible: true } | { compatible: false; reason: IncompatibilityReason } {
  if (!option.isActive) return { compatible: false, reason: "inactive" };
  if (ctx.includedOptionIds.includes(option.id)) return { compatible: false, reason: "included" };
  const own = rules.filter((r) => r.optionId === option.id);
  if (own.some((r) => r.mode === "EXCLUDE" && ruleMatches(r, ctx))) {
    return { compatible: false, reason: "excluded" };
  }
  if (option.appliesToAll) return { compatible: true };
  if (own.some((r) => r.mode === "INCLUDE" && ruleMatches(r, ctx))) return { compatible: true };
  return { compatible: false, reason: "no_include_rule" };
}

export function isOptionCompatible(option: OptionLike, rules: readonly CompatibilityRule[], ctx: CompatibilityContext): boolean {
  return checkOptionCompatibility(option, rules, ctx).compatible;
}

/** Returns only the options that may be sold with the given repair. */
export function filterCompatibleOptions<T extends OptionLike>(
  options: readonly T[],
  rules: readonly CompatibilityRule[],
  ctx: CompatibilityContext,
): T[] {
  return options.filter((o) => isOptionCompatible(o, rules, ctx));
}

/**
 * A pack is compatible when it is active, has at least one item, and EVERY
 * item is compatible with the repair. If any item is already included in the
 * repair, the pack would sell something already paid for: it is hidden.
 */
export function isPackCompatible(
  pack: PackLike,
  optionsById: ReadonlyMap<string, OptionLike>,
  rules: readonly CompatibilityRule[],
  ctx: CompatibilityContext,
): boolean {
  if (!pack.isActive || pack.optionIds.length === 0) return false;
  return pack.optionIds.every((id) => {
    const option = optionsById.get(id);
    return option ? isOptionCompatible(option, rules, ctx) : false;
  });
}

export function filterCompatiblePacks<T extends PackLike>(
  packs: readonly T[],
  optionsById: ReadonlyMap<string, OptionLike>,
  rules: readonly CompatibilityRule[],
  ctx: CompatibilityContext,
): T[] {
  return packs.filter((p) => isPackCompatible(p, optionsById, rules, ctx));
}
