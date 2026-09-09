import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DescriptionList } from "@/components/ui/misc";
import { Section } from "@/components/admin/ui";
import { TradeInNoteForm, TradeInOfferForm } from "@/components/admin/shop-forms";
import { tradeInStatusAction } from "@/app/admin/actions/shop";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { getTradeInById, getTradeInEvents, signTradeInPhotos } from "@/lib/tradein/service";
import { canTradeInTransition, TRADE_IN_CONDITION_LABELS, TRADE_IN_ITEM_TYPE_LABELS, TRADE_IN_STATUS_LABELS, tradeInStatusTone } from "@/lib/tradein/status";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";
import { ROUTES } from "@/config/site";

export default async function TradeInPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  await requireStaffOrRedirect();
  let t;
  try {
    t = await getTradeInById(id);
  } catch {
    notFound();
  }
  const [events, photos] = await Promise.all([getTradeInEvents(t.id), signTradeInPhotos(t)]);

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/trade-ins" className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted hover:text-ink">
            ← Reprises
          </Link>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Reprise {t.request_number}</p>
          <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.item_title}</h1>
          <p className="text-[14px] text-ink-faint">
            {TRADE_IN_ITEM_TYPE_LABELS[t.item_type]} · {t.platform} ·{" "}
            {t.customer_id ? (
              <Link href={`/admin/customers/${t.customer_id}`} className="hover:text-ink">
                {t.customer_first_name} {t.customer_last_name}
              </Link>
            ) : (
              `${t.customer_first_name} ${t.customer_last_name}`
            )}{" "}
            · {t.customer_email}
            {t.customer_phone ? ` · ${t.customer_phone}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={tradeInStatusTone(t.status)}>{TRADE_IN_STATUS_LABELS[t.status]}</Badge>
          <a href={`${ROUTES.tradeInTracking}/${t.access_token}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted hover:text-ink">
            Vue client ↗
          </a>
        </div>
      </div>
      {error ? <p className="border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Lot décrit par le client">
          <DescriptionList
            items={[
              { label: "État déclaré", value: TRADE_IN_CONDITION_LABELS[t.condition] },
              { label: "Accessoires", value: t.accessories.length ? t.accessories.join(", ") : "—" },
              { label: "Description", value: t.description ?? "—" },
              { label: "Demande du", value: formatDateTime(t.created_at) },
            ]}
          />
          {photos.length ? (
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <li key={p.path} className="aspect-square border border-border bg-surface-muted">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire */}
                      <img src={p.url} alt="Photo du lot" className="h-full w-full object-cover" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="photo-placeholder mt-4 h-[74px] text-[10.5px]">aucune photo envoyée</div>
          )}
        </Section>
        <Section title={t.status === "NEW" ? "Proposer une offre" : "Offre"} description={t.offered_at ? `Envoyée le ${formatDateTime(t.offered_at)}${t.offer_expires_at ? ` · valable jusqu'au ${formatDate(t.offer_expires_at)}` : ""}` : "Le client reçoit l'offre par e-mail avec un lien pour accepter ou refuser."}>
          {t.offer_cents !== null ? (
            <p className="mb-3 font-mono text-[26px] font-semibold text-ink">
              {formatPrice(t.offer_cents)}
              {t.decided_at ? <span className="ml-3 font-sans text-[13px] font-normal text-ink-faint">décision le {formatDateTime(t.decided_at)}</span> : null}
            </p>
          ) : null}
          {t.decision_note ? <p className="mb-3 text-[13.5px] text-ink-soft">Remarque du client : {t.decision_note}</p> : null}
          {canTradeInTransition(t.status, "ESTIMATED") ? <TradeInOfferForm requestId={t.id} currentOffer={t.offer_cents} currentNote={t.offer_note} /> : null}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {canTradeInTransition(t.status, "CLOSED") ? (
              <form action={tradeInStatusAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="request_id" value={t.id} />
                <input type="hidden" name="status" value="CLOSED" />
                <input name="note" placeholder="Note (montant payé au comptoir, entrée en stock…)" aria-label="Note de clôture" className="border border-border-strong bg-field px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted" />
                <button type="submit" className="cursor-pointer bg-accent px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white hover:bg-paper hover:text-ink-900">
                  Clôturer (lot déposé et payé)
                </button>
              </form>
            ) : null}
            {canTradeInTransition(t.status, "REFUSED") ? (
              <form action={tradeInStatusAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="request_id" value={t.id} />
                <input type="hidden" name="status" value="REFUSED" />
                <input name="note" placeholder="Motif (facultatif)" aria-label="Motif du refus" className="border border-border-strong bg-field px-3 py-2 text-[13px] text-ink placeholder:text-ink-muted" />
                <button type="submit" className="cursor-pointer border border-border-strong px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint hover:border-paper">
                  Refuser la reprise
                </button>
              </form>
            ) : null}
          </div>
        </Section>
        <Section title="Notes internes">
          {t.internal_notes ? <pre className="mb-3 whitespace-pre-wrap font-sans text-[13.5px] text-ink-soft">{t.internal_notes}</pre> : <p className="mb-3 text-[13.5px] text-ink-muted">Aucune note.</p>}
          <TradeInNoteForm requestId={t.id} />
        </Section>
        <Section title="Historique">
          <ol className="flex flex-col gap-2 text-[13px]">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-ink-faint">
                <span className="whitespace-nowrap font-mono text-[#6b6558]">{formatDateTime(e.created_at)}</span>
                <span>
                  <span className="font-medium text-ink">{e.title}</span>
                  {!e.is_public ? <span className="ml-1 font-mono text-[10px] uppercase text-ink-muted">interne</span> : null}
                  {e.description ? <span className="block text-ink-soft">{e.description}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </div>
  );
}
