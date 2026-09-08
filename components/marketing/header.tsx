import Link from "next/link";
import { Wrench } from "lucide-react";
import { ROUTES } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { MobileNav, AccountLink } from "@/components/marketing/header-client";

const NAV = [
  { href: ROUTES.repair, label: "Réparations" },
  { href: ROUTES.howItWorks, label: "Comment ça marche" },
  { href: ROUTES.trust, label: "Confiance" },
  { href: ROUTES.faq, label: "FAQ" },
  { href: ROUTES.tracking, label: "Suivi" },
];

export function SiteHeader({ brandName }: { brandName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href={ROUTES.home} className="flex items-center gap-2.5 font-semibold tracking-tight text-ink" aria-label={`${brandName} — accueil`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
            <Wrench className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>{brandName}</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-muted hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <AccountLink />
          </div>
          <ButtonLink href={ROUTES.repair} variant="accent" size="sm" className="hidden sm:inline-flex">
            Faire réparer ma console
          </ButtonLink>
          <MobileNav items={NAV} />
        </div>
      </Container>
    </header>
  );
}
