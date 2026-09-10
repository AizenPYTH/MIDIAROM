import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, Eyebrow, DescriptionList } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { TradeInDecision } from "@/components/tradein/trade-in-decision";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTradeInEvents, signTradeInPhotos } from "@/lib/tradein/service";
import { TRADE_IN_CONDITION_LABELS, TRADE_IN_ITEM_TYPE_LABELS, TRADE_IN_STATUS_DESCRIPTIONS, TRADE_IN_STATUS_LABELS, TRADE_IN_TIMELINE, tradeInStatusTone } from "@/lib/tradein/status";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

/** L'offre reste décidable tant que sa date de validité n'est pas dépassée. */
function offerStillOpen(expiresAt: string | null): boolean {
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}
export const metadata: Metadata = { title: "Suivi de reprise", robots: { index: false, follow: false } };

/** Suivi par jeton : lot, état, offre, décision en ligne, historique public. */
export default async function TradeInTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const { data: t } = await createSupabaseAdminClient().from("trade_in_requests").select("*").eq("access_token", token).maybeSingle();
  if (!t) notFound();
  const [events, photos] = await Promise.all([getTradeInEvents(t.id, true), signTradeInPhotos(t)]);
  const reachedIndex = TRADE_IN_TIMELINE.findIndex((s) => s.statuses.includes(t.status));
  const canDecide = t.status === "ESTIMATED" && offerStillOpen(t.offer_expires_at);

  return (
    <Container className="max-w-[760px] py-14">
      <Eyebrow>Reprise</Eyebrow>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-[30px] font-semibold tracking-[-0.02em] text-ink">{t.request_number}</h1>
          <p className="text-[16px] text-ink">{t.item_title}</p>
          <p className="text-[13px] text-ink-muted">Demande du {formatDateTime(t.created_at)}</p>
        </div>
        <Badge tone={tradeInStatusTone(t.status)}>{TRADE_IN_STATUS_LABELS[t.status]}</Badge>
      </div>
      <p className="mt-3 text-[14.5px] text-ink-soft">{TRADE_IN_STATUS_DESCRIPTIONS[t.status]}</p>
      <ol className="mt-6 flex gap-[2px]" aria-label="Avancement">
        {TRADE_IN_TIMELINE.map((s, i) => (
          <li key={s.key} className={cn("min-w-0 shrink-0 whitespace-nowrap px-[11px] py-[10px] text-center font-mono text-[10px] uppercase tracking-[0.04em] sm:flex-1 sm:shrink sm:overflow-hidden sm:text-ellipsis sm:px-1 sm:py-[9px]", i <= reachedIndex || t.status === "CLOSED" ? "bg-accent text-white" : "bg-surface-muted text-ink-muted")} title={s.label}>
            {s.label}
          </li>
        ))}
      </ol>

      {t.status === "ESTIMATED" || t.status === "ACCEPTED" ? (
        <div className="mt-6 bg-ink-900 p-5 text-paper">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Offre de l&apos;atelier</span>
          <p className="mt-1 font-mono text-[30px] font-semibold">{t.offer_cents !== null ? formatPrice(t.offer_cents) : "—"}</p>
          {t.offer_note ? <p className="mt-2 text-[14.5px] text-[#c4bdae]">{t.offer_note}</p> : null}
          {t.offer_expires_at ? <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">Valable jusqu&apos;au {formatDate(t.offer_expires_at)}</p> : null}
          {canDecide ? (
            <div className="mt-4 [&_button]:text-white [&_textarea]:bg-ink-800 [&_textarea]:text-paper">
              <TradeInDecision token={t.access_token} />
            </div>
          ) : null}
          {t.status === "ACCEPTED" ? <p className="mt-3 text-[14px] text-[#c4bdae]">Apportez le lot au magasin aux horaires d&apos;ouverture : paiement au comptoir après vérification.</p> : null}
        </div>
      ) : null}

      <div className="mt-6 border border-border p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Votre lot</span>
        <div className="mt-3">
          <DescriptionList
            items={[
              { label: "Type", value: TRADE_IN_ITEM_TYPE_LABELS[t.item_type] },
              { label: "Plateforme", value: t.platform },
              { label: "État déclaré", value: TRADE_IN_CONDITION_LABELS[t.condition] },
              { label: "Accessoires", value: t.accessories.length ? t.accessories.join(", ") : "—" },
              { label: "Description", value: t.description ?? "—" },
            ]}
          />
        </div>
        {photos.length ? (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((p) => (
              <li key={p.path} className="aspect-square border border-border bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire */}
                {p.url ? <img src={p.url} alt="Photo du lot" className="h-full w-full object-cover" /> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <section className="mt-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Historique</span>
        <ol className="mt-3 flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 text-[13.5px]">
              <span className="whitespace-nowrap font-mono text-[12px] text-ink-muted">{formatDateTime(e.created_at)}</span>
              <span>
                <span className="font-medium text-ink">{e.title}</span>
                {e.description ? <span className="block text-ink-soft">{e.description}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </Container>
  );
}
