"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/form";
import { PhotoPicker } from "@/components/admin/photo-picker";
import { PricingModeField } from "@/components/admin/pricing-mode";
import { buildSku, slugify } from "@/lib/catalog/listing";
import type { ProductCategory } from "@/lib/shop/status";
import type { EntityDef, FieldDef } from "@/lib/admin/entities";
import { deleteEntityAction, saveEntityAction, type EntityActionResult } from "@/app/admin/actions/catalog";

export type SelectOptions = Record<string, { value: string; label: string }[]>;

function defaultValue(field: FieldDef, row: Record<string, unknown> | null): string {
  if (field.type === "spec") {
    const specs = (row?.specs ?? {}) as Record<string, unknown>;
    const v = field.specKey ? specs[field.specKey] : undefined;
    return v == null ? "" : String(v);
  }
  const v = row?.[field.name];
  if (v == null) return "";
  if (field.type === "cents" || field.type === "pricing") return (Number(v) / 100).toFixed(2);
  if (field.type === "list" || field.type === "photos") return Array.isArray(v) ? v.join("\n") : "";
  if (field.type === "json") return JSON.stringify(v, null, 2);
  return String(v);
}

function initialChecked(field: FieldDef, valeurs: Record<string, unknown> | null): boolean {
  if (valeurs && field.name in valeurs) return Boolean(valeurs[field.name]);
  return field.name.startsWith("is_") && !["is_seo_published", "is_diagnostic_only", "is_recommended", "is_current"].includes(field.name);
}

/**
 * Un champ écarté par le rayon reste posté, en caché, avec sa valeur du moment.
 *
 * Sans cela, enregistrer une figurine effacerait sa région, son contenu de
 * boîte et ses caractéristiques — non pas parce qu'on l'a voulu, mais parce que
 * ces champs n'étaient pas à l'écran et que le formulaire ne les postait plus.
 * Masquer une question ne doit jamais effacer une réponse.
 */
function ChampCache({ field, value, checked }: { field: FieldDef; value: string; checked: boolean }) {
  if (field.type === "checkbox") return checked ? <input type="hidden" name={field.name} value="true" /> : null;
  if (field.type === "photos") {
    return (
      <>
        {value
          .split("\n")
          .filter(Boolean)
          .map((p) => (
            <input key={p} type="hidden" name={field.name} value={p} />
          ))}
      </>
    );
  }
  return <input type="hidden" name={field.name} value={value} />;
}

