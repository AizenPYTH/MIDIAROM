import { z } from "zod";
import { SLUG_REGEX } from "@/lib/utils/slug";

/**
 * Declarative definitions for the generic admin CRUD (catalog, content…).
 * Each entity maps form fields to a zod schema; the server action validates,
 * writes with the admin client after `requireAdmin()`, audits and revalidates.
 */
export type FieldType = "text" | "textarea" | "markdown" | "number" | "cents" | "checkbox" | "select" | "slug" | "list" | "json";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[] | "brands" | "models" | "faults" | "option_categories";
  width?: "full" | "half";
}

export interface EntityDef {
  table:
    | "brands"
    | "console_models"
    | "faults"
    | "repairs"
    | "repair_options"
    | "packs"
    | "shipping_methods"
    | "faq_items"
    | "packaging_instructions"
    | "gallery_items"
    | "legal_documents"
    | "seo_pages"
    | "content_blocks"
    | "test_checklists"
    | "option_categories"
    | "marketing_costs";
  label: string;
  labelPlural: string;
  basePath: string;
  idField?: string; // default "id"
  fields: FieldDef[];
  schema: z.ZodType<Record<string, unknown>>;
  revalidate: string[];
  /** Columns shown in the list view. */
  listColumns: string[];
}

const text = (max = 200) => z.string().trim().max(max);
const optText = (max = 4000) => z.string().trim().max(max).transform((v) => (v ? v : null));
const slug = z.string().trim().regex(SLUG_REGEX, "Slug invalide (minuscules, chiffres, tirets)");
const bool = z.boolean();
const int = z.coerce.number().int();
const nullableInt = z.union([z.literal(""), z.coerce.number().int()]).transform((v) => (v === "" ? null : v));
const nullableUuid = z.union([z.literal(""), z.string().uuid()]).transform((v) => (v ? v : null));
const list = z.array(z.string().trim().min(1));

