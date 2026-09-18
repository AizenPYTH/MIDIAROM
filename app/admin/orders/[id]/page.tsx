import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/misc";
import { StatusTimeline } from "@/components/ui/timeline";
import { Section, Tabs, Table, Th, Td } from "@/components/admin/ui";
import { MediaGallery } from "@/components/customer/media-gallery";
import { MediaUploader } from "@/components/customer/media-uploader";
import { DiagnosticForm, ManualShipmentForm, MarkShippedForm, NoteForm, PartForm, DevisSimpleForm, QuoteForm, ReceptionForm, RefundForm, ReturnLabelForm, SendQuoteButton, StatusForm, TestResultsForm, WorkLogForm } from "@/components/admin/order-forms";
import { assignTechnicianAction, cancelQuoteAction, deleteMediaAction, deletePartAction, markDeliveredAction, startTestsAction, toggleMediaVisibilityAction } from "@/app/admin/actions/orders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { signMedia, kindLabel } from "@/lib/media/service";
import { signedMediaUrl } from "@/lib/shipping/service";
import { computeWorkshopTimeline, isAdminRole, ORDER_STATUS_LABELS, QUOTE_STATUS_LABELS, statusTone, DIAGNOSTIC_OUTCOME_LABELS } from "@/lib/orders/status";
import { formatDateTime, formatMinutes, formatPrice } from "@/lib/utils/format";
import type { MediaKind } from "@/lib/security/upload";
import { Select } from "@/components/ui/form";

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "reception", label: "Réception" },
  { key: "diagnostic", label: "Diagnostic" },
  { key: "quotes", label: "Devis" },
  { key: "repair", label: "Réparation" },
  { key: "tests", label: "Tests" },
  { key: "shipping", label: "Expédition" },
  { key: "media", label: "Médias" },
  { key: "history", label: "Historique" },
];

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: tabRaw }] = await Promise.all([params, searchParams]);
  const user = await requireStaffOrRedirect();
  const tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as string) : "overview";
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("repair_orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();

  const [items, events, history, media, quotes, shipments, diagnostic, reception, tests, checklists, messages, parts, workLogs, payments, invoices, technicians, options, sav, audit] = await Promise.all([
    db.from("repair_order_items").select("*").eq("order_id", id).order("created_at"),
    db.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("order_status_history").select("*, actor:profiles(first_name, last_name)").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("order_media").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("supplementary_quotes").select("*, items:supplementary_quote_items(*), decisions:quote_decisions(*)").eq("order_id", id).order("created_at", { ascending: false }),
    db.from("shipments").select("*").eq("order_id", id).order("created_at"),
    db.from("diagnostics").select("*").eq("order_id", id).maybeSingle(),
    db.from("reception_reports").select("*").eq("order_id", id).maybeSingle(),
    db.from("repair_tests").select("*, results:repair_test_results(*)").eq("order_id", id).maybeSingle(),
    db.from("test_checklists").select("id, name, model_id").eq("is_active", true).order("name"),
    db.from("order_messages").select("*, author:profiles(first_name, last_name)").eq("order_id", id).order("created_at"),
    db.from("repair_parts").select("*").eq("order_id", id).order("created_at"),
    db.from("repair_work_logs").select("*, technician:technicians(display_name)").eq("order_id", id).order("created_at"),
    db.from("payments").select("*").eq("order_id", id).order("created_at"),
    db.from("invoices").select("*").eq("order_id", id).order("issued_at"),
    db.from("technicians").select("id, display_name").eq("is_active", true).order("display_name"),
    db.from("repair_options").select("id, name, price_cents, estimated_cost_cents").eq("is_active", true).order("name"),
    db.from("sav_requests").select("id, subject, status, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    isAdminRole(user.profile.role) ? db.from("audit_logs").select("*, actor:profiles(first_name, last_name)").eq("order_id", id).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
  ]);

  const signed = await signMedia(media.data ?? []);
  const outbound = (shipments.data ?? []).filter((s) => s.direction === "TO_WORKSHOP");
  const returns = (shipments.data ?? []).filter((s) => s.direction === "TO_CUSTOMER");
  const labelUrls = new Map<string, string | null>();
  for (const s of shipments.data ?? []) if (s.label_path) labelUrls.set(s.id, await signedMediaUrl("shipping-media", s.label_path));
  const address = order.shipping_address as Record<string, string | null>;
  const hrefFor = (key: string) => `/admin/orders/${id}?tab=${key}`;
  const mediaOf = (kinds: MediaKind[]) => signed.filter((m) => kinds.includes(m.kind));
  const admin = isAdminRole(user.profile.role);
  const partsCost = (parts.data ?? []).reduce((s, p) => s + p.unit_cost_cents * p.quantity, 0);
  const minutes = (workLogs.data ?? []).reduce((s, w) => s + w.minutes_spent, 0);
  const shippingCost = (shipments.data ?? []).reduce((s, sh) => s + sh.cost_cents, 0);
  const estimatedCost = (items.data ?? []).reduce((s, i) => s + i.estimated_cost_cents, 0);
  const pendingQuotes = (quotes.data ?? []).filter((q) => q.status === "SENT").length;
  /*
    Le devis en cours d'une demande, et la décision qui lui a répondu.

    Les devis sont déjà triés du plus récent au plus ancien : le premier est
    celui qui porte le prix qu'on a annoncé au client. Sa décision, s'il en a
    reçu une, est celle qu'il faut montrer au réparateur — avec le motif, la
    seule chose que le client dise spontanément sur un prix qu'il refuse.
  */
  const dernierDevis = (quotes.data ?? []).find((q) => ["SENT", "ACCEPTED", "REFUSED"].includes(q.status)) ?? null;
  const derniereDecision = (dernierDevis?.decisions as { comment: string | null; created_at: string }[] | undefined)?.[0] ?? null;

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin" className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted hover:text-ink">← Réparations</Link>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Fiche {order.order_number}</p>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-ink">{order.model_name.startsWith(order.brand_name) ? order.model_name : `${order.brand_name} ${order.model_name}`}</h1>
          <p className="text-[14px] text-ink-faint">
            {order.repair_name} · <Link href={`/admin/customers/${order.customer_id}`} className="hover:text-ink">{order.customer_first_name} {order.customer_last_name}</Link> · {order.customer_email}{order.customer_phone ? ` · ${order.customer_phone}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={statusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          <form action={assignTechnicianAction} className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em]">
            <input type="hidden" name="order_id" value={order.id} />
            <label htmlFor="technician_id" className="text-ink-muted">Technicien</label>
            <Select id="technician_id" name="technician_id" defaultValue={order.assigned_technician_id ?? ""} className="py-1.5 text-[12px]">
              <option value="">Non assigné</option>
              {(technicians.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
            </Select>
            <Button type="submit" size="sm" variant="outline" className="py-2">OK</Button>
          </form>
        </div>
      </div>
      {/*
        Une demande de devis ne ressemble à aucun autre dossier de la liste :
        rien n'a été payé, la console n'est pas là, et quelqu'un attend un prix.
        Le dire en tête de fiche, avec la description du client sous les yeux et
        le chemin vers le chiffrage, évite d'ouvrir six onglets pour comprendre
        de quoi il retourne.
      */}
      {order.is_quote_request && order.status === "QUOTE_REQUESTED" ? (
        <div className="border-l-2 bg-surface p-4" style={{ borderLeftColor: "var(--brand)" }}>
          <span className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.13em]" style={{ color: "var(--brand)" }}>
              Demande de devis · à chiffrer
            </span>
            <Link href={hrefFor("quotes")} className="font-mono text-[11.5px] text-ink-soft underline hover:text-ink">
              Chiffrer et envoyer le devis →
            </Link>
          </span>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.5] text-ink">{order.customer_notes ?? "Le client n'a pas laissé de description."}</p>
          <p className="mt-2 font-mono text-[11.5px] text-ink-muted">
            Panne annoncée : {order.fault_name} · {mediaOf(["CUSTOMER"]).length} photo(s) jointe(s) · console non reçue, aucun règlement.
          </p>
          {mediaOf(["CUSTOMER"]).length ? (
            <div className="mt-3">
              <MediaGallery media={mediaOf(["CUSTOMER"])} />
            </div>
          ) : null}
          {/*
            Le chiffrage, ici même.

            Le réparateur vient de lire la description et de regarder les
            photos ; ce qu'on lui demande tient en un nombre. L'envoyer depuis
            l'onglet « Devis » l'obligeait à quitter l'écran où il avait le
            dossier sous les yeux, pour y retrouver un formulaire de neuf
            champs. Le formulaire complet reste disponible sous l'onglet, pour
            le devis qui a besoin de plusieurs lignes.
          */}
          <div className="mt-4 border-t border-border pt-4">
            <DevisSimpleForm orderId={order.id} libelle={order.repair_name ?? order.fault_name ?? "Réparation"} />
          </div>
        </div>
      ) : null}

      {/*
        Après l'envoi : où en est le client.

        Trois états, et un seul se lit d'un coup d'œil — c'est tout ce que le
        réparateur a besoin de savoir avant de décider s'il relance ou s'il
        passe à autre chose.
      */}
      {order.is_quote_request && order.status !== "QUOTE_REQUESTED" && dernierDevis ? (
        <div
          className="border-l-2 bg-surface p-4"
          style={{ borderLeftColor: dernierDevis.status === "ACCEPTED" ? "var(--ok, #0b7f63)" : dernierDevis.status === "REFUSED" ? "var(--danger)" : "var(--brand)" }}
        >
          <span className="text-[15px] font-semibold text-ink">
            {dernierDevis.status === "ACCEPTED" ? "✓ " : dernierDevis.status === "REFUSED" ? "✕ " : "⏳ "}
            Devis envoyé — {formatPrice(dernierDevis.total_cents)}
          </span>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {dernierDevis.status === "ACCEPTED"
              ? "Le client a accepté. Il a reçu les instructions pour déposer ou envoyer sa console."
              : dernierDevis.status === "REFUSED"
                ? "Le client a refusé. Aucun frais ne lui a été facturé et sa console est restée chez lui."
                : "En attente de la réponse du client."}
          </p>
          {derniereDecision?.comment ? <p className="mt-2 text-[13.5px] text-ink">« {derniereDecision.comment} »</p> : null}
        </div>
      ) : null}

      <div>
        <span className="mb-2 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Avancement</span>
        {/* Le suivi atelier commence à la réception : sur une demande de devis,
            la console n'est pas encore partie de chez le client, et cette frise
            n'a donc rien à montrer avant son accord. */}
        {order.is_quote_request && ["QUOTE_REQUESTED", "WAITING_CUSTOMER_APPROVAL"].includes(order.status) ? (
          <p className="text-[13.5px] text-ink-muted">
            {order.status === "QUOTE_REQUESTED" ? "En attente de votre devis. Le suivi atelier démarrera à la réception de la console." : "Devis envoyé : en attente de la décision du client."}
          </p>
        ) : (
          <StatusTimeline steps={computeWorkshopTimeline(order.status)} />
        )}
      </div>
      <Tabs tabs={TABS.map((t) => (t.key === "quotes" ? { ...t, count: pendingQuotes } : t))} current={tab} hrefFor={hrefFor} />

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/*
            Pendant le devis, le statut n'est pas une décision du réparateur.

            Il suit l'envoi du devis puis la réponse du client : demande reçue →
            devis envoyé → accepté ou refusé. Offrir ici un menu déroulant
            revenait à proposer de le devancer — annoncer « devis envoyé » sans
            devis, ou « accepté » à la place du client. Le menu revient dès que
            la console est à l'atelier, où c'est bien le réparateur qui fait
            avancer le dossier.
          */}
          {order.is_quote_request && ["QUOTE_REQUESTED", "WAITING_CUSTOMER_APPROVAL"].includes(order.status) ? null : (
            <Section title="Statut">
              <StatusForm orderId={order.id} current={order.status} role={user.profile.role} />
            </Section>
          )}
          <Section title="Commande">
            <ul className="divide-y divide-border text-sm">
              {(items.data ?? []).map((i) => (
                <li key={i.id} className="flex justify-between py-1.5">
                  <span>{i.label}{i.source === "QUOTE" ? <Badge tone="info" className="ml-2">Devis</Badge> : null}</span>
                  <span className="tabular-nums">{formatPrice(i.total_cents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold"><span>Total</span><span>{formatPrice(order.total_cents)}</span></div>
            <div className="flex justify-between text-xs text-ink-muted"><span>Encaissé</span><span>{formatPrice(order.paid_cents)}</span></div>
            {/*
              Le bloc comptable ne s'affiche pas pendant le devis.

              Coût des pièces, coût catalogue, transport, temps technicien,
              marge : sur une demande de devis, ces cinq lignes valent toutes
              zéro — la console n'est pas arrivée, rien n'a été commandé,
              personne n'a encore ouvert quoi que ce soit. Elles n'apprennent
              donc rien et occupent le tiers de l'écran sur lequel le
              réparateur doit poser un prix. Elles reviennent dès que le
              dossier entre à l'atelier, où elles ont enfin un contenu.
            */}
            {admin && !(order.is_quote_request && ["QUOTE_REQUESTED", "WAITING_CUSTOMER_APPROVAL"].includes(order.status)) ? (
              <dl className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-3 text-xs">
                <dt className="text-ink-muted">Coût pièces (réel)</dt><dd className="text-right">{formatPrice(partsCost)}</dd>
                <dt className="text-ink-muted">Coût estimé catalogue</dt><dd className="text-right">{formatPrice(estimatedCost)}</dd>
                <dt className="text-ink-muted">Coût transport</dt><dd className="text-right">{formatPrice(shippingCost)}</dd>
                <dt className="text-ink-muted">Temps technicien</dt><dd className="text-right">{formatMinutes(minutes)}</dd>
                <dt className="font-medium text-ink">Marge estimée</dt><dd className="text-right font-medium text-ink">{formatPrice(order.paid_cents - (partsCost || estimatedCost) - shippingCost)}</dd>
              </dl>
            ) : null}
          </Section>
          <Section title="Client et retour">
            <DescriptionList items={[
              { label: "Client", value: <Link href={`/admin/customers/${order.customer_id}`} className="text-accent hover:underline">{order.customer_first_name} {order.customer_last_name}</Link> },
              { label: "E-mail", value: order.customer_email },
              { label: "Téléphone", value: order.customer_phone ?? "—" },
              { label: "Adresse de retour", value: [address.line1, address.line2, `${address.postal_code} ${address.city}`].filter(Boolean).join(", ") },
              { label: "Notes du client", value: order.customer_notes ?? "—" },
              { label: "Symptômes cochés", value: order.symptoms.length ? order.symptoms.join(", ") : "—" },
              { label: "N° de série déclaré", value: order.console_serial_number ?? "—" },
              { label: "Attribution", value: [order.utm_source, order.utm_medium, order.utm_campaign].filter(Boolean).join(" / ") || "Direct" },
              { label: "CGV acceptées", value: order.accepted_terms_at ? `${formatDateTime(order.accepted_terms_at)} (v. ${order.accepted_terms_version})` : "—" },
              { label: "Suivi public", value: <span className="font-mono text-xs">/suivi/{order.tracking_token}</span> },
            ]} />
          </Section>
          <Section title="Photos envoyées par le client" description="Jointes à la fiche de réparation, visibles par le client dans son espace.">
            <MediaGallery media={mediaOf(["CUSTOMER"])} emptyText="Le client n'a joint aucune photo." />
          </Section>
          <Section title="Messages et notes">
            <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto">
              {(messages.data ?? []).map((m) => {
                const author = m.author as { first_name: string | null; last_name: string | null } | null;
                return (
                  <li key={m.id} className={`rounded-md px-3 py-2 text-sm ${m.is_internal ? "border border-dashed border-warning/50 bg-warning-soft" : m.is_from_staff ? "bg-primary-soft" : "bg-surface-muted"}`}>
                    <p className="whitespace-pre-line text-ink">{m.body}</p>
                    <p className="mt-1 text-[11px] text-ink-muted">{m.is_internal ? "Note interne · " : m.is_from_staff ? "Atelier · " : "Client · "}{author ? `${author.first_name ?? ""} ${author.last_name ?? ""} · ` : ""}{formatDateTime(m.created_at)}</p>
                  </li>
                );
              })}
              {!messages.data?.length ? <li className="text-sm text-ink-muted">Aucun message.</li> : null}
            </ul>
            <NoteForm orderId={order.id} />
          </Section>
          {admin ? (
            <Section title="Paiements et factures" className="lg:col-span-2">
              <Table>
                <thead><tr><Th>Type</Th><Th>Prestataire</Th><Th>Statut</Th><Th className="text-right">Montant</Th><Th>Date</Th><Th></Th></tr></thead>
                <tbody>
                  {(payments.data ?? []).map((p) => (
                    <tr key={p.id}>
                      <Td>{p.purpose === "QUOTE" ? "Complément devis" : "Initial"}</Td>
                      <Td className="font-mono text-xs">{p.provider} {p.provider_payment_id ? `· ${p.provider_payment_id}` : ""}</Td>
                      <Td><Badge tone={p.status === "SUCCEEDED" ? "success" : p.status === "PENDING" ? "warning" : "neutral"}>{p.status}</Badge></Td>
                      <Td className="text-right tabular-nums">{formatPrice(p.amount_cents)}{p.refunded_cents ? <span className="block text-xs text-danger">remb. {formatPrice(p.refunded_cents)}</span> : null}</Td>
                      <Td className="text-ink-muted">{formatDateTime(p.succeeded_at ?? p.created_at)}</Td>
                      <Td>{(p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && p.amount_cents - p.refunded_cents > 0 ? <details><summary className="cursor-pointer text-xs text-accent">Rembourser</summary><div className="mt-2"><RefundForm paymentId={p.id} maxCents={p.amount_cents - p.refunded_cents} /></div></details> : null}</Td>
                    </tr>
                  ))}
                  {!payments.data?.length ? <tr><Td colSpan={6} className="text-center text-ink-muted">Aucun paiement.</Td></tr> : null}
                </tbody>
              </Table>
              {invoices.data?.length ? (
                <ul className="mt-3 text-xs text-ink-muted">
                  {invoices.data.map((inv) => <li key={inv.id}>{inv.invoice_number} · {inv.invoice_type} · {formatPrice(inv.amount_cents)} · {formatDateTime(inv.issued_at)}</li>)}
                </ul>
              ) : null}
            </Section>
          ) : null}
          {sav.data?.length ? (
            <Section title="SAV" className="lg:col-span-2">
              <ul className="text-sm">
                {sav.data.map((s) => <li key={s.id}><Link href={`/admin/sav/${s.id}`} className="text-accent hover:underline">{s.subject}</Link> <span className="text-ink-muted">· {s.status} · {formatDateTime(s.created_at)}</span></li>)}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}

      {tab === "reception" ? (
        <div className="space-y-6">
          {!["AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK"].includes(order.status) && !reception.data ? (
            <Alert tone="warning">Ce dossier n&apos;est pas en attente de réception (statut : {ORDER_STATUS_LABELS[order.status]}).</Alert>
          ) : null}
          <Section title="Fiche de réception" description="Enregistrer la fiche passe automatiquement le dossier en « Contrôle de réception » et notifie le client.">
            <ReceptionForm orderId={order.id} report={reception.data} declaredSerial={order.console_serial_number} />
          </Section>
          <Section title="Photos et vidéos de réception" description="Colis, console sous tous les angles, accessoires, numéro de série." actions={<MediaUploader orderId={order.id} kind="RECEPTION" captionPrompt />}>
            <MediaGallery media={mediaOf(["RECEPTION"])} emptyText="Aucune photo de réception. Ajoutez-en avant le diagnostic." />
          </Section>
        </div>
      ) : null}

      {tab === "diagnostic" ? (
        <div className="space-y-6">
          <Section title="Fiche diagnostic" description={diagnostic.data?.completed_at ? `Terminé le ${formatDateTime(diagnostic.data.completed_at)} — ${diagnostic.data.outcome ? DIAGNOSTIC_OUTCOME_LABELS[diagnostic.data.outcome] : ""}` : "Le diagnostic reste en brouillon tant qu'il n'est pas terminé."}>
            <DiagnosticForm orderId={order.id} diagnostic={diagnostic.data} declaredFault={`${order.fault_name}${order.customer_notes ? ` — ${order.customer_notes}` : ""}`} canStartRepair={["DIAGNOSIS", "RECEIVED", "RECEPTION_CHECK"].includes(order.status)} />
          </Section>
          <Section title="Photos et vidéos de diagnostic" actions={<MediaUploader orderId={order.id} kind="DIAGNOSTIC" captionPrompt />}>
            <MediaGallery media={mediaOf(["DIAGNOSTIC"])} emptyText="Aucune photo de diagnostic." />
          </Section>
        </div>
      ) : null}

      {tab === "quotes" ? (
        <div className="space-y-6">
          {(quotes.data ?? []).map((q) => {
            const qItems = q.items as { id: string; label: string; quantity: number; total_cents: number }[];
            const decisions = q.decisions as { id: string; decision: string; created_at: string; ip_address: string | null; user_agent: string | null; comment: string | null }[];
            return (
              <Section key={q.id} title={`${q.quote_number} — ${q.title}`} description={`${QUOTE_STATUS_LABELS[q.status]} · ${formatPrice(q.total_cents)}${q.sent_at ? ` · envoyé le ${formatDateTime(q.sent_at)}` : ""}${q.expires_at ? ` · expire le ${formatDateTime(q.expires_at)}` : ""}`}
                actions={<div className="flex gap-2">{q.status === "DRAFT" ? <SendQuoteButton quoteId={q.id} /> : null}{["DRAFT", "SENT"].includes(q.status) ? <form action={cancelQuoteAction}><input type="hidden" name="quote_id" value={q.id} /><Button type="submit" size="sm" variant="ghost">Annuler</Button></form> : null}</div>}>
                {q.diagnosis_summary ? <p className="text-sm text-ink-soft">Constat : {q.diagnosis_summary}</p> : null}
                {q.message ? <p className="mt-1 whitespace-pre-line text-sm text-ink">{q.message}</p> : null}
                <ul className="mt-3 divide-y divide-border text-sm">
                  {qItems.map((i) => <li key={i.id} className="flex justify-between py-1"><span>{i.label}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</span><span className="tabular-nums">{formatPrice(i.total_cents)}</span></li>)}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {q.is_required_for_repair ? <Badge tone="warning">Nécessaire à la réparation</Badge> : <Badge>Facultatif</Badge>}
                  {q.requires_payment ? <Badge tone="info">{q.paid_at ? `Payé le ${formatDateTime(q.paid_at)}` : "Paiement requis"}</Badge> : null}
                </div>
                {decisions.length ? (
                  <ul className="mt-3 rounded-md bg-surface-muted p-3 text-xs text-ink-soft">
                    {decisions.map((d) => (
                      <li key={d.id}>
                        {d.decision === "ACCEPTED" ? "✔ Accepté" : "✘ Refusé"} le {formatDateTime(d.created_at)}
                        {d.ip_address ? ` · IP ${d.ip_address}` : ""}
                        {d.user_agent ? ` · ${d.user_agent.slice(0, 60)}` : ""}
                        {/* Le motif du refus : la seule information que le
                            client donne spontanément sur son prix. */}
                        {d.comment ? <span className="mt-1 block text-ink">« {d.comment} »</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            );
          })}
          <Section
            title={order.is_quote_request && !order.received_at ? "Chiffrer la demande" : "Nouveau devis complémentaire"}
            description={
              order.is_quote_request && !order.received_at
                ? "Le client attend ce prix pour décider. Dès l'envoi, il reçoit un lien personnel pour accepter ou refuser — sans avoir à créer de compte. Ce n'est qu'après son accord qu'il lui sera demandé de déposer ou d'envoyer sa console."
                : "Aucune prestation supplémentaire ne doit être réalisée avant l'accord enregistré du client."
            }
          >
            {order.is_quote_request && !order.received_at ? (
              <>
                <DevisSimpleForm orderId={order.id} libelle={order.repair_name ?? order.fault_name ?? "Réparation"} />
                {/*
                  Le formulaire complet ne disparaît pas, il se replie. Un devis
                  à plusieurs lignes reste possible — c'est simplement ce qu'on
                  ouvre quand on en a besoin, et non ce qu'on traverse chaque
                  fois qu'on veut poser un prix.
                */}
                <details className="mt-6 border-t border-border pt-4">
                  <summary className="cursor-pointer text-[13.5px] text-ink-muted hover:text-ink">Devis détaillé — plusieurs lignes, options du catalogue, paiement en ligne</summary>
                  <div className="mt-4">
                    <QuoteForm orderId={order.id} options={options.data ?? []} defaultRequiresPayment={false} />
                  </div>
                </details>
              </>
            ) : (
              <QuoteForm orderId={order.id} options={options.data ?? []} defaultRequiresPayment={!order.is_quote_request} />
            )}
          </Section>
          <Section title="Photos jointes aux devis" actions={<MediaUploader orderId={order.id} kind="QUOTE" captionPrompt />}>
            <MediaGallery media={mediaOf(["QUOTE"])} emptyText="Ajoutez une photo du constat (poussière, oxydation…) : elle est affichée au client avec le devis." />
          </Section>
        </div>
      ) : null}

      {tab === "repair" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Journal d'intervention" description={`Temps total : ${formatMinutes(minutes)}`}>
            <ul className="mb-4 space-y-2 text-sm">
              {(workLogs.data ?? []).map((w) => <li key={w.id} className="rounded-md bg-surface-muted px-3 py-2"><p className="text-ink">{w.description}</p><p className="text-xs text-ink-muted">{(w.technician as { display_name: string } | null)?.display_name ?? "—"} · {formatMinutes(w.minutes_spent)} · {formatDateTime(w.created_at)}{w.is_visible_to_customer ? " · visible client" : ""}</p></li>)}
            </ul>
            <WorkLogForm orderId={order.id} />
          </Section>
          <Section title="Pièces utilisées" description={`Coût total : ${formatPrice(partsCost)}`}>
            <ul className="mb-4 divide-y divide-border text-sm">
              {(parts.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5">
                  <span>{p.name}{p.reference ? <span className="text-ink-muted"> · {p.reference}</span> : null}{p.supplier ? <span className="text-ink-muted"> · {p.supplier}</span> : null} × {p.quantity}</span>
                  <span className="flex items-center gap-2 tabular-nums">{formatPrice(p.unit_cost_cents * p.quantity)}<form action={deletePartAction}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="part_id" value={p.id} /><button type="submit" className="text-xs text-danger hover:underline">Retirer</button></form></span>
                </li>
              ))}
            </ul>
            <PartForm orderId={order.id} />
          </Section>
          <Section title="Photos de réparation" className="lg:col-span-2" actions={<MediaUploader orderId={order.id} kind="REPAIR" captionPrompt />}>
            <MediaGallery media={mediaOf(["REPAIR"])} emptyText="Aucune photo de réparation." />
          </Section>
        </div>
      ) : null}

      {tab === "tests" ? (
        <div className="space-y-6">
          {tests.data ? (
            <Section title="Contrôle qualité" description={tests.data.is_completed ? `Validé le ${formatDateTime(tests.data.completed_at)}` : "Renseignez chaque test puis validez."}>
              <TestResultsForm orderId={order.id} testId={tests.data.id} results={(tests.data.results as { id: string; label: string; status: string; comment: string | null; display_order: number }[]).sort((a, b) => a.display_order - b.display_order)} notes={tests.data.notes} />
            </Section>
          ) : (
            <Section title="Démarrer le contrôle qualité" description="Choisissez la checklist adaptée au modèle.">
              <form action={startTestsAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="order_id" value={order.id} />
                <div>
                  <label htmlFor="checklist_id" className="mb-1 block text-xs font-medium text-ink-muted">Checklist</label>
                  <Select id="checklist_id" name="checklist_id" defaultValue={(checklists.data ?? []).find((c) => c.model_id === order.model_id)?.id ?? (checklists.data ?? []).find((c) => !c.model_id)?.id ?? ""}>
                    {(checklists.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <Button type="submit">Démarrer les tests</Button>
              </form>
            </Section>
          )}
        </div>
      ) : null}

      {tab === "shipping" ? (
        <div className="space-y-6">
          <Section title="Aller (client → atelier)">
            {outbound.length ? <ShipmentList shipments={outbound} labelUrls={labelUrls} /> : <p className="text-sm text-ink-muted">Aucune étiquette aller (le client expédie lui-même ou dépose à l&apos;atelier).</p>}
            <details className="mt-3"><summary className="cursor-pointer text-sm text-accent">Enregistrer un envoi aller manuellement</summary><div className="mt-3"><ManualShipmentForm orderId={order.id} direction="TO_WORKSHOP" /></div></details>
          </Section>
          <Section title="Retour (atelier → client)" description="Avant expédition : tests validés, photo de l'état final et du colis fermé, étiquette et numéro de suivi.">
            {returns.length ? <ShipmentList shipments={returns} labelUrls={labelUrls} /> : <p className="mb-3 text-sm text-ink-muted">Aucune expédition retour.</p>}
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div><p className="mb-2 text-sm font-medium text-ink">Générer une étiquette via le transporteur</p><ReturnLabelForm orderId={order.id} /></div>
              <div><p className="mb-2 text-sm font-medium text-ink">Ou saisir un envoi manuel</p><ManualShipmentForm orderId={order.id} direction="TO_CUSTOMER" /></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {order.status !== "SHIPPED" && order.status !== "DELIVERED" && order.status !== "COMPLETED" ? <MarkShippedForm orderId={order.id} /> : null}
              {order.status === "SHIPPED" ? <form action={markDeliveredAction}><input type="hidden" name="order_id" value={order.id} /><Button type="submit" variant="outline">Marquer comme livré</Button></form> : null}
            </div>
          </Section>
          <Section title="Photos état final et colis fermé" actions={<div className="flex gap-2"><MediaUploader orderId={order.id} kind="FINAL" label="État final" captionPrompt /><MediaUploader orderId={order.id} kind="SHIPPING" label="Colis fermé" accept="image/*" /></div>}>
            <MediaGallery media={mediaOf(["FINAL", "SHIPPING"]).filter((m) => m.mime_type.startsWith("image/"))} emptyText="Ajoutez la photo de l'état final et du colis fermé." />
          </Section>
        </div>
      ) : null}

      {tab === "media" ? (
        <div className="space-y-6">
          {(["RECEPTION", "DIAGNOSTIC", "QUOTE", "REPAIR", "FINAL", "SHIPPING", "SAV", "DOCUMENT"] as MediaKind[]).map((kind) => {
            const rows = mediaOf([kind]);
            return (
              <Section key={kind} title={kindLabel(kind)} description={`${rows.length} fichier(s)`} actions={<MediaUploader orderId={order.id} kind={kind} accept={kind === "DOCUMENT" ? "application/pdf" : "image/*,video/*,application/pdf"} captionPrompt />}>
                <MediaGallery media={rows} />
                {rows.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                    {rows.map((m) => (
                      <li key={m.id} className="flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1">
                        <span className="max-w-[160px] truncate">{m.caption ?? m.original_name ?? m.id.slice(0, 8)}</span>
                        <form action={toggleMediaVisibilityAction}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="media_id" value={m.id} /><input type="hidden" name="visible" value={m.is_visible_to_customer ? "0" : "1"} /><button type="submit" className="text-accent hover:underline">{m.is_visible_to_customer ? "Masquer au client" : "Rendre visible"}</button></form>
                        <form action={deleteMediaAction} ><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="media_id" value={m.id} /><button type="submit" className="text-danger hover:underline">Supprimer</button></form>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            );
          })}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Événements">
            <ol className="space-y-2 text-sm">
              {(events.data ?? []).map((e) => <li key={e.id} className="flex gap-3"><span className="w-32 shrink-0 text-xs text-ink-muted">{formatDateTime(e.created_at)}</span><span><span className="font-medium text-ink">{e.title}</span>{!e.is_public ? <Badge className="ml-2">interne</Badge> : null}{e.description ? <span className="block text-ink-soft">{e.description}</span> : null}</span></li>)}
            </ol>
          </Section>
          <Section title="Changements de statut">
            <ol className="space-y-2 text-sm">
              {(history.data ?? []).map((h) => { const actor = h.actor as { first_name: string | null; last_name: string | null } | null; return <li key={h.id} className="flex gap-3"><span className="w-32 shrink-0 text-xs text-ink-muted">{formatDateTime(h.created_at)}</span><span>{h.from_status ? `${ORDER_STATUS_LABELS[h.from_status]} → ` : ""}<span className="font-medium text-ink">{ORDER_STATUS_LABELS[h.to_status]}</span><span className="block text-xs text-ink-muted">{actor ? `${actor.first_name ?? ""} ${actor.last_name ?? ""}` : "Système"}{h.reason ? ` · ${h.reason}` : ""}</span></span></li>; })}
            </ol>
          </Section>
          {admin ? (
            <Section title="Journal d'audit" className="lg:col-span-2">
              <Table>
                <thead><tr><Th>Date</Th><Th>Acteur</Th><Th>Action</Th><Th>Détail</Th></tr></thead>
                <tbody>
                  {(audit.data ?? []).map((a) => { const actor = a.actor as { first_name: string | null; last_name: string | null } | null; return <tr key={a.id}><Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(a.created_at)}</Td><Td className="text-xs">{actor ? `${actor.first_name ?? ""} ${actor.last_name ?? ""}` : "Système"}</Td><Td className="font-mono text-xs">{a.action}</Td><Td className="max-w-md truncate font-mono text-[11px] text-ink-muted">{a.new_value ? JSON.stringify(a.new_value) : ""}</Td></tr>; })}
                </tbody>
              </Table>
            </Section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ShipmentList({ shipments, labelUrls }: { shipments: { id: string; carrier_name: string | null; tracking_number: string | null; tracking_url: string | null; status: string; cost_cents: number; created_at: string; provider_code: string }[]; labelUrls: Map<string, string | null> }) {
  return (
    <ul className="divide-y divide-border text-sm">
      {shipments.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>
            <span className="font-medium text-ink">{s.carrier_name ?? s.provider_code}</span> · <span className="font-mono">{s.tracking_number ?? "—"}</span>
            <span className="block text-xs text-ink-muted">{s.status} · {formatDateTime(s.created_at)} · coût {formatPrice(s.cost_cents)}</span>
          </span>
          <span className="flex gap-3 text-xs">
            {labelUrls.get(s.id) ? <a href={labelUrls.get(s.id) ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">↓ Étiquette</a> : null}
            {s.tracking_url ? <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Suivi</a> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
