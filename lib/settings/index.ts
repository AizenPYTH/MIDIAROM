import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BRAND_DEFAULTS, type BrandSettings } from "@/config/brand";
import { DEFAULT_BUSINESS_RULES, type BusinessRules } from "@/lib/quotes/rules";
import type { Json } from "@/types/database";

/**
 * Site settings (site_settings table). Read with the admin client because
 * public settings are needed on anonymous pages and the values are curated
 * by administrators. Only `is_public` keys are ever rendered to visitors.
 */
export interface WarrantySettings {
  default_months: number;
  scope: string;
  exclusions: string;
}
export interface ShippingInfoSettings {
  intro: string;
  return_carrier_note: string;
  workshop_receiving_name: string;
  workshop_receiving_address: string;
}
export interface TrustSettings {
  company_story: string;
  years_of_experience: number | null;
  team_intro: string;
  workshop_intro: string;
  new_management_note: string;
}
export interface SocialSettings {
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  google_business: string;
}
export interface ShopSettings {
  shipping_enabled: boolean;
  shipping_fee_cents: number;
  free_shipping_threshold_cents: number | null;
  pickup_enabled: boolean;
  pickup_note: string;
  shipping_note: string;
}
export interface CheckoutSettings {
  terms_version: string;
  show_terms_summary: boolean;
}

export interface SettingsMap {
  brand: BrandSettings;
  business_rules: BusinessRules;
  warranty: WarrantySettings;
  shipping_info: ShippingInfoSettings;
  trust: TrustSettings;
  social: SocialSettings;
  checkout: CheckoutSettings;
  shop: ShopSettings;
}

const DEFAULTS: SettingsMap = {
  brand: { ...BRAND_DEFAULTS },
  business_rules: DEFAULT_BUSINESS_RULES,
  warranty: { default_months: 0, scope: "", exclusions: "" },
  shipping_info: { intro: "", return_carrier_note: "", workshop_receiving_name: "", workshop_receiving_address: "" },
  trust: { company_story: "", years_of_experience: null, team_intro: "", workshop_intro: "", new_management_note: "" },
  social: { instagram: "", facebook: "", tiktok: "", youtube: "", google_business: "" },
  checkout: { terms_version: "draft", show_terms_summary: true },
  shop: { shipping_enabled: true, shipping_fee_cents: 690, free_shipping_threshold_cents: null, pickup_enabled: true, pickup_note: "", shipping_note: "" },
};

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const getSetting = cache(async <K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> => {
  try {
    const { data } = await createSupabaseAdminClient().from("site_settings").select("value").eq("key", key).maybeSingle();
    if (data && isRecord(data.value)) {
      return { ...DEFAULTS[key], ...(data.value as Partial<SettingsMap[K]>) };
    }
  } catch (error) {
    console.error(`[settings] failed to load ${key}`, error);
  }
  return DEFAULTS[key];
});

export const getBrandSettings = () => getSetting("brand");
export const getBusinessRules = () => getSetting("business_rules");

export async function getAllSettings(): Promise<SettingsMap> {
  const [brand, business_rules, warranty, shipping_info, trust, social, checkout, shop] = await Promise.all([
    getSetting("brand"),
    getSetting("business_rules"),
    getSetting("warranty"),
    getSetting("shipping_info"),
    getSetting("trust"),
    getSetting("social"),
    getSetting("checkout"),
    getSetting("shop"),
  ]);
  return { brand, business_rules, warranty, shipping_info, trust, social, checkout, shop };
}
