"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ClipboardList, FileText, Inbox, LayoutDashboard, LifeBuoy, Package, PackageCheck, Settings, ShieldCheck, Star, Truck, Users, UserCog, Wrench } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ALL = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, admin: false, exact: true },
  { href: "/admin/orders", label: "Dossiers", icon: ClipboardList, admin: false },
  { href: "/admin/reception", label: "Réception", icon: Inbox, admin: false },
  { href: "/admin/sav", label: "SAV", icon: LifeBuoy, admin: false },
  { href: "/admin/customers", label: "Clients", icon: Users, admin: true },
  { href: "/admin/catalog", label: "Catalogue", icon: Wrench, admin: true },
  { href: "/admin/options", label: "Options", icon: Boxes, admin: true },
  { href: "/admin/packs", label: "Packs", icon: PackageCheck, admin: true },
  { href: "/admin/shipping", label: "Transport", icon: Truck, admin: true },
  { href: "/admin/technicians", label: "Techniciens", icon: UserCog, admin: true },
  { href: "/admin/content", label: "Contenu", icon: FileText, admin: true },
  { href: "/admin/reviews", label: "Avis", icon: Star, admin: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, admin: true },
  { href: "/admin/settings", label: "Réglages", icon: Settings, admin: true },
  { href: "/admin/audit", label: "Audit", icon: ShieldCheck, admin: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ALL.filter((i) => isAdmin || !i.admin);
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-0" aria-label="Back-office">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium", active ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-surface-muted hover:text-ink")}>
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <span className="hidden"><Package /></span>
    </nav>
  );
}
