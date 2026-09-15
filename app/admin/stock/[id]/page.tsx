import Link from "next/link";
import { EntityEditPage } from "@/components/admin/entity-pages";
import { Section } from "@/components/admin/ui";
import { StockAdjustForm } from "@/components/admin/shop-forms";
import { categoryFromSlug } from "@/lib/shop/status";

/**
 * La fiche d'un article.
 *
 * Elle enchaînait, sous le formulaire, trois blocs pleine largeur : ajuster le
 * stock, téléverser des médias, et cinquante mouvements de stock. La page
 * faisait trois écrans pour un article qu'on ouvre le plus souvent pour
 * corriger un prix.
 *
 * Il ne reste que l'ajustement de stock, en une ligne, parce que c'est le seul
 * geste qu'on fait vraiment depuis cette page. L'historique part sur sa propre
 * page, à un clic. Le téléverseur a disparu : les photos se choisissent
 * maintenant dans le formulaire, sans copier-coller de chemin.
 */
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
      {(row) => (
        <Section
          title="Ajuster le stock"
          description={`Quantité actuelle : ${String(row.quantity)} · seuil de stock faible : ${String(row.low_stock_threshold)}`}
          actions={
            <Link
              href={`/admin/stock/${String(row.id)}/mouvements`}
              className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-ink"
            >
              Historique du stock →
            </Link>
          }
        >
          <StockAdjustForm productId={String(row.id)} />
        </Section>
      )}
    </EntityEditPage>
  );
}
