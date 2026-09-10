import type { Metadata } from "next";
import Image from "next/image";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { getSetting } from "@/lib/settings";
import { getGalleryItems } from "@/lib/content";
import { publicMediaUrl } from "@/components/marketing/gallery";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l'atelier pour toute question sur une réparation ou un dossier en cours.",
  alternates: { canonical: `${SITE_URL}${ROUTES.contact}` },
};

export default async function ContactPage() {
  const [brand, gallery] = await Promise.all([getSetting("brand"), getGalleryItems("storefront")]);
  const address = [brand.address_line1, [brand.postal_code, brand.city].filter(Boolean).join(" ")].filter(Boolean);
  const facade = gallery[0] ?? null;
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <PageHeader eyebrow="Contact" title="Nous contacter" description="Pour un dossier en cours, privilégiez la messagerie de votre espace client : le technicien y a directement accès." />
      {/* La photo de la façade : « Le magasin » du menu mène ici, on doit y
          reconnaître la boutique avant de lire l'adresse. */}
      {facade ? (
        <div className="mt-8 overflow-hidden border border-border-strong bg-surface-muted">
          {/* La photo est en portrait : on la laisse à son format plutôt que de
              la recadrer en bandeau, où l'on ne verrait qu'une tranche de la
              devanture. La largeur est bornée pour qu'elle reste lisible. */}
          <Image
            src={publicMediaUrl(facade.image_path)}
            alt={facade.title ?? "Le magasin"}
            width={765}
            height={1020}
            sizes="(min-width: 640px) 420px, 100vw"
            className="mx-auto h-auto w-full max-w-[420px]"
            priority
          />
        </div>
      ) : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {brand.email ? (
          <a href={`mailto:${brand.email}`} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-5 hover:border-accent">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">E-mail</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{brand.email}</p>
            </div>
          </a>
        ) : null}
        {brand.phone ? (
          <a href={`tel:${brand.phone.replace(/\s+/g, "")}`} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-5 hover:border-accent">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Téléphone</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{brand.phone}</p>
            </div>
          </a>
        ) : null}
        {address.length ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-5">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Atelier</p>
              {address.map((line) => (
                <p key={line} className="text-sm text-ink-soft">{line}</p>
              ))}
            </div>
          </div>
        ) : null}
        {brand.hours ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-5">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Horaires</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{brand.hours}</p>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-8 bg-ink-900 p-5 text-paper">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Dossier en cours</p>
        <p className="mt-1 text-[15px] text-[#c4bdae]">Écrivez-nous directement depuis le dossier : votre message est rattaché à votre console.</p>
        <ButtonLink href={ROUTES.accountOrders} variant="accent" size="sm" className="mt-3">
          Ouvrir mes dossiers
        </ButtonLink>
      </div>
    </Container>
  );
}
