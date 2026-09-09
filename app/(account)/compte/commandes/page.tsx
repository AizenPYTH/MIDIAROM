import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FULFILLMENT_LABELS, shopStatusLabel, shopStatusTone } from "@/lib/shop/status";
import { formatDate, formatPrice } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Mes commandes", robots: { index: false } };

/** Commandes boutique du client connecté (lecture sous RLS : `customer_id = auth.uid()`). */
export default async function ShopOrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: orders, error } = await supabase.from("shop_orders").select("id, order_number, status, fulfillment, total_cents, created_at, items:shop_order_items(label, quantity)").order("created_at", { ascending: false });
  if (error) return <EmptyState title="Impossible de charger vos commandes" description="Réessayez dans quelques instants." />;

  return (
    <div>
      <PageHeader title="Mes commandes" description="Consoles, jeux et accessoires achetés en boutique." actions={<ButtonLink href={ROUTES.shop} variant="accent" size="sm">Voir la boutique</ButtonLink>} />
      {orders?.length ? (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => {
            const items = order.items as { label: string; quantity: number }[];
            return (
              <li key={order.id}>
                <Link href={`${ROUTES.accountShopOrders}/${order.id}`} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-ink">{order.order_number}</span>
                      <Badge tone={shopStatusTone(order.status)}>{shopStatusLabel(order.status, order.fulfillment)}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-ink">{items.map((i) => `${i.label}${i.quantity > 1 ? ` × ${i.quantity}` : ""}`).join(", ")}</p>
                    <p className="text-xs text-ink-muted">
                      Commandé le {formatDate(order.created_at)} · {FULFILLMENT_LABELS[order.fulfillment]} · {formatPrice(order.total_cents)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted" aria-hidden="true">Ouvrir →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState className="mt-8" title="Aucune commande pour le moment" description="Vos achats en boutique apparaîtront ici." action={<ButtonLink href={ROUTES.shop} size="sm">Parcourir le catalogue</ButtonLink>} />
      )}
    </div>
  );
}
