/**
 * Prix indicatif d'un jeu de démonstration.
 *
 * **Ce prix n'est pas un prix de vente.** Les jeux de la vitrine ne sont pas au
 * catalogue : ils n'ont ni stock, ni marge, ni fournisseur. Mais une grille de
 * produits sans prix ne ressemble pas à une boutique, et c'est une boutique
 * qu'on montre. On calcule donc un ordre de grandeur, et **l'interface dit
 * partout qu'il est indicatif** — carte, fiche, panier impossible.
 *
 * Le calcul est déterministe et lisible plutôt qu'aléatoire : deux rendus
 * successifs donnent le même prix, et n'importe qui peut vérifier d'où il
 * sort. Il suit la décote réelle du marché du jeu vidéo — plein tarif à la
 * sortie, puis une baisse par palier — et s'arrondit aux prix pratiqués en
 * rayon.
 *
 * Dès qu'un vrai produit entre au catalogue, son prix réel prend la place et
 * ce fichier n'est plus consulté pour lui.
 */

/** Paliers de décote, du plus récent au plus ancien. */
const PALIERS: { ageMax: number; prixCents: number }[] = [
  { ageMax: 0, prixCents: 6999 },
  { ageMax: 1, prixCents: 4999 },
  { ageMax: 2, prixCents: 3999 },
  { ageMax: 4, prixCents: 2999 },
  { ageMax: 7, prixCents: 1999 },
  { ageMax: 12, prixCents: 1499 },
];
/** Au-delà du dernier palier : prix plancher de l'occasion ancienne. */
const PLANCHER_CENTS = 999;
/** Un jeu très bien noté se négocie plus cher, même vieux. */
const PRIME_CULTE_CENTS = 500;
const SEUIL_CULTE = 88;

export function demoPriceCents(releaseDate: string | null, rating: number | null): number {
  const annee = Number(releaseDate?.slice(0, 4));
  if (!Number.isInteger(annee)) return PLANCHER_CENTS;
  const age = new Date().getUTCFullYear() - annee;
  const base = PALIERS.find((p) => age <= p.ageMax)?.prixCents ?? PLANCHER_CENTS;
  const prime = rating !== null && rating >= SEUIL_CULTE && age > 2 ? PRIME_CULTE_CENTS : 0;
  return base + prime;
}

/** La mention qui accompagne obligatoirement ce prix, partout où il s'affiche. */
export const DEMO_PRICE_NOTE = "Prix indicatif";
