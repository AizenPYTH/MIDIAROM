import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPendingPayment } from "@/lib/orders/payments";
import { formatPrice } from "@/lib/utils/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status";
import { getSetting } from "@/lib/settings";
import { TrackOnMount } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { PaymentPendingRefresh } from "@/components/checkout/payment-pending";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false, follow: false } };

export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ token?: string; payment?: string }> }) {
  const [{ orderId }, { token, payment }] = await Promise.all([params, searchParams]);
  if (!token) notFound();
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("repair_orders").select("*").eq("id", orderId).eq("tracking_token", token).maybeSingle();
  if (!order) notFound();

  // Webhook may still be in flight: try a server-side verification (Stripe) as a fallback.
  let paid = order.status !== "PENDING_PAYMENT";
  if (!paid && payment) paid = await verifyPendingPayment(payment);
  const { data: fresh } = paid ? await db.from("repair_orders").select("*").eq("id", order.id).single() : { data: order };
  const current = fresh ?? order;
  const shipping = await getSetting("shipping_info");
  const { data: shipment } = await db.from("shipments").select("*").eq("order_id", order.id).eq("direction", "TO_WORKSHOP").maybeSingle();

  return (
    <Container className="max-w-[760px] py-16">
      {paid ? (
        <>
          <TrackOnMount event={ANALYTICS_EVENTS.PURCHASE} props={{ order_number: current.order_number, value_cents: current.total_cents, repair_id: current.repair_id ?? undefined }} />
          <Eyebrow tone="repair">Demande enregistrée</Eyebrow>
          <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">Merci, votre commande est confirmée.</h1>
          <p className="mt-3 text-[16.5px] text-ink-soft">Votre numéro de dossier :</p>
          <p className="mt-1 font-mono text-[34px] font-semibold tracking-[-0.02em] text-ink">{current.order_number}</p>
          <p className="mt-3 text-[14px] text-ink-muted">Un e-mail de confirmation avec les instructions vient de vous être envoyé à {current.customer_email}.</p>

          <div className="mt-8 bg-ink-900 p-4 text-paper">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Récapitulatif</span>
            <div className="mt-[11px] flex flex-col gap-[7px] text-[14.5px]">
              {[
                ["Console", current.model_name],
                ["Prestation", current.repair_name],
                ["Montant réglé", formatPrice(current.total_cents)],
                ["Statut", ORDER_STATUS_LABELS[current.status]],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3.5">
                  <span className="text-[#c4bdae]">{k}</span>
                  <span className="text-right font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border border-border p-5">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Prochaines étapes</span>
            <ol className="mt-3 flex flex-col gap-2 text-[14.5px] leading-[1.5] text-ink-soft">
              <li className="flex gap-3.5">
                <span className="font-mono text-[12px] text-accent">01</span>
                <span>
                  Emballez soigneusement votre console en suivant nos{" "}
                  <Link href={ROUTES.packaging} className="text-sale underline">
                    instructions d&apos;emballage
                  </Link>
                  .
                </span>
              </li>
              <li className="flex gap-3.5">
                <span className="font-mono text-[12px] text-accent">02</span>
                <span>
                  Glissez une feuille avec votre numéro de dossier <span className="font-mono font-semibold text-ink">{current.order_number}</span> dans le colis.
                </span>
              </li>
              <li className="flex gap-3.5">
                <span className="font-mono text-[12px] text-accent">03</span>
                {shipment?.label_path ? (
                  <span>Imprimez l&apos;étiquette de transport disponible dans votre espace client et déposez le colis au point indiqué.</span>
                ) : (
                  <span>
                    {shipping.workshop_receiving_address ? (
                      <>
                        Expédiez le colis à : <span className="text-ink">{[shipping.workshop_receiving_name, shipping.workshop_receiving_address].filter(Boolean).join(", ")}</span>
                      </>
                    ) : (
                      <>L&apos;adresse d&apos;expédition de l&apos;atelier vous est communiquée par e-mail.</>
                    )}
                  </span>
                )}
              </li>
              <li className="flex gap-3.5">
                <span className="font-mono text-[12px] text-accent">04</span>
                <span>Suivez chaque étape depuis votre espace client. Vous serez notifié par e-mail.</span>
              </li>
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={`${ROUTES.accountOrders}/${current.id}`} className="bg-accent px-[22px] py-3.5 text-[15px] font-semibold text-white hover:bg-ink-900">
              Ouvrir mon dossier
            </Link>
            <Link href={`${ROUTES.tracking}/${current.tracking_token}`} className="border border-ink px-[22px] py-3.5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-paper">
              Suivi sans connexion
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-ink-muted">Pas encore de mot de passe ? Un e-mail vous permet d&apos;en définir un. Vous pouvez aussi utiliser « Mot de passe oublié » avec l&apos;adresse {current.customer_email}.</p>
        </>
      ) : (
        <>
          <PaymentPendingRefresh />
          <Eyebrow tone="muted">Paiement</Eyebrow>
          <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">Paiement en cours de confirmation</h1>
          <p className="mt-3 text-[16px] text-ink-soft">
            Votre dossier <span className="font-mono font-semibold text-ink">{current.order_number}</span> est enregistré. Nous attendons la confirmation de votre paiement par notre prestataire. Cette page se rafraîchit automatiquement.
          </p>
          <Alert tone="info" className="mt-6">
            Si vous avez fermé la page de paiement sans payer, vous pouvez{" "}
            <Link href={`${ROUTES.checkout}/${current.repair_id}`} className="text-sale underline">
              reprendre votre demande
            </Link>
            .
          </Alert>
        </>
      )}
    </Container>
  );
}
