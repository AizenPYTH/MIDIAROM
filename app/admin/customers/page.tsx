import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Pagination, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { formatDate } from "@/lib/utils/format";

const PAGE_SIZE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdminOrRedirect();
  const { q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const db = createSupabaseAdminClient();
  let query = db.from("profiles").select("id, email, first_name, last_name, phone, created_at", { count: "exact" }).eq("role", "CUSTOMER").order("created_at", { ascending: false });
  if (q) query = query.or(`email.ilike.%${q}%,last_name.ilike.%${q}%,first_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const ids = (data ?? []).map((p) => p.id);
  const [{ data: orderCounts }, { data: shopCounts }, { data: tradeCounts }] = ids.length
    ? await Promise.all([db.from("repair_orders").select("customer_id").in("customer_id", ids), db.from("shop_orders").select("customer_id").in("customer_id", ids), db.from("trade_in_requests").select("customer_id").in("customer_id", ids)])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const counts = new Map<string, number>();
  for (const o of orderCounts ?? []) counts.set(o.customer_id, (counts.get(o.customer_id) ?? 0) + 1);
  const shop = new Map<string, number>();
  for (const o of shopCounts ?? []) shop.set(o.customer_id, (shop.get(o.customer_id) ?? 0) + 1);
  const trades = new Map<string, number>();
  for (const o of tradeCounts ?? []) if (o.customer_id) trades.set(o.customer_id, (trades.get(o.customer_id) ?? 0) + 1);
  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Réparations, commandes boutique et reprises de chaque client. Seules les informations nécessaires au suivi sont affichées." />
      <form method="get" className="flex gap-2"><Input name="q" defaultValue={q ?? ""} placeholder="E-mail, nom…" aria-label="Recherche" className="max-w-sm" /><Button type="submit" variant="outline">Rechercher</Button></form>
      <Table>
        <thead><tr><Th>Client</Th><Th>E-mail</Th><Th>Téléphone</Th><Th>Réparations</Th><Th>Commandes</Th><Th>Reprises</Th><Th>Inscrit</Th></tr></thead>
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id}>
              <Td><Link href={`/admin/customers/${p.id}`} className="font-medium text-accent hover:underline">{p.first_name} {p.last_name}</Link></Td>
              <Td>{p.email}</Td>
              <Td>{p.phone ?? "—"}</Td>
              <Td className="font-mono">{counts.get(p.id) ?? 0}</Td>
              <Td className="font-mono">{shop.get(p.id) ?? 0}</Td>
              <Td className="font-mono">{trades.get(p.id) ?? 0}</Td>
              <Td className="text-ink-muted">{formatDate(p.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
    </div>
  );
}
