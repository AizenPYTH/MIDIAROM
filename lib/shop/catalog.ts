import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";
import { categoryFromSlug, type ProductCategory, type ProductCondition } from "@/lib/shop/status";

export type Product = Tables<"products">;

export interface ProductFilters {
  q?: string;
  category?: string; // slug (consoles, jeux…)
  platform?: string;
  condition?: "neuf" | "occasion" | "revise";
  availability?: "stock";
  retro?: boolean;
  minCents?: number;
  maxCents?: number;
  sort?: "recent" | "price-asc" | "price-desc" | "name";
  modelId?: string;
}

const db = () => createSupabaseAdminClient();

/** Produits actifs filtrés (catalogue public). Les prix et le stock viennent de la base. */
export const getProducts = cache(async (filters: ProductFilters = {}, limit = 200): Promise<Product[]> => {
  let query = db().from("products").select("*").eq("is_active", true);
  const category = categoryFromSlug(filters.category);
  if (category) query = query.eq("category", category);
  if (filters.platform) query = query.ilike("platform", filters.platform);
  if (filters.modelId) query = query.eq("model_id", filters.modelId);
  if (filters.condition === "neuf") query = query.eq("condition", "NEW");
  if (filters.condition === "revise") query = query.eq("condition", "REFURBISHED");
  if (filters.condition === "occasion") query = query.in("condition", ["USED_A", "USED_B", "USED_C"] satisfies ProductCondition[]);
  if (filters.availability === "stock") query = query.gt("quantity", 0);
  if (filters.retro) query = query.eq("is_retro", true);
  if (filters.minCents !== undefined) query = query.gte("price_cents", filters.minCents);
  if (filters.maxCents !== undefined) query = query.lte("price_cents", filters.maxCents);
  if (filters.q) {
    const term = filters.q.trim().replace(/[%,]/g, "");
    if (term) query = query.or(`name.ilike.%${term}%,platform.ilike.%${term}%,sku.ilike.%${term}%,description.ilike.%${term}%`);
  }
  switch (filters.sort) {
    case "price-asc":
      query = query.order("price_cents", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("display_order", { ascending: true });
  }
  const { data } = await query.limit(limit);
  return data ?? [];
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const { data } = await db().from("products").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
  return data ?? null;
});

export const getProductsByIds = cache(async (ids: string[]): Promise<Product[]> => {
  if (!ids.length) return [];
  const { data } = await db().from("products").select("*").in("id", ids);
  return data ?? [];
});

export const getFeaturedProducts = cache(async (limit = 8): Promise<Product[]> => {
  const { data } = await db().from("products").select("*").eq("is_active", true).gt("quantity", 0).order("is_featured", { ascending: false }).order("display_order").limit(limit);
  return data ?? [];
});

/** Plateformes présentes dans le catalogue actif (pour les filtres). */
export const getProductPlatforms = cache(async (): Promise<string[]> => {
  const { data } = await db().from("products").select("platform").eq("is_active", true);
  return [...new Set((data ?? []).map((p) => p.platform))].sort((a, b) => a.localeCompare(b, "fr"));
});

export const getProductCategoryCounts = cache(async (): Promise<Record<ProductCategory, number>> => {
  const { data } = await db().from("products").select("category").eq("is_active", true);
  const counts: Record<ProductCategory, number> = { CONSOLE: 0, GAME: 0, ACCESSORY: 0, PART: 0, COLLECTIBLE: 0, MANGA: 0 };
  for (const p of data ?? []) counts[p.category] += 1;
  return counts;
});

/**
 * Photo d'un produit, avec repli sur le modèle de console auquel il est lié.
 *
 * Le catalogue porte 13 détourés de consoles (`console_models.image_path`,
 * importés par `npm run photos:consoles`). Une console mise en vente sans
 * photo propre n'a donc aucune raison de s'afficher vide : celle du modèle
 * dit déjà de quel appareil il s'agit.
 *
 * Renvoie null plutôt qu'un chemin de remplissage : l'affichage sait poser son
 * aplat.
 */
export async function productPhoto(product: Pick<Product, "images" | "model_id">): Promise<string | null> {
  const own = (product.images ?? []).find(Boolean);
  if (own) return own;
  if (!product.model_id) return null;
  const { data } = await db().from("console_models").select("image_path").eq("id", product.model_id).maybeSingle();
  return data?.image_path ?? null;
}

/** Même repli, pour une liste, en une seule requête. */
export async function productPhotos(products: Product[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const needModel: string[] = [];
  for (const p of products) {
    const own = (p.images ?? []).find(Boolean);
    if (own) out.set(p.id, own);
    else if (p.model_id) needModel.push(p.model_id);
    else out.set(p.id, null);
  }
  if (needModel.length) {
    const { data } = await db().from("console_models").select("id, image_path").in("id", [...new Set(needModel)]);
    const byModel = new Map((data ?? []).map((m) => [m.id, m.image_path]));
    for (const p of products) {
      if (out.has(p.id)) continue;
      out.set(p.id, (p.model_id ? byModel.get(p.model_id) : null) ?? null);
    }
  }
  return out;
}
