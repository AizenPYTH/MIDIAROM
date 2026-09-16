import Link from "next/link";
import { ROUTES } from "@/config/site";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { isAdminRole } from "@/lib/orders/status";
import { getBrandSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminNav, type AdminMenuGroup, type AdminTab } from "@/components/admin/nav";
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

  const initials = `${user.profile.first_name?.[0] ?? ""}${user.profile.last_name?.[0] ?? ""}`.toUpperCase() || "··";

  /**
   * Cinq onglets de premier niveau, toujours visibles.
   *
   * La barre n'en portait **aucun** : tout vivait dans le menu « Plus », qui,
   * sans onglet à sa gauche, se plaçait au bord gauche de l'écran et ouvrait
   * son panneau de 560 px vers la gauche — c'est-à-dire dans le vide. On
   * pouvait tenir le site sans jamais trouver où ajouter un article.
   */
  const tabs: AdminTab[] = [
    { href: "/admin", label: "Accueil", admin: false, exact: true },
    { href: "/admin/atelier", label: "Atelier", admin: false, count: expected },
    { href: "/admin/shop-orders", label: "Commandes", admin: false },
    { href: "/admin/stock", label: "Articles", admin: true },
    { href: "/admin/catalog", label: "Tarifs", admin: true },
  ];

  const groups: AdminMenuGroup[] = [
    {
      label: "Boutique",
      items: [
        { href: "/admin/annonces/nouvelle", label: "Ajouter un article", admin: true },
        { href: "/admin/trade-ins", label: "Reprises", admin: false, count: newTradeIns },
        { href: "/admin/customers", label: "Clients", admin: true },
        { href: "/admin/reviews", label: "Avis", admin: true },
      ],
    },
    {
      label: "Atelier",
      items: [
        { href: "/admin/reception", label: "Réception", admin: false, count: expected },
        { href: "/admin/sav", label: "SAV", admin: false, count: openSav },
        { href: "/admin/orders", label: "Tous les dossiers", admin: false },
        { href: "/admin/technicians", label: "Techniciens", admin: true },
      ],
    },
    {
      label: "Le site",
      items: [
        { href: "/admin/content", label: "Textes et pages", admin: true },
        { href: "/admin/settings", label: "Réglages", admin: true },
        { href: "/admin/options", label: "Options", admin: true },
        { href: "/admin/packs", label: "Packs", admin: true },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/admin/shipping", label: "Transport", admin: true },
        { href: "/admin/analytics", label: "Statistiques", admin: true },
        { href: "/admin/audit", label: "Audit", admin: true },
      ],
    },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Backdrop />
      {/*
        Bandeau graphite opaque.
        Il était posé sur `rgba(7,6,10,0.5)` : un noir à demi transparent qui,
        au-dessus d'un back-office blanc, donnait un gris moyen changeant au fil
        du défilement. Les encres de la charte sont faites pour le fond clair
        (#0f0f11, #6e6e73) : sur ce gris elles perdaient leur contraste, et les
        éléments clairs — les initiales, le rouge — disparaissaient.
        Le fond est désormais franc, et les textes prennent les encres « sur
        fond noir » déjà définies (--on-dark, --on-dark-2). Le survol passe par
        --red-on-dark : le rouge de marque ne tient que 3,3:1 sur du noir.
      */}
      <header
        className="sticky top-0 z-40 flex flex-wrap items-center gap-x-5 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-[30px]"
        style={{ background: "#0d0d10", borderBottomColor: "rgba(255,255,255,0.12)" }}
      >
        <Link href={ROUTES.admin} className="flex items-center gap-2.5 whitespace-nowrap text-[var(--on-dark)] transition-colors hover:text-[var(--red-on-dark)]">
          <PulseDot />
          <span className="font-display text-[17px] font-extrabold uppercase tracking-[-0.01em]">{brand.name}</span>
        </Link>
        <span className="chip border border-[rgba(255,255,255,0.22)] text-[var(--on-dark-2)]">Atelier</span>
        <span className="flex-1" />
        <span className="hidden whitespace-nowrap font-mono text-[11.5px] text-[var(--on-dark-2)] sm:inline">{todayLabel()}</span>
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-[11px] font-semibold text-white" style={{ background: "var(--red)" }} aria-hidden="true">
            {initials}
          </span>
          <span className="hidden text-[14px] text-[var(--on-dark)] sm:inline">{user.profile.first_name}</span>
        </span>
        <span className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--on-dark-2)]">
          <Link href={ROUTES.home} className="min-h-[44px] items-center transition-colors hover:text-[var(--red-on-dark)] sm:min-h-0 inline-flex">
            Site
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex min-h-[44px] cursor-pointer items-center transition-colors hover:text-[var(--red-on-dark)] sm:min-h-0">
              Sortir
            </button>
          </form>
        </span>
      </header>
      <AdminNav tabs={tabs.filter((t) => admin || !t.admin)} groups={groups} />
      <main className="page-wrap min-w-0 flex-1 px-4 pb-[70px] pt-[34px] sm:px-[30px]">{children}</main>
    </div>
  );
}
