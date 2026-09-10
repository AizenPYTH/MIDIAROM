import Link from "next/link";
import { ROUTES } from "@/config/site";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { isAdminRole, ROLE_LABELS } from "@/lib/orders/status";
import { getBrandSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminNav, type AdminMenuGroup, type AdminTab } from "@/components/admin/nav";
import { BrandMark } from "@/components/marketing/header";
import { logoutAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "QUALITY_CONTROL", "READY_TO_SHIP", "SHIPPED", "RETURN_REQUIRED", "REFUSED_QUOTE", "UNREPAIRABLE", "SAV", "DISPUTED"] as const;

function todayLabel(): string {
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Back-office du handoff : entièrement sombre (.theme-ink), header avec logo
 * inversé + pastille « admin », date, avatar carré ; ligne d'onglets avec
 * compteurs. Les modules existants (catalogue, contenu, réglages…) restent des
 * onglets, filtrés par rôle.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, brand] = await Promise.all([requireStaffOrRedirect(), getBrandSettings()]);
  const admin = isAdminRole(user.profile.role);
  const db = createSupabaseAdminClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [openOrders, expected, openSav, shopToPrepare, lowStock, newTradeIns] = await Promise.all([
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", [...OPEN_STATUSES])),
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", ["AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"])),
    count(db.from("sav_requests").select("id", { count: "exact", head: true }).in("status", ["NEW", "IN_ANALYSIS"])),
    count(db.from("shop_orders").select("id", { count: "exact", head: true }).in("status", ["PAID", "PREPARED"])),
    db.from("products").select("quantity, low_stock_threshold").eq("is_active", true).then((r) => (r.data ?? []).filter((p) => p.quantity <= p.low_stock_threshold).length),
    count(db.from("trade_in_requests").select("id", { count: "exact", head: true }).eq("status", "NEW")),
  ]);

  // Premier niveau : le travail quotidien de l'atelier. Tout le reste vit sous
  // « Plus », regroupé par usage. Aucune route n'est retirée.
  const primary: AdminTab[] = [
    { href: "/admin", label: "Réparations", admin: false, exact: true, count: openOrders },
    { href: "/admin/shop-orders", label: "Commandes", admin: false, count: shopToPrepare },
    { href: "/admin/stock", label: "Stock", admin: true, count: lowStock },
    { href: "/admin/customers", label: "Clients", admin: true },
  ].filter((t) => admin || !t.admin);

  const groups: AdminMenuGroup[] = [
    {
      label: "Gestion",
      items: [
        { href: "/admin/customers", label: "Clients", admin: true },
        { href: "/admin/technicians", label: "Techniciens", admin: true },
        { href: "/admin/catalog", label: "Catalogue", admin: true },
        { href: "/admin/trade-ins", label: "Reprises", admin: false, count: newTradeIns },
        { href: "/admin/content", label: "Contenu", admin: true },
        { href: "/admin/reviews", label: "Avis", admin: true },
      ],
    },
    {
      label: "Atelier",
      items: [
        { href: "/admin/reception", label: "Réception", admin: false, count: expected },
        { href: "/admin/sav", label: "SAV", admin: false, count: openSav },
        { href: "/admin/orders", label: "Dossiers", admin: false },
      ],
    },
    {
      label: "Configuration",
      items: [
        { href: "/admin/options", label: "Options", admin: true },
        { href: "/admin/packs", label: "Packs", admin: true },
        { href: "/admin/shipping", label: "Transport", admin: true },
        { href: "/admin/settings", label: "Paramètres", admin: true },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/admin/customers?role=staff", label: "Utilisateurs", admin: true },
        { href: "/admin/analytics", label: "Statistiques", admin: true },
        { href: "/admin/audit", label: "Audit", admin: true },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => admin || !i.admin) }))
    .filter((g) => g.items.length);

  const initials = `${user.profile.first_name?.[0] ?? ""}${user.profile.last_name?.[0] ?? ""}`.toUpperCase() || "··";

  return (
    <div className="theme-ink flex min-h-full flex-1 flex-col bg-bg text-ink">
      <header className="flex flex-wrap items-center gap-[18px] border-b border-border px-5 py-[13px]">
        <Link href={ROUTES.admin} className="flex items-center gap-[9px] whitespace-nowrap text-ink">
          <BrandMark name={brand.name} inverted size="sm" />
          <span className="border border-border-strong px-[7px] py-[3px] font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">admin</span>
        </Link>
        <span className="flex-1" />
        <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted">{todayLabel()}</span>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="flex h-[26px] w-[26px] items-center justify-center bg-accent font-mono text-[11px] font-semibold text-white" aria-hidden="true">
            {initials}
          </span>
          <span className="text-[13.5px]">
            {user.profile.first_name} — {ROLE_LABELS[user.profile.role].toLowerCase()}
          </span>
        </span>
        <span className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
          <Link href={ROUTES.home} className="hover:text-ink">
            Site
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="cursor-pointer hover:text-ink">
              Déconnexion
            </button>
          </form>
        </span>
      </header>
      <AdminNav tabs={primary} groups={groups} />
      <main className="min-w-0 flex-1 p-5">{children}</main>
    </div>
  );
}
