"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export interface AdminTab {
  href: string;
  label: string;
  admin: boolean;
  exact?: boolean;
  count?: number;
}

/** Ligne d'onglets du handoff : mono 12 px majuscules, actif souligné 2 px bleu, compteur en pastille. */
export function AdminNav({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-[2px] overflow-x-auto border-b border-border px-5" aria-label="Back-office">
      {tabs.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3.5 font-mono text-[12px] uppercase tracking-[0.07em] transition-colors", active ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {item.label}
            {item.count ? <span className="bg-surface-strong px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
