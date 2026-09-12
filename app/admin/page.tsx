import Link from "next/link";
import { MediaGallery } from "@/components/customer/media-gallery";
import { NoteForm, SendQuoteButton } from "@/components/admin/order-forms";
import { advanceStatusAction } from "@/app/admin/actions/orders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { signMedia } from "@/lib/media/service";
import { canRoleTransition, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Espace réparateur — un seul écran, une seule tâche.
 *
 * Le réparateur ouvre la page, voit ce qui l'attend, tape sur une réparation,
 * change son statut, envoie le devis. Rien d'autre : ni onglets, ni tableaux,
 * ni graphiques. Les quatre indicateurs se calculent depuis la file.
 *
 * Au téléphone, le maître/détail devient deux niveaux : la file (A1), puis la
 * fiche (A2) avec un retour. Sans `?sel=`, la file seule ; avec, la fiche seule.
 */

/** Les cinq temps de l'atelier, et les statuts réels qu'ils recouvrent. */
const STEPS: { key: string; label: string; status: OrderStatus; statuses: OrderStatus[] }[] = [
  { key: "recu", label: "Reçu", status: "RECEIVED", statuses: ["PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK"] },
  { key: "diagnostic", label: "Diagnostic", status: "DIAGNOSIS", statuses: ["DIAGNOSIS"] },
  { key: "devis", label: "Devis", status: "WAITING_CUSTOMER_APPROVAL", statuses: ["WAITING_CUSTOMER_APPROVAL", "APPROVED"] },
  { key: "atelier", label: "Atelier", status: "REPAIRING", statuses: ["REPAIRING", "QUALITY_CONTROL"] },
  { key: "pret", label: "Prêt", status: "READY_TO_SHIP", statuses: ["READY_TO_SHIP"] },
];

const FILTERS = [{ key: "all", label: "Tout" }, ...STEPS.map((s) => ({ key: s.key, label: s.label }))];

/** Tout ce qui n'est pas encore parti : le compteur « N en cours ». */
const OPEN: OrderStatus[] = [
  "PAID",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT_TO_WORKSHOP",
  "RECEIVED",
  "RECEPTION_CHECK",
  "DIAGNOSIS",
  "WAITING_CUSTOMER_APPROVAL",
  "APPROVED",
  "REPAIRING",
  "QUALITY_CONTROL",
  "READY_TO_SHIP",
  "RETURN_REQUIRED",
  "REFUSED_QUOTE",
  "UNREPAIRABLE",
  "SAV",
  "DISPUTED",
];

/** Index du temps atelier atteint par un statut (-1 s'il est déjà expédié). */
function stepIndex(status: OrderStatus): number {
  return STEPS.findIndex((s) => s.statuses.includes(status));
}

/** Pastille de statut : un fond translucide et un texte de la même famille. */
const PILL: Record<string, string> = {
  recu: "bg-[rgba(244,242,255,0.10)] text-ink",
  diagnostic: "bg-[rgba(51,225,255,0.16)] text-cyan",
  devis: "bg-[rgba(255,92,168,0.16)] text-rose",
  atelier: "bg-[rgba(124,92,255,0.22)] text-[#c9c4ff]",
  pret: "bg-[rgba(216,255,62,0.16)] text-lime",
  parti: "bg-[rgba(244,242,255,0.07)] text-ink-muted",
};

function StatusPill({ status }: { status: OrderStatus }) {
  const i = stepIndex(status);
  const key = i === -1 ? "parti" : STEPS[i]!.key;
  return <span className={cn("whitespace-nowrap rounded-full px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em]", PILL[key])}>{ORDER_STATUS_LABELS[status]}</span>;
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; sel?: string; error?: string }> }) {
  const [{ q, f, sel, error }, user] = await Promise.all([searchParams, requireStaffOrRedirect()]);
  const db = createSupabaseAdminClient();
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]!;
  const statuses = STEPS.find((s) => s.key === filter.key)?.statuses ?? OPEN;

  let listQuery = db
    .from("repair_orders")
    .select("id, order_number, model_name, repair_name, status, customer_first_name, customer_last_name, customer_notes, fault_name, received_at, created_at")
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(60);
  if (q?.trim()) {
    const term = q.trim().replace(/[%,]/g, "");
    listQuery = listQuery.or(`order_number.ilike.%${term}%,customer_last_name.ilike.%${term}%,customer_first_name.ilike.%${term}%,model_name.ilike.%${term}%,customer_email.ilike.%${term}%`);
  }

  const count = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);
  const [{ data: list }, enCours, enAtelier, devisAValider, prets, { data: delais }] = await Promise.all([
    listQuery,
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", OPEN)),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", ["REPAIRING", "QUALITY_CONTROL"])),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).eq("status", "WAITING_CUSTOMER_APPROVAL")),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).eq("status", "READY_TO_SHIP")),
    // Délai moyen réellement constaté : rien n'est affiché tant qu'aucun
    // dossier n'est allé de la réception à l'expédition.
    db.from("repair_orders").select("received_at, shipped_at").not("received_at", "is", null).not("shipped_at", "is", null).order("shipped_at", { ascending: false }).limit(50),
  ]);

  const spans = (delais ?? []).map((d) => (new Date(d.shipped_at as string).getTime() - new Date(d.received_at as string).getTime()) / 86_400_000).filter((n) => n >= 0);
  const delaiMoyen = spans.length ? (spans.reduce((a, b) => a + b, 0) / spans.length).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " j" : "—";

  const rows = list ?? [];
  const explicitSelection = rows.some((o) => o.id === sel);
  const selectedId = explicitSelection ? sel : rows[0]?.id;
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
  const current = selected ? stepIndex(selected.status) : -1;

  const hrefFor = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, f, sel: selectedId, ...params })) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/admin${s ? `?${s}` : ""}`;
  };
  const currentHref = hrefFor({});

  const kpis = [
    { label: "En atelier", value: String(enAtelier), glow: "rgba(124,92,255,0.3)", tone: "text-violet" },
    { label: "Devis à valider", value: String(devisAValider), glow: "rgba(255,92,168,0.24)", tone: "text-rose" },
    { label: "Prêts à rendre", value: String(prets), glow: "rgba(216,255,62,0.22)", tone: "text-lime" },
    { label: "Délai moyen", value: delaiMoyen, glow: "rgba(51,225,255,0.24)", tone: "text-cyan" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[clamp(32px,4.4vw,60px)] font-extrabold leading-[0.92] tracking-[-0.04em] text-ink">L&apos;atelier aujourd&apos;hui</h1>
        <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-muted">{enCours} en cours</span>
      </div>

      {/* 2 × 2 au téléphone (écran A1), une rangée de quatre au-delà. */}
      <div className="grid grid-cols-2 gap-[18px] sm:[grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {kpis.map((k) => (
          <div key={k.label} className="glass anim-rise relative overflow-hidden rounded-[24px] p-5 sm:p-6">
            <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full" style={{ background: `radial-gradient(circle, ${k.glow}, transparent 70%)` }} />
            <p className={cn("relative font-display text-[34px] font-extrabold leading-none tracking-[-0.035em] sm:text-[46px]", k.tone)}>{k.value}</p>
            <p className="relative mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">{k.label}</p>
          </div>
        ))}
      </div>

      {error ? <p className="rounded-[20px] border border-danger bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p> : null}

      <div className="grid items-start gap-[18px] [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:minmax(330px,1fr)_minmax(380px,1.1fr)]">
        {/* ---------------------------------------------------------------
            A1 — la file
        --------------------------------------------------------------- */}
        <section className={cn("min-w-0 flex-col gap-4", explicitSelection ? "hidden xl:flex" : "flex")}>
          <form method="get" action="/admin" className="flex flex-col gap-3">
            <input type="hidden" name="f" value={filter.key} />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Rechercher un numéro, un nom, une console"
              aria-label="Rechercher"
              className="w-full rounded-[14px] border border-border-strong bg-field px-4 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
            <div className="scroll-strip gap-2 sm:flex-wrap">
              {FILTERS.map((x) => (
                <Link
                  key={x.key}
                  href={hrefFor({ f: x.key === "all" ? undefined : x.key, sel: undefined })}
                  aria-current={filter.key === x.key ? "true" : undefined}
                  className={cn("chip", filter.key === x.key ? "bg-paper text-ink-900" : "border border-border text-ink-muted hover:text-ink")}
                >
                  {x.label}
                </Link>
              ))}
            </div>
          </form>

          <div className="flex flex-col gap-2.5">
            {rows.map((o) => {
              const active = o.id === selectedId;
              return (
                <Link
                  key={o.id}
                  href={hrefFor({ sel: o.id })}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex flex-col gap-2.5 rounded-[22px] border p-4 transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:translate-x-1.5 hover:border-border-strong sm:p-5",
                    active ? "border-violet bg-[rgba(124,92,255,0.12)]" : "border-border bg-surface-muted",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted">{o.order_number}</span>
                    <StatusPill status={o.status} />
                  </span>
                  <span className="font-display text-[18px] font-bold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[21px]">{o.model_name}</span>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px] text-ink-muted">
                    <span>
                      {o.repair_name} · {o.customer_first_name} {o.customer_last_name}
                    </span>
                    <span className="font-mono text-[11.5px]">{o.received_at ? formatDate(o.received_at) : formatDate(o.created_at)}</span>
                  </span>
                </Link>
              );
            })}
            {!rows.length ? <p className="text-[14px] text-ink-muted">Aucune réparation ne correspond.</p> : null}
          </div>
        </section>

        {/* ---------------------------------------------------------------
            A2 — la fiche
        --------------------------------------------------------------- */}
        <aside
          className={cn("glass min-w-0 flex-col gap-6 rounded-[28px] p-5 sm:p-7 xl:sticky xl:top-24 xl:flex", explicitSelection ? "flex" : "hidden xl:flex")}
          style={{ boxShadow: "var(--glow-panel)" }}
        >
          {selected ? (
            <>
              <Link href={hrefFor({ sel: undefined })} className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted transition-colors hover:text-sale xl:hidden">
                ← La file
              </Link>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-muted">{selected.order_number}</span>
                  <StatusPill status={selected.status} />
                </div>
                <h2 className="font-display text-[clamp(26px,3.2vw,38px)] font-extrabold leading-[0.95] tracking-[-0.035em] text-ink">{selected.model_name}</h2>
                <p className="text-[14.5px] text-ink-muted">
                  {selected.repair_name} ·{" "}
                  <Link href={`/admin/customers/${selected.customer_id}`} className="transition-colors hover:text-sale">
                    {selected.customer_first_name} {selected.customer_last_name}
                  </Link>
                  {selected.customer_phone ? (
                    <>
                      {" · "}
                      <a href={`tel:${selected.customer_phone.replace(/\s/g, "")}`} className="transition-colors hover:text-sale">
                        {selected.customer_phone}
                      </a>
                    </>
                  ) : null}
                </p>
              </div>

              {/* Avancement : cinq segments cliquables. Au téléphone la bande
                  défile — cinq libellés écrasés dans 360 px sont illisibles. */}
              <div className="flex flex-col gap-2.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">Avancement</span>
                <div className="scroll-strip gap-2">
                  {STEPS.map((seg, i) => {
                    const reached = current >= 0 && i <= current;
                    const allowed = canRoleTransition(user.profile.role, selected.status, seg.status);
                    const cls = cn(
                      "min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-300",
                      reached ? "border-sale bg-[rgba(216,255,62,0.16)] text-lime" : "border-border text-ink-muted",
                    );
                    return allowed ? (
                      <form key={seg.status} action={advanceStatusAction} className="shrink-0">
                        <input type="hidden" name="order_id" value={selected.id} />
                        <input type="hidden" name="status" value={seg.status} />
                        <input type="hidden" name="next" value={currentHref} />
                        <button type="submit" className={cn(cls, "cursor-pointer hover:border-sale hover:text-lime")} title={`Passer en « ${ORDER_STATUS_LABELS[seg.status]} »`}>
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
              </div>

              {/* La parole du client : citée, jamais éditable depuis l'atelier. */}
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">Ce que dit le client</span>
                <blockquote className="border-l-2 border-sale pl-4 font-display text-[17px] font-bold leading-[1.3] tracking-[-0.02em] text-ink sm:text-[19px]">
                  {selected.customer_notes || selected.fault_name}
                </blockquote>
                {selected.symptoms.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {selected.symptoms.map((sym) => (
                      <li key={sym} className="rounded-full border border-border px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
                        {sym}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {signed.length ? (
                  <div className="[&_li]:rounded-[14px] [&_li]:border-border">
                    <MediaGallery media={signed} />
                  </div>
                ) : (
                  <p className="rounded-[20px] border border-dashed border-border px-4 py-3 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">Aucune photo envoyée par le client</p>
                )}
              </div>

              <div className="flex flex-col gap-2.5 border-t border-border pt-6">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">Devis</span>
                {(items?.data ?? []).map((i) => (
                  <div key={i.id} className="flex justify-between gap-4 border-b border-border pb-2 text-[14.5px] text-ink-soft">
                    <span>
                      {i.label}
                      {i.source === "QUOTE" ? <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan">devis</span> : null}
                    </span>
                    <span className="whitespace-nowrap font-mono text-ink">{formatPrice(i.total_cents)}</span>
                  </div>
                ))}
                <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-sale pt-3">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">Total</span>
                  <span className="whitespace-nowrap font-display text-[26px] font-extrabold tracking-[-0.03em] text-lime">{formatPrice(selected.total_cents)}</span>
                </div>
                <div className="flex justify-between gap-4 text-[12.5px] text-ink-muted">
                  <span>Encaissé</span>
                  <span className="whitespace-nowrap font-mono">{formatPrice(selected.paid_cents)}</span>
                </div>
                {(quotes?.data ?? []).map((qu) => (
                  <div key={qu.id} className="flex justify-between gap-4 text-[13px] text-ink-muted">
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

              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">Historique</span>
                {(events?.data ?? []).map((e) => (
                  <div key={e.id} className="flex gap-4 text-[13px] text-ink-muted">
                    <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-faint">{formatDateTime(e.created_at)}</span>
                    <span className="text-ink-soft">
                      {e.title}
                      {!e.is_public ? <span className="ml-1.5 font-mono text-[10px] uppercase text-ink-muted">interne</span> : null}
                    </span>
                  </div>
                ))}
                {!events?.data?.length ? <span className="text-[13px] text-ink-muted">Aucun événement.</span> : null}
              </div>

              {/* Barre d'action : collée en bas de l'écran au téléphone. */}
              <div
                className="safe-bottom sticky bottom-0 -mx-5 flex flex-wrap gap-2.5 border-t border-border px-5 pt-4 backdrop-blur-[14px] max-sm:bg-[rgba(7,6,10,0.82)] sm:static sm:mx-0 sm:border-0 sm:px-0 sm:pb-0 sm:pt-2"
                style={{ "--safe-pb": "16px" } as React.CSSProperties}
              >
                {draftQuote ? (
                  <SendQuoteButton
                    quoteId={draftQuote.id}
                    className="btn-gradient min-h-11 flex-[1_1_180px] rounded-full px-5 py-3 text-[14px] font-semibold"
                    label={`Envoyer le devis ${draftQuote.quote_number}`}
                  />
                ) : (
                  <Link href={`/admin/orders/${selected.id}?tab=quotes`} className="btn-gradient flex min-h-11 flex-[1_1_180px] items-center justify-center rounded-full px-5 py-3 text-center text-[14px] font-semibold">
                    Envoyer le devis
                  </Link>
                )}
                <Link
                  href={`/admin/orders/${selected.id}?tab=shipping`}
                  className="flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border border-border-strong px-5 py-3 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  Étiquette
                </Link>
                <Link
                  href={`/admin/orders/${selected.id}`}
                  className="flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border border-border-strong px-5 py-3 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  Fiche complète
                </Link>
              </div>
            </>
          ) : (
            <p className="text-[14px] text-ink-muted">Sélectionnez une réparation dans la file.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
