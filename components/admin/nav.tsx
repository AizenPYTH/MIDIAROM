"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface AdminTab {
  href: string;
  label: string;
  admin: boolean;
  exact?: boolean;
  count?: number;
}

export interface AdminMenuGroup {
  label: string;
  items: AdminTab[];
}

const TAB_CLASS = "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3.5 font-mono text-[12px] uppercase tracking-[0.07em] transition-colors";

function Count({ value }: { value: number }) {
  return <span className="bg-surface-strong px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">{value}</span>;
}

/**
 * Barre du back-office : cinq entrées de premier niveau pour le travail quotidien,
 * le reste regroupé sous « Plus ». Aucune route n'est retirée, seule la hiérarchie
 * visuelle change. Le menu est un `<details>` : il fonctionne sans JavaScript et se
 * referme après une navigation.
 */
export function AdminNav({ tabs, groups }: { tabs: AdminTab[]; groups: AdminMenuGroup[] }) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);

  const isActive = (item: AdminTab) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const activeInMenu = groups.some((g) => g.items.some(isActive));
  const pending = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + (i.count ?? 0), 0), 0);

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const el = menuRef.current;
      if (el?.open && event.target instanceof Node && !el.contains(event.target)) el.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) menuRef.current.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <nav className="flex items-stretch gap-[2px] border-b border-border px-5" aria-label="Back-office">
      <div className="flex min-w-0 flex-1 gap-[2px] overflow-x-auto">
        {tabs.map((item) => {
          const active = isActive(item);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(TAB_CLASS, active ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink")}>
              {item.label}
              {item.count ? <Count value={item.count} /> : null}
            </Link>
          );
        })}
      </div>

      {groups.length ? (
        <details ref={menuRef} className="relative shrink-0">
          <summary
            className={cn(TAB_CLASS, "cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden", activeInMenu ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink")}
            aria-label="Plus de sections"
          >
            Plus
            {pending ? <Count value={pending} /> : null}
            <span aria-hidden="true" className="text-[10px]">
              ▾
            </span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-px grid w-[min(560px,calc(100vw-2.5rem))] gap-x-6 gap-y-4 border border-border-strong bg-surface p-5 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group.label} className="min-w-0">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">{group.label}</p>
                <ul className="flex flex-col">
                  {group.items.map((item) => {
                    const active = isActive(item);
                    return (
                      <li key={`${group.label}-${item.href}`}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn("flex items-center justify-between gap-3 py-[7px] text-[14px] transition-colors", active ? "text-accent-light" : "text-ink hover:text-accent-light")}
                        >
                          {item.label}
                          {item.count ? <Count value={item.count} /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
