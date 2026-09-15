import { slugify } from "@/lib/catalog/import";
import type { ProductCategory } from "@/lib/shop/status";

/**
 * Ce que le formulaire court fabrique à la place de l'utilisateur.
 *
 * Ces deux fonctions vivent hors de l'action serveur pour deux raisons : un
 * fichier `"use server"` ne peut exporter que des fonctions asynchrones, et ce
 * sont les deux seules étapes de la création qui peuvent se tromper en
 * silence — un prix mal lu entre en base sans erreur, une référence non unique
 * fait échouer le deuxième article de la journée. Elles sont donc pures, et
 * testées (`tests/listings.test.ts`).
 */

/** « 49,90 », « 49.90 », « 129,50 € » → centimes. Null si ce n'en est pas un. */
export function priceToCents(saisie: string): number | null {
  const propre = saisie.replace(/\s|€/g, "").replace(",", ".");
  // `Number("")` vaut 0 et `parseFloat("12abc")` vaut 12 : sans cette garde,
  // une saisie fantaisiste deviendrait un prix silencieusement faux.
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  return Math.round(Number(propre) * 100);
}

/**
 * Référence interne, lisible et unique.
 *
 * Trois lettres de rayon, la date, le premier mot du nom, et quatre caractères
 * tirés au sort — assez pour que deux articles saisis dans la même minute ne se
 * marchent pas dessus, assez court pour être lu à voix haute au comptoir.
 */
export function buildSku(category: ProductCategory, name: string): string {
  const rayon = { GAME: "JEU", CONSOLE: "CON", COLLECTIBLE: "FIG", ACCESSORY: "ACC", PART: "PIE", MANGA: "FIG" }[category] ?? "ART";
  const jour = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const suffixe = Math.random().toString(36).slice(2, 6).toUpperCase();
  const mot = slugify(name).split("-")[0]?.slice(0, 6).toUpperCase() || "ART";
  return `${rayon}-${jour}-${mot}-${suffixe}`;
}
