import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FilterChips, StatBand, StatCard } from "@/components/admin/ui";
import { tradeInStatusAction } from "@/app/admin/actions/shop";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { TRADE_IN_STATUS_LABELS, tradeInStatusTone, type TradeInStatus } from "@/lib/tradein/status";
import { formatDate, formatPrice } from "@/lib/utils/format";

const FILTERS: { key: string; label: string; statuses: TradeInStatus[] | null }[] = [
  { key: "open", label: "Ouvertes", statuses: ["NEW", "ESTIMATED", "ACCEPTED"] },
  { key: "new", label: "Nouvelles", statuses: ["NEW"] },
  { key: "estimated", label: "Offre envoyée", statuses: ["ESTIMATED"] },
  { key: "accepted", label: "Acceptées", statuses: ["ACCEPTED"] },
  { key: "all", label: "Tout", statuses: null },
];

export default async function TradeInsPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  await requireStaffOrRedirect();
  const { q, f } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]!;
  const db = createSupabaseAdminClient();
  const count = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let query = db.from("trade_in_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (q?.trim()) {
    const term = q.trim().replace(/[%,]/g, "");
    query = query.or(`request_number.ilike.%${term}%,item_title.ilike.%${term}%,customer_last_name.ilike.%${term}%,platform.ilike.%${term}%`);
  }
  const [{ data }, open, pendingOffers, acceptedMonth, offersMonth] = await Promise.all([
    query,
    count(db.from("trade_in_requests").select("id", { count: "exact", head: true }).eq("status", "NEW")),
    count(db.from("trade_in_requests").select("id", { count: "exact", head: true }).eq("status", "ESTIMATED")),
    count(db.from("trade_in_requests").select("id", { count: "exact", head: true }).in("status", ["ACCEPTED", "CLOSED"]).gte("decided_at", monthStart.toISOString())),
    db.from("trade_in_requests").select("offer_cents").in("status", ["ACCEPTED", "CLOSED"]).gte("decided_at", monthStart.toISOString()),
  ]);
  const offered = (offersMonth.data ?? []).reduce((s, t) => s + (t.offer_cents ?? 0), 0);

  return (
    <div>
      <StatBand>
        <StatCard label="Demandes ouvertes" value={open} hint="à estimer" href="/admin/trade-ins?f=new" tone={open ? "warning" : undefined} />
        <StatCard label="Offres en attente" value={pendingOffers} hint="décision client attendue" href="/admin/trade-ins?f=estimated" />
        <StatCard label="Acceptées ce mois" value={acceptedMonth} hint="paiement comptoir" href="/admin/trade-ins?f=accepted" tone="success" />
        <StatCard label="Montant repris ce mois" value={formatPrice(offered)} hint="offres acceptées" />
      </StatBand>
      <section className="flex flex-col gap-3.5 p-5">
        <form method="get" action="/admin/trade-ins" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="f" value={filter.key} />
          <input name="q" defaultValue={q ?? ""} placeholder="Rechercher n° / lot / client / plateforme" aria-label="Recherche" className="min-w-0 flex-[1_1_220px] rounded-[14px] border border-border-strong bg-field px-4 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:text-[14px]" />
          <FilterChips items={FILTERS.map((x) => ({ key: x.key, label: x.label }))} current={filter.key} hrefFor={(key) => `/admin/trade-ins?${new URLSearchParams({ ...(q ? { q } : {}), f: key })}`} />
        </form>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {(data ?? []).map((t) => (
            <div key={t.id} className="flex flex-col gap-2.5 border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/admin/trade-ins/${t.id}`} className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted hover:text-ink">
                  {t.request_number}
                </Link>
                <Badge tone={tradeInStatusTone(t.status)}>{TRADE_IN_STATUS_LABELS[t.status]}</Badge>
              </div>
              <Link href={`/admin/trade-ins/${t.id}`} className="text-[16px] font-semibold text-ink hover:text-accent-light">
                {t.item_title}
              </Link>
              <span className="text-[13.5px] text-ink-faint">
                {t.customer_first_name} {t.customer_last_name} · {t.platform} · demande du {formatDate(t.created_at)}
                {t.photos.length ? ` · ${t.photos.length} photo${t.photos.length > 1 ? "s" : ""}` : ""}
              </span>
              <div className="flex justify-between gap-3 border-t border-border pt-2.5 text-[14.5px]">
                <span className="text-ink-muted">Offre atelier</span>
                <span className="whitespace-nowrap font-mono">{t.offer_cents !== null ? formatPrice(t.offer_cents) : "à estimer"}</span>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/trade-ins/${t.id}`} className="flex-1 whitespace-nowrap bg-accent px-3 py-[11px] text-center font-mono text-[11px] uppercase tracking-[0.06em] text-white hover:bg-paper hover:text-ink-900">
                  {t.status === "NEW" ? "Proposer" : "Ouvrir"}
                </Link>
                {t.status === "NEW" || t.status === "ESTIMATED" ? (
                  <form action={tradeInStatusAction}>
                    <input type="hidden" name="request_id" value={t.id} />
                    <input type="hidden" name="status" value="REFUSED" />
                    <button type="submit" className="cursor-pointer whitespace-nowrap border border-border-strong px-[13px] py-[11px] font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint hover:border-paper">
                      Refuser
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
          {!data?.length ? <p className="text-[13.5px] text-ink-muted">Aucune demande de reprise.</p> : null}
        </div>
      </section>
    </div>
  );
}
