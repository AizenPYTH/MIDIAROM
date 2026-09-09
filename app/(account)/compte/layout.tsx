import Link from "next/link";
import { FolderOpen, LogOut, MapPin, UserRound, Wrench } from "lucide-react";
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
    { href: ROUTES.accountOrders, label: "Mes dossiers", icon: "FolderOpen" as const },
    { href: ROUTES.accountProfile, label: "Mon profil", icon: "UserRound" as const },
    { href: ROUTES.accountAddresses, label: "Mes adresses", icon: "MapPin" as const },
  ];
  return (
    <>
      <SiteHeader brandName={brand.name} />
      <main className="flex-1">
        <Container className="grid gap-8 py-8 lg:grid-cols-[240px_1fr] lg:py-12">
          <aside className="min-w-0">
            <p className="truncate px-3 text-sm font-semibold text-ink">
              {user.profile.first_name} {user.profile.last_name}
            </p>
            <p className="break-all px-3 text-xs text-ink-muted">{user.email}</p>
            <AccountNav items={items} />
            {isStaffRole(user.profile.role) ? (
              <Link href={ROUTES.admin} className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-surface-muted">
                <Wrench className="h-4 w-4" aria-hidden="true" /> Back-office
              </Link>
            ) : null}
            <form action={logoutAction} className="mt-4 border-t border-border pt-3">
              <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-muted hover:bg-surface-muted hover:text-ink">
                <LogOut className="h-4 w-4" aria-hidden="true" /> Se déconnecter
              </button>
            </form>
          </aside>
          <div className="min-w-0">{children}</div>
        </Container>
      </main>
      <span className="hidden">
        <FolderOpen /> <UserRound /> <MapPin />
      </span>
    </>
  );
}