export function EntityForm({
  entityKey,
  entity,
  row,
  defaults,
  selectOptions,
}: {
  entityKey: string;
  entity: Pick<EntityDef, "fields" | "sections" | "categoryField"> & { idField: string };
  row: Record<string, unknown> | null;
  /**
   * Valeurs pré-remplies à la création, et rien d'autre.
   *
   * Séparées de `row` à dessein : `row` signifie « on édite une ligne qui
   * existe », ce qui décide de l'identifiant envoyé et du libellé du bouton.
   * Les confondre ferait dire « Enregistrer » à un formulaire de création et
   * lui ferait poster un identifiant `undefined`.
   */
  defaults?: Record<string, unknown> | null;
  selectOptions: SelectOptions;
}) {
  const bound = saveEntityAction.bind(null, entityKey);
  const [state, action, pending] = useActionState<EntityActionResult | null, FormData>(bound, null);
  const id = row ? String(row[entity.idField]) : "new";
  const valeurs = row ?? defaults ?? null;
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  /**
   * Le rayon décide des champs à l'écran, et il change sous le doigt : on le
   * suit donc en état plutôt que de lire le DOM au moment d'envoyer.
   */
  const champCategorie = entity.categoryField;
  const [categorie, setCategorie] = useState<string>(() => (champCategorie ? defaultValue({ name: champCategorie, label: "", type: "select" }, valeurs) : ""));

  /**
   * Le nom fabrique la référence et l'adresse de la fiche, tant que personne ne
   * les a touchées — et jamais sur une fiche qui existe : changer le SKU ou le
   * slug d'un article déjà en ligne casse un inventaire et des liens partagés.
   */
  const [nom, setNom] = useState<string>(() => defaultValue({ name: "name", label: "", type: "text" }, valeurs));
  const [forces, setForces] = useState<Record<string, string>>({});
  const derive = useMemo(
    () => ({
      sku: nom.trim() ? buildSku((categorie || "CONSOLE") as ProductCategory, nom) : "",
      slug: nom.trim() ? slugify(nom) : "",
    }),
    // Le SKU tire au sort quatre caractères : il ne se recalcule que quand le
    // nom ou le rayon change, pas à chaque rendu — sinon la référence
    // défilerait sous les yeux.
    [nom, categorie],
  );

  /**
   * Un champ propre à un rayon n'apparaît qu'une fois le rayon choisi.
   *
   * Sur une fiche vierge, montrer d'un coup la région, le modèle lié et le
   * personnage reviendrait à reposer la question de départ : on choisit le
   * rayon, puis on répond à ses questions.
   */
  const visible = (f: FieldDef) => !champCategorie || !f.categories || (categorie ? f.categories.includes(categorie) : false);
  const libelle = (f: FieldDef) => (categorie && f.labelByCategory?.[categorie]) || f.label;
  const aide = (f: FieldDef) => (categorie && f.hintByCategory?.[categorie]) || f.hint;

  const sections = entity.sections?.length ? entity.sections : [""];
  const parSection = (nom: string) => entity.fields.filter((f) => !f.advanced && (f.section ?? "") === nom);
  const avances = entity.fields.filter((f) => f.advanced);
  const caches = entity.fields.filter((f) => !visible(f));

  function rendre(field: FieldDef) {
    const full = field.width !== "half";
    const cls = full ? "sm:col-span-2" : "";
    const brut = defaultValue(field, valeurs);
    const value = field.derive && !row ? (forces[field.name] ?? derive[field.derive]) : brut;
    const error = errors[field.name];
    const htmlId = `f_${field.name}`;

    if (field.type === "checkbox") {
      return (
        <label key={field.name} className={`flex items-center gap-2 text-sm text-ink sm:pt-6 ${cls}`}>
          <Checkbox name={field.name} defaultChecked={initialChecked(field, valeurs)} /> {libelle(field)}
        </label>
      );
    }

    if (field.type === "photos") {
      return (
        <Field key={field.name} label={libelle(field)} htmlFor="photos" hint={aide(field)} error={error} className={cls}>
          <PhotoPicker name={field.name} initial={brut.split("\n").filter(Boolean)} />
        </Field>
      );
    }

    // La tarification pilote deux colonnes : elle se rend elle-même, sans
    // l'étiquette de `Field`, qui en annoncerait une seule.
    if (field.type === "pricing") {
      const devis = Boolean(valeurs?.price_is_provisional);
      return (
        <div key={field.name} className={cls}>
          <PricingModeField
            initialMode={devis ? "QUOTE" : "FIXED"}
            initialPriceEuros={devis ? "" : brut}
            label={libelle(field)}
            error={error ?? errors.price_is_provisional}
          />
        </div>
      );
    }

    return (
      <Field key={field.name} label={libelle(field)} htmlFor={htmlId} required={field.required} hint={aide(field)} error={error} className={cls}>
        {field.type === "textarea" || field.type === "list" || field.type === "json" || field.type === "markdown" ? (
          <Textarea id={htmlId} name={field.name} defaultValue={value} className={field.type === "markdown" ? "min-h-[240px] font-mono text-sm" : field.type === "json" ? "min-h-[120px] font-mono text-xs" : undefined} required={field.required} aria-invalid={Boolean(error)} />
        ) : field.type === "select" ? (
          <Select
            id={htmlId}
            name={field.name}
            defaultValue={value}
            required={field.required}
            aria-invalid={Boolean(error)}
            onChange={field.name === champCategorie ? (e) => setCategorie(e.target.value) : undefined}
          >
            <option value="">—</option>
            {(typeof field.options === "string" ? (selectOptions[field.options] ?? []) : (field.options ?? [])).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : field.derive && !row ? (
          // Valeur fabriquée : contrôlée, pour suivre le nom tant qu'on n'y
          // touche pas, et cesser de bouger dès qu'on y touche.
          <Input id={htmlId} name={field.name} value={value} onChange={(e) => setForces((f) => ({ ...f, [field.name]: e.target.value }))} required={field.required} aria-invalid={Boolean(error)} />
        ) : (
          <Input
            id={htmlId}
            name={field.name}
            defaultValue={value}
            onChange={field.name === "name" ? (e) => setNom(e.target.value) : undefined}
            required={field.required}
            aria-invalid={Boolean(error)}
            inputMode={field.type === "cents" || field.type === "number" ? "decimal" : undefined}
            type={field.type === "number" ? "number" : "text"}
            readOnly={Boolean(row) && field.name === entity.idField && entity.idField !== "id"}
          />
        )}
      </Field>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="__id" value={id} />

      {/* Les champs hors rayon, postés sans être montrés. */}
      {caches.map((f) => (
        <ChampCache key={f.name} field={f} value={defaultValue(f, valeurs)} checked={initialChecked(f, valeurs)} />
      ))}

      {sections.map((titre) => {
        const champs = parSection(titre).filter(visible);
        if (!champs.length) return null;
        return (
          <fieldset key={titre || "principal"} className="min-w-0 border-0 p-0">
            {titre ? (
              <legend className="mb-3 w-full border-b border-border pb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">{titre}</legend>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">{champs.map(rendre)}</div>
          </fieldset>
        );
      })}

      {avances.length ? (
        // Un seul repli, pour les champs qu'on ouvre une fois sur vingt. Les
        // multiplier rendrait la page aussi lente à lire qu'avant.
        // `open` sur erreur : un champ obligatoire replié qu'on ne peut pas
        // atteindre bloque l'envoi sans rien dire.
        <details open={avances.some((f) => errors[f.name])} className="min-w-0 border border-border bg-surface-muted px-4 py-3">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">Options avancées</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{avances.filter(visible).map(rendre)}</div>
        </details>
      ) : null}

      <div className="flex flex-col gap-3">
        <FormError message={state && !state.ok ? state.error : null} />
        <FormSuccess message={state?.ok ? (state.message ?? null) : null} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            {row ? "Enregistrer" : "Créer"}
          </Button>
        </div>
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
