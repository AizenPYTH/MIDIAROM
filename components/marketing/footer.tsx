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
    { label: "Consoles", href: ROUTES.consoles },
    { label: "Reprise", href: ROUTES.tradeIn },
    { label: "Suivi réparation", href: ROUTES.tracking },
    { label: "Espace client", href: ROUTES.account },
    ...socials.map((s) => ({ label: s.label, href: s.href, external: true })),
  ];

  return (
    <footer className="mt-auto border-t border-border font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-faint">
      <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-[18px] px-4 pb-[34px] pt-7 sm:flex-row sm:flex-wrap sm:justify-between sm:px-8 sm:py-8">
        <span>
          © {new Date().getFullYear()} {brand.name}
          {brand.city ? ` — ${brand.city}` : ""}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-2 sm:gap-y-1">
          {links.map((link, i) => (
            <span key={link.label} className="contents">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {link.external ? (
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-sale">
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} className="transition-colors hover:text-sale">
                  {link.label}
                </Link>
              )}
            </span>
          ))}
        </span>
      </div>
      {models.length ? (
        <div className="mx-auto flex w-full max-w-[1340px] flex-wrap gap-x-3 gap-y-1 border-t border-border px-4 py-4 text-[10.5px] text-ink-faint/70 sm:px-8">
          <span className="uppercase tracking-[0.08em]">Réparation</span>
          {models.slice(0, 10).map((m) => (
            <span key={m.slug} className="contents">
              <span aria-hidden="true">·</span>
              <Link href={`${ROUTES.repair}/${m.slug}`} className="transition-colors hover:text-sale">
                {m.name}
              </Link>
            </span>
          ))}
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.repair} className="transition-colors hover:text-sale">
            Toutes les consoles
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.packaging} className="transition-colors hover:text-sale">
            Emballage
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.trust} className="transition-colors hover:text-sale">
            Confiance
          </Link>
        </div>
      ) : null}
    </footer>
  );
}
