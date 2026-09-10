import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Cellule KPI du handoff : étiquette mono, valeur 26 px / 800, note 12.5 px.
 *
 * Au téléphone (écran M5), les cellules deviennent une bande à défilement
 * horizontal : étiquette et valeur d'un cran plus petites, note explicative
 * retirée — elle doublerait la hauteur de la bande pour un détail.
 */
export function StatCard({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "warning" | "info" | "success" }) {
  const body = (
    <div className={cn("flex h-full min-w-[132px] flex-col gap-[5px] bg-surface px-4 py-3.5 sm:min-w-0 sm:px-5 sm:py-4", href && "transition-colors hover:bg-surface-muted")}>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-muted sm:text-[10.5px]">{label}</span>
      <strong className={cn("text-[22px] font-extrabold tracking-[-0.02em] sm:text-[26px]", tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "info" ? "text-info" : "text-ink")}>{value}</strong>
      {hint ? <span className="hidden text-[12.5px] text-ink-muted sm:block">{hint}</span> : <span className="hidden text-[12.5px] text-transparent sm:block" aria-hidden="true">·</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Bandeau KPI : cellules séparées par des filets de 1 px. */
export function StatBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("scroll-strip gap-px border-y border-border bg-border sm:grid sm:[grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]", className)}>{children}</div>;
}

/**
 * Tableau du back-office. `cards` le fait basculer en cartes empilées au
 * téléphone (écran M5) : chaque `Td` doit alors porter un `label`, qui remplace
 * l'en-tête masqué. Sans `cards`, le tableau défile horizontalement comme sur
 * le bureau — le compromis retenu pour les listes de consultation.
 */
export function Table({ children, className, minWidth = 640, cards }: { children: React.ReactNode; className?: string; minWidth?: number; cards?: boolean }) {
  return (
    <div className={cn("overflow-x-auto border border-border", cards && "max-sm:border-0 max-sm:bg-transparent", className)}>
      <table className={cn("w-full text-[14px]", cards && "table-cards")} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("bg-surface px-3.5 py-[11px] text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.08em] text-ink-muted", className)}>{children}</th>;
}

export function Td({ children, className, colSpan, label }: { children?: React.ReactNode; className?: string; colSpan?: number; label?: string }) {
  return (
    <td className={cn("border-t border-border px-3.5 py-3 align-top text-ink", className)} colSpan={colSpan} data-label={label}>
      {children}
    </td>
  );
}

export function Section({ title, description, actions, children, className }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border border-border-strong bg-surface", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{title}</h2>
          {description ? <p className="mt-1 text-[12.5px] text-ink-faint">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

/** Onglets mono majuscules, actif souligné 2 px bleu (fiche dossier, listes). */
export function Tabs({ tabs, current, hrefFor }: { tabs: { key: string; label: string; count?: number }[]; current: string; hrefFor: (key: string) => string }) {
  return (
    <nav className="flex w-full max-w-full gap-[2px] overflow-x-auto border-b border-border" aria-label="Onglets">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          className={cn("-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3.5 font-mono text-[12px] uppercase tracking-[0.07em]", current === t.key ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink")}
          aria-current={current === t.key ? "page" : undefined}
        >
          {t.label}
          {t.count ? <span className="bg-surface-strong px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Filtres en boutons mono (« Tout », statuts…) ; actif = papier sur encre. */
export function FilterChips({ items, current, hrefFor }: { items: { key: string; label: string }[]; current: string; hrefFor: (key: string) => string }) {
  return (
    <div className="scroll-strip gap-2 sm:flex-wrap">
      {items.map((it) => (
        <Link key={it.key} href={hrefFor(it.key)} className={cn("whitespace-nowrap border border-border-strong px-[11px] py-[13px] font-mono text-[11px] uppercase tracking-[0.06em] sm:py-[9px]", current === it.key ? "bg-paper text-ink-900" : "bg-transparent text-ink-faint hover:text-ink")} aria-current={current === it.key ? "true" : undefined}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between font-mono text-[11.5px] text-ink-muted">
      <span>
        Page {page} / {pages} · {total} résultat{total > 1 ? "s" : ""}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="border border-border-strong px-3 py-1.5 uppercase tracking-[0.06em] hover:text-ink">
            Précédent
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className="border border-border-strong px-3 py-1.5 uppercase tracking-[0.06em] hover:text-ink">
            Suivant
          </Link>
        ) : null}
      </div>
    </div>
  );
}
