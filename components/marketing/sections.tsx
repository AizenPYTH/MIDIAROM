import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { ROUTES } from "@/config/site";
import { Container, SectionTitle } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { DynamicIcon } from "@/components/marketing/icons";
import { formatPrice } from "@/lib/utils/format";
import type { Brand, ConsoleModel } from "@/lib/repair/catalog";
import type { Views } from "@/types/database";

export function ReassuranceGrid({ items }: { items: { icon: string; title: string; text: string }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <li key={item.title} className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
            <DynamicIcon name={item.icon} className="h-4.5 w-4.5" />
          </div>
          <p className="font-semibold text-ink">{item.title}</p>
          <p className="mt-1 text-sm text-ink-muted">{item.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function ConsoleGrid({ brands, models }: { brands: Brand[]; models: ConsoleModel[] }) {
  return (
    <div className="space-y-8">
      {brands.map((brand) => {
        const brandModels = models.filter((m) => m.brand_id === brand.id);
        if (!brandModels.length) return null;
        return (
          <div key={brand.id}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">{brand.name}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {brandModels.map((model) => (
                <li key={model.id}>
                  <Link
                    href={`${ROUTES.repair}/${model.slug}`}
                    className="group flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent hover:bg-accent-soft/40"
                  >
                    <span className="font-medium text-ink">{model.name}</span>
                    <ArrowRight className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function StepsList({ steps, compact }: { steps: { title: string; text: string }[]; compact?: boolean }) {
  return (
    <ol className={compact ? "grid gap-4 sm:grid-cols-3" : "space-y-6"}>
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{i + 1}</span>
          <div>
            <p className="font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PopularRepairs({
  repairs,
}: {
  repairs: { id: string; name: string; price_cents: number; summary: string | null; modelSlug: string; faultSlug: string; modelName: string }[];
}) {
  if (!repairs.length) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {repairs.map((r) => (
        <li key={r.id}>
          <Link href={`${ROUTES.repair}/${r.modelSlug}/${r.faultSlug}`} className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{r.modelName}</p>
            <p className="mt-1 font-semibold text-ink">{r.name}</p>
            {r.summary ? <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{r.summary}</p> : null}
            <p className="mt-auto pt-4 text-lg font-bold text-primary">{formatPrice(r.price_cents)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ReviewsSection({ reviews }: { reviews: Views<"public_reviews">[] }) {
  // Only genuine, moderated reviews are ever displayed. No reviews → no section.
  if (!reviews.length) return null;
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <SectionTitle title="Avis de clients" description="Avis authentiques laissés après une réparation, modérés par l'atelier." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center gap-1 text-warning" aria-label={`${review.rating ?? 0} sur 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < (review.rating ?? 0) ? "fill-current" : "opacity-30"}`} aria-hidden="true" />
                ))}
              </div>
              {review.title ? <p className="mt-2 font-semibold text-ink">{review.title}</p> : null}
              {review.body ? <p className="mt-1 text-sm text-ink-soft">{review.body}</p> : null}
              <p className="mt-3 text-xs text-ink-muted">
                {review.display_name ?? "Client"} · {review.model_name} — {review.repair_name}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function FaqList({ items }: { items: { id: string; question: string; answer: string }[] }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface">
      {items.map((item) => (
        <details key={item.id} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
            {item.question}
            <span className="text-ink-muted transition-transform group-open:rotate-90" aria-hidden="true">›</span>
          </summary>
          <p className="mt-3 text-sm text-ink-soft">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBanner({ title, text }: { title: string; text: string }) {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="rounded-lg bg-primary px-6 py-10 text-center text-white sm:px-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">{text}</p>
          <ButtonLink href={ROUTES.repair} variant="accent" size="lg" className="mt-6">
            Faire réparer ma console
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
