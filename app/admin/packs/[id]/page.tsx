import { EntityEditPage } from "@/components/admin/entity-pages";
import { Section } from "@/components/admin/ui";
import { Alert } from "@/components/ui/alert";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { togglePackItemAction } from "@/app/admin/actions/catalog";
import { formatPrice } from "@/lib/utils/format";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntityEditPage entityKey="packs" id={id}>
      {async (row) => {
        const packId = String(row.id);
        const db = createSupabaseAdminClient();
        const [{ data: options }, { data: items }] = await Promise.all([db.from("repair_options").select("id, name, price_cents, is_active").order("display_order"), db.from("pack_items").select("option_id").eq("pack_id", packId)]);
        const set = new Set((items ?? []).map((i) => i.option_id));
        const sum = (options ?? []).filter((o) => set.has(o.id)).reduce((s, o) => s + o.price_cents, 0);
        const price = Number(row.price_cents ?? 0);
        return (
          <Section title="Contenu du pack" description={`Somme des options : ${formatPrice(sum)} · prix du pack : ${formatPrice(price)} · ${sum > price ? `économie client ${formatPrice(sum - price)}` : "aucune économie"}`}>
            {sum > 0 && price >= sum ? <Alert tone="warning" className="mb-3">Le prix du pack est supérieur ou égal à la somme des options : il n&apos;apporte aucun avantage au client.</Alert> : null}
            <ul className="grid gap-2 sm:grid-cols-2">
              {(options ?? []).map((o) => {
                const inPack = set.has(o.id);
                return (
                  <li key={o.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span>{o.name} <span className="text-ink-muted">· {formatPrice(o.price_cents)}</span></span>
                    <form action={togglePackItemAction}>
                      <input type="hidden" name="pack_id" value={packId} />
                      <input type="hidden" name="option_id" value={o.id} />
                      <input type="hidden" name="included" value={inPack ? "0" : "1"} />
                      <button type="submit" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${inPack ? "bg-success-soft text-success" : "bg-surface-muted text-ink-soft"}`}>{inPack ? "Dans le pack ✓" : "Ajouter"}</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      }}
    </EntityEditPage>
  );
}
