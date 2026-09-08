import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Pagination, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, statusTone, type OrderStatus } from "@/lib/orders/status";
import { formatDateTime, formatPrice } from "@/lib/utils/format";

const PAGE_SIZE = 25;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireStaffOrRedirect();
  const { status, q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const db = createSupabaseAdminClient();
  let query = db.from("repair_orders").select("id, order_number, model_name, repair_name, status, total_cents, created_at, customer_first_name, customer_last_name, customer_email", { count: "exact" }).order("created_at", { ascending: false });
  if (status && ORDER_STATUSES.includes(status as OrderStatus)) query = query.eq("status", status as OrderStatus);
  if (q) {
    const term = q.trim();
    query = query.or(`order_number.ilike.%${term}%,customer_email.ilike.%${term}%,customer_last_name.ilike.%${term}%,model_name.ilike.%${term}%`);
  }
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const hrefFor = (p: number) => `/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(p) }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Dossiers" description="Toutes les commandes et réparations." />
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4" method="get">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-ink-muted">Recherche</label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="REP-000152, e-mail, nom, console…" />
        </div>
        <div className="min-w-[200px]">
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-ink-muted">Statut</label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Tous</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">Filtrer</Button>
      </form>
      <Table>
        <thead>
          <tr>
            <Th>Dossier</Th>
            <Th>Client</Th>
            <Th>Console / réparation</Th>
            <Th>Statut</Th>
            <Th className="text-right">Total</Th>
            <Th>Créé</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((o) => (
            <tr key={o.id} className="hover:bg-surface-muted/60">
              <Td><Link href={`/admin/orders/${o.id}`} className="font-mono font-medium text-accent hover:underline">{o.order_number}</Link></Td>
              <Td>
                <span className="block">{o.customer_first_name} {o.customer_last_name}</span>
                <span className="block text-xs text-ink-muted">{o.customer_email}</span>
              </Td>
              <Td>{o.model_name} — {o.repair_name}</Td>
              <Td><Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge></Td>
              <Td className="text-right tabular-nums">{formatPrice(o.total_cents)}</Td>
              <Td className="text-ink-muted">{formatDateTime(o.created_at)}</Td>
            </tr>
          ))}
          {!data?.length ? (
            <tr><Td colSpan={6} className="text-center text-ink-muted">Aucun dossier ne correspond.</Td></tr>
          ) : null}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefFor} />
    </div>
  );
}
