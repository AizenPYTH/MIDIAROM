"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ShoppingBag, User, Wrench } from "lucide-react";
import { ROUTES } from "@/config/site";
import { cn } from "@/lib/utils/cn";

/**
 * Barre d'onglets basse du téléphone (écran M1).
 *
 * Les quatre destinations que l'on cherche au doigt, toujours à portée du
 * pouce. Icônes linéaires 1,5 px sans arrondi, jamais pleines ni colorées :
 * seule l'icône active passe en orange, comme le carré rempli du prototype.
 *
 * L'onglet « Compte » pointe vers l'espace client : le proxy renvoie vers la
 * connexion quand la session manque, inutile de le deviner côté navigateur.
 */
const TABS = [
  { href: ROUTES.home, label: "Accueil", Icon: House },
  { href: ROUTES.shop, label: "Boutique", Icon: ShoppingBag },
  { href: ROUTES.repair, label: "Réparer", Icon: Wrench },
  { href: ROUTES.account, label: "Compte", Icon: User },
];

/**
 * Les écrans dont la fiche de réparation *est* le contenu : elle y pose sa
 * propre barre d'action collée en bas (« Retour » + « Continuer · total »).
 * Deux barres superposées mangeraient 120 px de hauteur et cacheraient le
 * bouton qui compte — le design de référence ne montre d'ailleurs la barre
 * d'onglets que sur l'accueil.
 *
 * `/reparation/<modèle>/<panne>` en est exclu : c'est une page de présentation,
 * sans formulaire.
 */
function ownedByRepairForm(pathname: string): boolean {
  if (pathname === ROUTES.repair) return true;
  if (pathname.startsWith(`${ROUTES.checkout}/`)) return true;
  const model = pathname.startsWith(`${ROUTES.repair}/`) ? pathname.slice(ROUTES.repair.length + 1) : "";
  return Boolean(model) && !model.includes("/");
}

export function MobileTabBar() {
  const pathname = usePathname();
  if (ownedByRepairForm(pathname)) return null;
  return (
    <>
      {/* La barre flotte au-dessus du document : sans ce talon, elle recouvre la
          dernière ligne du pied de page. */}
      <div aria-hidden="true" className="safe-bottom lg:hidden" style={{ "--safe-pb": "64px" } as React.CSSProperties} />
      <nav
        aria-label="Navigation principale du téléphone"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-bg pt-3 lg:hidden"
        style={{ "--safe-pb": "14px" } as React.CSSProperties}
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = href === ROUTES.home ? pathname === ROUTES.home : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1.5 px-1 pb-0.5", active ? "text-ink" : "text-ink-muted")}>
              <Icon size={18} strokeWidth={1.5} className={active ? "text-sale" : undefined} aria-hidden="true" />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.06em]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
