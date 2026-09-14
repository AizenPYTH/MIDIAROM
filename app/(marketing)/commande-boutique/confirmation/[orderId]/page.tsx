import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPendingPayment } from "@/lib/orders/payments";
import { formatPrice } from "@/lib/utils/format";
import { shopStatusLabel } from "@/lib/shop/status";
import { getSetting } from "@/lib/settings";
import { PaymentPendingRefresh } from "@/components/checkout/payment-pending";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false, follow: false } };

export default async function ShopConfirmationPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ token?: string; payment?: string }> }) {
  const [{ orderId }, { token, payment }] = await Promise.all([params, searchParams]);
  if (!token) notFound();
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("shop_orders").select("*").eq("id", orderId).eq("tracking_token", token).maybeSingle();
  if (!order) notFound();
  let paid = order.status !== "PENDING";
  if (!paid && payment) paid = await verifyPendingPayment(payment);
  const { data: fresh } = paid ? await db.from("shop_orders").select("*").eq("id", order.id).single() : { data: order };
  const current = fresh ?? order;
  const [{ data: items }, shop] = await Promise.all([db.from("shop_order_items").select("*").eq("order_id", order.id), getSetting("shop")]);

  return (
    <Container className="max-w-[760px] py-16">
      {paid ? (
        <>
          <Eyebrow>Commande enregistrée</Eyebrow>
          <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">Merci, votre commande est confirmée.</h1>
          <p className="mt-3 text-[16.5px] text-ink-soft">Votre numéro de commande :</p>
          <p className="mt-1 font-mono text-[34px] font-semibold tracking-[-0.02em] text-ink">{current.order_number}</p>
          <p className="mt-3 text-[14px] text-ink-muted">Un e-mail de confirmation vient de vous être envoyé à {current.customer_email}.</p>
          <div className="mt-8 bg-ink-900 p-4 text-paper">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Récapitulatif</span>
            <div className="mt-[11px] flex flex-col gap-[7px] text-[14.5px]">
              {(items ?? []).map((i) => (
                <div key={i.id} className="flex justify-between gap-3.5">
                  <span className="text-[#c4bdae]">
                    {i.label}
                    {i.quantity > 1 ? ` × ${i.quantity}` : ""}
                  </span>
                  <span className="font-mono">{formatPrice(i.total_cents)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3.5 border-t border-ink-700 pt-2">
                <span className="text-[#c4bdae]">{current.fulfillment === "PICKUP" ? "Retrait au magasin" : "Envoi"}</span>
                <span className="font-mono">{current.shipping_cents ? formatPrice(current.shipping_cents) : current.fulfillment === "SHIPPING" ? "offert" : "0 €"}</span>
              </div>
              <div className="flex justify-between gap-3.5 text-[16px] font-semibold">
                <span>Total réglé</span>
                <span className="font-mono">{formatPrice(current.total_cents)}</span>
              </div>
              <div className="flex justify-between gap-3.5 text-[12.5px]">
                <span className="text-[#c4bdae]">Statut</span>
                <span className="font-mono">{shopStatusLabel(current.status, current.fulfillment)}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 border border-border p-5 text-[14.5px] leading-[1.5] text-ink-soft">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Et maintenant</span>
            <p className="mt-2">{current.fulfillment === "PICKUP" ? `Nous préparons votre commande et vous prévenons par e-mail dès qu'elle est prête au retrait. ${shop.pickup_note}` : `Nous préparons votre colis et vous envoyons le numéro de suivi par e-mail. ${shop.shipping_note}`}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={`${ROUTES.accountShopOrders}/${current.id}`} className="bg-ink-900 px-[22px] py-3.5 text-[15px] font-semibold text-paper hover:bg-sale">
              Suivre ma commande
            </Link>
            <Link href={ROUTES.shop} className="border border-ink px-[22px] py-3.5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-paper">
              Retour à la boutique
            </Link>
          </div>
        </>
      ) : (
        <>
          <PaymentPendingRefresh />
          <Eyebrow tone="muted">Paiement</Eyebrow>
          <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">Paiement en cours de confirmation</h1>
          <p className="mt-3 text-[16px] text-ink-soft">
            Votre commande <span className="font-mono font-semibold text-ink">{current.order_number}</span> est enregistrée. Nous attendons la confirmation de votre paiement. Cette page se rafraîchit automatiquement.
          </p>
          <Alert tone="info" className="mt-6">
            Si vous avez fermé la page de paiement sans payer, vous pouvez{" "}
            <Link href={ROUTES.shopCheckout} className="text-sale underline">
              reprendre votre commande
            </Link>
            .
          </Alert>
        </>
      )}
    </Container>
  );
}
