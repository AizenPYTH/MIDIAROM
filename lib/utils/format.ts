const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Formats integer cents as "50,00 €". */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
}

/**
 * Prix d'une prestation du catalogue.
 *
 * Trois cas, et un seul champ pour les départager : `price_is_provisional`.
 * Le montant ne décide de rien — il ne l'a jamais bien fait, puisqu'un tarif à
 * zéro peut vouloir dire deux choses opposées :
 *
 *   price_is_provisional = true            → « Nécessite un devis »
 *   false, price_cents  = 0                → « Gratuit »
 *   false, price_cents  > 0                → « 50,00 € »
 *
 * L'ancienne version répondait « Sur devis » dès que le montant valait zéro :
 * une prestation offerte était donc impossible à annoncer, et le catalogue ne
 * savait pas distinguer « je ne sais pas encore » de « je ne facture rien ».
 */
export function formatRepairPrice(cents: number, provisional: boolean): string {
  if (provisional) return "Nécessite un devis";
  return cents === 0 ? "Gratuit" : formatPrice(cents);
}

/** "+34,90 €" for add-ons. */
export function formatPriceDelta(cents: number): string {
  if (cents === 0) return "Inclus";
  return `${cents > 0 ? "+" : "−"}${formatPrice(Math.abs(cents))}`;
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Europe/Paris",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, true);
}

export function formatLeadTime(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Selon diagnostic";
  if (min != null && max != null) {
    if (min === max) return `${min} jour${min > 1 ? "s" : ""} en atelier`;
    return `${min} à ${max} jours en atelier`;
  }
  const value = (min ?? max) as number;
  return `environ ${value} jour${value > 1 ? "s" : ""} en atelier`;
}

export function formatWarranty(months: number): string {
  if (months <= 0) return "Sans garantie spécifique";
  return `${months} mois sur l'intervention`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, "0")}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
