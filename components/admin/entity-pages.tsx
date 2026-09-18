import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/admin/ui";
import { EntityForm, DeleteEntityButton, type SelectOptions } from "@/components/admin/entity-form";
import { getEntity } from "@/lib/admin/entities";
import { createGenericAdminClient } from "@/lib/supabase/generic";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRayons } from "@/lib/shop/categories";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { formatPrice } from "@/lib/utils/format";

/** Loads the options for select fields (brands, models, faults, categories). */
export async function loadSelectOptions(): Promise<SelectOptions> {
  const db = createSupabaseAdminClient();
  const [brands, models, faults, cats, familles, rayons] = await Promise.all([
    db.from("brands").select("id, name").order("display_order"),
    db.from("console_models").select("id, name, brand:brands(name)").order("display_order"),
    db.from("faults").select("id, name").order("display_order"),
    db.from("option_categories").select("id, name").order("display_order"),
    db.from("repair_categories").select("id, name").eq("is_active", true).order("display_order"),
    getRayons(),
  ]);
  return {
    brands: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    models: (models.data ?? []).map((m) => ({ value: m.id, label: `${(m.brand as { name: string } | null)?.name ?? ""} ${m.name}`.trim() })),
    faults: (faults.data ?? []).map((f) => ({ value: f.id, label: f.name })),
    option_categories: (cats.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    // Les familles de pannes (« Image & HDMI », « Charge & USB-C »…). Elles
    // groupent le catalogue derrière « Autre problème » : une prestation sans
    // famille y atterrit dans « Autres prestations ».
    repair_categories: (familles.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    // Les rayons de la boutique, y compris ceux ouverts par le vendeur. Le
    // libellé au singulier : on choisit **un** rayon pour **un** article.
    rayons: rayons.map((r) => ({ value: r.code, label: r.short })),
  };
}

/** Le mot que chaque rayon emploie pour `products.platform`. */
async function motsDeTag(): Promise<Record<string, string>> {
  return Object.fromEntries((await getRayons()).map((r) => [r.code, r.tagLabel]));
}

function cell(column: string, value: unknown, options: SelectOptions): React.ReactNode {
  if (column.endsWith("_cents")) return <span className="tabular-nums">{formatPrice(Number(value ?? 0))}</span>;
  if (typeof value === "boolean") return <Badge tone={value ? "success" : "neutral"}>{value ? "Oui" : "Non"}</Badge>;
  if (column === "brand_id") return options.brands?.find((o) => o.value === value)?.label ?? "—";
  if (column === "model_id") return options.models?.find((o) => o.value === value)?.label ?? "Générique";
  if (column === "fault_id") return options.faults?.find((o) => o.value === value)?.label ?? "—";
  if (column === "category_id") return options.repair_categories?.find((o) => o.value === value)?.label ?? options.option_categories?.find((o) => o.value === value)?.label ?? "—";
  if (column === "condition" && typeof value === "string") return ({ NEW: "Neuf", REFURBISHED: "Révisé", USED_A: "Occasion A", USED_B: "Occasion B", USED_C: "Occasion C" } as Record<string, string>)[value] ?? value;
  if (column === "quantity") return <span className={Number(value) === 0 ? "font-mono text-danger" : "font-mono"}>{String(value)}</span>;
  if (value == null || value === "") return "—";
  return String(value).slice(0, 80);
}

const COLUMN_LABELS: Record<string, string> = {
  name: "Nom", slug: "Slug", display_order: "Ordre", is_active: "Actif", brand_id: "Marque", model_id: "Modèle", fault_id: "Panne", price_cents: "Prix", is_seo_published: "SEO", applies_to_all: "Universelle", is_recommended: "Recommandée", code: "Code", provider_code: "Transporteur", includes_outbound: "Aller", includes_return: "Retour", question: "Question", category: "Catégorie", title: "Titre", image_path: "Image", is_published: "Publié", version: "Version", is_current: "En vigueur", path: "Chemin", no_index: "No-index", key: "Clé", sku: "SKU", platform: "Plateforme / licence", condition: "État", quantity: "Stock", family: "Famille", source: "Source", campaign: "Campagne", period_start: "Début", period_end: "Fin", amount_cents: "Montant", label: "Nom", label_singular: "Au singulier", position: "Ordre", is_public: "En boutique", tag_label: "Ligne du dessus", is_featured: "Fréquent", featured_order: "Rang", category_id: "Famille",
};

export async function EntityListPage({ entityKey, title, description, extra }: { entityKey: string; title?: string; description?: string; extra?: React.ReactNode }) {
  await requireAdminOrRedirect();
  const entity = getEntity(entityKey);
  if (!entity) notFound();
  const idField = entity.idField ?? "id";
  // Une liste se lit dans l'ordre où elle s'affiche. On cherche donc la colonne
  // de rang que l'entité porte — `display_order` ou `position` — avant de se
  // rabattre sur un nom, puis sur l'identifiant. Trier par identifiant une liste
  // qui a un ordre d'affichage donne un classement que personne ne reconnaît.
  const colonne = (n: string) => entity.fields.some((f) => f.name === n);
  const orderBy = colonne("display_order") ? "display_order" : colonne("position") ? "position" : colonne("name") ? "name" : colonne("label") ? "label" : idField;
  const [{ data }, options] = await Promise.all([createGenericAdminClient().from(entity.table).select("*").order(orderBy, { ascending: true }).limit(500), loadSelectOptions()]);
  const rows = (data ?? []) as Record<string, unknown>[];
  return (
    <div className="space-y-6">
      <PageHeader title={title ?? entity.labelPlural} description={description} actions={<ButtonLink href={`${entity.basePath}/new`} size="sm">+ {entity.label}</ButtonLink>} />
      {extra}
      <Table>
        <thead>
          <tr>
            {entity.listColumns.map((c) => (
              <Th key={c}>{COLUMN_LABELS[c] ?? c}</Th>
            ))}
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = String(row[idField]);
            return (
              <tr key={id} className="hover:bg-surface-muted/60">
                {entity.listColumns.map((c) => (
                  <Td key={c}>{c === entity.listColumns[0] ? <Link href={`${entity.basePath}/${encodeURIComponent(id)}`} className="font-medium text-accent hover:underline">{cell(c, row[c], options)}</Link> : cell(c, row[c], options)}</Td>
                ))}
                <Td className="text-right"><Link href={`${entity.basePath}/${encodeURIComponent(id)}`} className="text-xs text-accent hover:underline">Modifier</Link></Td>
              </tr>
            );
          })}
          {!rows.length ? (
            <tr>
              <Td colSpan={entity.listColumns.length + 1} className="text-center text-ink-muted">Aucun élément.</Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
    </div>
  );
}

export async function EntityEditPage({
  entityKey,
  id,
  defaults,
  children,
}: {
  entityKey: string;
  id: string;
  /**
   * Valeurs pré-remplies à la création.
   *
   * L'accueil du back-office propose « Publier un jeu vidéo » et « Publier une
   * console » : ces deux boutons doivent ouvrir un formulaire dont la catégorie
   * est déjà la bonne. Sans cela, ils mènent au même écran vide et le choix
   * proposé sur l'accueil n'était qu'un décor.
   *
   * Ignoré à l'édition : une valeur d'URL ne doit pas pouvoir réécrire une
   * ligne existante.
   */
  defaults?: Record<string, unknown>;
  children?: (row: Record<string, unknown>) => Promise<React.ReactNode> | React.ReactNode;
}) {
  await requireAdminOrRedirect();
  const entity = getEntity(entityKey);
  if (!entity) notFound();
  const idField = entity.idField ?? "id";
  const isNew = id === "new";
  let row: Record<string, unknown> | null = null;
  if (!isNew) {
    const { data } = await createGenericAdminClient().from(entity.table).select("*").eq(idField, decodeURIComponent(id)).maybeSingle();
    if (!data) notFound();
    row = data as Record<string, unknown>;
  }
  const [options, tags] = await Promise.all([loadSelectOptions(), motsDeTag()]);
  const prefill = isNew && defaults && Object.keys(defaults).length ? defaults : null;
  const label = row ? String(row.name ?? row.title ?? row.question ?? row[idField]) : `Nouveau : ${entity.label}`;
  return (
    <div className="space-y-6">
      <div>
        <Link href={entity.basePath} className="text-xs text-ink-muted hover:text-ink">← {entity.labelPlural}</Link>
        <PageHeader className="mt-1" title={label} actions={row ? <DeleteEntityButton entityKey={entityKey} id={String(row[idField])} label={label} /> : undefined} />
      </div>
      <div className="rounded-lg border border-border bg-surface p-5">
        <EntityForm entityKey={entityKey} entity={{ fields: entity.fields, sections: entity.sections, categoryField: entity.categoryField, idField: entity.idField ?? "id" }} row={row} defaults={prefill} selectOptions={options} motsDeTag={tags} />
      </div>
      {row && children ? await children(row) : null}
    </div>
  );
}
