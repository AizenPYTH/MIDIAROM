import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Pagination, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { formatDateTime } from "@/lib/utils/format";

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdminOrRedirect();
  const { q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  let query = createSupabaseAdminClient().from("audit_logs").select("*, actor:profiles(first_name, last_name, email)", { count: "exact" }).order("created_at", { ascending: false });
  if (q) query = query.or(`action.ilike.%${q}%,resource_type.ilike.%${q}%,resource_id.ilike.%${q}%`);
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  return (
    <div className="space-y-6">
      <PageHeader title="Journal d'audit" description="Actions sensibles : prix, statuts, devis, fichiers, remboursements, rôles." />
      <form method="get" className="flex gap-2"><Input name="q" defaultValue={q ?? ""} placeholder="action, table, id…" aria-label="Recherche" className="max-w-sm" /><Button type="submit" variant="outline">Filtrer</Button></form>
      <Table>
        <thead><tr><Th>Date</Th><Th>Acteur</Th><Th>Action</Th><Th>Ressource</Th><Th>Détail</Th></tr></thead>
        <tbody>
          {(data ?? []).map((a) => { const actor = a.actor as { first_name: string | null; last_name: string | null; email: string } | null; return (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(a.created_at)}</Td>
              <Td className="text-xs">{actor ? `${actor.first_name ?? ""} ${actor.last_name ?? ""}` : "Système"}<span className="block text-ink-muted">{a.actor_role ?? ""}</span></Td>
              <Td className="font-mono text-xs">{a.action}</Td>
              <Td className="text-xs">{a.resource_type}{a.order_id ? <Link href={`/admin/orders/${a.order_id}`} className="ml-1 text-accent hover:underline">dossier</Link> : null}<span className="block font-mono text-[10px] text-ink-muted">{a.resource_id}</span></Td>
              <Td className="max-w-md font-mono text-[11px] text-ink-muted"><details><summary className="cursor-pointer">voir</summary><pre className="mt-1 whitespace-pre-wrap">{JSON.stringify({ old: a.old_value, new: a.new_value, ip: a.ip_address }, null, 1)}</pre></details></Td>
            </tr>
          ); })}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/admin/audit?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
    </div>
  );
}
