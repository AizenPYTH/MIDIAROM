import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { isMockPayments } from "@/lib/stripe";
import { isProduction } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/utils/format";
import { simulatePaymentAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Simulation de paiement (développement)", robots: { index: false, follow: false } };

export default async function PaymentSimulationPage({ searchParams }: { searchParams: Promise<{ session?: string; payment?: string; success?: string; cancel?: string }> }) {
  if (isProduction() || !isMockPayments()) notFound();
  const { session, payment: paymentId, success, cancel } = await searchParams;
  if (!session || !paymentId) notFound();
  const { data: payment } = await createSupabaseAdminClient().from("payments").select("*, order:repair_orders(order_number, repair_name)").eq("id", paymentId).eq("provider_session_id", session).maybeSingle();
  if (!payment) notFound();
  const order = payment.order as { order_number: string; repair_name: string } | null;

  return (
    <Container className="max-w-md py-16">
      <Alert tone="warning" title="Mode développement">
        Cette page simule le prestataire de paiement (PAYMENT_PROVIDER=mock). En production, le client est redirigé vers Stripe et la confirmation arrive par webhook.
      </Alert>
      <div className="mt-6 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-ink-muted">Dossier {order?.order_number}</p>
        <p className="font-medium text-ink">{order?.repair_name}</p>
        <p className="mt-2 text-2xl font-bold text-primary">{formatPrice(payment.amount_cents)}</p>
        <p className="text-xs text-ink-muted">{payment.purpose === "QUOTE" ? "Complément de devis" : "Paiement initial"}</p>
        <form action={simulatePaymentAction} className="mt-6 flex flex-col gap-2">
          <input type="hidden" name="payment" value={payment.id} />
          <input type="hidden" name="session" value={session} />
          <input type="hidden" name="success" value={success ?? "/"} />
          <input type="hidden" name="cancel" value={cancel ?? "/"} />
          <Button type="submit" name="outcome" value="success" variant="accent" fullWidth>
            Simuler un paiement réussi
          </Button>
          <Button type="submit" name="outcome" value="cancel" variant="outline" fullWidth>
            Annuler le paiement
          </Button>
        </form>
      </div>
    </Container>
  );
}
