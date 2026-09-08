import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Breadcrumbs } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaGallery } from "@/components/customer/media-gallery";
import { QuoteDecisionForm } from "@/components/customer/forms";
import { PaymentPendingRefresh } from "@/components/checkout/payment-pending";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/security/auth";
import { signMedia } from "@/lib/media/service";
import { verifyPendingPayment } from "@/lib/orders/payments";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";
import { payQuoteAction } from "@/app/(account)/compte/actions";
import { getBusinessRules } from "@/lib/settings";
import { consequenceForOutcome } from "@/lib/quotes/rules";

export const metadata: Metadata = { title: "Devis complémentaire", robots: { index: false } };

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string; quoteId: string }>; searchParams: Promise<{ paid?: string; payment?: string; cancelled?: string }> }) {
  const [{ id, quoteId }, { paid, payment, cancelled }] = await Promise.all([params, searchParams]);
  await requireUserOrRedirect(`${ROUTES.accountOrders}/${id}/devis/${quoteId}`);
  if (paid && payment) await verifyPendingPayment(payment);
  const supabase = await createSupabaseServerClient();
  const [{ data: order }, { data: quote }] = await Promise.all([
    supabase.from("repair_orders").select("id, order_number, model_name, repair_name").eq("id", id).maybeSingle(),
    supabase.from("supplementary_quotes").select("*, items:supplementary_quote_items(*)").eq("id", quoteId).eq("order_id", id).maybeSingle(),
  ]);
  if (!order || !quote) notFound();
  const [{ data: media }, { data: decisions }, rules] = await Promise.all([
    supabase.from("order_media").select("*").eq("order_id", id).in("kind", ["QUOTE", "DIAGNOSTIC"]).eq("is_visible_to_customer", true).order("created_at", { ascending: false }),
    supabase.from("quote_decisions").select("*").eq("quote_id", quoteId).order("created_at"),
    getBusinessRules(),
  ]);
  const photos = await signMedia(media ?? []);
  const items = quote.items as { id: string; label: string; description: string | null; quantity: number; unit_price_cents: number; total_cents: number }[];
  const expired = quote.status === "SENT" && quote.expires_at && new Date(quote.expires_at) < new Date();
  const awaitingPayment = quote.status === "ACCEPTED" && quote.requires_payment && quote.total_cents > 0 && !quote.paid_at;
  const refusal = consequenceForOutcome("QUOTE_REFUSED", rules, false);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Mes dossiers", href: ROUTES.accountOrders }, { label: order.order_number, href: `${ROUTES.accountOrders}/${order.id}` }, { label: quote.quote_number }]} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Devis complémentaire</p>
        <h1 className="mt-1 font-mono text-2xl font-bold text-ink">{quote.quote_number}</h1>
        <p className="text-ink-soft">
          {order.model_name} — {order.repair_name}
        </p>
      </div>

      {paid && quote.paid_at ? <Alert tone="success" title="Complément réglé">Merci, votre règlement est confirmé. L&apos;intervention complémentaire est programmée.</Alert> : null}
      {paid && !quote.paid_at ? (
        <>
          <PaymentPendingRefresh />
          <Alert tone="info" title="Paiement en cours de confirmation">Nous attendons la confirmation du prestataire. Cette page se rafraîchit automatiquement.</Alert>
        </>
      ) : null}
      {cancelled ? <Alert tone="warning" title="Paiement annulé">Vous pouvez reprendre le règlement ci-dessous.</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{quote.title}</CardTitle>
          {quote.diagnosis_summary ? <p className="text-sm text-ink-soft">Diagnostic : {quote.diagnosis_summary}</p> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {quote.message ? <p className="whitespace-pre-line text-sm text-ink">{quote.message}</p> : null}
          <ul className="divide-y divide-border text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="block text-ink">
                    {item.label}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                  {item.description ? <span className="block text-xs text-ink-muted">{item.description}</span> : null}
                </span>
                <span className="tabular-nums text-ink">{formatPrice(item.total_cents)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-semibold text-ink">Montant du devis</span>
            <span className="text-2xl font-bold text-primary">{formatPrice(quote.total_cents)}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
            {quote.sent_at ? <span>Envoyé le {formatDateTime(quote.sent_at)}</span> : null}
            {quote.expires_at ? <span>· Valable jusqu&apos;au {formatDate(quote.expires_at)}</span> : null}
            {quote.is_required_for_repair ? <Badge tone="warning">Nécessaire pour réaliser la réparation</Badge> : <Badge tone="neutral">Facultatif</Badge>}
          </div>
          {photos.length ? (
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Photos du technicien</p>
              <MediaGallery media={photos} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {quote.status === "SENT" && !expired ? (
        <Card>
          <CardHeader>
            <CardTitle>Votre décision</CardTitle>
            <p className="text-sm text-ink-soft">
              {quote.is_required_for_repair
                ? `Sans cette intervention, la réparation commandée ne peut pas être réalisée. ${refusal.explanation}`
                : "Cette intervention est facultative : en cas de refus, la réparation commandée se poursuit normalement."}
            </p>
          </CardHeader>
          <CardContent>
            <QuoteDecisionForm quoteId={quote.id} amountCents={quote.total_cents} requiresPayment={quote.requires_payment && quote.total_cents > 0} />
          </CardContent>
        </Card>
      ) : null}
      {expired ? <Alert tone="warning" title="Devis expiré">La durée de validité est dépassée. Contactez-nous depuis la messagerie du dossier pour le renouveler.</Alert> : null}

      {quote.status === "ACCEPTED" ? (
        <Alert tone="success" title={`Vous avez accepté le devis complémentaire de ${formatPrice(quote.total_cents)}.`}>
          {quote.decided_at ? `Accord enregistré le ${formatDateTime(quote.decided_at)}.` : null}
          {awaitingPayment ? (
            <form action={payQuoteAction} className="mt-3">
              <input type="hidden" name="quote_id" value={quote.id} />
              <Button type="submit" variant="accent" size="sm">
                Régler le complément de {formatPrice(quote.total_cents)}
              </Button>
            </form>
          ) : quote.paid_at ? (
            ` Complément réglé le ${formatDateTime(quote.paid_at)}.`
          ) : null}
        </Alert>
      ) : null}
      {quote.status === "REFUSED" ? (
        <Alert tone="info" title="Devis refusé">
          Refus enregistré{quote.decided_at ? ` le ${formatDateTime(quote.decided_at)}` : ""}. {quote.is_required_for_repair ? refusal.explanation : "La réparation commandée se poursuit normalement."}
        </Alert>
      ) : null}

      {decisions?.length ? (
        <p className="text-xs text-ink-muted">
          Trace : {decisions.map((d) => `${d.decision === "ACCEPTED" ? "acceptation" : "refus"} le ${formatDateTime(d.created_at)}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
