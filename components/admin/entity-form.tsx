"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/form";
import type { EntityDef, FieldDef } from "@/lib/admin/entities";
import { deleteEntityAction, saveEntityAction, type EntityActionResult } from "@/app/admin/actions/catalog";

export type SelectOptions = Record<string, { value: string; label: string }[]>;

function defaultValue(field: FieldDef, row: Record<string, unknown> | null): string {
  const v = row?.[field.name];
  if (v == null) return "";
  if (field.type === "cents") return (Number(v) / 100).toFixed(2);
  if (field.type === "list") return Array.isArray(v) ? v.join("\n") : "";
  if (field.type === "json") return JSON.stringify(v, null, 2);
  return String(v);
}

export function EntityForm({ entityKey, entity, row, selectOptions }: { entityKey: string; entity: EntityDef; row: Record<string, unknown> | null; selectOptions: SelectOptions }) {
  const bound = saveEntityAction.bind(null, entityKey);
  const [state, action, pending] = useActionState<EntityActionResult | null, FormData>(bound, null);
  const id = row ? String(row[entity.idField ?? "id"]) : "new";
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="__id" value={id} />
      {entity.fields.map((field) => {
        const full = field.width !== "half";
        const cls = full ? "sm:col-span-2" : "";
        const value = defaultValue(field, row);
        const error = errors[field.name];
        const htmlId = `f_${field.name}`;
        if (field.type === "checkbox") {
          return (
            <label key={field.name} className={`flex items-center gap-2 pt-6 text-sm text-ink ${cls}`}>
              <Checkbox name={field.name} defaultChecked={row ? Boolean(row[field.name]) : field.name.startsWith("is_") && field.name !== "is_seo_published" && field.name !== "is_diagnostic_only" && field.name !== "is_recommended" && field.name !== "is_current"} /> {field.label}
            </label>
          );
        }
        return (
          <Field key={field.name} label={field.label} htmlFor={htmlId} required={field.required} hint={field.hint} error={error} className={cls}>
            {field.type === "textarea" || field.type === "list" || field.type === "json" || field.type === "markdown" ? (
              <Textarea id={htmlId} name={field.name} defaultValue={value} className={field.type === "markdown" ? "min-h-[240px] font-mono text-sm" : field.type === "json" ? "min-h-[120px] font-mono text-xs" : undefined} required={field.required} aria-invalid={Boolean(error)} />
            ) : field.type === "select" ? (
              <Select id={htmlId} name={field.name} defaultValue={value} required={field.required} aria-invalid={Boolean(error)}>
                <option value="">—</option>
                {(typeof field.options === "string" ? (selectOptions[field.options] ?? []) : (field.options ?? [])).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id={htmlId} name={field.name} defaultValue={value} required={field.required} aria-invalid={Boolean(error)} inputMode={field.type === "cents" || field.type === "number" ? "decimal" : undefined} type={field.type === "number" ? "number" : "text"} readOnly={Boolean(row) && field.name === (entity.idField ?? "") } />
            )}
          </Field>
        );
      })}
      <div className="sm:col-span-2">
        <FormError message={state && !state.ok ? state.error : null} />
        <FormSuccess message={state?.ok ? (state.message ?? null) : null} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={pending}>
          {row ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteEntityButton({ entityKey, id, label }: { entityKey: string; id: string; label: string }) {
  const bound = deleteEntityAction.bind(null, entityKey);
  return (
    <form
      action={bound}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer « ${label} » ? Si l'élément est utilisé par des dossiers, il sera seulement désactivé.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="__id" value={id} />
      <Button type="submit" variant="danger" size="sm">
        Supprimer
      </Button>
    </form>
  );
}
