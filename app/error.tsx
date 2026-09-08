"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ROUTES } from "@/config/site";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-danger">Une erreur est survenue</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Nous n&apos;avons pas pu afficher cette page</h1>
      <p className="mt-2 max-w-md text-ink-soft">Réessayez dans un instant. Si le problème persiste, contactez-nous en indiquant le code {error.digest ?? "inconnu"}.</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <ButtonLink href={ROUTES.home} variant="outline">Accueil</ButtonLink>
      </div>
    </main>
  );
}
