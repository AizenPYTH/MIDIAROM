import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { getBrandSettings } from "@/lib/settings";
import { FULFILLMENT_LABELS, shopStatusLabel } from "@/lib/shop/status";
import { formatDateTime, formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

/** Bons de préparation / d'envoi imprimables (une page par commande). */
export default async function PrintShopOrdersPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const [{ id }, brand] = await Promise.all([searchParams, getBrandSettings()]);
  await requireStaffOrRedirect();
  const db = createSupabaseAdminClient();
  let query = db.from("shop_orders").select("*, items:shop_order_items(*)").order("created_at");
  query = id ? query.eq("id", id) : query.in("status", ["PAID", "PREPARED"]);
  const { data: orders } = await query.limit(50);
  return (
    <div className="bg-white p-6 text-[#14120f] print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.06em]">
        <Link href="/admin/shop-orders" className="border border-[#14120f] px-3 py-2">
          ← Commandes
        </Link>
        <span>
          {orders?.length ?? 0} bon(s) — utilisez Imprimer (Ctrl/Cmd + P)
        </span>
      </div>
      {(orders ?? []).map((o) => {
        const address = (o.shipping_address ?? null) as Record<string, string | null> | null;
        const items = o.items as { id: string; label: string; sku: string | null; quantity: number; total_cents: number }[];
        return (
          <article key={o.id} className="mb-8 break-after-page border border-[#14120f] p-6 font-sans">
            <header className="flex items-start justify-between gap-4 border-b border-[#14120f] pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.1em]">{o.fulfillment === "SHIPPING" ? "Bon d'envoi" : "Bon de préparation — retrait"}</p>
                <h1 className="mt-1 font-mono text-[26px] font-semibold">{o.order_number}</h1>
                <p className="text-[13px]">
                  {formatDateTime(o.created_at)} · {shopStatusLabel(o.status, o.fulfillment)} · {FULFILLMENT_LABELS[o.fulfillment]}
                </p>
              </div>
              <div className="text-right text-[13px]">
                <p className="font-extrabold">{brand.name}</p>
                <p>{[brand.address_line1, `${brand.postal_code} ${brand.city}`].filter(Boolean).join(", ")}</p>
                <p>{brand.phone}</p>
              </div>
            </header>
            <div className="mt-4 grid grid-cols-2 gap-6 text-[13.5px]">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.1em]">Client</p>
                <p className="font-semibold">
                  {o.customer_first_name} {o.customer_last_name}
                </p>
                <p>{o.customer_email}</p>
                <p>{o.customer_phone}</p>
              </div>
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.1em]">{o.fulfillment === "SHIPPING" ? "Adresse de livraison" : "Retrait"}</p>
                {address ? (
                  <>
                    <p className="font-semibold">{address.line1}</p>
                    {address.line2 ? <p>{address.line2}</p> : null}
                    <p>
                      {address.postal_code} {address.city}
                    </p>
                  </>
                ) : (
                  <p>Au magasin, aux horaires d&apos;ouverture</p>
                )}
              </div>
            </div>
            <table className="mt-5 w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-[#14120f] font-mono text-[10.5px] uppercase tracking-[0.08em]">
                  <th className="py-2 text-left">SKU</th>
                  <th className="py-2 text-left">Article</th>
                  <th className="py-2 text-right">Qté</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Préparé</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-dotted border-[#14120f]">
                    <td className="py-2 font-mono text-[12px]">{i.sku ?? "—"}</td>
                    <td className="py-2">{i.label}</td>
                    <td className="py-2 text-right font-mono">{i.quantity}</td>
                    <td className="py-2 text-right font-mono">{formatPrice(i.total_cents)}</td>
                    <td className="py-2 text-right">☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex justify-end gap-8 text-[13.5px]">
              <span>Livraison {formatPrice(o.shipping_cents)}</span>
              <span className="font-semibold">Total {formatPrice(o.total_cents)}</span>
            </div>
            {o.customer_notes ? <p className="mt-4 text-[13px]">Remarque client : {o.customer_notes}</p> : null}
          </article>
        );
      })}
      {!orders?.length ? <p className="font-mono text-[12px] uppercase tracking-[0.06em]">Aucune commande à préparer.</p> : null}
    </div>
  );
}
