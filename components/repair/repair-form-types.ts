/** Données sérialisables passées à la fiche de réparation (client). */
export interface FormModel {
  id: string;
  name: string;
  slug: string;
  tag: string; // marque ou précision affichée en mono sous le nom
}

export interface FormRepair {
  id: string;
  name: string;
  faultName: string;
  faultSlug: string;
  note: string;
  priceCents: number;
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
