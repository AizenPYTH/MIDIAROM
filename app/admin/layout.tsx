import Link from "next/link";
import { LogOut, Wrench } from "lucide-react";
import { ROUTES } from "@/config/site";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { isAdminRole, ROLE_LABELS } from "@/lib/orders/status";
import { getBrandSettings } from "@/lib/settings";
import { AdminNav } from "@/components/admin/nav";
import { logoutAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, brand] = await Promise.all([requireStaffOrRedirect(), getBrandSettings()]);
  const admin = isAdminRole(user.profile.role);
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="flex w-full flex-col border-b border-border bg-surface lg:min-h-screen lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:py-4">
          <Link href={ROUTES.admin} className="flex items-center gap-2 font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
              <Wrench className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="truncate">{brand.name}</span>
          </Link>
          <Link href={ROUTES.home} className="text-xs text-ink-muted hover:text-ink lg:hidden">
            Site
          </Link>
        </div>
        <AdminNav isAdmin={admin} />
        <div className="mt-auto hidden border-t border-border px-4 py-3 text-xs text-ink-muted lg:block">
          <p className="font-medium text-ink">
            {user.profile.first_name} {user.profile.last_name}
          </p>
          <p>{ROLE_LABELS[user.profile.role]}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link href={ROUTES.home} className="hover:text-ink">
              Voir le site
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="flex items-center gap-1 hover:text-ink">
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Déconnexion
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-bg">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
