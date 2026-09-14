import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { hljProvider } from "@/lib/catalog/providers/hlj";
import { FigurineImporter } from "@/app/admin/catalog/figurines/import-client";

/**
 * Catalogue → Importer une figurine.
 *
 * Le point d'entrée du seul import externe du projet. Il crée des brouillons
 * dans le rayon « Figurines Manga / Anime », et rien d'autre : pas de console,
 * pas de composant, pas d'accessoire informatique.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Importer une figurine" };

export default async function FigurinesImportPage() {
  await requireAdminOrRedirect();
  const configError = hljProvider.configurationError();

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8">
      <nav className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
        <Link href="/admin/catalog" className="hover:text-ink">
          Catalogue
        </Link>{" "}
        / <span className="text-ink">Importer une figurine</span>
      </nav>

      <h1 className="mt-3 font-display text-[clamp(24px,3vw,34px)] font-extrabold tracking-[-0.03em] text-ink">Importer une figurine</h1>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.55] text-ink-soft">
        Cherchez une figurine chez {hljProvider.label}, puis importez-la. Le produit est créé{" "}
        <strong className="font-semibold text-ink">en brouillon</strong> dans le rayon Figurines Manga / Anime : ni prix, ni stock, ni
        mise en ligne. Vous complétez ensuite la fiche dans le stock.
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-surface-muted p-4 text-[13.5px] leading-[1.55] text-ink-soft">
        <strong className="font-semibold text-ink">Droits des images.</strong> Les visuels de {hljProvider.label} sont conservés à part,
        avec leur source et leur adresse d&apos;origine, et ne s&apos;affichent jamais sur la boutique. Avant de publier, ajoutez au moins
        une photo dont MÉDI@ROM détient les droits : c&apos;est elle que le rayon montrera.
      </div>

      {configError ? (
        <div className="mt-6 rounded-2xl bg-warning-soft px-4 py-3 text-[13.5px] text-warning">
          {configError}
        </div>
      ) : (
        <FigurineImporter />
      )}
    </div>
  );
}
