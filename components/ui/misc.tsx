import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Conteneur du handoff : max-width 1280 px, padding horizontal 24 px — ramené à
 * 16 px au téléphone, la gouttière minimale du handoff mobile. Les 8 px gagnés
 * de chaque côté font la différence entre deux colonnes de produits et une.
 */
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1340px] px-4 sm:px-8", className)} {...props} />;
}

/** Étiquette mono colorée au-dessus des titres (« 01 — Vente », « Atelier »…). */
export function Eyebrow({ tone = "sale", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "sale" | "repair" | "muted" }) {
  const color = tone === "sale" ? "text-sale" : tone === "repair" ? "text-accent" : "text-ink-muted";
  return <span className={cn("mono-label block", color, className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  eyebrowTone = "sale",
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: string;
  eyebrowTone?: "sale" | "repair" | "muted";
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow> : null}
        <h1 className="page-title mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">{title}</h1>
        {description ? <p className="mt-3 max-w-[42ch] text-[16.5px] leading-[1.55] text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ title, description, eyebrow, eyebrowTone = "sale", className, aside }: { title: string; description?: string; eyebrow?: string; eyebrowTone?: "sale" | "repair" | "muted"; className?: string; aside?: React.ReactNode }) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-6", className)}>
      <div>
        {eyebrow ? <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow> : null}
        <h2 className="mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{title}</h2>
        {description ? <p className="mt-3 max-w-[42ch] text-[16px] leading-[1.5] text-ink-soft">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start rounded-[24px] border border-dashed border-border-strong bg-surface-muted px-6 py-8", className)}>
      <p className="text-[15.5px] font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden="true" />;
}

/** Lignes clé / valeur séparées par un pointillé (bloc tarifs, devis). */
export function DescriptionList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("flex flex-col gap-2 text-[14.5px]", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 border-b border-dotted border-border-strong pb-2 sm:flex-row sm:justify-between sm:gap-4">
          <dt className="shrink-0 text-ink-muted">{item.label}</dt>
          <dd className="min-w-0 text-ink sm:text-right">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Price({ cents, className, prefix }: { cents: number; className?: string; prefix?: string }) {
  const value = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {prefix}
      {value}
    </span>
  );
}

/** Ligne label / prix pointillée (grille tarifaire, devis). */
export function PriceRow({ label, value, strong, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "mt-0.5 text-[16px] font-semibold" : "border-b border-dotted border-border-strong pb-1.5 text-[14.5px]", className)}>
      <span>{label}</span>
      <span className={cn("whitespace-nowrap font-mono", !strong && "text-ink-soft")}>{value}</span>
    </div>
  );
}
