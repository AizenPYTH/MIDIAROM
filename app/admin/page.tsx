import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FilterChips, StatBand, StatCard } from "@/components/admin/ui";
import { MediaGallery } from "@/components/customer/media-gallery";
import { NoteForm, SendQuoteButton } from "@/components/admin/order-forms";
import { advanceStatusAction } from "@/app/admin/actions/orders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { signMedia } from "@/lib/media/service";
import { canRoleTransition, isAdminRole, ORDER_STATUS_LABELS, statusTone, WORKSHOP_STEPS, workshopStepIndex, type OrderStatus } from "@/lib/orders/status";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Filtres de la liste (handoff : Tout, Diagnostic, En atelier, Prêt) mappés sur les statuts réels. */
const FILTERS: { key: string; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "all", label: "Tout", statuses: null },
  { key: "expected", label: "Attendus", statuses: ["PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"] },
  { key: "diagnostic", label: "Diagnostic", statuses: ["RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL"] },
  { key: "workshop", label: "En atelier", statuses: ["APPROVED", "REPAIRING", "QUALITY_CONTROL"] },
  { key: "ready", label: "Prêt", statuses: ["READY_TO_SHIP"] },
  { key: "shipped", label: "Expédié", statuses: ["SHIPPED", "DELIVERED"] },
];
const ACTIVE_STATUSES: OrderStatus[] = ["PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "QUALITY_CONTROL", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "RETURN_REQUIRED", "REFUSED_QUOTE", "UNREPAIRABLE", "SAV", "DISPUTED"];

function periods(): { startOfDay: string; thirtyDaysAgo: string } {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return { startOfDay: startOfDay.toISOString(), thirtyDaysAgo: new Date(startOfDay.getTime() - 30 * 86_400_000).toISOString() };
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; sel?: string; error?: string }> }) {
  const [{ q, f, sel, error }, user] = await Promise.all([searchParams, requireStaffOrRedirect()]);
  const db = createSupabaseAdminClient();
  const { startOfDay, thirtyDaysAgo } = periods();
  const admin = isAdminRole(user.profile.role);
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]!;
  const count = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);

  let listQuery = db
    .from("repair_orders")
    .select("id, order_number, model_name, repair_name, status, customer_first_name, customer_last_name, customer_notes, fault_name, received_at, created_at")
    .in("status", filter.statuses ?? ACTIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(60);
  if (q?.trim()) {
    const term = q.trim().replace(/[%,]/g, "");
    listQuery = listQuery.or(`order_number.ilike.%${term}%,customer_last_name.ilike.%${term}%,customer_first_name.ilike.%${term}%,model_name.ilike.%${term}%,customer_email.ilike.%${term}%`);
  }

  const [{ data: list }, workshop, pendingQuotes, ready, delays, revenue30, purchases30, sav, today] = await Promise.all([
    listQuery,
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", ["APPROVED", "REPAIRING", "QUALITY_CONTROL"])),
    count(db.from("supplementary_quotes").select("id", { count: "exact", head: true }).eq("status", "SENT")),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).eq("status", "READY_TO_SHIP")),
    db.from("repair_orders").select("received_at, shipped_at").not("received_at", "is", null).not("shipped_at", "is", null).order("shipped_at", { ascending: false }).limit(30),
    admin ? db.from("repair_orders").select("total_cents").gte("paid_at", thirtyDaysAgo).not("paid_at", "is", null) : Promise.resolve({ data: [] as { total_cents: number }[] }),
    admin ? count(db.from("repair_orders").select("id", { count: "exact", head: true }).gte("paid_at", thirtyDaysAgo).not("paid_at", "is", null)) : Promise.resolve(0),
    count(db.from("sav_requests").select("id", { count: "exact", head: true }).in("status", ["NEW", "IN_ANALYSIS"])),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).gte("created_at", startOfDay).neq("status", "PENDING_PAYMENT")),
  ]);

  const delayDays = (delays.data ?? []).map((o) => (new Date(o.shipped_at!).getTime() - new Date(o.received_at!).getTime()) / 86_400_000).filter((d) => d >= 0);
  const avgDelay = delayDays.length ? delayDays.reduce((a, b) => a + b, 0) / delayDays.length : null;
  const revenue = (revenue30.data ?? []).reduce((s, o) => s + o.total_cents, 0);

  const rows = list ?? [];
  const selectedId = rows.some((o) => o.id === sel) ? sel : rows[0]?.id;
  const selected = selectedId ? (await db.from("repair_orders").select("*").eq("id", selectedId).maybeSingle()).data : null;
  const [items, events, media, quotes] = selected
    ? await Promise.all([
        db.from("repair_order_items").select("*").eq("order_id", selected.id).order("created_at"),
        db.from("order_events").select("*").eq("order_id", selected.id).order("created_at", { ascending: false }).limit(12),
        db.from("order_media").select("*").eq("order_id", selected.id).in("kind", ["CUSTOMER", "RECEPTION", "DIAGNOSTIC"]).order("created_at", { ascending: false }).limit(6),
        db.from("supplementary_quotes").select("id, quote_number, title, status, total_cents").eq("order_id", selected.id).order("created_at", { ascending: false }),
      ])
    : [null, null, null, null];
  const signed = media?.data ? await signMedia(media.data) : [];
  const draftQuote = (quotes?.data ?? []).find((qu) => qu.status === "DRAFT");
  const pipelineIndex = selected ? workshopStepIndex(selected.status) : -1;
  const hrefFor = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, f, sel: selectedId, ...params })) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/admin${s ? `?${s}` : ""}`;
  };
  const currentHref = hrefFor({});

  return (
    <div className="-m-5">
      <StatBand>
        <StatCard label="En atelier" value={workshop} hint="accord reçu, réparation, contrôle qualité" href="/admin?f=workshop" />
        <StatCard label="Devis à valider" value={pendingQuotes} hint="en attente de décision client" href="/admin?f=diagnostic" tone={pendingQuotes ? "warning" : undefined} />
        <StatCard label="Prêts à expédier" value={ready} hint="contrôle qualité validé" href="/admin?f=ready" tone={ready ? "success" : undefined} />
        <StatCard label="Délai moyen" value={avgDelay === null ? "—" : `${avgDelay.toFixed(1).replace(".", ",")} j`} hint={delayDays.length ? `réception → expédition, ${delayDays.length} derniers dossiers` : "aucun dossier expédié pour l'instant"} />
        <StatCard label="Dossiers du jour" value={today} hint="commandes payées aujourd'hui" href="/admin/orders" />
        <StatCard label="SAV ouverts" value={sav} hint="nouvelles demandes et analyses" href="/admin/sav" tone={sav ? "warning" : undefined} />
        {admin ? <StatCard label="CA 30 jours" value={formatPrice(revenue)} hint={`${purchases30} commandes payées`} href="/admin/analytics" tone="success" /> : null}
        {admin ? <StatCard label="Panier moyen" value={formatPrice(purchases30 ? Math.round(revenue / purchases30) : 0)} hint="30 derniers jours" href="/admin/analytics" /> : null}
      </StatBand>

      <div className="grid gap-px bg-border [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        {/* Liste */}
        <section className="flex min-w-0 flex-col gap-3.5 bg-bg p-5">
          <form method="get" action="/admin" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="f" value={filter.key} />
            <input name="q" defaultValue={q ?? ""} placeholder="Rechercher n° / nom / console" aria-label="Rechercher" className="min-w-0 flex-[1_1_180px] border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none" />
            <FilterChips items={FILTERS.map((x) => ({ key: x.key, label: x.label }))} current={filter.key} hrefFor={(key) => hrefFor({ f: key === "all" ? undefined : key, sel: undefined })} />
          </form>
          {error ? <p className="border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p> : null}
          <div className="flex flex-col gap-2">
            {rows.map((o) => {
              const active = o.id === selectedId;
              return (
                <Link key={o.id} href={hrefFor({ sel: o.id })} scroll={false} className={cn("flex flex-col gap-2 border p-3.5 text-ink transition-colors", active ? "border-accent bg-surface-muted" : "border-border bg-surface hover:border-border-strong")} aria-current={active ? "true" : undefined}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted">{o.order_number}</span>
                    <Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  </span>
                  <span className="flex flex-col gap-[3px]">
                    <strong className="text-[15.5px] font-semibold">
                      {o.model_name} — {o.repair_name}
                    </strong>
                    <span className="text-[13px] text-ink-faint">
                      {o.customer_first_name} {o.customer_last_name} · {o.received_at ? `reçu ${formatDate(o.received_at)}` : `commandé ${formatDate(o.created_at)}`}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-[13px] text-ink-muted">{o.customer_notes || o.fault_name}</span>
                </Link>
              );
            })}
            {!rows.length ? <p className="text-[13.5px] text-ink-muted">Aucun dossier ne correspond.</p> : null}
          </div>
          <Link href="/admin/orders" className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted hover:text-ink">
            Tous les dossiers →
          </Link>
        </section>

        {/* Fiche */}
        <aside className="flex min-w-0 flex-col gap-4 bg-surface p-5">
          {selected ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Fiche {selected.order_number}</span>
                <span className="whitespace-nowrap font-mono text-[11px] text-accent-light">{ORDER_STATUS_LABELS[selected.status]}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{selected.model_name}</h2>
                <span className="text-[14px] text-ink-faint">
                  {selected.repair_name} ·{" "}
                  <Link href={`/admin/customers/${selected.customer_id}`} className="hover:text-ink">
                    {selected.customer_first_name} {selected.customer_last_name}
                  </Link>
                  {selected.customer_phone ? ` · ${selected.customer_phone}` : ""}
                </span>
              </div>

              <div className="flex flex-col gap-[7px] border border-border-strong p-3.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Panne décrite par le client</span>
                <p className="text-[14.5px] leading-[1.5] text-[#e4dccb]">
                  <span className="font-semibold">{selected.fault_name}.</span> {selected.customer_notes || "Aucune description complémentaire."}
                </p>
                {selected.symptoms.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {selected.symptoms.map((sym) => (
                      <li key={sym} className="border border-border-strong px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">
                        {sym}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {signed.length ? (
                  <div className="mt-1 [&_li]:border-border [&_li]:bg-surface-muted">
                    <MediaGallery media={signed} />
                  </div>
                ) : (
                  <div className="photo-placeholder mt-1 h-[74px] text-[10.5px]">photos client, de réception et de diagnostic</div>
                )}
              </div>

              <div className="flex flex-col gap-[9px]">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Avancement</span>
                <div className="flex gap-[2px]">
                  {WORKSHOP_STEPS.map((seg, i) => {
                    const reached = i <= pipelineIndex;
                    const allowed = canRoleTransition(user.profile.role, selected.status, seg.status);
                    const cls = cn("min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[9px] font-mono text-[10px] uppercase tracking-[0.04em]", reached ? "bg-accent text-white" : "bg-surface-muted text-ink-muted");
                    return allowed ? (
                      <form key={seg.status} action={advanceStatusAction} className="flex min-w-0 flex-1">
                        <input type="hidden" name="order_id" value={selected.id} />
                        <input type="hidden" name="status" value={seg.status} />
                        <input type="hidden" name="next" value={currentHref} />
                        <button type="submit" className={cn(cls, "w-full cursor-pointer hover:bg-paper hover:text-ink-900")} title={`Passer en « ${ORDER_STATUS_LABELS[seg.status]} »`}>
                          {seg.label}
                        </button>
                      </form>
                    ) : (
                      <span key={seg.status} className={cls} title={reached ? "Étape atteinte" : "Transition non autorisée depuis ce statut"}>
                        {seg.label}
                      </span>
                    );
                  })}
                </div>
                <span className="text-[12px] text-ink-muted">Reçu → Diagnostic → Devis envoyé → En attente client → En atelier → Réparé → Expédié → Terminé. Cliquer un segment change le statut si la transition est autorisée ; les autres statuts sont dans la fiche complète.</span>
              </div>

              <div className="flex flex-col gap-[9px] border border-border-strong p-3.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Devis</span>
                {(items?.data ?? []).map((i) => (
                  <div key={i.id} className="flex justify-between gap-3.5 border-b border-dotted border-[#3a3529] pb-1.5 text-[14.5px]">
                    <span>
                      {i.label}
                      {i.source === "QUOTE" ? <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em] text-accent-light">devis</span> : null}
                    </span>
                    <span className="whitespace-nowrap font-mono text-[#e4dccb]">{formatPrice(i.total_cents)}</span>
                  </div>
                ))}
                <div className="mt-0.5 flex justify-between gap-3.5 text-[16px] font-semibold">
                  <span>Total</span>
                  <span className="whitespace-nowrap font-mono">{formatPrice(selected.total_cents)}</span>
                </div>
                <div className="flex justify-between gap-3.5 text-[12.5px] text-ink-muted">
                  <span>Encaissé</span>
                  <span className="whitespace-nowrap font-mono">{formatPrice(selected.paid_cents)}</span>
                </div>
                {(quotes?.data ?? []).map((qu) => (
                  <div key={qu.id} className="flex justify-between gap-3.5 text-[13px] text-ink-faint">
                    <span>
                      {qu.quote_number} · {qu.title}
                    </span>
                    <span className="whitespace-nowrap font-mono">
                      {formatPrice(qu.total_cents)} · {qu.status === "SENT" ? "envoyé" : qu.status === "DRAFT" ? "brouillon" : qu.status === "ACCEPTED" ? "accepté" : qu.status === "REFUSED" ? "refusé" : qu.status.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>

              <NoteForm orderId={selected.id} compact />

              <div className="flex flex-wrap gap-2">
                {draftQuote ? (
                  <SendQuoteButton quoteId={draftQuote.id} className="flex-[1_1_150px] bg-accent px-3 py-[13px] text-white hover:bg-paper hover:text-ink-900" label={`Envoyer le devis ${draftQuote.quote_number}`} />
                ) : (
                  <Link href={`/admin/orders/${selected.id}?tab=quotes`} className="flex-[1_1_150px] whitespace-nowrap bg-accent px-3 py-[13px] text-center font-mono text-[12px] uppercase tracking-[0.06em] text-white hover:bg-paper hover:text-ink-900">
                    Devis complémentaire
                  </Link>
                )}
                <Link href={`/admin/orders/${selected.id}?tab=shipping`} className="whitespace-nowrap border border-border-strong px-[15px] py-[13px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:border-paper">
                  Étiquette retour
                </Link>
                <Link href={`/admin/orders/${selected.id}`} className="whitespace-nowrap border border-border-strong px-[15px] py-[13px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:border-paper">
                  Fiche complète
                </Link>
              </div>

              <div className="flex flex-col gap-[7px] border-t border-border pt-3.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Historique</span>
                {(events?.data ?? []).map((e) => (
                  <div key={e.id} className="flex gap-3 text-[13px] text-ink-faint">
                    <span className="whitespace-nowrap font-mono text-[#6b6558]">{formatDateTime(e.created_at)}</span>
                    <span>
                      {e.title}
                      {!e.is_public ? <span className="ml-1 font-mono text-[10px] uppercase text-ink-muted">interne</span> : null}
                    </span>
                  </div>
                ))}
                {!events?.data?.length ? <span className="text-[13px] text-ink-muted">Aucun événement.</span> : null}
              </div>
            </>
          ) : (
            <p className="text-[14px] text-ink-muted">Sélectionnez un dossier dans la liste.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
