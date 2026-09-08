import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { StatCard, Section, Table, Th, Td } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { isAdminRole, ORDER_STATUS_LABELS, statusTone } from "@/lib/orders/status";
import { formatDateTime, formatPrice } from "@/lib/utils/format";

function periods(): { startOfDay: string; thirtyDaysAgo: string } {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return { startOfDay: startOfDay.toISOString(), thirtyDaysAgo: new Date(startOfDay.getTime() - 30 * 86_400_000).toISOString() };
}

export default async function AdminDashboard() {
  const user = await requireStaffOrRedirect();
  const db = createSupabaseAdminClient();
  const { startOfDay, thirtyDaysAgo } = periods();

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [today, awaiting, diagnosis, pendingQuotes, repairing, toShip, sav, recent, revenue30, sessions30, purchases30, optionsAdded30] = await Promise.all([
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).gte("created_at", startOfDay).neq("status", "PENDING_PAYMENT")),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", ["AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"])),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", ["RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS"])),
    count(db.from("supplementary_quotes").select("id", { count: "exact", head: true }).eq("status", "SENT")),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", ["APPROVED", "REPAIRING", "QUALITY_CONTROL"])),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).eq("status", "READY_TO_SHIP")),
    count(db.from("sav_requests").select("id", { count: "exact", head: true }).in("status", ["NEW", "IN_ANALYSIS"])),
    db.from("repair_orders").select("id, order_number, model_name, repair_name, status, total_cents, created_at, customer_first_name, customer_last_name").neq("status", "PENDING_PAYMENT").order("created_at", { ascending: false }).limit(10),
    db.from("repair_orders").select("total_cents").gte("paid_at", thirtyDaysAgo).not("paid_at", "is", null),
    db.from("analytics_events").select("session_id").eq("event_name", "page_view").gte("created_at", thirtyDaysAgo),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).gte("paid_at", thirtyDaysAgo).not("paid_at", "is", null)),
    count(db.from("repair_order_items").select("id", { count: "exact", head: true }).in("item_type", ["OPTION", "PACK"]).gte("created_at", thirtyDaysAgo)),
  ]);

  const revenue = (revenue30.data ?? []).reduce((s, o) => s + o.total_cents, 0);
  const uniqueSessions = new Set((sessions30.data ?? []).map((s) => s.session_id).filter(Boolean)).size;
  const conversion = uniqueSessions ? (purchases30 / uniqueSessions) * 100 : 0;
  const avgBasket = purchases30 ? revenue / purchases30 : 0;
  const admin = isAdminRole(user.profile.role);

  return (
    <div className="space-y-8">
      <PageHeader title="Tableau de bord" description={`Bonjour ${user.profile.first_name ?? ""}. Voici l'activité de l'atelier.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Commandes du jour" value={today} href="/admin/orders" />
        <StatCard label="Colis attendus" value={awaiting} href="/admin/orders?status=AWAITING_SHIPMENT" tone="info" />
        <StatCard label="En diagnostic" value={diagnosis} href="/admin/orders?status=DIAGNOSIS" />
        <StatCard label="Devis en attente" value={pendingQuotes} href="/admin/orders?status=WAITING_CUSTOMER_APPROVAL" tone={pendingQuotes ? "warning" : undefined} />
        <StatCard label="Réparations en cours" value={repairing} href="/admin/orders?status=REPAIRING" />
        <StatCard label="À expédier" value={toShip} href="/admin/orders?status=READY_TO_SHIP" tone={toShip ? "warning" : undefined} />
        <StatCard label="SAV ouverts" value={sav} href="/admin/sav" tone={sav ? "warning" : undefined} />
        {admin ? <StatCard label="CA 30 jours" value={formatPrice(revenue)} hint={`${purchases30} commandes payées`} href="/admin/analytics" tone="success" /> : null}
        {admin ? <StatCard label="Panier moyen" value={formatPrice(Math.round(avgBasket))} href="/admin/analytics" /> : null}
        {admin ? <StatCard label="Taux de conversion" value={`${conversion.toFixed(1)} %`} hint={`${uniqueSessions} sessions / 30 j`} href="/admin/analytics" /> : null}
        {admin ? <StatCard label="Options ajoutées" value={optionsAdded30} hint="30 derniers jours" href="/admin/analytics" /> : null}
      </div>

      <Section title="Derniers dossiers" actions={<Link href="/admin/orders" className="text-sm text-accent hover:underline">Tous les dossiers</Link>}>
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
            {(recent.data ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-surface-muted/60">
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono font-medium text-accent hover:underline">
                    {o.order_number}
                  </Link>
                </Td>
                <Td>
                  {o.customer_first_name} {o.customer_last_name}
                </Td>
                <Td>
                  {o.model_name} — {o.repair_name}
                </Td>
                <Td>
                  <Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </Td>
                <Td className="text-right tabular-nums">{formatPrice(o.total_cents)}</Td>
                <Td className="text-ink-muted">{formatDateTime(o.created_at)}</Td>
              </tr>
            ))}
            {!recent.data?.length ? (
              <tr>
                <Td className="text-center text-ink-muted" colSpan={6}>
                  Aucun dossier pour le moment.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
