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
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Atelier Console",
  tagline: "Réparation de consoles à distance",
  description:
    "Atelier spécialisé dans la réparation de consoles de jeux, partout en France.",
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
