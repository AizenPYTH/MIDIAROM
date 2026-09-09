import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Eyebrow } from "@/components/ui/misc";
import { HowToList } from "@/components/marketing/sections";
import { TradeInForm } from "@/components/tradein/trade-in-form";
import { getActiveBrands, getActiveModels } from "@/lib/repair/catalog";
import { toFormModels } from "@/lib/repair/form-data";
import { getCurrentUser } from "@/lib/security/auth";
import { getContentBlock } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reprise de consoles, jeux et accessoires — estimation en ligne",
  description: "Vendez votre console, vos jeux ou vos accessoires : estimation en ligne à partir de photos, offre par e-mail, paiement au comptoir le jour même.",
  alternates: { canonical: `${SITE_URL}${ROUTES.tradeIn}` },
};

const STEPS = [
  { title: "Vous décrivez le lot", text: "Type, plateforme, état, accessoires, photos. Deux minutes." },
  { title: "Offre par e-mail", text: "L'atelier examine les photos et vous envoie une proposition chiffrée." },
  { title: "Vous acceptez en ligne", text: "Un clic pour accepter ou refuser, sans engagement." },
  { title: "Dépôt et paiement au comptoir", text: "Vérification du lot au magasin, paiement le jour même." },
];

export default async function TradeInPage() {
  const [brands, models, user, block] = await Promise.all([getActiveBrands(), getActiveModels(), getCurrentUser(), getContentBlock("homepage.tradein")]);
  const platforms = [...new Set([...brands.map((b) => b.name), ...models.map((m) => m.short_name ?? m.name)])];
  return (
    <section className="bg-ink-900 px-6 py-[64px] text-paper">
      <div className="mx-auto grid max-w-[1280px] items-start gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <div className="flex flex-col gap-[26px]">
          <div>
            <Eyebrow>Reprise</Eyebrow>
            <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em]">{block?.title ?? "Vendez-nous votre console"}</h1>
            <p className="mt-3.5 max-w-[42ch] text-[16.5px] leading-[1.55] text-[#c4bdae]">{block?.body ?? "Estimation en ligne, paiement au comptoir le jour même. Consoles, jeux, manettes, collectors."}</p>
          </div>
          <HowToList steps={STEPS} />
          <p className="font-mono text-[11.5px] text-ink-muted">
            <Link href={`${ROUTES.shop}?retro=1`} className="hover:text-paper">
              Voir le rayon rétro
            </Link>
            {" · "}
            <Link href={ROUTES.contact} className="hover:text-paper">
              Le magasin
            </Link>
          </p>
        </div>
        <TradeInForm platforms={platforms} models={toFormModels(models, brands)} initialCustomer={user ? { first_name: user.profile.first_name ?? "", last_name: user.profile.last_name ?? "", email: user.email, phone: user.profile.phone ?? "" } : null} isLoggedIn={Boolean(user)} />
      </div>
    </section>
  );
}
