import type { Metadata } from "next";
import Image from "next/image";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { getPackagingInstructions } from "@/lib/content";
import { getActiveModels } from "@/lib/repair/catalog";
import { publicMediaUrl } from "@/components/marketing/gallery";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Instructions d'emballage",
  description: "Comment emballer votre console avant de l'envoyer à l'atelier : carton, protection, calage, fermeture.",
  alternates: { canonical: `${SITE_URL}${ROUTES.packaging}` },
};

export default async function PackagingPage({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele } = await searchParams;
  const models = await getActiveModels();
  const model = modele ? models.find((m) => m.slug === modele) : undefined;
  const instructions = await getPackagingInstructions(model?.id ?? null);
  const generic = instructions.filter((i) => i.model_id === null);
  const specific = instructions.filter((i) => i.model_id !== null);

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <PageHeader eyebrow="Avant l'envoi" title={model ? `Emballer votre ${model.name}` : "Instructions d'emballage"} description="Un bon emballage évite la quasi-totalité des dommages de transport. Prenez cinq minutes pour suivre ces étapes." />
      {!model ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {models.map((m) => (
            <a key={m.id} href={`${ROUTES.packaging}?modele=${m.slug}`} className="flex min-h-11 items-center border border-border bg-surface px-3 py-1 text-sm text-ink-soft hover:border-accent hover:text-ink sm:min-h-0">
              {m.name}
            </a>
          ))}
        </div>
      ) : null}
      <ol className="mt-8 space-y-4">
        {generic.map((step, i) => (
          <li key={step.id} className="flex gap-4 rounded-lg border border-border bg-surface p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
              {step.image_path ? (
                <div className="relative mt-3 aspect-video overflow-hidden rounded-md bg-surface-muted">
                  <Image src={publicMediaUrl(step.image_path)} alt="" fill className="object-cover" sizes="(min-width: 768px) 640px, 100vw" />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {specific.length ? (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-ink">Spécifique à votre console</h2>
          <ul className="space-y-3">
            {specific.map((step) => (
              <li key={step.id} className="rounded-lg border border-border bg-surface p-5">
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Alert tone="info" className="mt-8" title="N'oubliez pas votre numéro de dossier">
        Glissez une feuille avec votre numéro de dossier (REP-XXXXXX) dans le colis. Il figure dans votre e-mail de confirmation et dans votre espace client.
      </Alert>
    </Container>
  );
}
