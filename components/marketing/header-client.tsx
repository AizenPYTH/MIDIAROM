"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
      className={className ?? "whitespace-nowrap font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft transition-colors hover:text-red"}
    >
      {loggedIn ? "Mon espace" : "Compte"}
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
        {/* Burger de la charte v4 : carré arrondi, deux traits. */}
        <span className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] border border-border-strong">
          <span className="block h-[1.5px] w-[18px] bg-ink" />
          <span className="block h-[1.5px] w-[18px] bg-ink" />
        </span>
      </button>
      {open ? (
        <div id="mobile-nav" className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">Menu</span>
            <button type="button" onClick={close} aria-label="Fermer le menu" className="flex h-11 w-11 cursor-pointer items-center justify-center text-[26px] leading-none text-ink">
              ×
            </button>
          </div>
          <nav className="flex flex-col divide-y divide-border" aria-label="Navigation mobile">
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="px-4 py-3.5 font-display text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-ink transition-colors hover:text-red">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-border px-4 py-5">
            <Link href={ROUTES.tracking} onClick={close} className="bg-red px-4 py-[15px] text-center font-mono text-[11.5px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-ink">
              Suivre ma réparation
            </Link>
            <AccountLink onNavigate={close} className="border border-ink px-4 py-[15px] text-center font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink" />
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

/**
 * La deuxième ligne de l'en-tête : les rayons.
 *
 * Découpée en deux, et pour une raison précise. `NavList` ne fait que dessiner ;
 * `PrimaryNav` lit l'adresse courante pour savoir quel onglet souligner. Comme
 * `useSearchParams()` force le rendu côté client, l'en-tête étant présent sur
 * toutes les pages, il empêcherait le pré-rendu statique de `/panier` et de
 * `/suivi` s'il n'était pas isolé derrière une frontière `<Suspense>`. La
 * navigation s'affiche donc toujours ; seul le soulignement attend.
 */
export function NavList({ items, courant }: { items: { href: string; label: string }[]; courant: string }) {
  return (
    <nav className="page-wrap mt-[11px] flex flex-wrap gap-x-[22px] gap-y-1.5 text-[14.5px] font-medium" aria-label="Navigation principale">
      {items.map((item) => {
        const actif = item.href === courant;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={actif ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 pb-[3px] text-ink transition-colors ${actif ? "border-red" : "border-transparent hover:border-border-strong"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * L'onglet actif, souligné de 2 px de rouge — l'un des six emplois autorisés de
 * l'accent. Il se déduit du chemin **et** du paramètre `cat` : sans lui,
 * « Jeux vidéo » et « Consoles » pointent tous deux sur /boutique et
 * s'allumeraient ensemble.
 */
export function PrimaryNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const cat = useSearchParams().get("cat");
  return <NavList items={items} courant={`${pathname}${cat ? `?cat=${cat}` : ""}`} />;
}

/**
 * La recherche, visible dès le premier écran.
 *
 * Un `<form>` en GET vers le catalogue : elle fonctionne sans JavaScript, et
 * elle atterrit sur la vraie page de résultats plutôt que sur une liste
 * fabriquée à côté. Plafonnée à 420 px pour que le bouton rouge reste à sa
 * droite sur les largeurs intermédiaires.
 */
export function SearchField() {
  return (
    <form
      action={ROUTES.shop}
      role="search"
      className="flex min-w-0 max-w-[420px] flex-[1_1_220px] items-center gap-2.5 rounded-[8px] border border-border-strong bg-surface-muted px-3.5 py-2.5"
    >
      <span aria-hidden="true" className="font-mono text-[12px] text-ink-muted">
        ⌕
      </span>
      <input
        type="search"
        name="q"
        id="recherche-boutique"
        placeholder="Rechercher un jeu, une console, une figurine"
        aria-label="Rechercher dans la boutique"
        className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted sm:text-[14.5px]"
      />
    </form>
  );
}
