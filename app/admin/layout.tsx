import Link from "next/link";
import { ROUTES } from "@/config/site";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { isAdminRole } from "@/lib/orders/status";
import { getBrandSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminNav, type AdminMenuGroup } from "@/components/admin/nav";
import { Backdrop, PulseDot } from "@/components/marketing/backdrop";
import { logoutAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

function todayLabel(): string {
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Espace réparateur, charte v4.
 *
 * Un seul écran, une seule tâche : la file de réparations et la fiche. Les
 * anciens onglets Commandes, Stock et Reprises ont disparu de la barre — le
 * magasin ne vend plus en ligne.
 *
 * Les modules qui ne relèvent pas du travail quotidien (catalogue et ses
 * tarifs, SAV, reprises, clients, réglages…) restent accessibles sous « Plus ».
 * Les retirer aurait coupé l'atelier de ses propres réglages : c'est de là que
 * se chiffrent les 1 189 prestations du catalogue.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, brand] = await Promise.all([requireStaffOrRedirect(), getBrandSettings()]);
  const admin = isAdminRole(user.profile.role);
  const db = createSupabaseAdminClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [expected, openSav, newTradeIns] = await Promise.all([
    count(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", ["AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"])),
    count(db.from("sav_requests").select("id", { count: "exact", head: true }).in("status", ["NEW", "IN_ANALYSIS"])),
    count(db.from("trade_in_requests").select("id", { count: "exact", head: true }).eq("status", "NEW")),
  ]);

  const groups: AdminMenuGroup[] = [
    {
      label: "Atelier",
      items: [
        { href: "/admin/reception", label: "Réception", admin: false, count: expected },
        { href: "/admin/sav", label: "SAV", admin: false, count: openSav },
        { href: "/admin/orders", label: "Tous les dossiers", admin: false },
      ],
    },
    {
      label: "Gestion",
      items: [
        { href: "/admin/catalog", label: "Catalogue et tarifs", admin: true },
        { href: "/admin/customers", label: "Clients", admin: true },
        { href: "/admin/trade-ins", label: "Reprises", admin: false, count: newTradeIns },
        { href: "/admin/technicians", label: "Techniciens", admin: true },
        { href: "/admin/content", label: "Contenu", admin: true },
        { href: "/admin/reviews", label: "Avis", admin: true },
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
        { href: "/admin/analytics", label: "Statistiques", admin: true },
        { href: "/admin/audit", label: "Audit", admin: true },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => admin || !i.admin) }))
    .filter((g) => g.items.length);

  const initials = `${user.profile.first_name?.[0] ?? ""}${user.profile.last_name?.[0] ?? ""}`.toUpperCase() || "··";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Backdrop />
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border px-4 py-3 backdrop-blur-[14px] sm:px-[30px]" style={{ background: "rgba(7,6,10,0.5)" }}>
        <Link href={ROUTES.admin} className="flex items-center gap-2.5 whitespace-nowrap text-ink">
          <PulseDot />
          <span className="font-display text-[17px] font-extrabold uppercase tracking-[-0.01em]">{brand.name}</span>
        </Link>
        <span className="chip border border-border text-ink-muted">Atelier</span>
        <span className="flex-1" />
        <span className="hidden whitespace-nowrap font-mono text-[11.5px] text-ink-muted sm:inline">{todayLabel()}</span>
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-[11px] font-semibold text-[var(--color-on-accent)]" style={{ background: "var(--gradient-cta)" }} aria-hidden="true">
            {initials}
          </span>
          <span className="hidden text-[14px] text-ink-soft sm:inline">{user.profile.first_name}</span>
        </span>
        <span className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
          <Link href={ROUTES.home} className="transition-colors hover:text-sale">
            Site
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="cursor-pointer transition-colors hover:text-sale">
              Sortir
            </button>
          </form>
        </span>
      </header>
      <AdminNav tabs={[]} groups={groups} />
      <main className="mx-auto min-w-0 w-full max-w-[1420px] flex-1 px-4 pb-[70px] pt-[34px] sm:px-[30px]">{children}</main>
    </div>
  );
}
