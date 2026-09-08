import type { Metadata } from "next";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { TrackingLookupForm } from "@/components/tracking/lookup-form";

export const metadata: Metadata = {
  title: "Suivre mon dossier de réparation",
  description: "Suivez l'avancement de la réparation de votre console avec votre numéro de dossier.",
  alternates: { canonical: `${SITE_URL}${ROUTES.tracking}` },
};

export default function TrackingPage() {
  return (
    <Container className="max-w-lg py-10 sm:py-16">
      <PageHeader eyebrow="Suivi" title="Où en est ma réparation ?" description="Saisissez votre numéro de dossier et l'e-mail utilisé lors de la commande." />
      <div className="mt-8 rounded-lg border border-border bg-surface p-6">
        <TrackingLookupForm />
      </div>
      <p className="mt-4 text-sm text-ink-muted">
        Vous pouvez aussi vous connecter à votre espace client pour voir les photos, le diagnostic et les devis.
      </p>
    </Container>
  );
}
