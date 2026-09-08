"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, UserRound, X } from "lucide-react";
import { ROUTES } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Shows "Mon espace" when a session cookie exists — purely cosmetic, security is server side. */
export function AccountLink() {
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
      setLoggedIn(false);
      return;
    }
  }, []);
  return (
    <Link
      href={loggedIn ? ROUTES.account : ROUTES.login}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-soft hover:bg-surface-muted hover:text-ink"
    >
      <UserRound className="h-4 w-4" aria-hidden="true" />
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
        className="flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-surface-muted"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open ? (
        <div id="mobile-nav" className="fixed inset-x-0 top-16 z-40 border-t border-border bg-surface shadow-md">
          <nav className="flex flex-col p-3" aria-label="Navigation mobile">
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-base font-medium text-ink hover:bg-surface-muted">
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <div onClick={() => setOpen(false)}>
                <AccountLink />
              </div>
              <ButtonLink href={ROUTES.repair} variant="accent" fullWidth onClick={() => setOpen(false)}>
                Faire réparer ma console
              </ButtonLink>
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
