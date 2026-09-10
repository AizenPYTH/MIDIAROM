import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { formatPrice } from "@/lib/utils/format";
import type { BrandSettings } from "@/config/brand";
import type { Brand, ConsoleModel } from "@/lib/repair/catalog";
import type { Tables, Views } from "@/types/database";
import { cn } from "@/lib/utils/cn";

/**
 * Bandeau de garanties du handoff : cellules mono majuscules séparées par des
 * filets.
 *
 * Au téléphone, la grille `auto-fit` retomberait sur une seule colonne et
 * empilerait quatre lignes pleine hauteur avant même le premier produit : on en
 * fait une bande à défilement horizontal, les libellés restent entiers.
 */
export function GuaranteeStrip({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="scroll-strip border-y border-border bg-bg sm:grid sm:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      {items.map((item, i) => (
        <div key={item} className={cn("max-w-[70vw] px-5 py-4 font-mono text-[12.5px] uppercase tracking-[0.04em] text-ink sm:max-w-none sm:px-6 sm:py-5", i < items.length - 1 && "border-r border-border")}>
          {item}
        </div>
      ))}
    </div>
  );
}

/** Liste ordonnée « comment ça marche » en blocs sombres numérotés (section réparation). */
export function HowToList({ steps, className }: { steps: { title: string; text: string }[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-px border border-ink-700 bg-ink-700", className)}>
      {steps.map((step, i) => (
        <li key={step.title} className="flex items-baseline gap-3.5 bg-ink-800 px-[18px] py-4">
          <span className="min-w-[22px] font-mono text-[12px] text-accent-light">{String(i + 1).padStart(2, "0")}</span>
          <span className="flex flex-col gap-[3px]">
            <strong className="text-[15.5px] font-semibold text-paper">{step.title}</strong>
            <span className="text-[14px] leading-[1.45] text-[#a39c8c]">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Bloc tarifs indicatifs (lignes pointillées) — prix réels du catalogue. */
export function PriceList({ items, id, title = "Indicatif — options en sus", className }: { items: { label: string; price: string; href?: string }[]; id?: string; title?: string; className?: string }) {
  return (
    <div id={id} className={cn("border border-ink-650 p-[18px]", className)} style={{ scrollMarginTop: 96 }}>
      <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">{title}</span>
      <div className="mt-3 flex flex-col gap-[9px]">
        {/* Deux modèles peuvent porter la même panne (« Ne s'allume plus ») : le
            libellé seul ne fait pas une clé unique, et React en omettait une. */}
        {items.map((t, i) => (
          <div key={`${t.href ?? ""}-${t.label}-${i}`} className="flex justify-between gap-4 border-b border-dotted border-[#3a3529] pb-[7px] text-[14.5px] text-paper">
            {t.href ? (
              <Link href={t.href} className="hover:text-accent-light">
                {t.label}
              </Link>
            ) : (
              <span>{t.label}</span>
            )}
            <span className="whitespace-nowrap font-mono text-[#e4dccb]">{t.price}</span>
          </div>
        ))}
        {!items.length ? <p className="text-[14px] text-[#a39c8c]">Tarifs communiqués après diagnostic.</p> : null}
      </div>
    </div>
  );
}

/** Grille des consoles par marque (pages catalogue), style boutons de la fiche. */
export function ConsoleGrid({ brands, models }: { brands: Brand[]; models: ConsoleModel[] }) {
  return (
    <div className="space-y-8">
      {brands.map((brand) => {
        const brandModels = models.filter((m) => m.brand_id === brand.id);
        if (!brandModels.length) return null;
        return (
          <div key={brand.id}>
            <h3 className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">{brand.name}</h3>
            <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
              {brandModels.map((model) => (
                <li key={model.id}>
                  <Link href={`${ROUTES.repair}/${model.slug}`} className="flex flex-col gap-1 border border-border-strong p-[13px] transition-colors hover:border-accent">
                    <span className="text-[15px] font-semibold text-ink">{model.name}</span>
                    <span className="font-mono text-[11px] text-ink-muted">{model.release_year ? `depuis ${model.release_year}` : brand.name}</span>
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
    <ol className={cn("flex flex-col gap-px border border-border bg-border", compact && "sm:grid sm:grid-cols-3")}>
      {steps.map((step, i) => (
        <li key={step.title} className="flex items-baseline gap-3.5 bg-surface px-[18px] py-4">
          <span className="min-w-[22px] font-mono text-[12px] text-accent">{String(i + 1).padStart(2, "0")}</span>
          <span className="flex flex-col gap-[3px]">
            <strong className="text-[15.5px] font-semibold text-ink">{step.title}</strong>
            <span className="text-[14px] leading-[1.45] text-ink-soft">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function PopularRepairs({ repairs }: { repairs: { id: string; name: string; price_cents: number; summary: string | null; modelSlug: string; faultSlug: string; modelName: string }[] }) {
  if (!repairs.length) return null;
  return (
    <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
      {repairs.map((r) => (
        <li key={r.id}>
          <Link href={`${ROUTES.repair}/${r.modelSlug}/${r.faultSlug}`} className="flex h-full flex-col gap-3 border border-border bg-surface p-4 transition-colors hover:border-accent">
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">{r.modelName}</span>
            <span className="text-[16px] font-semibold leading-[1.25] text-ink">{r.name}</span>
            {r.summary ? <span className="line-clamp-2 text-[13px] text-ink-faint">{r.summary}</span> : null}
            <span className="mt-auto font-mono text-[17px] font-semibold text-ink">{formatPrice(r.price_cents)}</span>
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
    <section className="border-t border-border">
      <Container className="py-[72px]">
        <div className="mb-7">
          <Eyebrow>Avis</Eyebrow>
          <h2 className="mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">Ce que disent les clients</h2>
          <p className="mt-3 max-w-[42ch] text-[16px] text-ink-soft">Avis authentiques laissés après une réparation, modérés par l&apos;atelier.</p>
        </div>
        <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col gap-3 border border-border bg-surface p-4">
              <span className="font-mono text-[12px] tracking-[0.1em] text-sale" aria-label={`${review.rating ?? 0} sur 5`}>
                {"★".repeat(review.rating ?? 0)}
                <span className="text-border-strong">{"★".repeat(Math.max(0, 5 - (review.rating ?? 0)))}</span>
              </span>
              {review.title ? <p className="text-[16px] font-semibold leading-[1.25] text-ink">{review.title}</p> : null}
              {review.body ? <p className="text-[14px] leading-[1.5] text-ink-soft">{review.body}</p> : null}
              <p className="mt-auto font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
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
    <div className="divide-y divide-border border border-border bg-surface">
      {items.map((item) => (
        <details key={item.id} className="group px-5 py-2.5 sm:py-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-1.5 text-[15.5px] font-semibold text-ink sm:min-h-0 sm:py-0 [&::-webkit-details-marker]:hidden">
            {item.question}
            <span className="font-mono text-ink-muted group-open:hidden" aria-hidden="true">
              +
            </span>
            <span className="hidden font-mono text-ink-muted group-open:inline" aria-hidden="true">
              −
            </span>
          </summary>
          <p className="mt-3 text-[14.5px] leading-[1.5] text-ink-soft">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** Section « Le magasin » du handoff : adresse, téléphone, horaires + photo (ou placeholder). */
export function StoreSection({ brand, photo }: { brand: BrandSettings; photo: Tables<"gallery_items"> | null }) {
  const hasAddress = brand.address_line1 || brand.city;
  return (
    <section id="magasin" className="border-t border-border bg-bg-alt" style={{ scrollMarginTop: 80 }}>
      <Container className="grid gap-10 py-16 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <div className="flex flex-col gap-3">
          <Eyebrow>Le magasin</Eyebrow>
          <h2 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{brand.address_line1 || brand.name}</h2>
          <p className="text-[16px] leading-[1.55] text-ink-soft">
            {hasAddress ? `${[brand.postal_code, brand.city].filter(Boolean).join(" ")}${brand.founded_year ? `. Ouvert depuis ${brand.founded_year}.` : "."}` : brand.description}
            {brand.phone ? (
              <>
                <br />
                <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="hover:text-sale">
                  {brand.phone}
                </a>
              </>
            ) : null}
            {brand.email ? (
              <>
                <br />
                <a href={`mailto:${brand.email}`} className="hover:text-sale">
                  {brand.email}
                </a>
              </>
            ) : null}
          </p>
          {brand.hours ? (
            <div className="mt-2 flex flex-col gap-1.5 font-mono text-[13.5px] text-ink">
              {brand.hours.split(/\s*[;\n]\s*/).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          ) : null}
          {/* Au téléphone, appeler est l'action la plus probable : elle passe
              devant, en pleine largeur, avant l'itinéraire et le courriel. */}
          {brand.phone ? (
            <a href={`tel:${brand.phone.replace(/\s/g, "")}`} className="mt-2 bg-ink px-5 py-[15px] text-center text-[15px] font-semibold text-paper sm:hidden">
              Appeler le magasin
            </a>
          ) : null}
          {hasAddress ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([brand.address_line1, brand.postal_code, brand.city].filter(Boolean).join(" "))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-ink px-5 py-[15px] text-center text-[15px] font-semibold text-ink sm:hidden"
            >
              Itinéraire
            </a>
          ) : null}
          <Link href={ROUTES.contact} className="mt-2 self-stretch border border-ink px-5 py-[15px] text-center text-[15px] font-semibold text-ink hover:bg-ink hover:text-paper sm:mt-2 sm:self-start sm:py-3">
            Nous écrire
          </Link>
        </div>
        {photo ? (
          <div className="flex items-start justify-center">
            {/* Photo entière, à son format d'origine : une devanture recadrée en
                bandeau ne montre qu'une tranche de l'enseigne. */}
            <Image
              src={publicMediaUrl(photo.image_path)}
              alt={photo.title ?? "Le magasin"}
              width={765}
              height={1020}
              sizes="(min-width: 640px) 380px, 100vw"
              className="h-auto w-full max-w-[380px] border border-border-strong"
            />
          </div>
        ) : (
          <div className="photo-placeholder min-h-[220px] text-[11.5px]">plan / façade du magasin</div>
        )}
      </Container>
    </section>
  );
}

/** Bandeau final : un appel à l'action pleine largeur sur fond encre. */
export function CtaBanner({ title, text }: { title: string; text: string }) {
  return (
    <section className="bg-ink-900 text-paper">
      <Container className="flex flex-wrap items-end justify-between gap-6 py-16">
        <div>
          <Eyebrow tone="repair">Atelier</Eyebrow>
          <h2 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em]">{title}</h2>
          <p className="mt-3 max-w-[42ch] text-[16.5px] leading-[1.55] text-[#c4bdae]">{text}</p>
        </div>
        <Link href={ROUTES.repair} className="bg-accent px-[22px] py-3.5 text-[15px] font-semibold text-white hover:bg-paper hover:text-ink-900">
          Démarrer une réparation
        </Link>
      </Container>
    </section>
  );
}
