import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FileText, Package } from "lucide-react";
import { ROUTES } from "@/config/site";
import { Container } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
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
    <Container className="max-w-2xl py-10 sm:py-16">
      {paid ? (
        <>
          <TrackOnMount event={ANALYTICS_EVENTS.PURCHASE} props={{ order_number: current.order_number, value_cents: current.total_cents, repair_id: current.repair_id ?? undefined }} />
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Merci, votre commande est confirmée</h1>
            <p className="mt-2 text-ink-soft">Votre numéro de dossier :</p>
            <p className="mt-1 font-mono text-3xl font-bold text-primary">{current.order_number}</p>
            <p className="mt-3 text-sm text-ink-muted">Un e-mail de confirmation avec les instructions vient de vous être envoyé à {current.customer_email}.</p>
          </div>

          <div className="mt-8 rounded-lg border border-border bg-surface p-5">
            <h2 className="font-semibold text-ink">Récapitulatif</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Console</dt><dd className="text-ink">{current.model_name}</dd></div>
              <div><dt className="text-ink-muted">Réparation</dt><dd className="text-ink">{current.repair_name}</dd></div>
              <div><dt className="text-ink-muted">Montant réglé</dt><dd className="font-semibold text-ink">{formatPrice(current.total_cents)}</dd></div>
              <div><dt className="text-ink-muted">Statut</dt><dd className="text-ink">{ORDER_STATUS_LABELS[current.status]}</dd></div>
            </dl>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <Package className="h-5 w-5 text-accent" aria-hidden="true" /> Prochaines étapes
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
              <li>
                Emballez soigneusement votre console en suivant nos{" "}
                <Link href={ROUTES.packaging} className="text-accent underline">
                  instructions d&apos;emballage
                </Link>
                .
              </li>
              <li>
                Glissez une feuille avec votre numéro de dossier <span className="font-mono font-semibold text-ink">{current.order_number}</span> dans le colis.
              </li>
              {shipment?.label_path ? (
                <li>Imprimez l&apos;étiquette de transport disponible dans votre espace client et déposez le colis au point indiqué.</li>
              ) : (
                <li>
                  Expédiez le colis à : <span className="text-ink">{[shipping.workshop_receiving_name, shipping.workshop_receiving_address].filter(Boolean).join(", ") || "adresse communiquée dans votre espace client"}</span>
                </li>
              )}
              <li>Suivez chaque étape depuis votre espace client. Vous serez notifié par e-mail.</li>
            </ol>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={`${ROUTES.accountOrders}/${current.id}`} variant="accent" size="lg">
              <FileText className="h-4 w-4" aria-hidden="true" /> Ouvrir mon dossier
            </ButtonLink>
            <ButtonLink href={`${ROUTES.tracking}/${current.tracking_token}`} variant="outline" size="lg">
              Suivi sans connexion
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            Pas encore de mot de passe ? Un e-mail vous permet d&apos;en définir un. Vous pouvez aussi utiliser « Mot de passe oublié » avec l&apos;adresse {current.customer_email}.
          </p>
        </>
      ) : (
        <>
          <PaymentPendingRefresh />
          <div className="text-center">
            <Clock className="mx-auto h-12 w-12 text-warning" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Paiement en cours de confirmation</h1>
            <p className="mt-2 text-ink-soft">
              Votre dossier <span className="font-mono font-semibold text-ink">{current.order_number}</span> est enregistré. Nous attendons la confirmation de votre paiement par notre prestataire. Cette page se rafraîchit automatiquement.
            </p>
          </div>
          <Alert tone="info" className="mt-6">
            Si vous avez fermé la page de paiement sans payer, vous pouvez{" "}
            <Link href={`${ROUTES.checkout}/${current.repair_id}`} className="text-accent underline">
              reprendre votre commande
            </Link>
            .
          </Alert>
        </>
      )}
    </Container>
  );
}
