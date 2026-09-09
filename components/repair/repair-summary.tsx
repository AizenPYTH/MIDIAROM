import { formatLeadTime, formatPrice, formatWarranty } from "@/lib/utils/format";
import type { Repair } from "@/lib/repair/catalog";

export function IncludedList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-baseline gap-2.5 text-[14.5px] text-ink-soft">
          <span className="font-mono text-[12px] text-accent" aria-hidden="true">
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function RepairFacts({ repair }: { repair: Repair }) {
  return (
    <dl className="grid grid-cols-2 gap-px border border-border bg-border">
      <div className="bg-surface-muted p-3">
        <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Délai indicatif</dt>
        <dd className="mt-1 text-[14px] font-semibold text-ink">{formatLeadTime(repair.lead_time_days_min, repair.lead_time_days_max)}</dd>
      </div>
      <div className="bg-surface-muted p-3">
        <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Garantie</dt>
        <dd className="mt-1 text-[14px] font-semibold text-ink">{formatWarranty(repair.warranty_months)}</dd>
      </div>
    </dl>
  );
}

export function PriceTag({ cents, compareAt, size = "lg" }: { cents: number; compareAt?: number | null; size?: "md" | "lg" }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={size === "lg" ? "font-mono text-[30px] font-semibold text-ink" : "font-mono text-[20px] font-semibold text-ink"}>{formatPrice(cents)}</span>
      {compareAt && compareAt > cents ? <span className="font-mono text-[13px] text-ink-muted line-through">{formatPrice(compareAt)}</span> : null}
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">TTC</span>
    </div>
  );
}
