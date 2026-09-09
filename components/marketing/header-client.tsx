"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Shows "Mon espace" when a session cookie exists — purely cosmetic, security is server side. */
export function AccountLink({ onNavigate }: { onNavigate?: () => void }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data }) => active && setLoggedIn(Boolean(data.session)));
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => active && setLoggedIn(Boolean(session)));
      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    } catch {
      // Supabase not configured in this environment: keep the neutral "Connexion" link.
      return;
    }
  }, []);
  return (
    <Link href={loggedIn ? ROUTES.account : ROUTES.login} onClick={onNavigate} className="whitespace-nowrap px-2 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:text-sale">
      {loggedIn ? "Mon espace" : "Connexion"}
    </Link>
  );
}

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="border border-border-strong px-3 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:border-ink"
      >
        {open ? "Fermer" : "Menu"}
      </button>
      {open ? (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-[57px] z-40 overflow-y-auto border-t border-border bg-bg">
          <nav className="flex flex-col divide-y divide-border" aria-label="Navigation mobile">
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="px-6 py-4 text-[16px] font-medium text-ink hover:bg-surface-muted">
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 px-6 py-4">
              <AccountLink onNavigate={() => setOpen(false)} />
              <Link href={ROUTES.tracking} onClick={() => setOpen(false)} className="border border-border-strong px-3.5 py-[11px] text-center font-mono text-[12px] uppercase tracking-[0.06em] text-ink">
                Suivre ma réparation
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
