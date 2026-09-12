import Link from "next/link";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import { AccountLink, MobileNav } from "@/components/marketing/header-client";

const NAV = [
  { href: ROUTES.repair, label: "Réparation" },
  { href: ROUTES.consoles, label: "Consoles" },
  { href: ROUTES.tradeIn, label: "Reprise" },
  { href: ROUTES.tracking, label: "Suivi" },
  { href: ROUTES.contact, label: "Le magasin" },
];

/** Logo typographique du handoff : carré encre avec le premier mot, puis le reste en capitales. */
export function BrandMark({ name, inverted, size = "md" }: { name: string; inverted?: boolean; size?: "md" | "sm" }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const mark = first ?? name;
  const label = rest.join(" ") || null;
  const box = inverted ? "bg-paper text-ink-900" : "bg-ink-900 text-paper";
  // Un cran plus petit au téléphone : le logo, le panier et le menu doivent tenir
  // sur une seule ligne à 360 px, sans que le header s'enroule.
  const boxSize = size === "sm" ? "px-[7px] py-[5px] text-[15px]" : "px-[7px] py-[5px] text-[16px] sm:px-[9px] sm:py-[7px] sm:text-[19px]";
  const labelSize = size === "sm" ? "text-[15px]" : "text-[16px] sm:text-[19px]";
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap">
      <span className={`${box} font-mono font-semibold tracking-[-0.02em] ${boxSize}`}>{mark}</span>
      {/* Mot-symbole en capitales : « MÉDI@ROM ». L'arobase de l'enseigne vient
          du nom enregistré dans Réglages, la mise en capitales de l'affichage. */}
      {label ? <span className={`font-extrabold uppercase tracking-[0.02em] ${labelSize}`}>{label}</span> : null}
    </span>
  );
}

/** Bandeau d'infos + header sticky du handoff (adresse, ancienneté, téléphone, horaires). */
export function SiteHeader({ brand }: { brand: BrandSettings }) {
  const info = [
    [brand.address_line1, [brand.postal_code, brand.city].filter(Boolean).join(" ")].filter(Boolean).join(" — "),
    brand.founded_year ? `Depuis ${brand.founded_year}` : "",
    brand.phone,
    brand.hours,
  ].filter(Boolean);

  // Au téléphone le bandeau tient sur une ligne : téléphone et horaires en
  // sortent — ils restent dans la section magasin, le pied de page et le menu.
  const shortInfo = [brand.address_line1, brand.city, brand.founded_year ? `depuis ${brand.founded_year}` : ""].filter(Boolean).join(" · ");

  return (
    <>
      {info.length ? (
        <>
          <div className="truncate bg-ink-900 px-4 py-[7px] text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-[#d9d3c5] sm:hidden">{shortInfo}</div>
          <div className="hidden flex-wrap justify-center gap-5 bg-ink-900 px-6 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-[#d9d3c5] sm:flex">
            {info.map((item, i) => (
              <span key={item} className="contents">
                {i > 0 ? (
                  <span className="text-[#6b6558]" aria-hidden="true">
                    /
                  </span>
                ) : null}
                <span>{item}</span>
              </span>
            ))}
          </div>
        </>
      ) : null}
      {/* z-40, au-dessus de la barre d'onglets basse (z-30) : le header pose un
          contexte d'empilement, et le panneau plein écran du menu, qui vit à
          l'intérieur, ne peut pas le dépasser — il passerait sous la barre. */}
      <header className="sticky top-0 z-40 flex items-center gap-x-7 gap-y-3 border-b border-border bg-bg px-4 py-2.5 sm:px-6 sm:py-3.5 lg:flex-wrap">
        <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="min-w-0 text-ink">
          <BrandMark name={brand.name} />
        </Link>
        <nav className="hidden flex-1 flex-wrap items-center gap-[22px] whitespace-nowrap text-[14px] font-medium lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink hover:text-sale">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <AccountLink />
          </div>
          <Link href={ROUTES.tracking} className="hidden whitespace-nowrap border border-border-strong chip text-ink hover:border-ink sm:inline-block">
            Suivre ma réparation
          </Link>
          <MobileNav items={NAV} brand={brand} />
        </div>
      </header>
    </>
  );
}
