"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/** Navigation de l'espace client : filets 1 px, entrée active en bloc encre. */
export function AccountNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex gap-px overflow-x-auto border border-border bg-border lg:flex-col" aria-label="Espace client">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={cn("shrink-0 whitespace-nowrap px-3.5 py-3 text-[14px] font-medium", active ? "bg-ink-900 text-paper" : "bg-surface text-ink hover:bg-surface-muted")} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
