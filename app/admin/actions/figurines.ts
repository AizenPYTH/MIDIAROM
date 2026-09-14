"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/auth";
import { audit } from "@/lib/security/audit";
import { hljProvider } from "@/lib/catalog/providers/hlj";
import type { ExternalProduct } from "@/lib/catalog/providers/types";
import { importExternalProduct } from "@/lib/catalog/import";

/**
 * Recherche et import de figurines depuis un catalogue externe.
 *
 * La recherche est **à la demande** : rien n'est aspiré, rien n'est stocké tant
 * que l'atelier n'a pas cliqué sur « Importer ». L'import crée un brouillon,
 * jamais un produit en vente — voir lib/catalog/import.ts.
 */

const MAX_RESULTS = 12;

export type FigurineSearchState =
  | { status: "idle" }
  | { status: "results"; term: string; products: ExternalProduct[]; error: string | null }
  | { status: "error"; error: string };

export type FigurineImportState =
  | { status: "idle" }
  | { status: "done"; ok: boolean; message: string; productId?: string };

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

export async function searchFigurinesAction(_prev: unknown, formData: FormData): Promise<FigurineSearchState> {
  await requireAdmin();
  const term = str(formData, "q");
  if (!term) return { status: "error", error: "Entrez un nom de figurine, par exemple « Luffy Gear 5 »." };

  const mauvaiseConfig = hljProvider.configurationError();
  if (mauvaiseConfig) return { status: "error", error: mauvaiseConfig };

  const { products, error } = await hljProvider.search(term, MAX_RESULTS);
  if (!products.length) return { status: "error", error: error ?? "Aucun résultat." };
  return { status: "results", term, products, error };
}

/**
 * Importe une fiche. Le formulaire renvoie la fiche sérialisée telle qu'elle a
 * été affichée : l'atelier importe ce qu'il a vu, et non le résultat d'une
 * seconde recherche qui pourrait avoir changé entre-temps.
 */
export async function importFigurineAction(_prev: unknown, formData: FormData): Promise<FigurineImportState> {
  const user = await requireAdmin();
  const brut = str(formData, "payload");
  if (!brut) return { status: "done", ok: false, message: "Fiche manquante." };

  let external: ExternalProduct;
  try {
    external = JSON.parse(brut) as ExternalProduct;
  } catch {
    return { status: "done", ok: false, message: "Fiche illisible." };
  }
  if (!external?.ref || !external?.name) {
    return { status: "done", ok: false, message: "Fiche incomplète : référence ou nom absent." };
  }

  const result = await importExternalProduct(external, hljProvider.id);
  if (!result.ok) return { status: "done", ok: false, message: result.error };

  await audit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: "products.imported",
    resourceType: "products",
    resourceId: result.productId,
    newValue: { source: hljProvider.id, ref: external.ref, name: external.name },
  });
  revalidatePath("/admin/stock");
  return { status: "done", ok: true, message: result.message, productId: result.productId };
}
