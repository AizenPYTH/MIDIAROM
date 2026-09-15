import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { NewListingForm } from "@/app/admin/annonces/nouvelle/form";
import { categoryFromSlug, PUBLIC_CATEGORIES } from "@/lib/shop/status";

/**
 * Nouvelle annonce.
 *
 * Le raccourci que le back-office n'avait pas : six champs, et l'article
 * existe. La fiche complète — photos, caractéristiques, fiche IGDB, mouvements
 * de stock — s'ouvre juste après, quand il y a quelque chose à y mettre.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Nouvelle annonce" };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireAdminOrRedirect();
  const { cat } = await searchParams;
  const demande = categoryFromSlug(cat);
  const initial = demande && PUBLIC_CATEGORIES.includes(demande) ? demande : "CONSOLE";

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
      <NewListingForm initialCategory={initial} />
    </div>
  );
}
