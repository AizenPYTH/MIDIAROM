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
 * Le menu du téléphone : un carré de 44 px à trois traits, qui ouvre un tiroir.
 *
 * Le panneau ne prend plus tout l'écran. Il descend du haut, sur un voile
 * sombre, et laisse voir la page en dessous : on sait d'où l'on vient et un
 * appui à côté referme. Les entrées sont des lignes de 17,5 px séparées d'un
 * filet, avec une flèche à droite — sept destinations tiennent alors sans
 * défilement, là où les titres de 26 px de l'ancien panneau en montraient
 * quatre. Chaque ligne fait au moins 44 px de haut : c'est la cible tactile
 * minimale, et une entrée de menu manquée est le premier abandon.
 *
 * Pas de glissement ni de fondu — apparition immédiate, comme le reste du
 * design. La touche Échap referme, et le défilement de la page est bloqué tant
 * que le tiroir est ouvert.
 */
export function MobileNav({ items, brand }: { items: { href: string; label: string }[]; brand?: BrandSettings }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
        className="flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border border-border-strong bg-surface"
      >
        <span aria-hidden="true" className="block h-[1.5px] w-[17px] bg-ink" />
        <span aria-hidden="true" className="block h-[1.5px] w-[17px] bg-ink" />
        <span aria-hidden="true" className="block h-[1.5px] w-[17px] bg-ink" />
      </button>
      {open ? (
        <div
          id="mobile-nav"
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ backgroundColor: "rgba(16,17,20,0.55)" }}
          onClick={(e) => {
            // Le voile referme ; le panneau, lui, garde ses clics.
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="mx-auto max-w-[540px] bg-bg px-4 pb-5 pt-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Menu</span>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer le menu"
                className="flex h-11 w-11 cursor-pointer items-center justify-center border border-border-strong bg-surface text-[19px] leading-none text-ink"
              >
                ×
              </button>
            </div>

            <nav className="mt-1.5 flex flex-col" aria-label="Navigation mobile">
              {items.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={`flex min-h-[44px] items-center justify-between gap-3 border-t border-border py-[15px] text-[17.5px] text-ink ${i === 0 ? "font-bold" : "font-medium"}`}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="text-[15px] text-ink-faint">
                    →
                  </span>
                </Link>
              ))}
              <span aria-hidden="true" className="block border-t border-border" />
            </nav>

            <div className="mt-4 flex gap-0.5">
              <Link
                href={ROUTES.tracking}
                onClick={close}
                className="flex-1 border border-border-strong bg-surface p-[15px] text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink"
              >
                Suivi
              </Link>
              <AccountLink
                onNavigate={close}
                className="flex-1 border border-border-strong bg-surface p-[15px] text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink"
              />
            </div>

            <Link
              href={ROUTES.repair}
              onClick={close}
              className="mt-0.5 block bg-red p-[15px] text-center text-[16.5px] font-semibold text-white"
            >
              Demander un diagnostic
            </Link>

            {address || brand?.phone || brand?.hours ? (
              <div className="mt-4 flex flex-col gap-1 font-mono text-[11.5px] leading-[1.6] text-ink-faint">
                {address ? <span>{address}</span> : null}
                {brand?.phone ? (
                  <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="inline-flex min-h-[44px] items-center text-ink">
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
    <nav className="flex flex-wrap gap-x-[15px] gap-y-1.5 text-[14.5px] font-medium min-[1560px]:gap-x-[22px]" aria-label="Navigation principale">
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
 * fabriquée à côté. Plafonnée à 340 px : au-delà, elle pousse le bouton rouge
 * hors de la ligne unique de l'en-tête.
 */
export function SearchField() {
  return (
    <form
      action={ROUTES.shop}
      role="search"
      // Sous lg, la recherche prend sa ligne entière, sous le logo : c'est le
      // premier geste d'un visiteur de boutique, elle ne partage pas sa ligne
      // avec le panier et le bouton menu.
      className="order-3 flex w-full min-w-0 max-w-none flex-[1_1_100%] items-center gap-2 border border-border-strong bg-surface px-3 py-[11px] lg:order-none lg:w-auto lg:flex-[1_1_130px] lg:px-[11px] lg:py-2.5 min-[1280px]:max-w-[340px] min-[1560px]:px-[13px]"
    >
      <span aria-hidden="true" className="font-mono text-[12px] text-ink-faint">
        ⌕
      </span>
      <input
        type="search"
        name="q"
        id="recherche-boutique"
        placeholder="Rechercher un jeu, une figurine"
        aria-label="Rechercher dans la boutique"
        className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint lg:text-[14.5px]"
      />
    </form>
  );
}