export const ENTITIES: Record<string, EntityDef> = {
  brands: {
    table: "brands",
    label: "Marque",
    labelPlural: "Marques",
    basePath: "/admin/catalog/brands",
    listColumns: ["name", "slug", "display_order", "is_active"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "slug", label: "Slug", type: "slug", required: true, width: "half" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "is_active", label: "Actif", type: "checkbox", width: "half" },
    ],
    schema: z.object({ name: text(80).min(1), slug, description: optText(), display_order: int.default(0), is_active: bool.default(true) }),
    revalidate: ["/", "/reparation"],
  },
  console_models: {
    table: "console_models",
    label: "Modèle",
    labelPlural: "Modèles",
    basePath: "/admin/catalog/models",
    listColumns: ["name", "slug", "brand_id", "display_order", "is_active"],
    fields: [
      { name: "brand_id", label: "Marque", type: "select", options: "brands", required: true, width: "half" },
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "slug", label: "Slug (URL /reparation/[slug])", type: "slug", required: true, width: "half" },
      { name: "short_name", label: "Nom court", type: "text", width: "half" },
      { name: "release_year", label: "Année", type: "number", width: "half" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "seo_title", label: "SEO — title", type: "text" },
      { name: "seo_description", label: "SEO — meta description", type: "textarea" },
      { name: "seo_intro", label: "SEO — introduction de la page modèle", type: "textarea" },
      { name: "image_path", label: "Image (chemin content-media)", type: "text", width: "half" },
      { name: "is_active", label: "Actif", type: "checkbox", width: "half" },
    ],
    schema: z.object({ brand_id: z.string().uuid(), name: text(80).min(1), slug, short_name: optText(40), release_year: nullableInt, display_order: int.default(0), description: optText(), seo_title: optText(200), seo_description: optText(400), seo_intro: optText(), image_path: optText(300), is_active: bool.default(true) }),
    revalidate: ["/", "/reparation"],
  },
  faults: {
    table: "faults",
    label: "Panne",
    labelPlural: "Pannes",
    basePath: "/admin/catalog/faults",
    listColumns: ["name", "slug", "display_order", "is_active"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "slug", label: "Slug (URL /reparation/[modèle]/[slug])", type: "slug", required: true, width: "half" },
      { name: "short_description", label: "Description courte (symptômes)", type: "text" },
      { name: "icon", label: "Icône (lucide)", type: "select", width: "half", options: ["MonitorOff", "Power", "Usb", "BatteryWarning", "Thermometer", "Disc", "Plug", "HardDrive", "Cable", "Gamepad2", "Smartphone", "HelpCircle", "Wrench"].map((v) => ({ value: v, label: v })) },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "is_active", label: "Active", type: "checkbox" },
    ],
    schema: z.object({ name: text(80).min(1), slug, short_description: optText(200), icon: optText(40), display_order: int.default(0), is_active: bool.default(true) }),
    revalidate: ["/reparation"],
  },
  repairs: {
    table: "repairs",
    label: "Réparation",
    labelPlural: "Réparations",
    basePath: "/admin/catalog/repairs",
    listColumns: ["name", "model_id", "fault_id", "price_cents", "is_active", "is_seo_published"],
    fields: [
      { name: "model_id", label: "Modèle", type: "select", options: "models", required: true, width: "half" },
      { name: "fault_id", label: "Panne", type: "select", options: "faults", required: true, width: "half" },
      { name: "name", label: "Nom de la prestation", type: "text", required: true, width: "half" },
      { name: "slug", label: "Slug (fiche)", type: "slug", required: true, width: "half" },
      { name: "summary", label: "Résumé (une phrase)", type: "text" },
      { name: "description", label: "Description (markdown)", type: "markdown" },
      { name: "price_cents", label: "Prix TTC (€)", type: "cents", required: true, width: "half" },
      { name: "compare_at_price_cents", label: "Prix barré (€)", type: "cents", width: "half" },
      { name: "estimated_cost_cents", label: "Coût pièces estimé (€)", type: "cents", width: "half", hint: "Pour le calcul de marge" },
      { name: "estimated_minutes", label: "Temps estimé (min)", type: "number", width: "half" },
      { name: "lead_time_days_min", label: "Délai min (jours)", type: "number", width: "half" },
      { name: "lead_time_days_max", label: "Délai max (jours)", type: "number", width: "half" },
      { name: "warranty_months", label: "Garantie (mois)", type: "number", width: "half" },
      { name: "warranty_scope", label: "Périmètre de garantie", type: "text", width: "half" },
      { name: "warranty_exclusions", label: "Exclusions de garantie", type: "text" },
      { name: "included_items", label: "Inclus (une ligne par élément)", type: "list" },
      { name: "important_notes", label: "Informations importantes (avant commande)", type: "textarea" },
      { name: "is_diagnostic_only", label: "Prestation de diagnostic uniquement", type: "checkbox", width: "half" },
      { name: "is_active", label: "Active (commandable)", type: "checkbox", width: "half" },
      { name: "is_seo_published", label: "Page SEO publiée (/reparation/modèle/panne indexée + sitemap)", type: "checkbox" },
      { name: "seo_title", label: "SEO — title", type: "text" },
      { name: "seo_description", label: "SEO — meta description", type: "textarea" },
      { name: "seo_h1", label: "SEO — H1", type: "text" },
      { name: "seo_symptoms", label: "Symptômes", type: "textarea" },
      { name: "seo_causes", label: "Causes", type: "textarea" },
      { name: "seo_process", label: "Procédure de réparation", type: "textarea" },
      { name: "seo_faq", label: 'FAQ (JSON : [{"question":"…","answer":"…"}])', type: "json" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
    ],
    schema: z.object({
      model_id: z.string().uuid(),
      fault_id: z.string().uuid(),
      name: text(120).min(1),
      slug,
      summary: optText(300),
      description: optText(20000),
      price_cents: int.min(0),
      compare_at_price_cents: nullableInt,
      estimated_cost_cents: int.min(0).default(0),
      estimated_minutes: int.min(0).default(0),
      lead_time_days_min: nullableInt,
      lead_time_days_max: nullableInt,
      warranty_months: int.min(0).default(0),
      warranty_scope: optText(500),
      warranty_exclusions: optText(1000),
      included_items: list.default([]),
      important_notes: optText(2000),
      is_diagnostic_only: bool.default(false),
      is_active: bool.default(true),
      is_seo_published: bool.default(false),
      seo_title: optText(200),
      seo_description: optText(400),
      seo_h1: optText(200),
      seo_symptoms: optText(),
      seo_causes: optText(),
      seo_process: optText(),
      seo_faq: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).default([]),
      display_order: int.default(0),
    }),
    revalidate: ["/", "/reparation", "/sitemap.xml"],
  },
  repair_options: {
    table: "repair_options",
    label: "Option",
    labelPlural: "Options",
    basePath: "/admin/options",
    listColumns: ["name", "price_cents", "applies_to_all", "is_recommended", "is_active", "display_order"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "slug", label: "Slug", type: "slug", required: true, width: "half" },
      { name: "category_id", label: "Catégorie", type: "select", options: "option_categories", width: "half" },
      { name: "price_cents", label: "Prix TTC (€)", type: "cents", required: true, width: "half" },
      { name: "estimated_cost_cents", label: "Coût estimé (€)", type: "cents", width: "half" },
      { name: "estimated_minutes", label: "Durée estimée (min)", type: "number", width: "half" },
      { name: "short_description", label: "Description courte", type: "text" },
      { name: "description", label: "Description détaillée", type: "textarea" },
      { name: "applies_to_all", label: "Compatible avec toutes les réparations (sauf exclusions)", type: "checkbox", width: "half" },
      { name: "is_recommended", label: "Recommandée (mise en avant)", type: "checkbox", width: "half" },
      { name: "is_active", label: "Active", type: "checkbox", width: "half" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
    ],
    schema: z.object({ name: text(100).min(1), slug, category_id: nullableUuid, price_cents: int.min(0), estimated_cost_cents: int.min(0).default(0), estimated_minutes: int.min(0).default(0), short_description: optText(300), description: optText(), applies_to_all: bool.default(false), is_recommended: bool.default(false), is_active: bool.default(true), display_order: int.default(0) }),
    revalidate: ["/reparation"],
  },
  option_categories: {
    table: "option_categories",
    label: "Catégorie d'option",
    labelPlural: "Catégories d'options",
    basePath: "/admin/options/categories",
    listColumns: ["name", "slug", "display_order"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "slug", label: "Slug", type: "slug", required: true, width: "half" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
    ],
    schema: z.object({ name: text(60).min(1), slug, display_order: int.default(0) }),
    revalidate: [],
  },
  packs: {
    table: "packs",
    label: "Pack",
    labelPlural: "Packs",
    basePath: "/admin/packs",
    listColumns: ["name", "price_cents", "is_recommended", "is_active", "display_order"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "slug", label: "Slug", type: "slug", required: true, width: "half" },
      { name: "price_cents", label: "Prix du pack TTC (€)", type: "cents", required: true, width: "half", hint: "Doit rester inférieur à la somme des options" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "short_description", label: "Description courte", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "is_recommended", label: "Recommandé", type: "checkbox", width: "half" },
      { name: "is_active", label: "Actif", type: "checkbox", width: "half" },
    ],
    schema: z.object({ name: text(100).min(1), slug, price_cents: int.min(0), display_order: int.default(0), short_description: optText(300), description: optText(), is_recommended: bool.default(false), is_active: bool.default(true) }),
    revalidate: ["/reparation"],
  },
  shipping_methods: {
    table: "shipping_methods",
    label: "Formule de transport",
    labelPlural: "Transport",
    basePath: "/admin/shipping",
    listColumns: ["name", "code", "price_cents", "provider_code", "includes_outbound", "includes_return", "is_active"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "code", label: "Code", type: "slug", required: true, width: "half" },
      { name: "description", label: "Description (affichée au checkout)", type: "textarea" },
      { name: "price_cents", label: "Prix client TTC (€)", type: "cents", required: true, width: "half" },
      { name: "estimated_cost_cents", label: "Coût réel estimé (€)", type: "cents", width: "half" },
      { name: "provider_code", label: "Transporteur (code provider)", type: "select", width: "half", options: [{ value: "mock", label: "mock (développement)" }, { value: "none", label: "Aucun (manuel / dépôt)" }] },
      { name: "provider_service_code", label: "Code service transporteur", type: "text", width: "half" },
      { name: "includes_outbound", label: "Étiquette aller fournie", type: "checkbox", width: "half" },
      { name: "includes_return", label: "Retour inclus", type: "checkbox", width: "half" },
      { name: "insurance_cents", label: "Valeur assurée (€)", type: "cents", width: "half" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "is_active", label: "Active", type: "checkbox" },
    ],
    schema: z.object({ name: text(100).min(1), code: slug, description: optText(500), price_cents: int.min(0), estimated_cost_cents: int.min(0).default(0), provider_code: text(40).min(1), provider_service_code: optText(60), includes_outbound: bool.default(true), includes_return: bool.default(true), insurance_cents: int.min(0).default(0), display_order: int.default(0), is_active: bool.default(true) }),
    revalidate: [],
  },
  faq_items: {
    table: "faq_items",
    label: "Question FAQ",
    labelPlural: "FAQ",
    basePath: "/admin/content/faq",
    listColumns: ["question", "category", "display_order", "is_active"],
    fields: [
      { name: "category", label: "Catégorie", type: "select", width: "half", options: ["general", "envoi", "reparation", "garantie", "donnees", "suivi", "commande"].map((v) => ({ value: v, label: v })) },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "question", label: "Question", type: "text", required: true },
      { name: "answer", label: "Réponse", type: "textarea", required: true },
      { name: "is_active", label: "Publiée", type: "checkbox" },
    ],
    schema: z.object({ category: text(40).min(1), display_order: int.default(0), question: text(300).min(3), answer: z.string().trim().min(3).max(4000), is_active: bool.default(true) }),
    revalidate: ["/", "/faq", "/comment-ca-marche"],
  },
  packaging_instructions: {
    table: "packaging_instructions",
    label: "Instruction d'emballage",
    labelPlural: "Emballage",
    basePath: "/admin/content/packaging",
    listColumns: ["title", "model_id", "display_order", "is_active"],
    fields: [
      { name: "model_id", label: "Modèle (vide = générique)", type: "select", options: "models", width: "half" },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "title", label: "Titre", type: "text", required: true },
      { name: "body", label: "Texte", type: "textarea", required: true },
      { name: "image_path", label: "Illustration (chemin content-media)", type: "text" },
      { name: "is_active", label: "Publiée", type: "checkbox" },
    ],
    schema: z.object({ model_id: nullableUuid, display_order: int.default(0), title: text(200).min(1), body: z.string().trim().min(3).max(4000), image_path: optText(300), is_active: bool.default(true) }),
    revalidate: ["/emballage"],
  },
  gallery_items: {
    table: "gallery_items",
    label: "Photo",
    labelPlural: "Galerie",
    basePath: "/admin/content/gallery",
    listColumns: ["title", "category", "image_path", "display_order", "is_published"],
    fields: [
      { name: "category", label: "Catégorie", type: "select", width: "half", options: ["workshop", "repair", "before_after", "team"].map((v) => ({ value: v, label: v })) },
      { name: "display_order", label: "Ordre", type: "number", width: "half" },
      { name: "image_path", label: "Image (chemin dans content-media)", type: "text", required: true, hint: "Téléversez le fichier via « Médias publics » puis collez le chemin." },
      { name: "title", label: "Titre", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "is_published", label: "Publiée", type: "checkbox" },
    ],
    schema: z.object({ category: text(40).min(1), display_order: int.default(0), image_path: text(300).min(1), title: optText(200), description: optText(1000), is_published: bool.default(true) }),
    revalidate: ["/comment-ca-marche", "/confiance"],
  },
  legal_documents: {
    table: "legal_documents",
    label: "Document légal",
    labelPlural: "Documents légaux",
    basePath: "/admin/content/legal",
    listColumns: ["title", "slug", "version", "is_current"],
    fields: [
      { name: "slug", label: "Type", type: "select", width: "half", options: [{ value: "cgv", label: "CGV" }, { value: "confidentialite", label: "Confidentialité" }, { value: "mentions-legales", label: "Mentions légales" }] },
      { name: "version", label: "Version", type: "text", required: true, width: "half" },
      { name: "title", label: "Titre", type: "text", required: true },
      { name: "body", label: "Contenu (markdown)", type: "markdown", required: true },
      { name: "is_current", label: "Version en vigueur (désactive les autres versions du même type)", type: "checkbox" },
    ],
    schema: z.object({ slug: text(40).min(1), version: text(40).min(1), title: text(200).min(1), body: z.string().trim().min(3).max(200000), is_current: bool.default(false) }),
    revalidate: ["/cgv", "/confidentialite", "/mentions-legales"],
  },
  seo_pages: {
    table: "seo_pages",
    label: "Page SEO",
    labelPlural: "Pages SEO (statiques)",
    basePath: "/admin/content/seo",
    idField: "path",
    listColumns: ["path", "title", "no_index"],
    fields: [
      { name: "path", label: "Chemin (ex : /faq)", type: "text", required: true, width: "half" },
      { name: "no_index", label: "Ne pas indexer", type: "checkbox", width: "half" },
      { name: "title", label: "Title", type: "text" },
      { name: "description", label: "Meta description", type: "textarea" },
      { name: "canonical", label: "Canonical (facultatif)", type: "text" },
    ],
    schema: z.object({ path: z.string().trim().regex(/^\/[a-z0-9\-/]*$/, "Chemin invalide"), no_index: bool.default(false), title: optText(200), description: optText(400), canonical: optText(300) }),
    revalidate: ["/"],
  },
  content_blocks: {
    table: "content_blocks",
    label: "Bloc de contenu",
    labelPlural: "Blocs de contenu",
    basePath: "/admin/content/blocks",
    idField: "key",
    listColumns: ["key", "title", "is_published"],
    fields: [
      { name: "key", label: "Clé", type: "text", required: true, width: "half", hint: "ex : homepage.hero" },
      { name: "is_published", label: "Publié", type: "checkbox", width: "half" },
      { name: "title", label: "Titre", type: "text" },
      { name: "body", label: "Texte (markdown)", type: "markdown" },
      { name: "data", label: "Données structurées (JSON)", type: "json" },
    ],
    schema: z.object({ key: z.string().trim().regex(/^[a-z0-9_.-]+$/), is_published: bool.default(true), title: optText(300), body: optText(20000), data: z.record(z.string(), z.unknown()).default({}) }),
    revalidate: ["/", "/comment-ca-marche", "/confiance", "/reparation"],
  },
  test_checklists: {
    table: "test_checklists",
    label: "Checklist de tests",
    labelPlural: "Checklists de tests",
    basePath: "/admin/settings/checklists",
    listColumns: ["name", "model_id", "is_active"],
    fields: [
      { name: "name", label: "Nom", type: "text", required: true, width: "half" },
      { name: "model_id", label: "Modèle (vide = générique)", type: "select", options: "models", width: "half" },
      { name: "is_active", label: "Active", type: "checkbox" },
    ],
    schema: z.object({ name: text(100).min(1), model_id: nullableUuid, is_active: bool.default(true) }),
    revalidate: [],
  },
  marketing_costs: {
    table: "marketing_costs",
    label: "Dépense marketing",
    labelPlural: "Dépenses marketing",
    basePath: "/admin/analytics/costs",
    listColumns: ["source", "campaign", "period_start", "period_end", "amount_cents"],
    fields: [
      { name: "source", label: "Source (google, meta…)", type: "text", required: true, width: "half" },
      { name: "campaign", label: "Campagne", type: "text", width: "half" },
      { name: "period_start", label: "Début (AAAA-MM-JJ)", type: "text", required: true, width: "half" },
      { name: "period_end", label: "Fin (AAAA-MM-JJ)", type: "text", required: true, width: "half" },
      { name: "amount_cents", label: "Montant (€)", type: "cents", required: true, width: "half" },
      { name: "notes", label: "Notes", type: "text" },
    ],
    schema: z.object({ source: text(60).min(1), campaign: optText(200), period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount_cents: int.min(0), notes: optText(500) }),
    revalidate: [],
  },
};

export function getEntity(key: string): EntityDef | null {
  return ENTITIES[key] ?? null;
}

/** Converts a FormData into the plain object expected by the entity schema. */
export function formDataToObject(entity: EntityDef, formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of entity.fields) {
    const raw = formData.get(field.name);
    const value = typeof raw === "string" ? raw : "";
    switch (field.type) {
      case "checkbox":
        out[field.name] = raw === "on" || raw === "true";
        break;
      case "cents": {
        const n = Math.round(Number(value.replace(",", ".")) * 100);
        out[field.name] = value === "" ? "" : Number.isFinite(n) ? n : Number.NaN;
        break;
      }
      case "number":
        out[field.name] = value;
        break;
      case "list":
        out[field.name] = value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "json":
        try {
          out[field.name] = value ? JSON.parse(value) : field.name === "data" ? {} : [];
        } catch {
          out[field.name] = Number.NaN; // forces a validation error
        }
        break;
      default:
        out[field.name] = value;
    }
  }
  return out;
}
