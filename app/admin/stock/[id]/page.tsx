import { EntityEditPage } from "@/components/admin/entity-pages";
import { Section } from "@/components/admin/ui";
import { StockAdjustForm } from "@/components/admin/shop-forms";
import { PublicMediaUploader } from "@/components/admin/public-media-uploader";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils/format";
import { categoryFromSlug } from "@/lib/shop/status";

const REASONS: Record<string, string> = { ORDER_PAID: "Commande payée", ORDER_CANCELLED: "Commande annulée", RECEIVED: "Réception / arrivage", ADJUSTMENT: "Inventaire", DAMAGED: "Casse / perte", COUNTER_SALE: "Vente au comptoir", TRADE_IN: "Reprise entrée en stock" };

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const [{ id }, { cat }] = await Promise.all([params, searchParams]);
  // « Publier un jeu vidéo » et « Publier une console », sur l'accueil du
  // back-office, ouvrent ce formulaire avec le bon rayon déjà choisi. Un slug
  // inconnu ne pré-remplit rien plutôt que d'imposer une catégorie au hasard.
  const category = categoryFromSlug(cat);
  return (
    <EntityEditPage entityKey="products" id={id} defaults={category ? { category } : undefined}>
      {async (row) => {
        const { data: movements } = await createSupabaseAdminClient().from("stock_movements").select("*, actor:profiles(first_name, last_name)").eq("product_id", String(row.id)).order("created_at", { ascending: false }).limit(50);
        return (
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Ajuster le stock" description={`Quantité actuelle : ${String(row.quantity)} · seuil de stock faible : ${String(row.low_stock_threshold)}`}>
              <StockAdjustForm productId={String(row.id)} />
            </Section>
            <Section title="Photos du produit" description="Téléversez les images puis collez leur chemin dans le champ « Photos » ci-dessus. La première photo sert de visuel principal ; les suivantes forment la galerie. Sans photo, la fiche affiche un aperçu rayé explicitement identifié.">
              <PublicMediaUploader folder="produits" />
            </Section>
            <Section title="Mouvements de stock">
              <ol className="flex flex-col gap-2 text-[13px]">
                {(movements ?? []).map((m) => {
                  const actor = m.actor as { first_name: string | null; last_name: string | null } | null;
                  return (
                    <li key={m.id} className="flex gap-3 text-ink-faint">
                      <span className="whitespace-nowrap font-mono text-[#6b6558]">{formatDateTime(m.created_at)}</span>
                      <span className={`font-mono ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                      <span>
                        {REASONS[m.reason] ?? m.reason}
                        {m.note ? ` · ${m.note}` : ""}
                        {actor ? ` · ${actor.first_name ?? ""} ${actor.last_name ?? ""}` : ""}
                      </span>
                    </li>
                  );
                })}
                {!movements?.length ? <li className="text-ink-muted">Aucun mouvement.</li> : null}
              </ol>
            </Section>
          </div>
        );
      }}
    </EntityEditPage>
  );
}
