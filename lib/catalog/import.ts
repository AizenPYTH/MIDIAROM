import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExternalProduct } from "@/lib/catalog/providers/types";

/**
 * Import d'une fiche externe vers un **brouillon** de produit.
 *
 * Trois règles, et elles ne se négocient pas :
 *
 *   1. **Brouillon.** `is_active = false`, prix à zéro, stock à zéro. Un produit
 *      importé n'est pas un produit en vente : il manque le prix, l'état et la
 *      photo maison. L'atelier complète, puis publie.
 *   2. **Catégorie fixe.** `COLLECTIBLE` — le rayon « Figurines Manga / Anime ».
 *      Cet import ne sert qu'à ça ; il ne doit jamais pouvoir créer une console,
 *      un composant PC ou un accessoire.
 *   3. **Images créditées.** Les visuels de la source vont dans
 *      `external_images` avec leur origine, jamais dans `images`. C'est `images`
 *      que la boutique affiche : elle ne montrera donc que ce dont MÉDI@ROM
 *      détient les droits.
 */

/** Le rayon de destination. En dur : cet import n'en sert pas d'autre. */
const CATEGORY = "COLLECTIBLE" as const;

export type ImportResult =
  | { ok: true; productId: string; slug: string; message: string }
  | { ok: false; error: string };

/** Slug lisible et stable, dérivé du nom. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "figurine";
}

/**
 * SKU provisoire.
 *
 * Il doit exister — la colonne est obligatoire et unique — sans se faire passer
 * pour une référence du magasin. Le préfixe le dit, et l'atelier le remplace au
 * moment de publier.
 */
export function draftSku(source: string, ref: string): string {
  const propre = ref.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase().slice(0, 24);
  return `${source}-${propre || Date.now().toString(36).toUpperCase()}`;
}

/** Les attributs d'une figurine, dans le jsonb déjà affiché sur la fiche. */
function specsFrom(external: ExternalProduct): Record<string, string> {
  const specs: Record<string, string> = {};
  if (external.manufacturer) specs.Fabricant = external.manufacturer;
  if (external.series) specs.Licence = external.series;
  if (external.character) specs.Personnage = external.character;
  if (external.size) specs.Dimensions = external.size;
  if (external.releaseDate) specs["Date de sortie"] = external.releaseDate;
  if (external.ref) specs["Référence fabricant"] = external.ref;
  return specs;
}

/**
 * Crée le brouillon. Refuse si la référence a déjà été importée — c'est tout
 * l'intérêt de l'index unique `(source, source_ref)`.
 */
export async function importExternalProduct(external: ExternalProduct, source: string): Promise<ImportResult> {
  const db = createSupabaseAdminClient();

  const { data: existant } = await db
    .from("products")
    .select("id, slug, name")
    .eq("source", source)
    .eq("source_ref", external.ref)
    .maybeSingle();
  if (existant) {
    return { ok: false, error: `Déjà importé : « ${existant.name} ». Retrouvez-le dans le stock.` };
  }

  // Un slug peut exister pour un autre produit : on le rend unique sans faire
  // échouer l'import pour si peu.
  const base = slugify(external.name);
  const { data: collision } = await db.from("products").select("id").eq("slug", base).maybeSingle();
  const slug = collision ? `${base}-${Date.now().toString(36).slice(-4)}` : base;

  const { data, error } = await db
    .from("products")
    .insert({
      sku: draftSku(source, external.ref),
      slug,
      name: external.name,
      category: CATEGORY,
      platform: external.series ?? "Figurine",
      condition: "NEW",
      description: external.description,
      specs: specsFrom(external),
      includes: [],
      // Aucune image maison : c'est ce qui empêche la publication en l'état.
      images: [],
      // `Json` du type généré n'accepte pas une interface nommée : la forme
      // est la même, on la lui présente comme un objet libre.
      external_images: external.images.map((i) => ({ url: i.url, source: i.source, sourceUrl: i.sourceUrl })),
      source,
      source_ref: external.ref,
      source_url: external.url,
      ean: external.ean,
      // Brouillon : ni prix, ni stock, ni mise en ligne.
      price_cents: 0,
      cost_cents: 0,
      quantity: 0,
      low_stock_threshold: 2,
      is_retro: false,
      is_featured: false,
      is_active: false,
      display_order: 0,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    return { ok: false, error: `Création du brouillon impossible : ${error?.message ?? "réponse vide"}` };
  }
  return {
    ok: true,
    productId: data.id,
    slug: data.slug,
    message: "Brouillon créé. Renseignez le prix, l'état, le stock et une photo à vous avant de publier.",
  };
}
