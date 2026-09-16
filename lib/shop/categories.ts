import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RAYONS_PAR_DEFAUT, ordonnes, type Rayon } from "@/lib/shop/rayons";

/**
 * La liste des rayons, telle qu'elle est en base.
 *
 * Mise en cache pour la durée d'une requête : l'en-tête, le pied de page, la
 * boutique et l'accueil la demandent tous, et c'est une table de cinq lignes.
 *
 * **Le repli n'est pas décoratif.** Si la table n'existe pas encore — le code
 * peut être déployé avant que la migration ne soit jouée sur Supabase, et c'est
 * le cas nominal ici puisque les migrations sont appliquées à la main — on rend
 * les cinq rayons d'origine. La boutique continue alors de fonctionner
 * exactement comme avant au lieu de s'afficher sans rayons. Le jour où la
 * migration passe, la liste devient celle du vendeur, sans redéploiement.
 */
export const getRayons = cache(async (): Promise<Rayon[]> => {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("product_categories")
      .select("code, label, label_singular, slug, position, is_public, tag_label")
      .order("position", { ascending: true });
    if (error || !data?.length) return ordonnes(RAYONS_PAR_DEFAUT);
    return ordonnes(
      data.map((r) => ({
        code: r.code,
        label: r.label,
        short: r.label_singular,
        slug: r.slug,
        position: r.position,
        isPublic: r.is_public,
        tagLabel: r.tag_label,
      })),
    );
  } catch {
    return ordonnes(RAYONS_PAR_DEFAUT);
  }
});
