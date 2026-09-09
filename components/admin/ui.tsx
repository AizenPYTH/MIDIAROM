import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function StatCard({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "warning" | "info" | "success" }) {
  const body = (
    <div className={cn("rounded-lg border border-border bg-surface p-4", href && "transition-colors hover:border-accent")}>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink")}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-surface", className)}>
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted", className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={cn("border-b border-border px-3 py-2.5 align-top text-ink", className)} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function Section({ title, description, actions, children, className }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Tabs({ tabs, current, hrefFor }: { tabs: { key: string; label: string; count?: number }[]; current: string; hrefFor: (key: string) => string }) {
  return (
    <nav className="flex w-full max-w-full gap-1 overflow-x-auto border-b border-border" aria-label="Onglets">
      {tabs.map((t) => (
        <Link key={t.key} href={hrefFor(t.key)} className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium", current === t.key ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink")} aria-current={current === t.key ? "page" : undefined}>
          {t.label}
          {t.count ? <span className="rounded-full bg-surface-muted px-1.5 text-[11px] text-ink-soft">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-ink-muted">
      <span>
        Page {page} / {pages} · {total} résultat{total > 1 ? "s" : ""}
      </span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={hrefFor(page - 1)} className="rounded-md border border-border px-3 py-1 hover:bg-surface-muted">Précédent</Link> : null}
        {page < pages ? <Link href={hrefFor(page + 1)} className="rounded-md border border-border px-3 py-1 hover:bg-surface-muted">Suivant</Link> : null}
      </div>
    </div>
  );
}
