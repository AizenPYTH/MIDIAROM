import Link from "next/link";
import { EntityListPage } from "@/components/admin/entity-pages";
import { createModelRepairAction, deleteModelRepairAction, updateRepairRowAction } from "@/app/admin/actions/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

const INPUT = "rounded-[14px] border border-border-strong bg-field px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:text-[13px]";

/**
 * Prestations de réparation, console par console.
 *
 * Une prestation = un modèle × une panne. Le prix, le nom, le résumé, l'ordre et
 * l'activation se modifient directement dans la liste ; la fiche complète (SEO,
 * garantie, délais, pièces) reste accessible sur chaque ligne. La vue tableau
 * d'origine reste disponible via « ?vue=table ».
 */
export default async function RepairsPage({ searchParams }: { searchParams: Promise<{ model?: string; vue?: string; error?: string }> }) {
  const { model, vue, error } = await searchParams;
  if (vue === "table") {
    return (
      <EntityListPage
        entityKey="repairs"
        description="Vue tableau complète. Pour une gestion console par console, revenez à la vue par défaut."
        extra={
          <p className="text-[13px]">
            <Link href="/admin/catalog/repairs" className="text-accent hover:underline">
              ← Gestion par console
            </Link>
          </p>
        }
      />
    );
  }

  await requireAdminOrRedirect();
  const db = createSupabaseAdminClient();
  const [{ data: models }, { data: allRepairs }, { data: faults }, { data: categories }] = await Promise.all([
    db.from("console_models").select("id, name, slug, is_active, display_order, brand:brands(name, display_order)").order("display_order"),
    db.from("repairs").select("id, model_id, is_active, price_is_provisional"),
    db.from("faults").select("id, name, slug").eq("is_active", true).order("display_order"),
    db.from("repair_categories").select("id, name, display_order").eq("is_active", true).order("display_order"),
  ]);

  const counts = new Map<string, { total: number; active: number; todo: number }>();
  for (const r of allRepairs ?? []) {
    const c = counts.get(r.model_id) ?? { total: 0, active: 0, todo: 0 };
    c.total += 1;
    if (r.is_active) c.active += 1;
    if (r.price_is_provisional) c.todo += 1;
    counts.set(r.model_id, c);
  }
  const list = (models ?? []).map((m) => ({ ...m, brandName: (m.brand as { name: string } | null)?.name ?? "", brandOrder: (m.brand as { display_order: number } | null)?.display_order ?? 99 }));
  list.sort((a, b) => a.brandOrder - b.brandOrder || a.display_order - b.display_order);
  const selected = list.find((m) => m.id === model) ?? list[0] ?? null;

  const { data: repairs } = selected
    ? await db
        .from("repairs")
        .select("id, name, summary, price_cents, display_order, is_active, is_diagnostic_only, price_is_provisional, category_id, fault:faults(id, name), category:repair_categories(id, name, display_order)")
        .eq("model_id", selected.id)
        .order("display_order")
    : { data: [] };
  const used = new Set((repairs ?? []).map((r) => (r.fault as { id: string } | null)?.id));
  const available = (faults ?? []).filter((f) => !used.has(f.id));

  // Regroupement par catégorie du catalogue client, dans l'ordre du document.
  type RepairRow = NonNullable<typeof repairs>[number];
  const groups = new Map<string, { name: string; order: number; rows: RepairRow[] }>();
  for (const r of repairs ?? []) {
    const cat = r.category as { name: string; display_order: number } | null;
    const name = cat?.name ?? "Sans catégorie";
    const g = groups.get(name) ?? { name, order: cat?.display_order ?? 9999, rows: [] };
    g.rows.push(r);
    groups.set(name, g);
  }
  const grouped = [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const todo = (repairs ?? []).filter((r) => r.price_is_provisional).length;

  return (
    <div>
      {error ? <p className="border-b border-danger bg-danger-soft px-5 py-2.5 text-[13px] text-danger">{error}</p> : null}
      <div className="grid [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(220px,270px)_minmax(0,1fr)]">
        {/* Consoles */}
        <aside className="min-w-0 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Consoles</p>
          <ul className="mt-3 flex flex-col">
            {list.map((m) => {
              const c = counts.get(m.id) ?? { total: 0, active: 0, todo: 0 };
              const active = selected?.id === m.id;
              return (
                <li key={m.id}>
                  <Link
                    href={`/admin/catalog/repairs?model=${m.id}`}
                    aria-current={active ? "true" : undefined}
                    className={cn("flex items-baseline justify-between gap-2 border-l-2 py-[7px] pl-2.5 pr-1 text-[13.5px] transition-colors", active ? "border-l-accent bg-surface-muted text-ink" : "border-l-transparent text-ink-faint hover:text-ink")}
                  >
                    <span className="min-w-0 truncate">
                      {m.name}
                      {!m.is_active ? <span className="ml-1.5 font-mono text-[10px] uppercase text-ink-muted">masquée</span> : null}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-1.5 font-mono text-[11px]">
                      {c.todo ? <span className="text-warning" title={`${c.todo} tarif(s) à configurer`}>{c.todo}⚠</span> : null}
                      <span className={c.active ? "text-ink-muted" : "text-warning"}>{c.active}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-border pt-3 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">
            <Link href="/admin/catalog/models" className="hover:text-ink">
              Gérer les consoles →
            </Link>
            <br />
            <Link href="/admin/catalog/repairs?vue=table" className="hover:text-ink">
              Vue tableau complète →
            </Link>
          </p>
        </aside>

        {/* Prestations du modèle sélectionné */}
        <section className="min-w-0 p-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{selected.brandName}</p>
                  <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.02em] text-ink">{selected.name}</h1>
                </div>
                <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                  <a href={`/reparation/${selected.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                    Vue client ↗
                  </a>
                </p>
              </div>
              <p className="mt-2 max-w-[74ch] text-[13px] text-ink-faint">
                Ces prestations et leurs prix sont ceux que le client voit lorsqu&apos;il choisit cette console, regroupés par catégorie comme dans le catalogue fourni. Les
                prix sont enregistrés en base : une modification ici est immédiate côté client.
                {todo ? (
                  <>
                    {" "}
                    <strong className="text-warning">
                      {todo} prestation{todo > 1 ? "s" : ""} sans tarif
                    </strong>{" "}
                    : elles s&apos;affichent « sur devis » tant qu&apos;un prix n&apos;est pas saisi.
                  </>
                ) : null}
              </p>

              <div className="mt-5 hidden gap-2 border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted lg:grid lg:[grid-template-columns:minmax(0,2fr)_minmax(0,1.6fr)_150px_88px_60px_60px_auto]">
                <span>Prestation</span>
                <span>Résumé client</span>
                <span>Catégorie</span>
                <span>Prix TTC</span>
                <span>Ordre</span>
                <span>Active</span>
                <span />
              </div>
              {grouped.map((group) => (
                <section key={group.name} className="mt-4">
                  <h2 className="border-b border-border-strong pb-1.5 font-mono text-[11px] uppercase tracking-[0.09em] text-ink-muted">
                    {group.name} <span className="text-ink-faint">· {group.rows.length}</span>
                  </h2>
                  <ul className="flex flex-col">
                    {group.rows.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-border py-2.5">
                        <form action={updateRepairRowAction} className="grid min-w-0 flex-1 gap-2 lg:[grid-template-columns:minmax(0,2fr)_minmax(0,1.6fr)_150px_88px_60px_60px_auto]">
                          <input type="hidden" name="repair_id" value={r.id} />
                          <input type="hidden" name="model_id" value={selected.id} />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <input name="name" defaultValue={r.name} required maxLength={140} aria-label="Nom de la prestation" className={cn(INPUT, "w-full")} />
                            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                              {(r.fault as { name: string } | null)?.name}
                              {r.is_diagnostic_only ? " · diagnostic" : ""}
                              {r.price_is_provisional ? <span className="ml-1.5 text-warning">· tarif à configurer</span> : null}
                            </span>
                          </span>
                          <input name="summary" defaultValue={r.summary ?? ""} maxLength={200} placeholder="Phrase affichée au client (facultatif)" aria-label="Résumé client" className={cn(INPUT, "w-full")} />
                          <select name="category_id" defaultValue={r.category_id ?? ""} aria-label="Catégorie" className={cn(INPUT, "w-full")}>
                            <option value="">Sans catégorie</option>
                            {(categories ?? []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <input
                            name="price"
                            defaultValue={(r.price_cents / 100).toFixed(2)}
                            inputMode="decimal"
                            required
                            aria-label={`Prix de ${r.name}`}
                            className={cn(INPUT, "w-full text-right font-mono", r.price_is_provisional && "border-warning text-warning")}
                          />
                          <input name="display_order" type="number" min={0} max={999} defaultValue={r.display_order} aria-label="Ordre d'affichage" className={cn(INPUT, "w-full text-right font-mono")} />
                          <label className="flex items-center gap-2 text-[12px] text-ink-faint">
                            <input type="checkbox" name="is_active" defaultChecked={r.is_active} className="h-4 w-4 accent-[var(--accent)]" aria-label="Prestation active" />
                            <span className="lg:sr-only">Active</span>
                          </label>
                          <span className="flex items-center gap-2">
                            <button type="submit" className="cursor-pointer whitespace-nowrap bg-accent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-white hover:bg-paper hover:text-ink-900">
                              Enregistrer
                            </button>
                            <Link href={`/admin/catalog/repairs/${r.id}`} className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted hover:text-ink">
                              Fiche
                            </Link>
                          </span>
                        </form>
                        <form action={deleteModelRepairAction}>
                          <input type="hidden" name="repair_id" value={r.id} />
                          <input type="hidden" name="model_id" value={selected.id} />
                          <button type="submit" className="cursor-pointer whitespace-nowrap border border-border-strong px-2.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint hover:border-danger hover:text-danger">
                            Retirer
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!repairs?.length ? <p className="py-4 text-[13.5px] text-ink-muted">Aucune prestation pour cette console. Ajoutez-en une ci-dessous.</p> : null}

              <form action={createModelRepairAction} className="mt-5 flex flex-wrap items-end gap-2 border-t border-border pt-5">
                <input type="hidden" name="model_id" value={selected.id} />
                <span className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">Panne</span>
                  <select name="fault_id" required aria-label="Panne" className={cn(INPUT, "min-w-[190px]")}>
                    {available.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">Nom de la prestation</span>
                  <input name="name" required minLength={2} maxLength={140} placeholder={`Ex. : Réparation port HDMI ${selected.name}`} aria-label="Nom de la nouvelle prestation" className={cn(INPUT, "w-full")} />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">Catégorie</span>
                  <select name="category_id" aria-label="Catégorie de la nouvelle prestation" className={cn(INPUT, "min-w-[170px]")}>
                    <option value="">Sans catégorie</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">Prix TTC</span>
                  <input name="price" required inputMode="decimal" placeholder="0 = sur devis" aria-label="Prix de la nouvelle prestation" className={cn(INPUT, "w-[110px] text-right font-mono")} />
                </span>
                <button type="submit" disabled={!available.length} className="cursor-pointer bg-accent px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white hover:bg-paper hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50">
                  Ajouter la prestation
                </button>
                {!available.length ? <span className="text-[12.5px] text-ink-muted">Toutes les pannes du catalogue sont déjà proposées pour cette console.</span> : null}
              </form>
              <p className="mt-3 text-[12.5px] text-ink-muted">
                Une prestation déjà commandée n&apos;est jamais supprimée : elle est désactivée pour préserver l&apos;historique des dossiers. Les pannes se gèrent dans{" "}
                <Link href="/admin/catalog/faults" className="text-accent-light hover:underline">
                  Catalogue → Pannes
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="text-[14px] text-ink-muted">
              Aucune console au catalogue.{" "}
              <Link href="/admin/catalog/models" className="text-accent-light hover:underline">
                Ajoutez-en une
              </Link>{" "}
              pour lui associer des prestations.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
