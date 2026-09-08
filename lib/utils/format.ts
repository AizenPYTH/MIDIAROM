const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Formats integer cents as "50,00 €". */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100);
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
