"use client";

import Link from "next/link";
import { useAnalytics } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/site";

export function CookieBanner({ enabled }: { enabled: boolean }) {
  const { consent, setConsent } = useAnalytics();
  if (!enabled || consent !== "unknown") return null;
  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-lg border border-border bg-surface p-4 shadow-md sm:inset-x-auto sm:right-4"
    >
      <p className="text-sm text-ink-soft">
        Nous utilisons une mesure d&apos;audience interne sans cookie. Avec votre accord, nous activons aussi Google Analytics / Ads
        pour mesurer nos campagnes.{" "}
        <Link href={ROUTES.privacy} className="text-accent underline">
          En savoir plus
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => setConsent("granted")}>
          Accepter
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConsent("denied")}>
          Refuser
        </Button>
      </div>
    </div>
  );
}
