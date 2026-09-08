import { PageHeader } from "@/components/ui/misc";
import { ReceptionLookupForm } from "@/components/admin/order-forms";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Table, Td, Th } from "@/components/admin/ui";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils/format";

export default async function ReceptionPage() {
  await requireStaffOrRedirect();
  const { data: expected } = await createSupabaseAdminClient().from("repair_orders").select("id, order_number, model_name, customer_last_name, status, created_at").in("status", ["AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"]).order("created_at").limit(50);
  return (
    <div className="space-y-6">
      <PageHeader title="Réception d'un colis" description="Scannez ou saisissez le numéro de dossier (REP-XXXXXX) ou le numéro de suivi du colis." />
      <div className="rounded-lg border border-border bg-surface p-5">
        <ReceptionLookupForm />
      </div>
      <div>
        <h2 className="mb-3 font-semibold text-ink">Colis attendus ({expected?.length ?? 0})</h2>
        <Table>
          <thead>
            <tr>
              <Th>Dossier</Th>
              <Th>Console</Th>
              <Th>Client</Th>
              <Th>Commandé</Th>
            </tr>
          </thead>
          <tbody>
            {(expected ?? []).map((o) => (
              <tr key={o.id}>
                <Td><Link href={`/admin/orders/${o.id}?tab=reception`} className="font-mono text-accent hover:underline">{o.order_number}</Link></Td>
                <Td>{o.model_name}</Td>
                <Td>{o.customer_last_name}</Td>
                <Td className="text-ink-muted">{formatDateTime(o.created_at)}</Td>
              </tr>
            ))}
            {!expected?.length ? <tr><Td colSpan={4} className="text-center text-ink-muted">Aucun colis attendu.</Td></tr> : null}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
