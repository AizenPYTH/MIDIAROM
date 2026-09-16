import { ROUTES } from "@/config/site";
import { CATEGORY_SLUGS } from "@/lib/shop/status";
import { BrandMark } from "@/components/marketing/header";
import { FooterColumn } from "@/components/marketing/footer-column";
import type { BrandSettings } from "@/config/brand";
import type { SocialSettings } from "@/lib/settings";

/**
 * Le pied de page : une tuile noire, trois colonnes de liens.
 *
 * Il tenait sur une ligne de « · » en petites capitales — compact, mais illisible
 * pour qui cherche une page précise. Cette direction lui donne la place d'un
 * plan de site : ce que l'atelier répare, ce que la boutique vend, et les
 * informations légales.
 *
 * L'adresse, la ville et les réseaux viennent des réglages. Un réseau non
 * renseigné ne laisse pas de trou : sa ligne n'existe pas.
 */
export function SiteFooter({ brand, social, models }: { brand: BrandSettings; social: SocialSettings; models: { slug: string; name: string }[] }) {
  const socials = [
    { label: "Instagram", href: social.instagram },
    { label: "Facebook", href: social.facebook },
    { label: "TikTok", href: social.tiktok },
    { label: "YouTube", href: social.youtube },
    { label: "Google", href: social.google_business },
  ].filter((s) => s.href);

  // Les consoles réellement réparables viennent du catalogue ; en leur absence,
  // la colonne retombe sur le parcours de devis plutôt que sur des liens morts.
  const consoles = models.slice(0, 5).map((m) => ({ label: m.name, href: `${ROUTES.repair}/${m.slug}` }));

  const colonnes: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
    {
      title: "Réparation",
      links: [
        ...(consoles.length ? consoles : [{ label: "Toutes les consoles", href: ROUTES.repair }]),
        { label: "Suivi de réparation", href: ROUTES.tracking },
        { label: "Envoi de colis", href: ROUTES.packaging },
      ],
    },
    {
      title: "Boutique",
      links: [
        { label: "Jeux vidéo", href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}` },
        { label: "Consoles", href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.CONSOLE}` },
        { label: "Figurines manga / anime", href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS.COLLECTIBLE}` },
        { label: "Mon compte", href: ROUTES.account },
        { label: "Panier", href: ROUTES.cart },
      ],
    },
    {
      title: "Informations",
      links: [
        { label: "Reprise de console", href: ROUTES.tradeIn },
        { label: "Garantie et retours", href: ROUTES.trust },
        { label: "Conditions générales de vente", href: ROUTES.cgv },
        { label: "Mentions légales", href: ROUTES.legal },
        { label: "Contact", href: ROUTES.contact },
        ...socials.map((s) => ({ label: s.label, href: s.href, external: true })),
      ],
    },
  ];

  const adresse = [brand.address_line1, [brand.postal_code, brand.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <footer className="mt-auto bg-ink px-[22px] pb-[26px] pt-[46px] text-on-dark-2">
      <div className="page-wrap grid gap-2 lg:gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(208px, 1fr))" }}>
        <div className="flex flex-col gap-[11px]">
          <span className="text-on-dark">
            <BrandMark name={brand.name} size="sm" />
          </span>
          <span className="max-w-[32ch] text-[14px] leading-[1.55]">
            Atelier de réparation de consoles et boutique gaming.
            {adresse ? ` ${adresse}.` : ""}
          </span>
        </div>

        {colonnes.map((col) => (
          <FooterColumn key={col.title} titre={col.title} liens={col.links} />
        ))}
      </div>

      <div
        className="page-wrap mt-[30px] flex flex-wrap justify-between gap-[18px] pt-[18px] font-mono text-[11px] uppercase tracking-[0.06em] text-on-dark-3"
        style={{ borderTop: "1px solid rgba(242,242,244,0.16)" }}
      >
        <span>
          © {new Date().getFullYear()} {brand.name}
          {brand.city ? ` — ${brand.city}` : ""}
        </span>
        <span>Paiement sécurisé · Envoi suivi · Garantie 3 mois</span>
      </div>
    </footer>
  );
}
