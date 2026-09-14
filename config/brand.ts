/**
 * Brand defaults. The final brand name is not decided yet: every value here
 * can be overridden from the back-office (site_settings.brand). Nothing in
 * the codebase should hard-code a brand name — read it through
 * `getBrandSettings()` (lib/settings) or these fallbacks.
 */
export interface BrandSettings {
  name: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  address_line1: string;
  postal_code: string;
  city: string;
  country: string;
  logo_path: string | null;
  hours: string;
  /** Année d'ouverture (affichée « Depuis 1997 » quand renseignée). */
  founded_year: string;
  siret: string;
  legal_form: string;
}

export const BRAND_DEFAULTS: BrandSettings = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "207 MÉDI@ROME",
  tagline: "Réparation de consoles et boutique gaming",
  description:
    "Atelier spécialisé dans la réparation de consoles de jeux — consoles uniquement — et boutique gaming : jeux vidéo, consoles, figurines manga et anime.",
  email: "contact@example.com",
  phone: "",
  address_line1: "",
  postal_code: "",
  city: "",
  country: "France",
  logo_path: null,
  hours: "",
  founded_year: "",
  siret: "",
  legal_form: "",
};
