import { EntityEditPage } from "@/components/admin/entity-pages";
import { Section } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saveChecklistItemsAction } from "@/app/admin/actions/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntityEditPage entityKey="test_checklists" id={id}>
      {async (row) => {
        const checklistId = String(row.id);
        const { data: items } = await createSupabaseAdminClient().from("test_checklist_items").select("label").eq("checklist_id", checklistId).order("display_order");
        return (
          <Section title="Points de contrôle" description="Un test par ligne, dans l'ordre d'exécution.">
            <form action={saveChecklistItemsAction} className="space-y-3">
              <input type="hidden" name="checklist_id" value={checklistId} />
              <Textarea name="items" defaultValue={(items ?? []).map((i) => i.label).join("\n")} className="min-h-[200px] font-mono text-sm" aria-label="Points de contrôle" />
              <Button type="submit" size="sm">Enregistrer les points de contrôle</Button>
            </form>
          </Section>
        );
      }}
    </EntityEditPage>
  );
}
