import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { NewListingForm } from "@/app/admin/annonces/nouvelle/form";
import { getRayons } from "@/lib/shop/categories";
import { codeDuSlug, rayonsPublics } from "@/lib/shop/rayons";

/**
 * Nouvelle annonce.
 *
 * Le raccourci que le back-office n'avait pas : six champs, et l'article
 * existe. La fiche complète — photos, caractéristiques, mouvements de stock —
 * s'ouvre juste après, quand il y a quelque chose à y mettre.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Nouvelle annonce" };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireAdminOrRedirect();
  const { cat } = await searchParams;
  // Les rayons proposés sont ceux du magasin, pas une liste figée dans le code :
  // celui que le vendeur vient d'ouvrir doit être là.
  const publics = rayonsPublics(await getRayons());
  const demande = codeDuSlug(publics, cat);
  const initial = demande ?? publics[0]?.code ?? "CONSOLE";

  return (
    <div className="w-full page-wrap px-4 py-7 sm:px-[30px]">
      <Link href="/admin" className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted transition-colors hover:text-red">
        ← Back-office
      </Link>
      <h1 className="mt-2 text-[clamp(23px,2.6vw,32px)] font-bold tracking-[-0.03em] text-ink">Nouvelle annonce</h1>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-[1.5] text-ink-soft">
        L&apos;essentiel maintenant, le reste après&#8239;: référence, adresse de la fiche et réglages de stock sont fabriqués tout
        seuls.
      </p>
      <NewListingForm initialCategory={initial} rayons={publics} />
    </div>
  );
}
