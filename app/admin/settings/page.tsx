import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Section } from "@/components/admin/ui";
import { SettingsForm, type SettingField } from "@/components/admin/settings-forms";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { getAllSettings } from "@/lib/settings";

const BRAND: SettingField[] = [
  { name: "name", label: "Nom de l'entreprise / marque" }, { name: "tagline", label: "Accroche" }, { name: "email", label: "E-mail de contact", type: "email" }, { name: "phone", label: "Téléphone" },
  { name: "address_line1", label: "Adresse" }, { name: "postal_code", label: "Code postal" }, { name: "city", label: "Ville" }, { name: "country", label: "Pays" },
  { name: "hours", label: "Horaires" }, { name: "founded_year", label: "Année d'ouverture" }, { name: "siret", label: "SIRET" }, { name: "legal_form", label: "Forme juridique" }, { name: "logo_path", label: "Logo (chemin content-media)" },
  { name: "description", label: "Description (meta par défaut, pied de page)", type: "textarea" },
];
const RULES: SettingField[] = [
  { name: "vat_rate_bp", label: "TVA (points de base, 2000 = 20 %)", type: "number" }, { name: "prices_include_vat", label: "Prix affichés TTC", type: "checkbox" },
  { name: "diagnostic_fee_cents", label: "Tarif diagnostic (€)", type: "cents" }, { name: "diagnostic_fee_deducted_when_repaired", label: "Diagnostic déduit/inclus si réparation", type: "checkbox" },
  { name: "refused_quote_return_fee_cents", label: "Frais de retour si refus de devis (€)", type: "cents" }, { name: "unrepairable_return_fee_cents", label: "Frais de retour si irréparable (€)", type: "cents" },
  { name: "no_fault_found_fee_cents", label: "Frais si aucune panne constatée (€)", type: "cents" }, { name: "quote_validity_days", label: "Validité d'un devis (jours)", type: "number" },
  { name: "review_request_delay_days", label: "Délai avant demande d'avis (jours après livraison)", type: "number" }, { name: "unclaimed_console_days", label: "Console non réclamée après (jours)", type: "number" },
];
const WARRANTY: SettingField[] = [{ name: "default_months", label: "Durée par défaut (mois)", type: "number" }, { name: "scope", label: "Périmètre", type: "textarea" }, { name: "exclusions", label: "Exclusions", type: "textarea" }];
const SHIPPING: SettingField[] = [{ name: "workshop_receiving_name", label: "Nom du destinataire (atelier)" }, { name: "workshop_receiving_address", label: "Adresse de réception (communiquée après paiement)" }, { name: "intro", label: "Texte transport (checkout)", type: "textarea" }, { name: "return_carrier_note", label: "Note sur le retour", type: "textarea" }];
const TRUST: SettingField[] = [{ name: "years_of_experience", label: "Années d'expérience (vide si non communiqué)", type: "number" }, { name: "company_story", label: "Historique de l'entreprise", type: "textarea" }, { name: "new_management_note", label: "Nouvelle direction / nouvelles procédures", type: "textarea" }, { name: "workshop_intro", label: "Présentation de l'atelier", type: "textarea" }, { name: "team_intro", label: "Présentation des techniciens", type: "textarea" }];
const SOCIAL: SettingField[] = [{ name: "instagram", label: "Instagram" }, { name: "facebook", label: "Facebook" }, { name: "tiktok", label: "TikTok" }, { name: "youtube", label: "YouTube" }, { name: "google_business", label: "Fiche Google" }];
const SHOP: SettingField[] = [{ name: "pickup_enabled", label: "Retrait au magasin possible", type: "checkbox" }, { name: "shipping_enabled", label: "Envoi possible", type: "checkbox" }, { name: "shipping_fee_cents", label: "Frais d'envoi (€)", type: "cents" }, { name: "free_shipping_threshold_cents", label: "Envoi offert à partir de (€, 0 = jamais)", type: "cents" }, { name: "pickup_note", label: "Note retrait (affichée au client)", type: "textarea" }, { name: "shipping_note", label: "Note envoi (affichée au client)", type: "textarea" }];
const CHECKOUT: SettingField[] = [{ name: "terms_version", label: "Version des CGV acceptée au checkout", hint: "Enregistrée sur chaque commande" }, { name: "show_terms_summary", label: "Afficher le résumé des conditions avant paiement", type: "checkbox" }];

export default async function SettingsPage() {
  await requireAdminOrRedirect();
  const s = await getAllSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Réglages" description="Configuration commerciale et informations de l'entreprise. Rien n'est codé en dur." actions={<Link href="/admin/settings/checklists" className="text-sm text-accent hover:underline">Checklists de tests →</Link>} />
      <Section title="Entreprise et marque"><SettingsForm settingKey="brand" values={s.brand as unknown as Record<string, unknown>} fields={BRAND} /></Section>
      <Section title="Règles métier" description="Diagnostic, refus de devis, irréparable, TVA, délais. Ces règles sont affichées au client avant paiement."><SettingsForm settingKey="business_rules" values={s.business_rules as unknown as Record<string, unknown>} fields={RULES} /></Section>
      <Section title="Garantie par défaut"><SettingsForm settingKey="warranty" values={s.warranty as unknown as Record<string, unknown>} fields={WARRANTY} /></Section>
      <Section title="Transport"><SettingsForm settingKey="shipping_info" values={s.shipping_info as unknown as Record<string, unknown>} fields={SHIPPING} /></Section>
      <Section title="Confiance et réputation" description="Ne renseignez que des informations réelles : rien n'est inventé par le site."><SettingsForm settingKey="trust" values={s.trust as unknown as Record<string, unknown>} fields={TRUST} /></Section>
      <Section title="Réseaux sociaux"><SettingsForm settingKey="social" values={s.social as unknown as Record<string, unknown>} fields={SOCIAL} /></Section>
      <Section title="Boutique (vente)"><SettingsForm settingKey="shop" values={s.shop as unknown as Record<string, unknown>} fields={SHOP} /></Section>
      <Section title="Checkout"><SettingsForm settingKey="checkout" values={s.checkout as unknown as Record<string, unknown>} fields={CHECKOUT} /></Section>
    </div>
  );
}
