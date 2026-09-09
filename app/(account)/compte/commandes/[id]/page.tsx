import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Breadcrumbs, DescriptionList } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTimeline } from "@/components/ui/timeline";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInvoiceDocumentUrl, INVOICE_TYPE_LABELS } from "@/lib/invoices";
import { FULFILLMENT_LABELS, SHOP_ORDER_STATUS_LABELS, shopStatusLabel, shopStatusTone, type ShopFulfillment, type ShopOrderStatus } from "@/lib/shop/status";
import type { TimelineState } from "@/lib/orders/status";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Commande", robots: { index: false } };

/** Étapes d'une commande boutique selon le mode de retrait / envoi. */
function shopTimeline(status: ShopOrderStatus, fulfillment: ShopFulfillment): { key: string; label: string; state: TimelineState }[] {
  const steps: { key: string; label: string; status: ShopOrderStatus }[] =
    fulfillment === "PICKUP"
      ? [
          { key: "paid", label: "Payée", status: "PAID" },
          { key: "prepared", label: "Prête au retrait", status: "PREPARED" },
          { key: "delivered", label: "Retirée", status: "DELIVERED" },
        ]
      : [
          { key: "paid", label: "Payée", status: "PAID" },
          { key: "prepared", label: "Préparée", status: "PREPARED" },
          { key: "shipped", label: "Expédiée", status: "SHIPPED" },
          { key: "delivered", label: "Livrée", status: "DELIVERED" },
        ];
  const order: ShopOrderStatus[] = ["PENDING", "PAID", "PREPARED", "SHIPPED", "DELIVERED"];
  const pos = order.indexOf(status);
  return steps.map((s) => {
    const stepPos = order.indexOf(s.status);
    const state: TimelineState = status === "CANCELLED" ? "todo" : stepPos < pos || (stepPos === pos && status === "DELIVERED") ? "done" : stepPos === pos ? "current" : "todo";
    return { key: s.key, label: s.label, state };
  });
}

export default async function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase.from("shop_orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: items }, { data: history }, { data: invoices }] = await Promise.all([
    supabase.from("shop_order_items").select("*").eq("order_id", id).order("created_at"),
    supabase.from("shop_order_history").select("*").eq("order_id", id).order("created_at"),
    supabase.from("invoices").select("*").eq("shop_order_id", id).order("issued_at"),
  ]);
  const invoiceLinks = await Promise.all((invoices ?? []).map(async (inv) => ({ ...inv, url: await getInvoiceDocumentUrl(inv) })));
  const address = (order.shipping_address ?? null) as Record<string, string | null> | null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Mes commandes", href: ROUTES.accountShopOrders }, { label: order.order_number }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-[28px] font-semibold tracking-[-0.02em] text-ink">{order.order_number}</h1>
          <p className="text-sm text-ink-muted">
            Commandée le {formatDateTime(order.created_at)} · {FULFILLMENT_LABELS[order.fulfillment]}
          </p>
        </div>
        <Badge tone={shopStatusTone(order.status)} className="text-sm">
          {shopStatusLabel(order.status, order.fulfillment)}
        </Badge>
      </div>

      <Card>
        <CardContent className="py-6">
          <StatusTimeline steps={shopTimeline(order.status, order.fulfillment)} />
          {order.status === "CANCELLED" ? <p className="mt-3 text-sm text-danger">Commande annulée{order.cancelled_at ? ` le ${formatDate(order.cancelled_at)}` : ""}.</p> : null}
          {order.status === "PENDING" ? <p className="mt-3 text-sm text-warning">Paiement non confirmé : la commande sera annulée automatiquement si le paiement n&apos;aboutit pas.</p> : null}
        </CardContent>
      </Card>

      {order.tracking_number ? (
        <Card>
          <CardHeader>
            <CardTitle>Suivi du colis</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-ink">
              {order.carrier_name ?? "Transporteur"} — <span className="font-mono">{order.tracking_number}</span>
            </p>
            {order.tracking_url ? (
              <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-accent underline">
                Suivre chez le transporteur
              </a>
            ) : null}
            {order.shipped_at ? <p className="mt-1 text-xs text-ink-muted">Expédiée le {formatDateTime(order.shipped_at)}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {(items ?? []).map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {i.label}
                    {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                    {i.sku ? <span className="ml-2 font-mono text-[11px] text-ink-muted">{i.sku}</span> : null}
                  </span>
                  <span className="whitespace-nowrap font-mono">{formatPrice(i.total_cents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Sous-total</span>
                <span className="font-mono">{formatPrice(order.subtotal_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">{order.fulfillment === "PICKUP" ? "Retrait au magasin" : "Livraison"}</span>
                <span className="font-mono">{order.shipping_cents ? formatPrice(order.shipping_cents) : "0 €"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total TTC</span>
                <span className="font-mono">{formatPrice(order.total_cents)}</span>
              </div>
              <div className="flex justify-between text-xs text-ink-muted">
                <span>dont TVA ({(order.vat_rate_bp / 100).toFixed(1).replace(".", ",")} %)</span>
                <span className="font-mono">{formatPrice(order.total_cents - Math.round(order.total_cents / (1 + order.vat_rate_bp / 10_000)))}</span>
              </div>
            </div>
            {invoiceLinks.length ? (
              <ul className="mt-3 space-y-1 text-xs text-ink-muted">
                {invoiceLinks.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-1.5">
                    {INVOICE_TYPE_LABELS[inv.invoice_type]} {inv.invoice_number} · {formatPrice(Math.abs(inv.amount_cents))} · {formatDate(inv.issued_at)}
                    {inv.url ? (
                      <a href={inv.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        Télécharger le PDF
                      </a>
                    ) : (
                      <span>· PDF envoyé sur demande</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Nom", value: `${order.customer_first_name} ${order.customer_last_name}` },
                { label: "E-mail", value: order.customer_email },
                { label: "Téléphone", value: order.customer_phone ?? "—" },
                { label: order.fulfillment === "PICKUP" ? "Retrait" : "Adresse de livraison", value: address ? [address.line1, address.line2, `${address.postal_code ?? ""} ${address.city ?? ""}`].filter((x) => x && x.trim()).join(", ") : "Au magasin, sur présentation du numéro de commande" },
                { label: "Vos remarques", value: order.customer_notes ?? "—" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {(history ?? []).map((h) => (
              <li key={h.id} className="flex gap-4">
                <span className="w-36 shrink-0 font-mono text-xs text-ink-muted">{formatDateTime(h.created_at)}</span>
                <span>
                  <span className="font-medium text-ink">{SHOP_ORDER_STATUS_LABELS[h.to_status]}</span>
                  {h.note ? <span className="block text-ink-soft">{h.note}</span> : null}
                </span>
              </li>
            ))}
            {!history?.length ? <li className="text-ink-muted">Aucun événement.</li> : null}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
