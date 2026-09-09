import Link from "next/link";
import { ROUTES } from "@/config/site";
import type { BrandSettings } from "@/config/brand";
import type { SocialSettings } from "@/lib/settings";

/** Pied de page du handoff : fond encre, mono 12 px, une ligne « © » et une ligne de liens séparés par « · ». */
export function SiteFooter({ brand, social, models }: { brand: BrandSettings; social: SocialSettings; models: { slug: string; name: string }[] }) {
  const socials = [
    { label: "Instagram", href: social.instagram },
    { label: "Facebook", href: social.facebook },
    { label: "TikTok", href: social.tiktok },
    { label: "YouTube", href: social.youtube },
    { label: "Google", href: social.google_business },
  ].filter((s) => s.href);

  const links: { label: string; href: string; external?: boolean }[] = [
    { label: "CGV", href: ROUTES.cgv },
    { label: "Confidentialité", href: ROUTES.privacy },
    { label: "Mentions légales", href: ROUTES.legal },
    { label: "Boutique", href: ROUTES.shop },
    { label: "Consoles", href: ROUTES.consoles },
    { label: "Reprise", href: ROUTES.tradeIn },
    { label: "Suivi réparation", href: ROUTES.tracking },
    { label: "Espace client", href: ROUTES.account },
    ...socials.map((s) => ({ label: s.label, href: s.href, external: true })),
  ];

  return (
    <footer className="mt-auto bg-ink-900 font-mono text-[12px] tracking-[0.04em] text-[#8a8271]">
      <div className="flex flex-wrap justify-between gap-[18px] px-6 py-7">
        <span>
          © {new Date().getFullYear()} {brand.name}
          {brand.city ? ` — ${brand.city}` : ""}
        </span>
        <span className="flex flex-wrap gap-x-2 gap-y-1">
          {links.map((link, i) => (
            <span key={link.label} className="contents">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {link.external ? (
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-paper">
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} className="hover:text-paper">
                  {link.label}
                </Link>
              )}
            </span>
          ))}
        </span>
      </div>
      {models.length ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1 border-t border-ink-700 px-6 py-4 text-[11px] text-[#6b6558]">
          <span className="uppercase tracking-[0.08em]">Réparation</span>
          {models.slice(0, 10).map((m) => (
            <span key={m.slug} className="contents">
              <span aria-hidden="true">·</span>
              <Link href={`${ROUTES.repair}/${m.slug}`} className="hover:text-paper">
                {m.name}
              </Link>
            </span>
          ))}
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.repair} className="hover:text-paper">
            Toutes les consoles
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.packaging} className="hover:text-paper">
            Emballage
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.trust} className="hover:text-paper">
            Confiance
          </Link>
        </div>
      ) : null}
    </footer>
  );
}
