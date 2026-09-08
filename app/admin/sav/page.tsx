import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { SAV_STATUS_LABELS } from "@/lib/orders/status";
import { formatDateTime } from "@/lib/utils/format";

export default async function SavListPage() {
  await requireStaffOrRedirect();
  const { data } = await createSupabaseAdminClient().from("sav_requests").select("*, order:repair_orders(order_number, model_name, repair_name, customer_last_name)").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-6">
      <PageHeader title="Service après-vente" description="Demandes ouvertes par les clients après livraison." />
      <Table>
        <thead><tr><Th>Demande</Th><Th>Dossier</Th><Th>Statut</Th><Th>Ouverte</Th></tr></thead>
        <tbody>
          {(data ?? []).map((s) => { const o = s.order as { order_number: string; model_name: string; repair_name: string; customer_last_name: string } | null; return (
            <tr key={s.id}>
              <Td><Link href={`/admin/sav/${s.id}`} className="font-medium text-accent hover:underline">{s.subject}</Link></Td>
              <Td><Link href={`/admin/orders/${s.order_id}`} className="font-mono text-accent hover:underline">{o?.order_number}</Link><span className="block text-xs text-ink-muted">{o?.model_name} — {o?.repair_name} · {o?.customer_last_name}</span></Td>
              <Td><Badge tone={s.status === "CLOSED" ? "neutral" : s.status === "ANSWERED" ? "success" : "warning"}>{SAV_STATUS_LABELS[s.status]}</Badge></Td>
              <Td className="text-ink-muted">{formatDateTime(s.created_at)}</Td>
            </tr>
          ); })}
          {!data?.length ? <tr><Td colSpan={4} className="text-center text-ink-muted">Aucune demande SAV.</Td></tr> : null}
        </tbody>
      </Table>
    </div>
  );
}
