import Link from "next/link";
import { notFound } from "next/navigation";
import { DescriptionList, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Section, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { ORDER_STATUS_LABELS, statusTone } from "@/lib/orders/status";
import { shopStatusLabel, shopStatusTone } from "@/lib/shop/status";
import { TRADE_IN_STATUS_LABELS, tradeInStatusTone } from "@/lib/tradein/status";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils/format";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffOrRedirect();
  const db = createSupabaseAdminClient();
  const { data: profile } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();
  const { data: orders } = await db.from("repair_orders").select("id, order_number, model_name, repair_name, status, total_cents, created_at").eq("customer_id", id).order("created_at", { ascending: false });
  const orderIds = (orders ?? []).map((o) => o.id);
  const [{ data: quotes }, { data: sav }, { data: invoices }, { data: shopOrders }, { data: tradeIns }] = await Promise.all([
    db.from("supplementary_quotes").select("id, quote_number, title, status, total_cents, order_id, created_at").in("order_id", orderIds).order("created_at", { ascending: false }),
    db.from("sav_requests").select("id, subject, status, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
    db.from("invoices").select("id, invoice_number, invoice_type, amount_cents, issued_at, order_id, shop_order_id").in("order_id", orderIds).order("issued_at", { ascending: false }),
    db.from("shop_orders").select("id, order_number, status, fulfillment, total_cents, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
    db.from("trade_in_requests").select("id, request_number, item_title, status, offer_cents, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);
  const total = (orders ?? []).reduce((s, o) => s + o.total_cents, 0) + (shopOrders ?? []).filter((o) => o.status !== "CANCELLED" && o.status !== "PENDING").reduce((s, o) => s + o.total_cents, 0);
  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="text-xs text-ink-muted hover:text-ink">← Clients</Link>
      <PageHeader title={`${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email} description={profile.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Informations"><DescriptionList items={[{ label: "Téléphone", value: profile.phone ?? "—" }, { label: "Inscrit le", value: formatDateTime(profile.created_at) }, { label: "Réparations", value: orders?.length ?? 0 }, { label: "Commandes boutique", value: shopOrders?.length ?? 0 }, { label: "Reprises", value: tradeIns?.length ?? 0 }, { label: "Total commandé", value: formatPrice(total) }, { label: "Opt-in marketing", value: profile.marketing_opt_in ? "Oui" : "Non" }]} /></Section>
        <Section title="SAV">{sav?.length ? <ul className="text-sm">{sav.map((s) => <li key={s.id}><Link href={`/admin/sav/${s.id}`} className="text-accent hover:underline">{s.subject}</Link> · {s.status} · {formatDate(s.created_at)}</li>)}</ul> : <p className="text-sm text-ink-muted">Aucune demande.</p>}</Section>
      </div>
      <Section title="Réparations">
        <Table>
          <thead><tr><Th>Dossier</Th><Th>Console / réparation</Th><Th>Statut</Th><Th className="text-right">Total</Th><Th>Date</Th></tr></thead>
          <tbody>{(orders ?? []).map((o) => <tr key={o.id}><Td><Link href={`/admin/orders/${o.id}`} className="font-mono text-accent hover:underline">{o.order_number}</Link></Td><Td>{o.model_name} — {o.repair_name}</Td><Td><Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge></Td><Td className="text-right tabular-nums">{formatPrice(o.total_cents)}</Td><Td className="text-ink-muted">{formatDate(o.created_at)}</Td></tr>)}</tbody>
        </Table>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Commandes boutique">
          {shopOrders?.length ? (
            <ul className="space-y-1 text-sm">{shopOrders.map((o) => <li key={o.id} className="flex flex-wrap items-center gap-2"><Link href={`/admin/shop-orders/${o.id}`} className="font-mono text-accent hover:underline">{o.order_number}</Link><Badge tone={shopStatusTone(o.status)}>{shopStatusLabel(o.status, o.fulfillment)}</Badge><span className="font-mono">{formatPrice(o.total_cents)}</span><span className="text-ink-muted">{formatDate(o.created_at)}</span></li>)}</ul>
          ) : <p className="text-sm text-ink-muted">Aucune commande boutique.</p>}
        </Section>
        <Section title="Reprises">
          {tradeIns?.length ? (
            <ul className="space-y-1 text-sm">{tradeIns.map((t) => <li key={t.id} className="flex flex-wrap items-center gap-2"><Link href={`/admin/trade-ins/${t.id}`} className="font-mono text-accent hover:underline">{t.request_number}</Link><span>{t.item_title}</span><Badge tone={tradeInStatusTone(t.status)}>{TRADE_IN_STATUS_LABELS[t.status]}</Badge>{t.offer_cents !== null ? <span className="font-mono">{formatPrice(t.offer_cents)}</span> : null}<span className="text-ink-muted">{formatDate(t.created_at)}</span></li>)}</ul>
          ) : <p className="text-sm text-ink-muted">Aucune reprise.</p>}
        </Section>
        <Section title="Devis">{quotes?.length ? <ul className="space-y-1 text-sm">{quotes.map((q) => <li key={q.id}><Link href={`/admin/orders/${q.order_id}?tab=quotes`} className="font-mono text-accent hover:underline">{q.quote_number}</Link> · {q.title} · {formatPrice(q.total_cents)} · {q.status}</li>)}</ul> : <p className="text-sm text-ink-muted">Aucun devis.</p>}</Section>
        <Section title="Factures">{invoices?.length ? <ul className="space-y-1 text-sm">{invoices.map((i) => <li key={i.id}><Link href={`/admin/orders/${i.order_id}`} className="font-mono text-accent hover:underline">{i.invoice_number}</Link> · {i.invoice_type} · {formatPrice(i.amount_cents)} · {formatDate(i.issued_at)}</li>)}</ul> : <p className="text-sm text-ink-muted">Aucune facture.</p>}</Section>
      </div>
    </div>
  );
}
