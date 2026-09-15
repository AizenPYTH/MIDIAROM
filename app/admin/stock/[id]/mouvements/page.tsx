import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { Section } from "@/components/admin/ui";
import { StockAdjustForm } from "@/components/admin/shop-forms";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils/format";

/**
 * L'historique des mouvements de stock d'un article.
 *
 * Il vivait au bas de la fiche produit, cinquante lignes sous le formulaire.
 * C'est une lecture d'inventaire, pas une étape de saisie : il a sa page, on y
 * va quand on cherche quelque chose, et la fiche reste courte.
 *
 * L'ajustement est repris ici aussi : quand on lit l'historique parce qu'un
 * compte est faux, on veut le corriger sans revenir en arrière.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Historique du stock" };

const MOTIFS: Record<string, string> = {
  ORDER_PAID: "Commande payée",
  ORDER_CANCELLED: "Commande annulée",
  RECEIVED: "Réception / arrivage",
  ADJUSTMENT: "Inventaire",
  DAMAGED: "Casse / perte",
  COUNTER_SALE: "Vente au comptoir",
  TRADE_IN: "Reprise entrée en stock",
};

export default async function StockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOrRedirect();
  const { id } = await params;
  const db = createSupabaseAdminClient();
  const { data: product } = await db.from("products").select("id, name, sku, quantity, low_stock_threshold").eq("id", id).maybeSingle();
  if (!product) notFound();
  const { data: movements } = await db
    .from("stock_movements")
    .select("*, actor:profiles(first_name, last_name)")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/stock/${product.id}`} className="text-xs text-ink-muted hover:text-ink">
          ← {product.name}
        </Link>
        <PageHeader
          className="mt-1"
          title="Historique du stock"
          description={`${product.sku} · quantité actuelle : ${product.quantity} · seuil de stock faible : ${product.low_stock_threshold}`}
        />
      </div>

      <Section title="Ajuster le stock">
        <StockAdjustForm productId={product.id} />
      </Section>

      <Section title="Mouvements" description={`${movements?.length ?? 0} dernier(s) mouvement(s)`}>
        <ol className="flex flex-col gap-2 text-[13px]">
          {(movements ?? []).map((m) => {
            const actor = m.actor as { first_name: string | null; last_name: string | null } | null;
            return (
              <li key={m.id} className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-dotted border-border pb-1.5 text-ink-faint">
                <span className="whitespace-nowrap font-mono text-ink-muted">{formatDateTime(m.created_at)}</span>
                <span className={`font-mono ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                <span className="min-w-0">
                  {MOTIFS[m.reason] ?? m.reason}
                  {m.note ? ` · ${m.note}` : ""}
                  {actor ? ` · ${actor.first_name ?? ""} ${actor.last_name ?? ""}` : ""}
                </span>
              </li>
            );
          })}
          {!movements?.length ? <li className="text-ink-muted">Aucun mouvement enregistré.</li> : null}
        </ol>
      </Section>
    </div>
  );
}
