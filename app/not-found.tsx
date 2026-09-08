import Link from "next/link";
import { ROUTES } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Page introuvable</h1>
      <p className="mt-2 max-w-md text-ink-soft">Cette page n&apos;existe pas ou plus. Vous cherchez peut-être une réparation ou le suivi d&apos;un dossier.</p>
      <div className="mt-6 flex gap-3">
        <ButtonLink href={ROUTES.repair}>Voir les réparations</ButtonLink>
        <ButtonLink href={ROUTES.tracking} variant="outline">Suivre un dossier</ButtonLink>
      </div>
      <Link href={ROUTES.home} className="mt-4 text-sm text-ink-muted hover:text-ink">← Accueil</Link>
    </main>
  );
}
