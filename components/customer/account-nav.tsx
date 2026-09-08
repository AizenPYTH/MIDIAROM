"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, MapPin, UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ICONS = { FolderOpen, MapPin, UserRound };

export function AccountNav({ items }: { items: { href: string; label: string; icon: keyof typeof ICONS }[] }) {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto lg:flex-col" aria-label="Espace client">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium", active ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-surface-muted hover:text-ink")} aria-current={active ? "page" : undefined}>
            <Icon className="h-4 w-4" aria-hidden="true" /> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
