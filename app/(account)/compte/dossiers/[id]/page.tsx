import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Breadcrumbs, DescriptionList } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { StatusTimeline } from "@/components/ui/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaGallery } from "@/components/customer/media-gallery";
import { CancelOrderForm, MessageForm } from "@/components/customer/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/security/auth";
import { signMedia } from "@/lib/media/service";
import { signedMediaUrl } from "@/lib/shipping/service";
import { computeWorkshopTimeline, CUSTOMER_CANCELLABLE_STATUSES, ORDER_STATUS_DESCRIPTIONS, ORDER_STATUS_LABELS, statusTone } from "@/lib/orders/status";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";
import { getSetting } from "@/lib/settings";
import { getInvoiceDocumentUrl, INVOICE_TYPE_LABELS } from "@/lib/invoices";

export const metadata: Metadata = { title: "Dossier", robots: { index: false } };

const OUTCOME_LABELS: Record<string, string> = {
  REPAIRABLE: "Réparable",
  UNREPAIRABLE: "Irréparable",
  NOT_ECONOMICAL: "Réparation non rentable",
  NO_FAULT_FOUND: "Aucune panne constatée",
  FURTHER_DIAGNOSIS_NEEDED: "Diagnostic complémentaire nécessaire",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserOrRedirect(`${ROUTES.accountOrders}/${id}`);
  const supabase = await createSupabaseServerClient();
  // RLS: only the owner (or staff) can read this order.
  const { data: order } = await supabase.from("repair_orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();

  const [items, events, media, quotes, shipments, diagnostic, tests, messages, invoices, reception, sav, shippingInfo, review] = await Promise.all([
    supabase.from("repair_order_items").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_events").select("*").eq("order_id", id).eq("is_public", true).order("created_at", { ascending: false }),
    supabase.from("order_media").select("*").eq("order_id", id).eq("is_visible_to_customer", true).order("created_at", { ascending: false }),
    supabase.from("supplementary_quotes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("shipments").select("*").eq("order_id", id).order("created_at"),
    supabase.from("customer_diagnostics").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("repair_tests").select("*, results:repair_test_results(*)").eq("order_id", id).maybeSingle(),
    supabase.from("order_messages").select("*").eq("order_id", id).order("created_at"),
    supabase.from("invoices").select("*").eq("order_id", id).order("issued_at"),
    supabase.from("reception_reports").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("sav_requests").select("id, status, subject, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    getSetting("shipping_info"),
    supabase.from("reviews").select("review_token, submitted_at").eq("order_id", id).maybeSingle(),
  ]);
  const { data: model } = order.model_id ? await supabase.from("console_models").select("slug").eq("id", order.model_id).maybeSingle() : { data: null };
  const packagingHref = model?.slug ? `${ROUTES.packaging}?modele=${model.slug}` : ROUTES.packaging;

  const signedMedia = await signMedia(media.data ?? []);
  const invoiceLinks = await Promise.all((invoices.data ?? []).map(async (inv) => ({ ...inv, url: await getInvoiceDocumentUrl(inv) })));
  const outbound = (shipments.data ?? []).find((s) => s.direction === "TO_WORKSHOP");
  const returnShipment = (shipments.data ?? []).find((s) => s.direction === "TO_CUSTOMER");
  const labelUrl = outbound?.label_path ? await signedMediaUrl("shipping-media", outbound.label_path) : null;
  const pendingQuotes = (quotes.data ?? []).filter((q) => q.status === "SENT");
  const acceptedUnpaid = (quotes.data ?? []).filter((q) => q.status === "ACCEPTED" && q.requires_payment && q.total_cents > 0 && !q.paid_at);
  const address = order.shipping_address as Record<string, string | null>;
  const mediaByKind = (kind: string) => signedMedia.filter((m) => m.kind === kind);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Mes dossiers", href: ROUTES.accountOrders }, { label: order.order_number }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-ink sm:text-3xl">{order.order_number}</h1>
          <p className="mt-1 text-ink">
            {order.model_name} — {order.repair_name}
          </p>
          <p className="text-sm text-ink-muted">Commandé le {formatDateTime(order.created_at)}</p>
        </div>
        <div className="text-right">
          <Badge tone={statusTone(order.status)} className="text-sm">
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          {ORDER_STATUS_DESCRIPTIONS[order.status] ? <p className="mt-2 max-w-xs text-xs text-ink-muted">{ORDER_STATUS_DESCRIPTIONS[order.status]}</p> : null}
        </div>
      </div>

      {pendingQuotes.map((q) => (
        <Alert key={q.id} tone="warning" title={`Devis ${q.quote_number} en attente de votre décision`}>
          {q.title} — {formatPrice(q.total_cents)}
          {q.expires_at ? ` · valable jusqu'au ${formatDate(q.expires_at)}` : ""}.{" "}
          <Link href={`${ROUTES.accountOrders}/${order.id}/devis/${q.id}`} className="font-medium text-accent underline">
            Voir le devis et décider
          </Link>
        </Alert>
      ))}
      {acceptedUnpaid.map((q) => (
        <Alert key={q.id} tone="info" title={`Devis ${q.quote_number} accepté — règlement attendu`}>
          Réglez le complément de {formatPrice(q.total_cents)} pour lancer l&apos;intervention.{" "}
          <Link href={`${ROUTES.accountOrders}/${order.id}/devis/${q.id}`} className="font-medium text-accent underline">
            Payer maintenant
          </Link>
        </Alert>
      ))}
      {order.status === "PENDING_PAYMENT" ? (
        <Alert tone="warning" title="Paiement non confirmé">
          Votre commande est enregistrée mais le paiement n&apos;a pas été confirmé.{" "}
          {order.repair_id ? (
            <Link href={`${ROUTES.checkout}/${order.repair_id}`} className="font-medium text-accent underline">
              Reprendre la commande
            </Link>
          ) : null}
        </Alert>
      ) : null}

      <Card>
        <CardContent className="py-6">
          <StatusTimeline steps={computeWorkshopTimeline(order.status)} />
        </CardContent>
      </Card>

      {order.status === "AWAITING_SHIPMENT" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Envoyer votre console
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink-soft">
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Emballez la console selon les{" "}
                <Link href={packagingHref} className="text-accent underline">
                  instructions d&apos;emballage
                </Link>
                .
              </li>
              <li>
                Glissez une feuille avec le numéro <span className="font-mono font-semibold text-ink">{order.order_number}</span> dans le colis.
              </li>
              {labelUrl ? (
                <li>Imprimez et collez l&apos;étiquette ci-dessous, puis déposez le colis au point indiqué par le transporteur.</li>
              ) : (
                <li>
                  {shippingInfo.workshop_receiving_address ? (
                    <>
                      Expédiez le colis à : <span className="text-ink">{[shippingInfo.workshop_receiving_name, shippingInfo.workshop_receiving_address].filter(Boolean).join(", ")}</span>
                    </>
                  ) : (
                    <>L&apos;adresse d&apos;expédition de l&apos;atelier vous est communiquée par e-mail (elle n&apos;est pas encore renseignée dans les réglages du site).</>
                  )}
                </li>
              )}
            </ol>
            {labelUrl ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-muted p-3">
                <a href={labelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-accent underline">
                  Télécharger mon étiquette (PDF)
                </a>
                {outbound?.tracking_number ? (
                  <span className="text-xs text-ink-muted">
                    Suivi : <span className="font-mono">{outbound.tracking_number}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
            {CUSTOMER_CANCELLABLE_STATUSES.includes(order.status) ? (
              <div className="pt-2">
                <CancelOrderForm orderId={order.id} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Votre commande</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {(items.data ?? []).map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2">
                  <span>
                    <span className="block text-ink">{item.label}</span>
                    {item.description ? <span className="block text-xs text-ink-muted">{item.description}</span> : null}
                    {item.source === "QUOTE" ? <Badge tone="info" className="mt-1">Devis complémentaire</Badge> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">{formatPrice(item.total_cents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold text-ink">
              <span>Total</span>
              <span>{formatPrice(order.total_cents)}</span>
            </div>
            <p className="text-xs text-ink-muted">Réglé : {formatPrice(order.paid_cents)}</p>
            {invoiceLinks.length ? (
              <ul className="mt-3 space-y-1 text-xs text-ink-muted">
                {invoiceLinks.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-1.5">
                    {INVOICE_TYPE_LABELS[inv.invoice_type]} {inv.invoice_number} · {formatPrice(Math.abs(inv.amount_cents))} · {formatDate(inv.issued_at)}
                    {inv.url ? (
                      <a href={inv.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        Télécharger le PDF
                      </a>
                    ) : (
                      <span>· PDF envoyé sur demande</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Console", value: order.model_name.startsWith(order.brand_name) ? order.model_name : `${order.brand_name} ${order.model_name}` },
                { label: "Panne déclarée", value: order.fault_name },
                { label: "Symptômes", value: order.symptoms.length ? order.symptoms.join(", ") : "—" },
                { label: "Garantie", value: order.warranty_months > 0 ? `${order.warranty_months} mois sur l'intervention` : "Selon la réparation issue du diagnostic" },
                { label: "Adresse de retour", value: [address.line1, address.line2, `${address.postal_code} ${address.city}`].filter(Boolean).join(", ") },
                { label: "Numéro de série", value: reception.data?.serial_number ?? order.console_serial_number ?? "—" },
                { label: "Vos notes", value: order.customer_notes ?? "—" },
              ]}
            />
            {mediaByKind("CUSTOMER").length ? (
              <div className="mt-4">
                <span className="mono-label text-ink-muted">Vos photos</span>
                <div className="mt-2">
                  <MediaGallery media={mediaByKind("CUSTOMER")} />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {reception.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Réception à l&apos;atelier</CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Reçu le", value: formatDateTime(reception.data.received_at) },
                { label: "État du colis", value: reception.data.package_condition ?? "—" },
                { label: "État extérieur", value: reception.data.exterior_condition ?? "—" },
                { label: "Accessoires reçus", value: reception.data.accessories.length ? reception.data.accessories.join(", ") : "Aucun" },
                { label: "Dommages visibles", value: reception.data.visible_damage ?? "Aucun" },
                { label: "Test initial", value: reception.data.initial_test ?? "—" },
              ]}
            />
            <div className="mt-4">
              <MediaGallery media={mediaByKind("RECEPTION")} emptyText="Les photos de réception apparaîtront ici." />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {diagnostic.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Diagnostic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Panne reproduite", value: diagnostic.data.fault_reproduced == null ? "—" : diagnostic.data.fault_reproduced ? "Oui" : "Non" },
                { label: "Conclusion", value: diagnostic.data.outcome ? OUTCOME_LABELS[diagnostic.data.outcome] : "—" },
                { label: "Résumé", value: diagnostic.data.customer_summary ?? "—" },
                { label: "Travaux recommandés", value: diagnostic.data.recommended_work ?? "—" },
              ]}
            />
            <div className="mt-4">
              <MediaGallery media={[...mediaByKind("DIAGNOSTIC"), ...mediaByKind("QUOTE")]} emptyText="Aucune photo de diagnostic." />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {quotes.data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Devis complémentaires</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {quotes.data.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-mono font-medium text-ink">{q.quote_number}</span> · {q.title}
                    <span className="block text-xs text-ink-muted">
                      {q.decided_at ? `Décision le ${formatDateTime(q.decided_at)}` : q.sent_at ? `Envoyé le ${formatDateTime(q.sent_at)}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{formatPrice(q.total_cents)}</span>
                    <Badge tone={q.status === "ACCEPTED" ? "success" : q.status === "REFUSED" ? "danger" : q.status === "SENT" ? "warning" : "neutral"}>
                      {{ DRAFT: "Brouillon", SENT: "À décider", ACCEPTED: q.paid_at || !q.requires_payment ? "Accepté" : "Accepté · paiement attendu", REFUSED: "Refusé", EXPIRED: "Expiré", CANCELLED: "Annulé" }[q.status]}
                    </Badge>
                    <Link href={`${ROUTES.accountOrders}/${order.id}/devis/${q.id}`} className="text-accent underline">
                      Détail
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {mediaByKind("REPAIR").length || mediaByKind("FINAL").length ? (
        <Card>
          <CardHeader>
            <CardTitle>Réparation et état final</CardTitle>
          </CardHeader>
          <CardContent>
            <MediaGallery media={[...mediaByKind("REPAIR"), ...mediaByKind("FINAL")]} />
          </CardContent>
        </Card>
      ) : null}

      {tests.data?.is_completed ? (
        <Card>
          <CardHeader>
            <CardTitle>Contrôle qualité</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {(tests.data.results as { id: string; label: string; status: string; comment: string | null }[])
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-1.5">
                    <span className="text-ink">{r.label}</span>
                    <Badge tone={r.status === "PASS" ? "success" : r.status === "FAIL" ? "danger" : "neutral"}>{{ PASS: "OK", FAIL: "Échec", NA: "N/A", PENDING: "—" }[r.status]}</Badge>
                  </li>
                ))}
            </ul>
            {tests.data.completed_at ? <p className="mt-2 text-xs text-ink-muted">Tests validés le {formatDateTime(tests.data.completed_at)}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {returnShipment ? (
        <Card>
          <CardHeader>
            <CardTitle>Retour de votre console</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-ink">
              {returnShipment.carrier_name ?? "Transporteur"} · suivi <span className="font-mono">{returnShipment.tracking_number ?? "—"}</span>
            </p>
            {returnShipment.tracking_url ? (
              <a href={returnShipment.tracking_url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Suivre chez le transporteur
              </a>
            ) : null}
            {returnShipment.shipped_at ? <p className="text-xs text-ink-muted">Expédié le {formatDateTime(returnShipment.shipped_at)}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {["DELIVERED", "COMPLETED", "SAV"].includes(order.status) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Un problème après la réparation ?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-soft">
              {sav.data?.length ? `${sav.data.length} demande(s) SAV sur ce dossier.` : "Ouvrez une demande SAV : elle est traitée par l'atelier avec l'historique complet de votre dossier."}
            </p>
            <ButtonLink href={`${ROUTES.accountOrders}/${order.id}/sav`} variant="outline" size="sm">
              {sav.data?.length ? "Voir mes demandes SAV" : "Ouvrir une demande SAV"}
            </ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      {review.data && !review.data.submitted_at ? (
        <Alert tone="info" title="Votre avis compte">
          <Link href={`/avis/${review.data.review_token}`} className="font-medium text-accent underline">
            Laisser un avis sur cette réparation
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Messagerie
          </CardTitle>
        </CardHeader>
        <CardContent>
          {messages.data?.length ? (
            <ul className="mb-4 space-y-3">
              {messages.data.map((m) => (
                <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.is_from_staff ? "bg-primary-soft text-ink" : "ml-auto bg-surface-muted text-ink"}`}>
                  <p className="whitespace-pre-line">{m.body}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {m.is_from_staff ? "Atelier" : "Vous"} · {formatDateTime(m.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-ink-muted">Aucun message pour le moment.</p>
          )}
          <MessageForm orderId={order.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique du dossier</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="flex gap-4">
                <span className="w-32 shrink-0 text-ink-muted">{formatDateTime(e.created_at)}</span>
                <span>
                  <span className="block font-medium text-ink">{e.title}</span>
                  {e.description ? <span className="block text-ink-soft">{e.description}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
