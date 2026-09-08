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
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { formatPrice } from "@/lib/utils/format";

/** Loads the options for select fields (brands, models, faults, categories). */
export async function loadSelectOptions(): Promise<SelectOptions> {
  const db = createSupabaseAdminClient();
  const [brands, models, faults, cats] = await Promise.all([
    db.from("brands").select("id, name").order("display_order"),
    db.from("console_models").select("id, name, brand:brands(name)").order("display_order"),
    db.from("faults").select("id, name").order("display_order"),
    db.from("option_categories").select("id, name").order("display_order"),
  ]);
  return {
    brands: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    models: (models.data ?? []).map((m) => ({ value: m.id, label: `${(m.brand as { name: string } | null)?.name ?? ""} ${m.name}`.trim() })),
    faults: (faults.data ?? []).map((f) => ({ value: f.id, label: f.name })),
    option_categories: (cats.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  };
}

function cell(column: string, value: unknown, options: SelectOptions): React.ReactNode {
  if (column.endsWith("_cents")) return <span className="tabular-nums">{formatPrice(Number(value ?? 0))}</span>;
  if (typeof value === "boolean") return <Badge tone={value ? "success" : "neutral"}>{value ? "Oui" : "Non"}</Badge>;
  if (column === "brand_id") return options.brands?.find((o) => o.value === value)?.label ?? "—";
  if (column === "model_id") return options.models?.find((o) => o.value === value)?.label ?? "Générique";
  if (column === "fault_id") return options.faults?.find((o) => o.value === value)?.label ?? "—";
  if (value == null || value === "") return "—";
  return String(value).slice(0, 80);
}

const COLUMN_LABELS: Record<string, string> = {
  name: "Nom", slug: "Slug", display_order: "Ordre", is_active: "Actif", brand_id: "Marque", model_id: "Modèle", fault_id: "Panne", price_cents: "Prix", is_seo_published: "SEO", applies_to_all: "Universelle", is_recommended: "Recommandée", code: "Code", provider_code: "Transporteur", includes_outbound: "Aller", includes_return: "Retour", question: "Question", category: "Catégorie", title: "Titre", image_path: "Image", is_published: "Publié", version: "Version", is_current: "En vigueur", path: "Chemin", no_index: "No-index", key: "Clé", source: "Source", campaign: "Campagne", period_start: "Début", period_end: "Fin", amount_cents: "Montant",
};

export async function EntityListPage({ entityKey, title, description, extra }: { entityKey: string; title?: string; description?: string; extra?: React.ReactNode }) {
  await requireAdminOrRedirect();
  const entity = getEntity(entityKey);
  if (!entity) notFound();
  const idField = entity.idField ?? "id";
  const orderBy = entity.fields.some((f) => f.name === "display_order") ? "display_order" : entity.fields.some((f) => f.name === "name") ? "name" : idField;
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

export async function EntityEditPage({ entityKey, id, children }: { entityKey: string; id: string; children?: (row: Record<string, unknown>) => Promise<React.ReactNode> | React.ReactNode }) {
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
  const options = await loadSelectOptions();
  const label = row ? String(row.name ?? row.title ?? row.question ?? row[idField]) : `Nouveau : ${entity.label}`;
  return (
    <div className="space-y-6">
      <div>
        <Link href={entity.basePath} className="text-xs text-ink-muted hover:text-ink">← {entity.labelPlural}</Link>
        <PageHeader className="mt-1" title={label} actions={row ? <DeleteEntityButton entityKey={entityKey} id={String(row[idField])} label={label} /> : undefined} />
      </div>
      <div className="rounded-lg border border-border bg-surface p-5">
        <EntityForm entityKey={entityKey} entity={entity} row={row} selectOptions={options} />
      </div>
      {row && children ? await children(row) : null}
    </div>
  );
}
