import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FilterChips, Pagination, StatBand, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { FULFILLMENT_LABELS, SHOP_ORDER_STATUSES, shopStatusLabel, shopStatusTone, type ShopOrderStatus } from "@/lib/shop/status";
import { formatDateTime, formatPrice } from "@/lib/utils/format";

/** ISO d'il y a N jours (hors rendu : la date n'est lue qu'une fois par requête). */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PAGE_SIZE = 30;
const FILTERS: { key: string; label: string; statuses: ShopOrderStatus[] | null }[] = [
  { key: "open", label: "À traiter", statuses: ["PAID", "PREPARED"] },
  { key: "all", label: "Tout", statuses: null },
  { key: "paid", label: "À préparer", statuses: ["PAID"] },
  { key: "prepared", label: "Préparées", statuses: ["PREPARED"] },
  { key: "shipped", label: "Expédiées", statuses: ["SHIPPED"] },
  { key: "pending", label: "Non payées", statuses: ["PENDING"] },
  { key: "done", label: "Terminées", statuses: ["DELIVERED", "CANCELLED"] },
];

export default async function ShopOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  await requireStaffOrRedirect();
  const { q, f, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]!;
  const db = createSupabaseAdminClient();
  const count = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let query = db.from("shop_orders").select("*, items:shop_order_items(label, quantity)", { count: "exact" }).order("created_at", { ascending: false });
  if (filter.statuses) query = query.in("status", filter.statuses);
  if (q?.trim()) {
    const term = q.trim().replace(/[%,]/g, "");
    query = query.or(`order_number.ilike.%${term}%,customer_last_name.ilike.%${term}%,customer_first_name.ilike.%${term}%,customer_email.ilike.%${term}%`);
  }
  const [{ data, count: total }, toPrepare, pickupsToday, revenueToday, abandoned] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    count(db.from("shop_orders").select("id", { count: "exact", head: true }).eq("status", "PAID")),
    count(db.from("shop_orders").select("id", { count: "exact", head: true }).eq("fulfillment", "PICKUP").eq("status", "PREPARED")),
    db.from("shop_orders").select("total_cents").gte("paid_at", startOfDay.toISOString()).not("paid_at", "is", null),
    count(db.from("shop_orders").select("id", { count: "exact", head: true }).eq("status", "PENDING").gte("created_at", daysAgo(7))),
  ]);
  const revenue = (revenueToday.data ?? []).reduce((s, o) => s + o.total_cents, 0);
  const hrefFor = (p: number) => `/admin/shop-orders?${new URLSearchParams({ ...(q ? { q } : {}), f: filter.key, page: String(p) })}`;
  const exportHref = `/admin/shop-orders/export?${new URLSearchParams({ ...(q ? { q } : {}), f: filter.key })}`;

  return (
    <div className="-m-5">
      <StatBand>
        <StatCard label="À préparer" value={toPrepare} hint="payées, non préparées" href="/admin/shop-orders?f=paid" tone={toPrepare ? "warning" : undefined} />
        <StatCard label="Retraits prêts" value={pickupsToday} hint="préparées, à retirer au magasin" href="/admin/shop-orders?f=prepared" />
        <StatCard label="CA boutique du jour" value={formatPrice(revenue)} hint="commandes payées aujourd'hui" tone="success" />
        <StatCard label="Paniers non payés" value={abandoned} hint="sur 7 jours" href="/admin/shop-orders?f=pending" />
      </StatBand>
      <section className="flex min-w-0 flex-col gap-3.5 p-5">
        <form method="get" action="/admin/shop-orders" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="f" value={filter.key} />
          <input name="q" defaultValue={q ?? ""} placeholder="Rechercher n° de commande / client" aria-label="Recherche" className="min-w-0 flex-[1_1_220px] border border-border-strong bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none" />
          <a href={exportHref} className="whitespace-nowrap border border-border-strong bg-surface px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink hover:border-paper">
            Exporter CSV
          </a>
          <Link href="/admin/shop-orders/print" className="whitespace-nowrap bg-sale px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white hover:bg-paper hover:text-ink-900">
            Imprimer bons d&apos;envoi
          </Link>
        </form>
        <FilterChips items={FILTERS.map((x) => ({ key: x.key, label: x.label }))} current={filter.key} hrefFor={(key) => `/admin/shop-orders?${new URLSearchParams({ ...(q ? { q } : {}), f: key })}`} />
        <Table minWidth={760}>
          <thead>
            <tr>
              <Th>N°</Th>
              <Th>Client</Th>
              <Th>Articles</Th>
              <Th className="text-right">Total</Th>
              <Th>Livraison</Th>
              <Th>Statut</Th>
              <Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((o) => {
              const items = o.items as { label: string; quantity: number }[];
              return (
                <tr key={o.id} className="hover:bg-surface-muted">
                  <Td>
                    <Link href={`/admin/shop-orders/${o.id}`} className="whitespace-nowrap font-mono text-[12.5px] text-ink-soft hover:text-ink">
                      {o.order_number}
                    </Link>
                  </Td>
                  <Td>
                    {o.customer_first_name} {o.customer_last_name}
                    <span className="block text-[12.5px] text-ink-muted">{o.customer_email}</span>
                  </Td>
                  <Td className="text-ink-faint">{items.map((i) => `${i.label}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(" · ")}</Td>
                  <Td className="whitespace-nowrap text-right font-mono">{formatPrice(o.total_cents)}</Td>
                  <Td className="text-[13px] text-ink-faint">
                    {FULFILLMENT_LABELS[o.fulfillment]}
                    {o.tracking_number ? <span className="block font-mono text-[11px]">{o.tracking_number}</span> : null}
                  </Td>
                  <Td>
                    <Badge tone={shopStatusTone(o.status)}>{shopStatusLabel(o.status, o.fulfillment)}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-[13px] text-ink-faint">{formatDateTime(o.created_at)}</Td>
                </tr>
              );
            })}
            {!data?.length ? (
              <tr>
                <Td colSpan={7} className="text-center text-ink-muted">
                  Aucune commande.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total ?? 0} hrefFor={hrefFor} />
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">{SHOP_ORDER_STATUSES.length} statuts : en attente de paiement → payée → préparée → expédiée / retirée → livrée · annulée</p>
      </section>
    </div>
  );
}
