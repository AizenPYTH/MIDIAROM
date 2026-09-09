import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DescriptionList } from "@/components/ui/misc";
import { Section, Table, Td, Th } from "@/components/admin/ui";
import { ShopNoteForm, ShopStatusForm, ShopTrackingForm } from "@/components/admin/shop-forms";
import { RefundForm } from "@/components/admin/order-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { isAdminRole } from "@/lib/orders/status";
import { CONDITION_SHORT, FULFILLMENT_LABELS, SHOP_ORDER_STATUS_LABELS, shopStatusLabel, shopStatusTone } from "@/lib/shop/status";
import { formatDateTime, formatPrice } from "@/lib/utils/format";

export default async function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaffOrRedirect();
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("shop_orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [items, history, payments, invoices] = await Promise.all([
    db.from("shop_order_items").select("*").eq("order_id", id).order("created_at"),
    db.from("shop_order_history").select("*, actor:profiles(first_name, last_name)").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("payments").select("*").eq("shop_order_id", id).order("created_at"),
    db.from("invoices").select("*").eq("shop_order_id", id).order("issued_at"),
  ]);
  const address = (order.shipping_address ?? null) as Record<string, string | null> | null;
  const admin = isAdminRole(user.profile.role);

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/shop-orders" className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted hover:text-ink">
            ← Commandes
          </Link>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Commande {order.order_number}</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.02em] text-ink">
            {order.customer_first_name} {order.customer_last_name}
          </h1>
          <p className="text-[14px] text-ink-faint">
            <Link href={`/admin/customers/${order.customer_id}`} className="hover:text-ink">
              {order.customer_email}
            </Link>
            {order.customer_phone ? ` · ${order.customer_phone}` : ""} · {FULFILLMENT_LABELS[order.fulfillment]} · {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={shopStatusTone(order.status)}>{shopStatusLabel(order.status, order.fulfillment)}</Badge>
          <Link href={`/admin/shop-orders/print?id=${order.id}`} className="border border-border-strong px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink hover:border-paper">
            Imprimer le bon
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Articles">
          <ul className="flex flex-col gap-2 text-[14.5px]">
            {(items.data ?? []).map((i) => (
              <li key={i.id} className="flex justify-between gap-3.5 border-b border-dotted border-[#3a3529] pb-1.5">
                <span>
                  {i.label}
                  {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                  <span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                    {i.sku ?? "—"} · {i.platform ?? ""} · {i.condition ? CONDITION_SHORT[i.condition] : ""}
                  </span>
                </span>
                <span className="whitespace-nowrap font-mono text-[#e4dccb]">{formatPrice(i.total_cents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between text-[13px] text-ink-muted">
            <span>{order.fulfillment === "SHIPPING" ? "Livraison" : "Retrait"}</span>
            <span className="font-mono">{formatPrice(order.shipping_cents)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[16px] font-semibold">
            <span>Total</span>
            <span className="font-mono">{formatPrice(order.total_cents)}</span>
          </div>
          <div className="flex justify-between text-[12.5px] text-ink-muted">
            <span>Encaissé</span>
            <span className="font-mono">{formatPrice(order.paid_cents)}</span>
          </div>
        </Section>
        <Section title="Statut">
          <ShopStatusForm orderId={order.id} current={order.status} fulfillment={order.fulfillment} carrier={order.carrier_name} tracking={order.tracking_number} trackingUrl={order.tracking_url} />
        </Section>
        <Section title="Client et livraison">
          <DescriptionList
            items={[
              { label: "Client", value: <Link href={`/admin/customers/${order.customer_id}`} className="text-accent-light hover:underline">{order.customer_first_name} {order.customer_last_name}</Link> },
              { label: "E-mail", value: order.customer_email },
              { label: "Téléphone", value: order.customer_phone ?? "—" },
              { label: "Mode", value: FULFILLMENT_LABELS[order.fulfillment] },
              { label: "Adresse", value: address ? [address.line1, address.line2, `${address.postal_code ?? ""} ${address.city ?? ""}`].filter(Boolean).join(", ") : "Retrait au magasin" },
              { label: "Remarque client", value: order.customer_notes ?? "—" },
              { label: "CGV acceptées", value: order.accepted_terms_at ? `${formatDateTime(order.accepted_terms_at)} (v. ${order.accepted_terms_version})` : "—" },
            ]}
          />
          {order.fulfillment === "SHIPPING" ? (
            <div className="mt-4 border-t border-border pt-4">
              <ShopTrackingForm orderId={order.id} carrier={order.carrier_name} tracking={order.tracking_number} trackingUrl={order.tracking_url} />
            </div>
          ) : null}
        </Section>
        <Section title="Notes internes">
          {order.internal_notes ? <pre className="mb-3 whitespace-pre-wrap font-sans text-[13.5px] text-ink-soft">{order.internal_notes}</pre> : <p className="mb-3 text-[13.5px] text-ink-muted">Aucune note.</p>}
          <ShopNoteForm orderId={order.id} />
        </Section>
        {admin ? (
          <Section title="Paiements et factures" className="lg:col-span-2">
            <Table>
              <thead>
                <tr>
                  <Th>Prestataire</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">Montant</Th>
                  <Th>Date</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {(payments.data ?? []).map((p) => (
                  <tr key={p.id}>
                    <Td className="font-mono text-xs">
                      {p.provider} {p.provider_payment_id ? `· ${p.provider_payment_id}` : ""}
                    </Td>
                    <Td>
                      <Badge tone={p.status === "SUCCEEDED" ? "success" : p.status === "PENDING" ? "warning" : "neutral"}>{p.status}</Badge>
                    </Td>
                    <Td className="text-right font-mono">
                      {formatPrice(p.amount_cents)}
                      {p.refunded_cents ? <span className="block text-xs text-danger">remb. {formatPrice(p.refunded_cents)}</span> : null}
                    </Td>
                    <Td className="text-ink-muted">{formatDateTime(p.succeeded_at ?? p.created_at)}</Td>
                    <Td>
                      {(p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && p.amount_cents - p.refunded_cents > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-accent-light">Rembourser</summary>
                          <div className="mt-2">
                            <RefundForm paymentId={p.id} maxCents={p.amount_cents - p.refunded_cents} />
                          </div>
                        </details>
                      ) : null}
                    </Td>
                  </tr>
                ))}
                {!payments.data?.length ? (
                  <tr>
                    <Td colSpan={5} className="text-center text-ink-muted">
                      Aucun paiement.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
            {invoices.data?.length ? (
              <ul className="mt-3 text-xs text-ink-muted">
                {invoices.data.map((inv) => (
                  <li key={inv.id}>
                    {inv.invoice_number} · {inv.invoice_type} · {formatPrice(inv.amount_cents)} · {formatDateTime(inv.issued_at)}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
        ) : null}
        <Section title="Historique" className="lg:col-span-2">
          <ol className="flex flex-col gap-2 text-[13px]">
            {(history.data ?? []).map((h) => {
              const actor = h.actor as { first_name: string | null; last_name: string | null } | null;
              return (
                <li key={h.id} className="flex gap-3 text-ink-faint">
                  <span className="whitespace-nowrap font-mono text-[#6b6558]">{formatDateTime(h.created_at)}</span>
                  <span>
                    {h.from_status ? `${SHOP_ORDER_STATUS_LABELS[h.from_status]} → ` : ""}
                    <span className="font-medium text-ink">{SHOP_ORDER_STATUS_LABELS[h.to_status]}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {actor ? `${actor.first_name ?? ""} ${actor.last_name ?? ""}` : "Système"}
                      {h.note ? ` · ${h.note}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Section>
      </div>
    </div>
  );
}
