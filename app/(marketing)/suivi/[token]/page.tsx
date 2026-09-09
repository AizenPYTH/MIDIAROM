import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatusTimeline } from "@/components/ui/timeline";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeTimeline, ORDER_STATUS_DESCRIPTIONS, ORDER_STATUS_LABELS, statusTone } from "@/lib/orders/status";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suivi du dossier", robots: { index: false, follow: false } };

/**
 * Token-based public tracking. Exposes ONLY: order number, console, repair,
 * status, public timeline events and return tracking number. No address,
 * no e-mail, no photos, no prices.
 */
export default async function TrackingTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("repair_orders").select("id, order_number, model_name, repair_name, status, created_at").eq("tracking_token", token).maybeSingle();
  if (!order) notFound();
  const [{ data: events }, { data: shipments }] = await Promise.all([
    db.from("order_events").select("id, title, description, created_at").eq("order_id", order.id).eq("is_public", true).order("created_at", { ascending: false }).limit(30),
    db.from("shipments").select("direction, carrier_name, tracking_number, tracking_url, status").eq("order_id", order.id).eq("direction", "TO_CUSTOMER"),
  ]);
  const returnShipment = shipments?.[0];

  return (
    <Container className="max-w-2xl py-10 sm:py-16">
      <PageHeader eyebrow="Suivi public" title={order.order_number} description={`${order.model_name} — ${order.repair_name}`} />
      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">Statut actuel</p>
            <Badge tone={statusTone(order.status)} className="mt-1 text-sm">
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="text-xs text-ink-muted">Commande du {formatDateTime(order.created_at)}</p>
        </div>
        {ORDER_STATUS_DESCRIPTIONS[order.status] ? <p className="mt-3 text-sm text-ink-soft">{ORDER_STATUS_DESCRIPTIONS[order.status]}</p> : null}
        <div className="mt-6">
          <StatusTimeline steps={computeTimeline(order.status)} />
        </div>
      </div>
      {returnShipment?.tracking_number ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-5 text-sm">
          <p className="font-semibold text-ink">Retour de votre console</p>
          <p className="mt-1 text-ink-soft">
            {returnShipment.carrier_name ?? "Transporteur"} — suivi <span className="font-mono text-ink">{returnShipment.tracking_number}</span>
          </p>
          {returnShipment.tracking_url ? (
            <a href={returnShipment.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-accent underline">
              Suivre chez le transporteur
            </a>
          ) : null}
        </div>
      ) : null}
      {events?.length ? (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-ink">Historique</h2>
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-4 text-sm">
                <span className="w-32 shrink-0 text-ink-muted">{formatDateTime(e.created_at)}</span>
                <span>
                  <span className="block font-medium text-ink">{e.title}</span>
                  {e.description ? <span className="block text-ink-soft">{e.description}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <div className="mt-8 bg-ink-900 p-5 text-paper">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Photos, diagnostic, devis et messages</p>
        <p className="mt-1 text-[15px] text-[#c4bdae]">Ces éléments sont réservés à votre espace client, protégé par mot de passe.</p>
        <ButtonLink href={`${ROUTES.accountOrders}/${order.id}`} variant="accent" size="sm" className="mt-3">
          Ouvrir mon espace client
        </ButtonLink>
      </div>
    </Container>
  );
}
