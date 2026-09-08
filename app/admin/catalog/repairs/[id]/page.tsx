import { EntityEditPage } from "@/components/admin/entity-pages";
import { Section } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRepairById, getRepairOffer } from "@/lib/repair/catalog";
import { toggleIncludedOptionAction } from "@/app/admin/actions/catalog";
import { formatPrice } from "@/lib/utils/format";
import { ROUTES } from "@/config/site";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntityEditPage entityKey="repairs" id={id}>
      {async (row) => {
        const db = createSupabaseAdminClient();
        const repairId = String(row.id);
        const [{ data: options }, { data: included }, repair] = await Promise.all([
          db.from("repair_options").select("id, name, price_cents, is_active").order("display_order"),
          db.from("repair_included_options").select("option_id").eq("repair_id", repairId),
          getRepairById(repairId),
        ]);
        const includedSet = new Set((included ?? []).map((i) => i.option_id));
        const offer = repair ? await getRepairOffer(repair) : null;
        return (
          <>
            {repair ? (
              <p className="text-sm text-ink-muted">
                Page publique :{" "}
                <a href={`${ROUTES.repair}/${repair.model.slug}/${repair.fault.slug}`} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                  {ROUTES.repair}/{repair.model.slug}/{repair.fault.slug}
                </a>
              </p>
            ) : null}
            <Section title="Prestations déjà incluses" description="Une option cochée ici est comprise dans la réparation : elle ne sera jamais vendue en plus, et les packs qui la contiennent sont masqués.">
              <ul className="grid gap-2 sm:grid-cols-2">
                {(options ?? []).map((o) => {
                  const isIncluded = includedSet.has(o.id);
                  return (
                    <li key={o.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span>{o.name} <span className="text-ink-muted">· {formatPrice(o.price_cents)}</span></span>
                      <form action={toggleIncludedOptionAction}>
                        <input type="hidden" name="repair_id" value={repairId} />
                        <input type="hidden" name="option_id" value={o.id} />
                        <input type="hidden" name="included" value={isIncluded ? "0" : "1"} />
                        <button type="submit" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isIncluded ? "bg-success-soft text-success" : "bg-surface-muted text-ink-soft"}`}>{isIncluded ? "Incluse ✓" : "Marquer incluse"}</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </Section>
            {offer ? (
              <Section title="Aperçu de l'offre calculée" description="Ce que le client verra au checkout après application des règles de compatibilité.">
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="mb-1 font-medium text-ink">Options compatibles ({offer.options.length})</p>
                    <ul className="space-y-1">{offer.options.map((o) => <li key={o.id}>{o.name} <span className="text-ink-muted">{formatPrice(o.price_cents)}</span>{o.is_recommended ? <Badge tone="success" className="ml-1">reco</Badge> : null}</li>)}</ul>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-ink">Packs compatibles ({offer.packs.length})</p>
                    <ul className="space-y-1">{offer.packs.map((p) => <li key={p.id}>{p.name} <span className="text-ink-muted">{formatPrice(p.price_cents)} · {p.options.map((o) => o.name).join(", ")}</span></li>)}</ul>
                  </div>
                </div>
              </Section>
            ) : null}
          </>
        );
      }}
    </EntityEditPage>
  );
}
