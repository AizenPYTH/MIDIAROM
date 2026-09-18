/** Données sérialisables passées à la fiche de réparation (client). */
export interface FormModel {
  id: string;
  name: string;
  /** « PS5 », « Switch OLED » : le nom court du catalogue, quand il existe. */
  short: string;
  slug: string;
  tag: string; // précision affichée en mono sous le nom (variantes ou année)
  brandId: string;
  brandName: string;
  brandSlug: string;
  isRetro: boolean;
  commonIssues: string[];
}

/** Plateforme (étape 1) : une marque du catalogue, ou le regroupement « Rétro ». */
export interface FormPlatform {
  key: string;
  label: string;
  note: string;
  /**
   * Le nom du visuel de la famille (`lib/content/platform-visuals.ts`).
   *
   * C'est le slug de la marque, pas son identifiant : `key` porte un UUID, qui
   * ne nommera jamais un fichier. La tuile restait donc noire.
   */
  visuel: string;
}

export interface FormRepair {
  id: string;
  name: string;
  faultName: string;
  faultSlug: string;
  note: string;
  priceCents: number;
  /** Catégorie du catalogue client (« Image & HDMI », « Charge & USB-C »…). */
  categoryName: string | null;
  categoryOrder: number;
  /**
   * Paraît dans la liste courte proposée d'emblée (`repairs.is_featured`).
   *
   * Optionnelles, et c'est volontaire : les deux colonnes arrivent par une
   * migration appliquée à la main sur Supabase, et le code peut tourner avant
   * elle. `listeCourte` sait quoi faire de leur absence.
   */
  isFeatured?: boolean;
  featuredOrder?: number;
  displayOrder?: number;
  /** Le catalogue fourni ne comporte pas de prix : la prestation est annoncée sur devis. */
  priceProvisional: boolean;
  isDiagnosticOnly: boolean;
  warrantyMonths: number;
  leadTimeMin: number | null;
  leadTimeMax: number | null;
  includedItems: string[];
}

export interface FormOption {
  id: string;
  name: string;
  note: string;
  priceCents: number;
  isRecommended: boolean;
}

export interface FormPack extends FormOption {
  optionIds: string[];
}

export interface FormShipping {
  id: string;
  name: string;
  note: string;
  priceCents: number;
  includesOutbound: boolean;
  includesReturn: boolean;
}

export interface FormOffer {
  repairId: string;
  options: FormOption[];
  packs: FormPack[];
  shippingMethods: FormShipping[];
  /**
   * Ce que l'intervention couvre déjà, par son nom.
   *
   * Le serveur retire ces options de `options` — on ne vend pas deux fois le
   * même geste. Sans leur nom, le client cherche « nettoyage » dans une liste
   * qui n'en contient pas et croit l'atelier incomplet. La liste est donc
   * annoncée, et la règle reste appliquée côté serveur.
   */
  includedNames: string[];
}

export interface FormConditions {
  refusalExplanation: string;
  refusalFeeCents: number;
  unrepairableFeeCents: number;
  quoteValidityDays: number;
  cgvVersion: string | null;
}

export interface FormCustomer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface FormAddress {
  line1: string;
  line2: string;
  postal_code: string;
  city: string;
}
