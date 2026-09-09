import Link from "next/link";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import { AccountLink, MobileNav } from "@/components/marketing/header-client";
import { CartLink } from "@/components/shop/cart-widgets";

const NAV = [
  { href: ROUTES.shop, label: "Boutique" },
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
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap">
      <span className={`${box} font-mono font-semibold tracking-[-0.02em] ${size === "sm" ? "px-[7px] py-[5px] text-[15px]" : "px-[9px] py-[7px] text-[19px]"}`}>{mark}</span>
      {label ? <span className={`font-extrabold uppercase tracking-[0.02em] ${size === "sm" ? "text-[15px]" : "text-[19px]"}`}>{label}</span> : null}
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

  return (
    <>
      {info.length ? (
        <div className="flex flex-wrap justify-center gap-5 bg-ink-900 px-6 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-[#d9d3c5]">
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
      ) : null}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-7 gap-y-3 border-b border-border bg-bg px-6 py-3.5">
        <Link href={ROUTES.home} aria-label={`${brand.name} — accueil`} className="text-ink">
          <BrandMark name={brand.name} />
        </Link>
        <nav className="hidden flex-1 flex-wrap items-center gap-[22px] whitespace-nowrap text-[14px] font-medium lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink hover:text-sale">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden sm:block">
            <AccountLink />
          </div>
          <Link href={ROUTES.tracking} className="hidden whitespace-nowrap border border-border-strong px-3.5 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink hover:border-ink sm:inline-block">
            Suivre ma réparation
          </Link>
          <CartLink />
          <MobileNav items={NAV} />
        </div>
      </header>
    </>
  );
}
