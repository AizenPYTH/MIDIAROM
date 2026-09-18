import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { Pagination, Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, statusTone, type OrderStatus } from "@/lib/orders/status";
import { formatDateTime, formatPrice } from "@/lib/utils/format";

const PAGE_SIZE = 25;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireStaffOrRedirect();
  const { status, q, page: pageRaw } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const db = createSupabaseAdminClient();
  let query = db
    .from("repair_orders")
    .select("id, order_number, model_name, repair_name, status, total_cents, created_at, customer_first_name, customer_last_name, customer_email, is_quote_request", { count: "exact" })
    .order("created_at", { ascending: false });
  if (status && ORDER_STATUSES.includes(status as OrderStatus)) query = query.eq("status", status as OrderStatus);

  /*
    Le compteur des demandes à chiffrer.

    Une demande de devis est la seule pièce du back-office où quelqu'un attend
    une réponse sans avoir rien payé : elle ne doit pas se perdre entre deux
    pages de dossiers. D'où ce raccourci permanent, hors du filtre, qui dit
    combien il en reste et y mène d'un clic.
  */
  const { count: aChiffrer } = await db
    .from("repair_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "QUOTE_REQUESTED");
  if (q) {
    const term = q.trim().replace(/[%,]/g, "");
    query = query.or(`order_number.ilike.%${term}%,customer_email.ilike.%${term}%,customer_last_name.ilike.%${term}%,model_name.ilike.%${term}%`);
  }
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const hrefFor = (p: number) => `/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(p) }).toString()}`;

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Dossiers</span>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-ink">Toutes les réparations</h1>
      </div>

      {aChiffrer ? (
        <Link
          href="/admin/orders?status=QUOTE_REQUESTED"
          className="flex items-center justify-between gap-3 border-l-2 bg-surface px-4 py-3 hover:bg-surface-muted"
          style={{ borderLeftColor: "var(--brand)" }}
        >
          <span>
            <span className="block text-[15px] font-semibold text-ink">
              {aChiffrer} demande{aChiffrer > 1 ? "s" : ""} de devis à chiffrer
            </span>
            <span className="block text-[13px] text-ink-muted">Le client attend un prix. Sa console est encore chez lui.</span>
          </span>
          <span aria-hidden="true" className="font-mono text-[13px] text-ink-soft">
            →
          </span>
        </Link>
      ) : null}
      <form className="flex flex-wrap items-center gap-2" method="get">
        <input id="q" name="q" defaultValue={q ?? ""} placeholder="Rechercher n° de dossier / client / console" aria-label="Recherche" className="min-w-0 flex-[1_1_220px] rounded-[14px] border border-border-strong bg-field px-4 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:text-[14px]" />
        <Select id="status" name="status" defaultValue={status ?? ""} aria-label="Statut" className="w-auto min-w-[200px] py-2.5">
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <button type="submit" className="cursor-pointer border border-border-strong bg-surface px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink hover:border-paper">
          Filtrer
        </button>
      </form>
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>N°</Th>
            <Th>Client</Th>
            <Th>Console / prestation</Th>
            <Th className="text-right">Total</Th>
            <Th>Créé</Th>
            <Th>Statut</Th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((o) => (
            <tr key={o.id} className="hover:bg-surface-muted">
              <Td>
                <Link href={`/admin/orders/${o.id}`} className="whitespace-nowrap font-mono text-[12.5px] text-ink-soft hover:text-ink">
                  {o.order_number}
                </Link>
              </Td>
              <Td>
                <span className="block">
                  {o.customer_first_name} {o.customer_last_name}
                </span>
                <span className="block text-[12.5px] text-ink-muted">{o.customer_email}</span>
              </Td>
              <Td className="text-ink-faint">
                {o.model_name} — {o.repair_name}
              </Td>
              {/* Un dossier de devis n'a pas de total tant qu'il n'a pas été
                  chiffré : « 0,00 € » laisserait croire à une commande offerte. */}
              <Td className="whitespace-nowrap text-right font-mono">{o.is_quote_request && o.total_cents === 0 ? "—" : formatPrice(o.total_cents)}</Td>
              <Td className="text-[13px] text-ink-faint">{formatDateTime(o.created_at)}</Td>
              <Td>
                <Badge tone={o.status === "QUOTE_REQUESTED" ? "warning" : statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
              </Td>
            </tr>
          ))}
          {!data?.length ? (
            <tr>
              <Td colSpan={6} className="text-center text-ink-muted">
                Aucun dossier ne correspond.
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={hrefFor} />
    </div>
  );
}
