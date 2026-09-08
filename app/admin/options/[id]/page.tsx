import { EntityEditPage, loadSelectOptions } from "@/components/admin/entity-pages";
import { Section } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addCompatibilityRuleAction, removeCompatibilityRuleAction } from "@/app/admin/actions/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntityEditPage entityKey="repair_options" id={id}>
      {async (row) => {
        const optionId = String(row.id);
        const db = createSupabaseAdminClient();
        const [{ data: rules }, options, { data: repairs }] = await Promise.all([
          db.from("repair_option_compatibility").select("*").eq("option_id", optionId).order("created_at"),
          loadSelectOptions(),
          db.from("repairs").select("id, name").order("name"),
        ]);
        const label = (kind: "brands" | "models" | "faults", value: string | null) => (value ? (options[kind]?.find((o) => o.value === value)?.label ?? value) : null);
        return (
          <Section title="Compatibilité" description={row.applies_to_all ? "Option universelle : compatible partout, sauf règles d'EXCLUSION ci-dessous." : "Option restreinte : proposée uniquement quand une règle d'INCLUSION correspond, sauf EXCLUSION."}>
            <ul className="mb-4 space-y-2 text-sm">
              {(rules ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.mode === "INCLUDE" ? "success" : "danger"}>{r.mode === "INCLUDE" ? "Inclure" : "Exclure"}</Badge>
                    {[label("brands", r.brand_id) && `Marque : ${label("brands", r.brand_id)}`, label("models", r.model_id) && `Modèle : ${label("models", r.model_id)}`, label("faults", r.fault_id) && `Panne : ${label("faults", r.fault_id)}`, r.repair_id && `Réparation : ${(repairs ?? []).find((x) => x.id === r.repair_id)?.name ?? r.repair_id}`].filter(Boolean).join(" · ")}
                  </span>
                  <form action={removeCompatibilityRuleAction}>
                    <input type="hidden" name="rule_id" value={r.id} />
                    <input type="hidden" name="option_id" value={optionId} />
                    <button type="submit" className="text-xs text-danger hover:underline">Retirer</button>
                  </form>
                </li>
              ))}
              {!rules?.length ? <li className="text-ink-muted">Aucune règle.</li> : null}
            </ul>
            <form action={addCompatibilityRuleAction} className="grid gap-2 sm:grid-cols-6">
              <input type="hidden" name="option_id" value={optionId} />
              <Select name="mode" aria-label="Mode" defaultValue="INCLUDE"><option value="INCLUDE">Inclure</option><option value="EXCLUDE">Exclure</option></Select>
              <Select name="brand_id" aria-label="Marque" defaultValue=""><option value="">Marque : toutes</option>{options.brands?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              <Select name="model_id" aria-label="Modèle" defaultValue=""><option value="">Modèle : tous</option>{options.models?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              <Select name="fault_id" aria-label="Panne" defaultValue=""><option value="">Panne : toutes</option>{options.faults?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              <Select name="repair_id" aria-label="Réparation" defaultValue=""><option value="">Réparation : toutes</option>{(repairs ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
              <Button type="submit" size="sm" variant="outline">Ajouter la règle</Button>
            </form>
            <p className="mt-2 text-xs text-ink-muted">Une règle s&apos;applique quand tous ses critères renseignés correspondent (marque ET modèle ET panne ET réparation).</p>
          </Section>
        );
      }}
    </EntityEditPage>
  );
}
