import { describe, expect, it } from "vitest";
import {
  checkOptionCompatibility,
  filterCompatibleOptions,
  filterCompatiblePacks,
  type CompatibilityContext,
  type CompatibilityRule,
} from "@/lib/repair/compatibility";

const ctxPs5Hdmi: CompatibilityContext = {
  brandId: "playstation",
  modelId: "ps5",
  faultId: "hdmi",
  repairId: "ps5-hdmi",
  includedOptionIds: [],
};
const ctxSwitchUsbC: CompatibilityContext = {
  brandId: "nintendo",
  modelId: "switch",
  faultId: "usb-c",
  repairId: "switch-usb-c",
  includedOptionIds: [],
};

const universal = { id: "cleaning", appliesToAll: true, isActive: true };
const liquidMetal = { id: "liquid-metal", appliesToAll: false, isActive: true };
const ssd = { id: "ssd", appliesToAll: false, isActive: true };
const inactive = { id: "inactive", appliesToAll: true, isActive: false };

const rules: CompatibilityRule[] = [
  { optionId: "liquid-metal", mode: "INCLUDE", modelId: "ps5" },
  { optionId: "ssd", mode: "INCLUDE", brandId: "playstation" },
  { optionId: "ssd", mode: "EXCLUDE", modelId: "ps4" },
  { optionId: "cleaning", mode: "EXCLUDE", repairId: "ps5-thermal" },
];

describe("option compatibility", () => {
  it("universal options are compatible everywhere unless excluded", () => {
    expect(checkOptionCompatibility(universal, rules, ctxPs5Hdmi)).toEqual({ compatible: true });
    expect(checkOptionCompatibility(universal, rules, ctxSwitchUsbC)).toEqual({ compatible: true });
    expect(checkOptionCompatibility(universal, rules, { ...ctxPs5Hdmi, repairId: "ps5-thermal" })).toEqual({
      compatible: false,
      reason: "excluded",
    });
  });

  it("include rules restrict to matching context", () => {
    expect(checkOptionCompatibility(liquidMetal, rules, ctxPs5Hdmi).compatible).toBe(true);
    expect(checkOptionCompatibility(liquidMetal, rules, ctxSwitchUsbC)).toEqual({ compatible: false, reason: "no_include_rule" });
  });

  it("exclude rules win over include rules", () => {
    const ps4 = { ...ctxPs5Hdmi, modelId: "ps4", repairId: "ps4-hdmi" };
    expect(checkOptionCompatibility(ssd, rules, ps4)).toEqual({ compatible: false, reason: "excluded" });
    expect(checkOptionCompatibility(ssd, rules, ctxPs5Hdmi).compatible).toBe(true);
  });

  it("never offers an option already included in the repair", () => {
    const ctx = { ...ctxPs5Hdmi, includedOptionIds: ["cleaning"] };
    expect(checkOptionCompatibility(universal, rules, ctx)).toEqual({ compatible: false, reason: "included" });
  });

  it("inactive options are never offered", () => {
    expect(checkOptionCompatibility(inactive, rules, ctxPs5Hdmi)).toEqual({ compatible: false, reason: "inactive" });
  });

  it("filters lists", () => {
    const result = filterCompatibleOptions([universal, liquidMetal, ssd, inactive], rules, ctxSwitchUsbC);
    expect(result.map((o) => o.id)).toEqual(["cleaning"]);
  });
});

describe("pack compatibility", () => {
  const optionsById = new Map([
    [universal.id, universal],
    [liquidMetal.id, liquidMetal],
    [ssd.id, ssd],
  ]);
  const packs = [
    { id: "pack-clean", isActive: true, optionIds: ["cleaning"] },
    { id: "pack-ps5", isActive: true, optionIds: ["cleaning", "liquid-metal"] },
    { id: "pack-empty", isActive: true, optionIds: [] },
    { id: "pack-off", isActive: false, optionIds: ["cleaning"] },
  ];

  it("keeps packs whose every item is compatible", () => {
    expect(filterCompatiblePacks(packs, optionsById, rules, ctxPs5Hdmi).map((p) => p.id)).toEqual(["pack-clean", "pack-ps5"]);
    expect(filterCompatiblePacks(packs, optionsById, rules, ctxSwitchUsbC).map((p) => p.id)).toEqual(["pack-clean"]);
  });

  it("hides a pack that would resell an included option", () => {
    const ctx = { ...ctxPs5Hdmi, includedOptionIds: ["cleaning"] };
    expect(filterCompatiblePacks(packs, optionsById, rules, ctx)).toEqual([]);
  });
});
