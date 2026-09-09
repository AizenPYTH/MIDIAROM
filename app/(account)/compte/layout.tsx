import Link from "next/link";
import { ROUTES } from "@/config/site";
import { Container } from "@/components/ui/misc";
import { requireUserOrRedirect } from "@/lib/security/auth";
import { isStaffRole } from "@/lib/orders/status";
import { getBrandSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/marketing/header";
import { logoutAction } from "@/app/(auth)/actions";
import { AccountNav } from "@/components/customer/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [user, brand] = await Promise.all([requireUserOrRedirect(ROUTES.account), getBrandSettings()]);
  const items = [
    { href: ROUTES.accountOrders, label: "Mes réparations" },
    { href: ROUTES.accountShopOrders, label: "Mes commandes" },
    { href: ROUTES.accountTradeIns, label: "Mes reprises" },
    { href: ROUTES.accountProfile, label: "Mon profil" },
    { href: ROUTES.accountAddresses, label: "Mes adresses" },
  ];
  return (
    <>
      <SiteHeader brand={brand} />
      <main className="flex-1">
        <Container className="grid gap-8 py-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-14">
          <aside className="min-w-0">
            <span className="mono-label text-ink-muted">Espace client</span>
            <p className="mt-2 truncate text-[16px] font-semibold text-ink">
              {user.profile.first_name} {user.profile.last_name}
            </p>
            <p className="break-all font-mono text-[11.5px] text-ink-muted">{user.email}</p>
            <AccountNav items={items} />
            {isStaffRole(user.profile.role) ? (
              <Link href={ROUTES.admin} className="mt-3 block border border-border-strong px-3.5 py-2.5 text-center font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:border-ink">
                Back-office
              </Link>
            ) : null}
            <form action={logoutAction} className="mt-4 border-t border-border pt-3">
              <button type="submit" className="w-full cursor-pointer py-2 text-left font-mono text-[12px] uppercase tracking-[0.06em] text-ink-muted hover:text-ink">
                Se déconnecter
              </button>
            </form>
          </aside>
          <div className="min-w-0">{children}</div>
        </Container>
      </main>
    </>
  );
}
