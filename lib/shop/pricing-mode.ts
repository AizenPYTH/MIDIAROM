/**
 * Comment se facture une prestation de réparation.
 *
 * Deux modes seulement, et un seul champ en base pour les porter :
 * `repairs.price_is_provisional`. Le montant ne dit rien à lui seul — un tarif
 * à zéro peut désigner une prestation offerte comme une prestation dont le prix
 * n'est pas encore arbitré.
 *
 *   FIXED  · price_is_provisional = false · le montant fait foi (0 € = offert)
 *   QUOTE  · price_is_provisional = true  · aucun montant, le devis tranchera
 *
 * Ce module ne dépend de rien : il est lu par le serveur (liste du catalogue,
 * actions) comme par le navigateur (contrôle de saisie).
 */
export type PricingMode = "FIXED" | "QUOTE";

export function pricingModeOf(provisional: boolean): PricingMode {
  return provisional ? "QUOTE" : "FIXED";
}

/** Résumé d'une ligne de catalogue : « Prix fixe — 50,00 € », « Gratuit » ou « Nécessite un devis ». */
export function pricingSummary(priceCents: number, provisional: boolean): string {
  if (provisional) return "Nécessite un devis";
  if (priceCents === 0) return "Gratuit";
  return `Prix fixe — ${(priceCents / 100).toFixed(2).replace(".", ",")} €`;
}
