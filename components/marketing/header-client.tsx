"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Shows "Mon espace" when a session cookie exists — purely cosmetic, security is server side. */
export function AccountLink({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
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
    <Link
      href={loggedIn ? ROUTES.account : ROUTES.login}
      onClick={onNavigate}
      className={className ?? "whitespace-nowrap px-2 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:text-sale"}
    >
      {loggedIn ? "Mon espace" : "Connexion"}
    </Link>
  );
}

/**
 * Menu du téléphone (écran M1) : un carré de 38 px à trois traits, qui ouvre un
 * panneau **plein écran** sur fond papier. Pas de glissement ni de fondu —
 * apparition immédiate, comme le reste du design.
 *
 * Le carré visible fait 38 px, mais la zone cliquable en fait 44 : c'est la
 * cible tactile minimale, et un bouton de menu manqué est le premier abandon.
 */
export function MobileNav({ items, brand }: { items: { href: string; label: string }[]; brand?: BrandSettings }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);
  const address = [brand?.address_line1, [brand?.postal_code, brand?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="Ouvrir le menu"
        className="flex h-11 w-11 cursor-pointer items-center justify-center"
      >
        <span className="flex h-[38px] w-[38px] flex-col items-center justify-center gap-[4px] border border-border-strong">
          <span className="block h-[1.5px] w-4 bg-ink" />
          <span className="block h-[1.5px] w-4 bg-ink" />
          <span className="block h-[1.5px] w-4 bg-ink" />
        </span>
      </button>
      {open ? (
        <div id="mobile-nav" className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">Menu</span>
            <button type="button" onClick={close} aria-label="Fermer le menu" className="flex h-11 w-11 cursor-pointer items-center justify-center text-[26px] leading-none text-ink">
              ×
            </button>
          </div>
          <nav className="flex flex-col divide-y divide-border" aria-label="Navigation mobile">
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="px-4 py-3.5 text-[24px] font-semibold leading-[1.2] text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-border bg-bg-alt px-4 py-5">
            <Link href={ROUTES.tracking} onClick={close} className="border border-ink px-4 py-[14px] text-center font-mono text-[12px] uppercase tracking-[0.06em] text-ink">
              Suivre ma réparation
            </Link>
            <AccountLink onNavigate={close} className="border border-border-strong px-4 py-[14px] text-center font-mono text-[12px] uppercase tracking-[0.06em] text-ink" />
            {address || brand?.phone || brand?.hours ? (
              <div className="mt-1 flex flex-col gap-1 font-mono text-[12px] leading-[1.5] text-ink-muted">
                {address ? <span>{address}</span> : null}
                {brand?.phone ? (
                  <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="text-ink">
                    {brand.phone}
                  </a>
                ) : null}
                {brand?.hours ? <span>{brand.hours}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
