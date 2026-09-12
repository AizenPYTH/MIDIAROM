import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FilterChips, StatBand, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { CATEGORY_LABELS, CONDITION_SHORT, stockState } from "@/lib/shop/status";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const FILTERS = [
  { key: "all", label: "Tout" },
  { key: "low", label: "Stock faible" },
  { key: "out", label: "Ruptures" },
  { key: "used", label: "Occasion" },
  { key: "retro", label: "Rétro" },
  { key: "inactive", label: "Hors vente" },
];

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  await requireAdminOrRedirect();
  const { q, f } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f)?.key ?? "all";
  const db = createSupabaseAdminClient();
  let query = db.from("products").select("*").order("display_order").order("name");
  if (q?.trim()) {
    const term = q.trim().replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,platform.ilike.%${term}%`);
  }
  const { data: all } = await query.limit(1000);
  const products = (all ?? []).filter((p) => {
    const state = stockState(p.quantity, p.low_stock_threshold);
    if (filter === "low") return state === "LOW";
    if (filter === "out") return state === "OUT";
    if (filter === "used") return p.condition !== "NEW";
    if (filter === "retro") return p.is_retro;
    if (filter === "inactive") return !p.is_active;
    return true;
  });
  const active = (all ?? []).filter((p) => p.is_active);
  const outOfStock = active.filter((p) => p.quantity === 0);
  const unique = active.filter((p) => p.quantity === 1 && p.condition !== "NEW");
  const stockValue = active.reduce((s, p) => s + p.cost_cents * p.quantity, 0);
  const usedCount = active.filter((p) => p.condition !== "NEW").length;

  return (
    <div>
      <StatBand>
        <StatCard label="Références" value={active.length} hint={`dont ${usedCount} en occasion / révisé`} />
        <StatCard label="Ruptures" value={outOfStock.length} hint={outOfStock.slice(0, 2).map((p) => p.name).join(", ") || "aucune"} href="/admin/stock?f=out" tone={outOfStock.length ? "warning" : undefined} />
        <StatCard label="Pièces uniques" value={unique.length} hint="occasion, un seul exemplaire" href="/admin/stock?f=used" />
        <StatCard label="Valeur stock" value={formatPrice(stockValue)} hint="prix d'achat × quantités" tone="success" />
      </StatBand>
      <section className="flex min-w-0 flex-col gap-3.5 p-5">
        <form method="get" action="/admin/stock" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="f" value={filter} />
          <input name="q" defaultValue={q ?? ""} placeholder="Rechercher une référence, un nom, une plateforme" aria-label="Recherche" className="min-w-0 flex-[1_1_220px] rounded-[14px] border border-border-strong bg-field px-4 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:text-[14px]" />
          <Link href="/admin/stock/new" className="whitespace-nowrap bg-sale px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-white hover:bg-paper hover:text-ink-900">
            + Nouvel article
          </Link>
        </form>
        <FilterChips items={FILTERS} current={filter} hrefFor={(key) => `/admin/stock?${new URLSearchParams({ ...(q ? { q } : {}), f: key })}`} />
        <Table minWidth={720} cards>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Article</Th>
              <Th>Plateforme</Th>
              <Th>État</Th>
              <Th className="text-right">Prix</Th>
              <Th className="text-right">Stock</Th>
              <Th>Disponibilité</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const state = stockState(p.quantity, p.low_stock_threshold);
              return (
                <tr key={p.id} className={cn("hover:bg-surface-muted", !p.is_active && "opacity-60")}>
                  <Td label="SKU" className="whitespace-nowrap font-mono text-[12px] text-ink-soft">{p.sku}</Td>
                  <Td>
                    <Link href={`/admin/stock/${p.id}`} className="font-medium text-ink hover:text-accent-light">
                      {p.name}
                    </Link>
                    <span className="block text-[12px] text-ink-muted">{CATEGORY_LABELS[p.category]}</span>
                  </Td>
                  <Td label="Plateforme" className="text-[13px] text-ink-faint">{p.platform}</Td>
                  <Td label="État" className="font-mono text-[11.5px] text-ink-soft">{CONDITION_SHORT[p.condition]}</Td>
                  <Td label="Prix" className="whitespace-nowrap text-right font-mono">{formatPrice(p.price_cents)}</Td>
                  <Td label="Stock" className={cn("whitespace-nowrap text-right font-mono text-[12.5px]", state === "OUT" ? "text-danger" : state === "LOW" ? "text-warning" : "text-ink-soft")}>{p.quantity}</Td>
                  <Td label="Disponibilité">
                    {!p.is_active ? <Badge>Hors vente</Badge> : state === "OUT" ? <Badge tone="danger">Rupture</Badge> : state === "LOW" ? <Badge tone="warning">Faible</Badge> : <Badge tone="success">Disponible</Badge>}
                  </Td>
                </tr>
              );
            })}
            {!products.length ? (
              <tr>
                <Td colSpan={7} className="text-center text-ink-muted">
                  Aucun article.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
