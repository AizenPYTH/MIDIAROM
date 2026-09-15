"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security/auth";
import { audit } from "@/lib/security/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildSku, priceToCents, slugify } from "@/lib/catalog/listing";
import { PUBLIC_CATEGORIES, type ProductCategory } from "@/lib/shop/status";

/**
 * Créer une annonce en une fois.
 *
 * Le formulaire complet d'un article demande vingt-sept champs, dont un SKU et
 * un slug à inventer soi-même. Pour mettre une console en vente, c'est vingt-
 * deux champs de trop, et les deux premiers sont précisément ceux qu'une
 * machine sait produire mieux qu'un humain.
 *
 * Cette action ne demande donc que ce qu'aucune règle ne peut deviner — ce que
 * c'est, comment ça s'appelle, dans quel état, à quel prix, combien — et
 * fabrique le reste. L'article créé s'ouvre ensuite sur sa fiche complète, où
 * tout reste modifiable.
 */

export type NewListingState = { status: "idle" } | { status: "error"; error: string; field?: string };

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

export async function createListingAction(_prev: unknown, formData: FormData): Promise<NewListingState> {
  const user = await requireAdmin();

  const nom = str(formData, "name");
  if (!nom) return { status: "error", error: "Donnez un nom à l'article.", field: "name" };

  const categorie = str(formData, "category") as ProductCategory;
  if (!PUBLIC_CATEGORIES.includes(categorie)) {
    return { status: "error", error: "Choisissez un rayon.", field: "category" };
  }

  const plateforme = str(formData, "platform");
  if (!plateforme) return { status: "error", error: "Indiquez la plateforme ou la licence.", field: "platform" };

  const prix = priceToCents(str(formData, "price"));
  if (prix === null) return { status: "error", error: "Le prix doit être un montant, par exemple 49,90.", field: "price" };

  const quantite = Number.parseInt(str(formData, "quantity") || "1", 10);
  if (!Number.isFinite(quantite) || quantite < 0) {
    return { status: "error", error: "La quantité doit être un nombre positif.", field: "quantity" };
  }

  // Les chemins viennent de champs cachés, donc du navigateur : on ne garde
  // que ce qui ressemble à un objet de notre propre bucket, et jamais une URL
  // absolue qui pointerait ailleurs.
  const photos = formData
    .getAll("images")
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => /^[\w-]+\/[\w.-]+$/.test(v))
    .slice(0, 12);

  const db = createSupabaseAdminClient();

  // Un slug est une adresse publique : il doit être unique. On suffixe plutôt
  // que de refuser la création pour un homonyme.
  const base = slugify(nom);
  const { data: collision } = await db.from("products").select("id").eq("slug", base).maybeSingle();
  const slug = collision ? `${base}-${Date.now().toString(36).slice(-4)}` : base;

  const { data, error } = await db
    .from("products")
    .insert({
      sku: buildSku(categorie, nom),
      slug,
      name: nom,
      category: categorie,
      platform: plateforme,
      condition: (str(formData, "condition") || "NEW") as "NEW",
      description: str(formData, "description") || null,
      price_cents: prix,
      cost_cents: 0,
      quantity: quantite,
      low_stock_threshold: 2,
      // Les photos choisies dans le formulaire. La première est la vignette
      // du rayon ; `PhotoPicker` garantit l'ordre, l'action ne le réarrange pas.
      images: photos,
      includes: [],
      // Mise en ligne immédiate seulement si c'est demandé : par défaut
      // l'article attend ses photos.
      is_active: formData.get("publish") === "on",
      is_retro: false,
      is_featured: false,
      display_order: 0,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    return { status: "error", error: `Création impossible : ${error?.message ?? "réponse vide"}` };
  }

  await audit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: "products.created",
    resourceType: "products",
    resourceId: data.id,
    newValue: { name: data.name, category: categorie },
  });

  revalidatePath("/admin/stock");
  // La fiche complète prend le relais : photos, caractéristiques, stock.
  redirect(`/admin/stock/${data.id}?cree=1`);
}
