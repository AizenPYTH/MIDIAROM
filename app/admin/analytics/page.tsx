import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Section, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { formatMinutes, formatPrice } from "@/lib/utils/format";

function pct(n: number, d: number): string {
  return d ? `${((n / d) * 100).toFixed(1)} %` : "—";
}

function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  return { to: now.toISOString().slice(0, 10), from: new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10) };
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; repair?: string; model?: string; source?: string; campaign?: string }> }) {
  await requireAdminOrRedirect();
  const sp = await searchParams;
  const defaults = defaultPeriod();
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : defaults.to;
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : defaults.from;
  const fromIso = `${from}T00:00:00Z`;
  const toIso = `${to}T23:59:59Z`;
  const db = createSupabaseAdminClient();

  let profit = db.from("order_profitability").select("*").gte("paid_at", fromIso).lte("paid_at", toIso).not("paid_at", "is", null);
  if (sp.repair) profit = profit.eq("repair_id", sp.repair);
  if (sp.model) profit = profit.eq("model_id", sp.model);
  if (sp.source) profit = profit.eq("utm_source", sp.source);
  if (sp.campaign) profit = profit.eq("utm_campaign", sp.campaign);

  const [{ data: rows }, { data: events }, { data: costs }, { data: repairs }, { data: models }, { data: items }] = await Promise.all([
    profit,
    db.from("analytics_events").select("event_name, session_id, utm_source, utm_campaign, landing_page, repair_id, value_cents").gte("created_at", fromIso).lte("created_at", toIso),
    db.from("marketing_costs").select("*").lte("period_start", to).gte("period_end", from),
    db.from("repairs").select("id, name").order("name"),
    db.from("console_models").select("id, name").order("display_order"),
    db.from("repair_order_items").select("order_id, item_type, label, total_cents, reference_id").in("item_type", ["OPTION", "PACK"]).gte("created_at", fromIso).lte("created_at", toIso),
  ]);

  const orders = rows ?? [];
  const revenue = orders.reduce((s, o) => s + (o.revenue_cents ?? 0), 0);
  const parts = orders.reduce((s, o) => s + (o.parts_cost_cents ?? 0), 0);
  const shippingCost = orders.reduce((s, o) => s + (o.shipping_cost_cents ?? 0), 0);
  const minutes = orders.reduce((s, o) => s + (o.technician_minutes ?? 0), 0);
  const savCount = orders.filter((o) => o.has_sav).length;
  const marketing = (costs ?? []).filter((c) => !sp.source || c.source === sp.source).reduce((s, c) => s + c.amount_cents, 0);
  const margin = revenue - parts - shippingCost - marketing;
  const cac = orders.length ? Math.round(marketing / orders.length) : 0;

  const ev = events ?? [];
  const sessions = new Set(ev.filter((e) => e.event_name === "page_view").map((e) => e.session_id)).size;
  const countEv = (name: string) => new Set(ev.filter((e) => e.event_name === name).map((e) => e.session_id ?? Math.random())).size;
  const funnel = [
    { label: "Visiteurs (sessions)", value: sessions },
    { label: "Réparation consultée", value: countEv("view_repair") },
    { label: "Checkout démarré", value: countEv("start_checkout") },
    { label: "Paiement démarré", value: countEv("start_payment") },
    { label: "Achats", value: orders.length },
  ];
  const optionAdds = ev.filter((e) => e.event_name === "add_option").length;
  const optionRemoves = ev.filter((e) => e.event_name === "remove_option").length;
  const packSelects = ev.filter((e) => e.event_name === "select_pack").length;
  const ordersWithOptions = new Set((items ?? []).map((i) => i.order_id)).size;

  const byRepair = new Map<string, { name: string; count: number; revenue: number; parts: number; shipping: number; minutes: number; sav: number }>();
  for (const o of orders) {
    const key = o.repair_id ?? "other";
    const row = byRepair.get(key) ?? { name: o.repair_name ?? "Autre", count: 0, revenue: 0, parts: 0, shipping: 0, minutes: 0, sav: 0 };
    row.count += 1;
    row.revenue += o.revenue_cents ?? 0;
    row.parts += o.parts_cost_cents ?? 0;
    row.shipping += o.shipping_cost_cents ?? 0;
    row.minutes += o.technician_minutes ?? 0;
    row.sav += o.has_sav ? 1 : 0;
    byRepair.set(key, row);
  }
  const byOption = new Map<string, { count: number; revenue: number }>();
  for (const i of items ?? []) {
    const row = byOption.get(i.label) ?? { count: 0, revenue: 0 };
    row.count += 1;
    row.revenue += i.total_cents;
    byOption.set(i.label, row);
  }
  const bySource = new Map<string, { sessions: Set<string>; orders: number; revenue: number }>();
  for (const e of ev.filter((x) => x.event_name === "page_view")) {
    const key = e.utm_source ?? "direct / organique";
    const row = bySource.get(key) ?? { sessions: new Set(), orders: 0, revenue: 0 };
    if (e.session_id) row.sessions.add(e.session_id);
    bySource.set(key, row);
  }
  for (const o of orders) {
    const key = o.utm_source ?? "direct / organique";
    const row = bySource.get(key) ?? { sessions: new Set(), orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += o.revenue_cents ?? 0;
    bySource.set(key, row);
  }
  // Repris du tableau de bord, allégé pour ne montrer que le travail du jour.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [delays, todayCount] = await Promise.all([
    db.from("repair_orders").select("received_at, shipped_at").not("received_at", "is", null).not("shipped_at", "is", null).order("shipped_at", { ascending: false }).limit(30),
    db.from("repair_orders").select("id", { count: "exact", head: true }).gte("created_at", startOfDay.toISOString()).neq("status", "PENDING_PAYMENT").then((r) => r.count ?? 0),
  ]);
  const delayDays = (delays.data ?? []).map((o) => (new Date(o.shipped_at!).getTime() - new Date(o.received_at!).getTime()) / 86_400_000).filter((d) => d >= 0);
  const avgDelay = delayDays.length ? delayDays.reduce((a, b) => a + b, 0) / delayDays.length : null;

  const landing = new Map<string, number>();
  for (const e of ev.filter((x) => x.event_name === "page_view" && x.landing_page)) landing.set(e.landing_page!, (landing.get(e.landing_page!) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics et rentabilité" description="Identifiez les réparations, options et campagnes réellement rentables." actions={<Link href="/admin/analytics/costs" className="text-sm text-accent hover:underline">Dépenses marketing →</Link>} />
      <form method="get" className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-6">
        <Input name="from" type="date" defaultValue={from} aria-label="Du" />
        <Input name="to" type="date" defaultValue={to} aria-label="Au" />
        <Select name="repair" defaultValue={sp.repair ?? ""} aria-label="Réparation"><option value="">Toutes réparations</option>{(repairs ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        <Select name="model" defaultValue={sp.model ?? ""} aria-label="Console"><option value="">Toutes consoles</option>{(models ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        <Input name="source" defaultValue={sp.source ?? ""} placeholder="Source (google…)" aria-label="Source" />
        <div className="flex gap-2"><Input name="campaign" defaultValue={sp.campaign ?? ""} placeholder="Campagne" aria-label="Campagne" /><Button type="submit" variant="outline">OK</Button></div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={formatPrice(revenue)} hint={`${orders.length} commandes payées`} tone="success" />
        <StatCard label="Panier moyen" value={formatPrice(orders.length ? Math.round(revenue / orders.length) : 0)} />
        <StatCard label="Conversion" value={pct(orders.length, sessions)} hint={`${sessions} sessions`} />
        <StatCard label="CAC" value={formatPrice(cac)} hint={`${formatPrice(marketing)} de dépenses marketing`} />
        <StatCard label="Coût pièces" value={formatPrice(parts)} />
        <StatCard label="Coût transport" value={formatPrice(shippingCost)} />
        <StatCard label="Temps technicien" value={formatMinutes(minutes)} hint={orders.length ? `${formatMinutes(Math.round(minutes / orders.length))} / dossier` : undefined} />
        <StatCard label="Marge estimée" value={formatPrice(margin)} hint={`${pct(margin, revenue)} du CA · ${savCount} SAV`} tone={margin >= 0 ? "success" : "warning"} />
        <StatCard label="Délai moyen" value={avgDelay === null ? "—" : `${avgDelay.toFixed(1).replace(".", ",")} j`} hint={delayDays.length ? `réception → expédition, ${delayDays.length} derniers dossiers` : "aucun dossier expédié"} />
        <StatCard label="Dossiers du jour" value={todayCount} hint="commandes payées aujourd'hui" href="/admin/orders" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Entonnoir de conversion">
          <ol className="space-y-2">
            {funnel.map((f, i) => (
              <li key={f.label} className="flex items-center justify-between text-sm"><span>{f.label}</span><span className="tabular-nums"><span className="font-semibold text-ink">{f.value}</span>{i > 0 ? <span className="ml-2 text-ink-muted">{pct(f.value, funnel[i - 1]!.value)}</span> : null}</span></li>
            ))}
          </ol>
        </Section>
        <Section title="Upsell">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-ink-muted">Options ajoutées (clics)</dt><dd className="text-right tabular-nums">{optionAdds}</dd>
            <dt className="text-ink-muted">Options retirées</dt><dd className="text-right tabular-nums">{optionRemoves}</dd>
            <dt className="text-ink-muted">Packs sélectionnés</dt><dd className="text-right tabular-nums">{packSelects}</dd>
            <dt className="text-ink-muted">Commandes avec option/pack</dt><dd className="text-right tabular-nums">{ordersWithOptions} ({pct(ordersWithOptions, orders.length)})</dd>
            <dt className="text-ink-muted">CA options et packs</dt><dd className="text-right tabular-nums">{formatPrice((items ?? []).reduce((s, i) => s + i.total_cents, 0))}</dd>
          </dl>
          <Table className="mt-4"><thead><tr><Th>Option / pack</Th><Th className="text-right">Ventes</Th><Th className="text-right">CA</Th></tr></thead><tbody>{[...byOption.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([label, r]) => <tr key={label}><Td>{label}</Td><Td className="text-right tabular-nums">{r.count}</Td><Td className="text-right tabular-nums">{formatPrice(r.revenue)}</Td></tr>)}</tbody></Table>
        </Section>
      </div>

      <Section title="Rentabilité par réparation">
        <Table>
          <thead><tr><Th>Réparation</Th><Th className="text-right">Commandes</Th><Th className="text-right">CA</Th><Th className="text-right">Pièces</Th><Th className="text-right">Transport</Th><Th className="text-right">Temps</Th><Th className="text-right">Marge</Th><Th className="text-right">SAV</Th></tr></thead>
          <tbody>
            {[...byRepair.values()].sort((a, b) => b.revenue - a.revenue).map((r) => { const m = r.revenue - r.parts - r.shipping; return <tr key={r.name}><Td>{r.name}</Td><Td className="text-right tabular-nums">{r.count}</Td><Td className="text-right tabular-nums">{formatPrice(r.revenue)}</Td><Td className="text-right tabular-nums">{formatPrice(r.parts)}</Td><Td className="text-right tabular-nums">{formatPrice(r.shipping)}</Td><Td className="text-right tabular-nums">{formatMinutes(r.minutes)}</Td><Td className={`text-right tabular-nums font-medium ${m >= 0 ? "text-success" : "text-danger"}`}>{formatPrice(m)} <span className="text-xs text-ink-muted">({pct(m, r.revenue)})</span></Td><Td className="text-right tabular-nums">{r.sav}</Td></tr>; })}
            {!byRepair.size ? <tr><Td colSpan={8} className="text-center text-ink-muted">Aucune commande payée sur la période.</Td></tr> : null}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-ink-muted">Le temps technicien vient du journal d&apos;intervention ; les pièces des lignes « Pièces utilisées » ; le transport des expéditions enregistrées.</p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sources et campagnes">
          <Table><thead><tr><Th>Source</Th><Th className="text-right">Sessions</Th><Th className="text-right">Commandes</Th><Th className="text-right">Conv.</Th><Th className="text-right">CA</Th></tr></thead><tbody>{[...bySource.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([src, r]) => <tr key={src}><Td>{src}</Td><Td className="text-right tabular-nums">{r.sessions.size}</Td><Td className="text-right tabular-nums">{r.orders}</Td><Td className="text-right tabular-nums">{pct(r.orders, r.sessions.size)}</Td><Td className="text-right tabular-nums">{formatPrice(r.revenue)}</Td></tr>)}</tbody></Table>
        </Section>
        <Section title="Pages d'atterrissage">
          <Table><thead><tr><Th>Page</Th><Th className="text-right">Sessions</Th></tr></thead><tbody>{[...landing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([p, n]) => <tr key={p}><Td className="font-mono text-xs">{p}</Td><Td className="text-right tabular-nums">{n}</Td></tr>)}</tbody></Table>
        </Section>
      </div>
    </div>
  );
}
