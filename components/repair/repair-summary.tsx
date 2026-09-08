import { Check, Clock, ShieldCheck } from "lucide-react";
import { formatLeadTime, formatPrice, formatWarranty } from "@/lib/utils/format";
import type { Repair } from "@/lib/repair/catalog";

export function IncludedList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-ink-soft">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function RepairFacts({ repair }: { repair: Repair }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-md bg-surface-muted p-3">
        <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Délai indicatif
        </dt>
        <dd className="mt-0.5 font-medium text-ink">{formatLeadTime(repair.lead_time_days_min, repair.lead_time_days_max)}</dd>
      </div>
      <div className="rounded-md bg-surface-muted p-3">
        <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Garantie
        </dt>
        <dd className="mt-0.5 font-medium text-ink">{formatWarranty(repair.warranty_months)}</dd>
      </div>
    </dl>
  );
}

export function PriceTag({ cents, compareAt, size = "lg" }: { cents: number; compareAt?: number | null; size?: "md" | "lg" }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={size === "lg" ? "text-3xl font-bold text-primary" : "text-xl font-bold text-primary"}>{formatPrice(cents)}</span>
      {compareAt && compareAt > cents ? <span className="text-sm text-ink-muted line-through">{formatPrice(compareAt)}</span> : null}
      <span className="text-xs text-ink-muted">TTC</span>
    </div>
  );
}
