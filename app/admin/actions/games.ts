"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hintsFromProduct, linkProductToGame, searchGameMatches, syncGame } from "@/lib/igdb/service";
import { audit } from "@/lib/security/audit";
import type { GameMatch } from "@/lib/igdb/types";

/**
 * Actions du back-office pour l'association produit ↔ jeu IGDB.
 *
 * Rien n'est irréversible : dissocier est une action à part entière, et une
 * correspondance choisie à la main est marquée MANUAL pour qu'aucune passe
 * automatique ne la remplace.
 */

export type GameActionResult =
  | { ok: true; message: string }
  | { ok: true; matches: GameMatch[]; error: string | null }
  | { ok: false; error: string };

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

async function loadProduct(productId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("products")
    .select("id, name, platform, ean, sku, edition, region, release_year, category")
    .eq("id", productId)
    .maybeSingle();
  return data;
}

/** Cherche les jeux correspondant à un produit et renvoie les candidats notés. */
export async function searchGamesForProductAction(_prev: unknown, formData: FormData): Promise<GameActionResult> {
  await requireAdmin();
  const productId = str(formData, "product_id");
  const product = await loadProduct(productId);
  if (!product) return { ok: false, error: "Produit introuvable." };

  // Le champ de recherche permet de corriger un nom de produit trop
  // commercial (« FIFA 23 - PS5 - Edition FR ») sans modifier la fiche.
  const override = str(formData, "q");
  const hints = hintsFromProduct(product);
  const { matches, error } = await searchGameMatches({ ...hints, name: override || hints.name }, 10);
  return { ok: true, matches, error };
}

/** Associe un jeu au produit. `igdb_id` vide = dissociation. */
export async function linkGameAction(_prev: unknown, formData: FormData): Promise<GameActionResult> {
  const user = await requireAdmin();
  const productId = str(formData, "product_id");
  const rawId = str(formData, "igdb_id");
  const product = await loadProduct(productId);
  if (!product) return { ok: false, error: "Produit introuvable." };

  if (!rawId) {
    const result = await linkProductToGame(productId, null, "MANUAL", null);
    if (!result.ok) return { ok: false, error: result.error };
    await audit({ actorId: user.id, actorRole: user.profile.role, action: "products.igdb_unlinked", resourceType: "products", resourceId: productId });
    revalidatePath(`/admin/stock/${productId}`);
    revalidatePath("/");
    return { ok: true, message: "Jeu dissocié. Le produit garde ses propres photos." };
  }

  const igdbId = Number(rawId);
  if (!Number.isInteger(igdbId) || igdbId <= 0) return { ok: false, error: "Identifiant IGDB invalide." };

  const confidenceRaw = Number(str(formData, "confidence"));
  const confidence = Number.isFinite(confidenceRaw) ? confidenceRaw : null;
  // Choisi dans la liste par un humain : c'est une validation, pas une
  // déduction, même quand le score était déjà élevé.
  const result = await linkProductToGame(productId, igdbId, "MANUAL", confidence);
  if (!result.ok) return { ok: false, error: result.error };

  await audit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: "products.igdb_linked",
    resourceType: "products",
    resourceId: productId,
    newValue: { igdb_game_id: igdbId, confidence },
  });
  revalidatePath(`/admin/stock/${productId}`);
  revalidatePath("/");
  return { ok: true, message: `Jeu associé (IGDB ${igdbId}). Les visuels sont disponibles.` };
}

/** Force une resynchronisation de la fiche associée, cache ignoré. */
export async function resyncGameAction(_prev: unknown, formData: FormData): Promise<GameActionResult> {
  await requireAdmin();
  const productId = str(formData, "product_id");
  const { data } = await createSupabaseAdminClient().from("products").select("igdb_game_id").eq("id", productId).maybeSingle();
  const igdbId = data?.igdb_game_id ? Number(data.igdb_game_id) : null;
  if (!igdbId) return { ok: false, error: "Aucun jeu associé à ce produit." };

  const result = await syncGame(igdbId, { force: true });
  if (!result.game) return { ok: false, error: result.error ?? "Synchronisation impossible." };
  await createSupabaseAdminClient().from("products").update({ igdb_synced_at: new Date().toISOString() }).eq("id", productId);
  revalidatePath(`/admin/stock/${productId}`);
  revalidatePath("/");
  return { ok: true, message: result.source === "igdb" ? "Fiche remise à jour depuis IGDB." : `Fiche inchangée : ${result.error ?? "cache utilisé"}.` };
}
