import Link from "next/link";
import { ROUTES } from "@/config/site";
import { Container } from "@/components/ui/misc";
import type { BrandSettings } from "@/config/brand";
import type { SocialSettings } from "@/lib/settings";

export function SiteFooter({ brand, social, models }: { brand: BrandSettings; social: SocialSettings; models: { slug: string; name: string }[] }) {
  const socials = [
    { label: "Instagram", href: social.instagram },
    { label: "Facebook", href: social.facebook },
    { label: "TikTok", href: social.tiktok },
    { label: "YouTube", href: social.youtube },
    { label: "Google", href: social.google_business },
  ].filter((s) => s.href);

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-semibold text-ink">{brand.name}</p>
          <p className="mt-2 text-sm text-ink-muted">{brand.description}</p>
          {brand.email ? (
            <a href={`mailto:${brand.email}`} className="mt-3 block text-sm text-accent hover:underline">
              {brand.email}
            </a>
          ) : null}
          {brand.phone ? <p className="mt-1 text-sm text-ink-soft">{brand.phone}</p> : null}
          {brand.hours ? <p className="mt-1 text-sm text-ink-muted">{brand.hours}</p> : null}
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Réparations</p>
          <ul className="mt-3 space-y-2 text-sm">
            {models.slice(0, 8).map((m) => (
              <li key={m.slug}>
                <Link href={`${ROUTES.repair}/${m.slug}`} className="text-ink-soft hover:text-ink">
                  Réparation {m.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href={ROUTES.repair} className="font-medium text-accent hover:underline">
                Toutes les consoles
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Service</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href={ROUTES.howItWorks} className="text-ink-soft hover:text-ink">Comment ça marche</Link></li>
            <li><Link href={ROUTES.trust} className="text-ink-soft hover:text-ink">Pourquoi nous faire confiance</Link></li>
            <li><Link href={ROUTES.packaging} className="text-ink-soft hover:text-ink">Instructions d&apos;emballage</Link></li>
            <li><Link href={ROUTES.tracking} className="text-ink-soft hover:text-ink">Suivre mon dossier</Link></li>
            <li><Link href={ROUTES.faq} className="text-ink-soft hover:text-ink">FAQ</Link></li>
            <li><Link href={ROUTES.contact} className="text-ink-soft hover:text-ink">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Informations</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href={ROUTES.cgv} className="text-ink-soft hover:text-ink">Conditions générales de vente</Link></li>
            <li><Link href={ROUTES.privacy} className="text-ink-soft hover:text-ink">Confidentialité</Link></li>
            <li><Link href={ROUTES.legal} className="text-ink-soft hover:text-ink">Mentions légales</Link></li>
            <li><Link href={ROUTES.account} className="text-ink-soft hover:text-ink">Espace client</Link></li>
          </ul>
          {socials.length ? (
            <ul className="mt-4 flex flex-wrap gap-3 text-sm">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-ink">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brand.name}. Tous droits réservés.</p>
          <p>Paiement sécurisé · Dossier tracé · Garantie sur l&apos;intervention</p>
        </Container>
      </div>
    </footer>
  );
}
