import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TRADE_IN_ITEM_TYPE_LABELS, TRADE_IN_STATUS_LABELS, tradeInStatusTone } from "@/lib/tradein/status";
import { formatDate, formatPrice } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Mes reprises", robots: { index: false } };

/** Demandes de reprise du client connecté ; chaque ligne ouvre le suivi (offre, décision, historique). */
export default async function TradeInsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: requests, error } = await supabase.from("trade_in_requests").select("id, request_number, item_title, item_type, platform, status, offer_cents, access_token, created_at").order("created_at", { ascending: false });
  if (error) return <EmptyState title="Impossible de charger vos reprises" description="Réessayez dans quelques instants." />;

  return (
    <div>
      <PageHeader title="Mes reprises" description="Vos demandes d'estimation, les offres de l'atelier et vos décisions." actions={<ButtonLink href={ROUTES.tradeIn} variant="accent" size="sm">Estimer un lot</ButtonLink>} />
      {requests?.length ? (
        <ul className="mt-8 space-y-3">
          {requests.map((t) => (
            <li key={t.id}>
              <Link href={`${ROUTES.tradeInTracking}/${t.access_token}`} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-ink">{t.request_number}</span>
                    <Badge tone={tradeInStatusTone(t.status)}>{TRADE_IN_STATUS_LABELS[t.status]}</Badge>
                    {t.status === "ESTIMATED" ? <Badge tone="warning">Offre à décider</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-ink">
                    {t.item_title} · {TRADE_IN_ITEM_TYPE_LABELS[t.item_type]} · {t.platform}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Demande du {formatDate(t.created_at)}
                    {t.offer_cents !== null ? ` · offre ${formatPrice(t.offer_cents)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted" aria-hidden="true">Ouvrir →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8" title="Aucune demande de reprise" description="Vendez-nous consoles, jeux et accessoires : estimation en ligne, paiement au comptoir." action={<ButtonLink href={ROUTES.tradeIn} size="sm">Estimer mon lot</ButtonLink>} />
      )}
    </div>
  );
}
