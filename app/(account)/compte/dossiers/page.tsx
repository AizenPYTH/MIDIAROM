import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/config/site";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABELS, statusTone } from "@/lib/orders/status";
import { formatDate, formatPrice } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Mes dossiers", robots: { index: false } };

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: orders, error } = await supabase.from("repair_orders").select("id, order_number, model_name, repair_name, status, total_cents, created_at").order("created_at", { ascending: false });
  if (error) {
    return <EmptyState title="Impossible de charger vos dossiers" description="Réessayez dans quelques instants." />;
  }
  const { data: pendingQuotes } = await supabase.from("supplementary_quotes").select("order_id").eq("status", "SENT");
  const pendingSet = new Set((pendingQuotes ?? []).map((q) => q.order_id));

  return (
    <div>
      <PageHeader title="Mes dossiers" description="Retrouvez l'avancement de chaque réparation." actions={<ButtonLink href={ROUTES.repair} variant="accent" size="sm">Nouvelle réparation</ButtonLink>} />
      {orders?.length ? (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`${ROUTES.accountOrders}/${order.id}`} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-ink">{order.order_number}</span>
                    <Badge tone={statusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                    {pendingSet.has(order.id) ? <Badge tone="warning">Devis à décider</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-ink">
                    {order.model_name} — {order.repair_name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Commandé le {formatDate(order.created_at)} · {formatPrice(order.total_cents)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8" title="Aucun dossier pour le moment" description="Votre premier dossier apparaîtra ici dès votre commande." action={<ButtonLink href={ROUTES.repair} size="sm">Faire réparer ma console</ButtonLink>} />
      )}
    </div>
  );
}
