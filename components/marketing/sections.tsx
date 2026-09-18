import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { ConsolePhoto } from "@/components/repair/console-photo";
import type { BrandSettings } from "@/config/brand";
import type { Brand, ConsoleModel } from "@/lib/repair/catalog";
import type { Tables, Views } from "@/types/database";
import { cn } from "@/lib/utils/cn";

/**
 * Le numéro d'étape, en rouge.
 *
 * Il y avait quatre accents et une lueur d'angle par carte, hérités d'une
 * charte sombre. Cette direction n'a qu'une couleur, et une lueur colorée sur
 * du blanc se lit comme une tache. Il ne reste que le chiffre.
 */
const STEP_TONE = "text-brand";

/**
 * « Quatre temps, zéro surprise » : quatre cartes en verre, chacune portant une
 * lueur d'angle de sa couleur, un numéro mono et une seule ligne de texte.
 */
export function MethodCards({ steps, className }: { steps: { title: string; text: string }[]; className?: string }) {
  return (
    <ol className={cn("grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]", className)}>
      {steps.map((step, i) => {
        return (
          <li key={step.title} className="glass reveal relative overflow-hidden rounded-[2px] p-6">
            <span className={cn("relative font-mono text-[11.5px] tracking-[0.14em]", STEP_TONE)}>{String(i + 1).padStart(2, "0")}</span>
            <h3 className="relative mt-4 font-display text-[22px] font-bold leading-[1.05] tracking-[-0.025em] text-ink">{step.title}</h3>
            <p className="relative mt-2.5 text-[15.5px] leading-[1.45] text-ink-soft">{step.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Grille tarifaire : lignes filetées, libellé à gauche, prix mono lime à
 * droite. Une prestation dont le tarif n'est pas arbitré affiche « sur devis » ;
 * aucun montant n'est inventé ici.
 */
export function PriceLines({ items, className }: { items: { label: string; price: string; href?: string }[]; className?: string }) {
  if (!items.length) {
    return <p className={cn("text-[16px] text-ink-muted", className)}>Les tarifs sont communiqués après diagnostic.</p>;
  }
  return (
    <ul className={cn("flex flex-col", className)}>
      {items.map((item, i) => {
        const row = (
          <>
            <span className="font-display text-[clamp(18px,1.6vw,23px)] font-bold leading-[1.1] tracking-[-0.03em] text-ink">{item.label}</span>
            <span className="whitespace-nowrap font-mono text-[18px] text-sale">{item.price}</span>
          </>
        );
        const shared = "reveal flex items-baseline justify-between gap-6 border-t border-border px-3 py-6 transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:bg-surface-muted hover:px-5";
        return (
          <li key={`${item.label}-${i}`} className={i === items.length - 1 ? "border-b border-border" : undefined}>
            {item.href ? (
              <Link href={item.href} className={shared}>
                {row}
              </Link>
            ) : (
              <div className={shared}>{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Atelier : trois cartes — identité, photographie, suivi.
 *
 * Le handoff place un champ « R-0000 » dans la carte de suivi. La recherche
 * demande aussi l'adresse électronique du dossier : un champ seul promettrait
 * un résultat qu'il ne peut pas donner, la carte mène donc à la page de suivi.
 */
export function StoreCards({ brand, photo, className }: { brand: BrandSettings; photo: Tables<"gallery_items"> | null; className?: string }) {
  const tel = brand.phone ? brand.phone.replace(/\s/g, "") : null;
  const address = [brand.address_line1, [brand.postal_code, brand.city].filter(Boolean).join(" ")].filter(Boolean);
  return (
    <div className={cn("grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]", className)}>
      <div className="reveal relative overflow-hidden rounded-[2px] border border-border bg-surface-muted p-8">
        <div className="relative">
          <p className="font-display text-[25px] font-bold leading-[1.05] tracking-[-0.035em] text-ink">{address[0] ?? brand.name}</p>
          {address[1] ? <p className="mt-1 text-[16px] text-ink-soft">{address[1]}</p> : null}
          {brand.hours ? (
            <div className="mt-5 flex flex-col gap-1 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-soft">
              {brand.hours.split(/\s*[;\n]\s*/).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          ) : null}
          {tel ? (
            <a href={`tel:${tel}`} className="mt-7 flex items-center justify-center rounded-full bg-paper px-6 py-[15px] text-[15px] font-semibold text-ink-900 transition-all duration-300 hover:brightness-95">
              {brand.phone}
            </a>
          ) : null}
        </div>
      </div>

      <div className="reveal overflow-hidden rounded-[2px] border border-border">
        {photo ? (
          <Image src={publicMediaUrl(photo.image_path)} alt={photo.title ?? "L'atelier"} width={765} height={1020} sizes="(min-width: 1024px) 420px, 100vw" className="h-full w-full object-cover" />
        ) : (
          <div className="photo-placeholder h-full min-h-[260px] w-full text-[11.5px]">Photographie de l&apos;atelier</div>
        )}
      </div>

      <div className="glass reveal flex flex-col rounded-[2px] p-8">
        <Eyebrow tone="repair">Suivi</Eyebrow>
        <p className="mt-3 font-display text-[25px] font-bold leading-[1.05] tracking-[-0.035em] text-ink">Où en est ma console ?</p>
        <p className="mt-3 text-[15.5px] leading-[1.45] text-ink-soft">Votre numéro de dossier et l&apos;adresse utilisée à la commande suffisent — aucun compte n&apos;est nécessaire.</p>
        <Link href={ROUTES.tracking} className="btn-gradient mt-auto flex items-center justify-center rounded-[2px] px-6 py-[15px] text-[15px] font-semibold">
          Suivre ma réparation
        </Link>
      </div>
    </div>
  );
}

/** Liste ordonnée « comment ça marche », en blocs de verre numérotés. */
export function HowToList({ steps, className }: { steps: { title: string; text: string }[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {steps.map((step, i) => {
        return (
          <li key={step.title} className="glass flex items-baseline gap-4 rounded-[2px] px-5 py-4">
            <span className={cn("min-w-[22px] font-mono text-[11.5px] tracking-[0.14em]", STEP_TONE)}>{String(i + 1).padStart(2, "0")}</span>
            <span className="flex flex-col gap-1">
              <strong className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{step.title}</strong>
              <span className="text-[14.5px] leading-[1.45] text-ink-soft">{step.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Les consoles prises en charge, marque par marque.
 *
 * Chaque carte porte le détouré du modèle (`console_models.image_path`, les
 * fichiers de `public/medias/consoles/`) : on reconnaît sa console d'un coup
 * d'œil, avant même de lire son nom. La vignette reste petite — c'est un
 * repère, pas une vitrine — et se charge en différé, la grille étant sous la
 * ligne de flottaison.
 *
 * `h-full` et `mt-auto` : les modèles dont le nom tient sur deux lignes
 * (« PlayStation 5 Slim Digital Edition ») ne décalent plus la rangée. Toutes
 * les cartes d'une ligne ont la même hauteur, et l'année est toujours au même
 * niveau.
 */
export function ConsoleGrid({ brands, models }: { brands: Brand[]; models: ConsoleModel[] }) {
  return (
    <div className="space-y-10">
      {brands.map((brand) => {
        const brandModels = models.filter((m) => m.brand_id === brand.id);
        if (!brandModels.length) return null;
        return (
          <div key={brand.id}>
            <h3 className="mb-4 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-muted">{brand.name}</h3>
            {/* `clamp` : deux colonnes au téléphone, comme au rayon. Le plancher
                fixe à 190 px n'en laissait qu'une sous 424 px, et dix-huit
                vignettes pleine largeur faisaient de la grille un couloir. */}
            <ul className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(150px, 20vw, 190px), 1fr))" }}>
              {brandModels.map((model) => (
                <li key={model.id} className="min-w-0">
                  <Link
                    href={`${ROUTES.repair}/${model.slug}`}
                    data-card="1"
                    className="glass flex h-full flex-col overflow-hidden rounded-[2px] transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]"
                  >
                    {/* Le cadre donne la géométrie, l'image s'y adapte : les
                        détourés vont du carré au 1,6/1, et une grille ne peut
                        pas suivre le rapport de chaque fichier. */}
                    <span className="relative block w-full overflow-hidden border-b border-border bg-paper-strong" style={{ aspectRatio: "4 / 3" }}>
                      <span data-zoom="1" className="absolute inset-0">
                        <ConsolePhoto
                          src={model.image_path ? publicMediaUrl(model.image_path) : null}
                          alt={`Console ${model.name}`}
                          label={model.name}
                          // Les paliers suivent le nombre réel de colonnes :
                          // deux au téléphone, trois sur tablette, six au-delà.
                          // Un `sizes` trop optimiste sert une image trop
                          // petite, et la vignette sort floue sur écran dense.
                          sizes="(max-width: 660px) 50vw, (max-width: 900px) 33vw, 240px"
                          className="p-[12%]"
                        />
                      </span>
                    </span>
                    <span className="flex flex-1 flex-col gap-1.5 p-[18px]">
                      <span className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{model.name}</span>
                      <span className="mt-auto font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">{model.release_year ? `depuis ${model.release_year}` : brand.name}</span>
                    </span>
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
    <ol className={cn("flex flex-col gap-3", compact && "sm:grid sm:grid-cols-3")}>
      {steps.map((step, i) => {
        return (
          <li key={step.title} className="glass flex items-baseline gap-4 rounded-[2px] px-5 py-4">
            <span className={cn("min-w-[22px] font-mono text-[11.5px] tracking-[0.14em]", STEP_TONE)}>{String(i + 1).padStart(2, "0")}</span>
            <span className="flex flex-col gap-1">
              <strong className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{step.title}</strong>
              <span className="text-[14.5px] leading-[1.45] text-ink-soft">{step.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ReviewsSection({ reviews }: { reviews: Views<"public_reviews">[] }) {
  // Only genuine, moderated reviews are ever displayed. No reviews → no section.
  if (!reviews.length) return null;
  return (
    <section>
      <Container className="py-[92px]">
        <Eyebrow>Avis</Eyebrow>
        <h2 className="reveal mt-3 font-display text-[clamp(26px,3.1vw,40px)] font-extrabold leading-[0.92] tracking-[-0.04em]">Ce que disent les clients</h2>
        <p className="reveal mt-4 max-w-[42ch] text-[16px] text-ink-soft">Avis authentiques laissés après une réparation, modérés par l&apos;atelier.</p>
        <ul className="mt-10 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {reviews.map((review) => (
            <li key={review.id} className="glass reveal flex flex-col gap-3 rounded-[2px] p-6">
              <span className="font-mono text-[13px] tracking-[0.2em] text-sale" aria-label={`${review.rating ?? 0} sur 5`}>
                {"★".repeat(review.rating ?? 0)}
                <span className="text-border-strong">{"★".repeat(Math.max(0, 5 - (review.rating ?? 0)))}</span>
              </span>
              {review.title ? <p className="font-display text-[19px] font-bold leading-[1.15] tracking-[-0.02em] text-ink">{review.title}</p> : null}
              {review.body ? <p className="text-[14.5px] leading-[1.5] text-ink-soft">{review.body}</p> : null}
              <p className="mt-auto font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
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
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <details key={item.id} className="glass group rounded-[2px] px-5 py-2.5 sm:py-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-1.5 font-display text-[17px] font-bold tracking-[-0.02em] text-ink sm:min-h-0 sm:py-0 [&::-webkit-details-marker]:hidden">
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

/** Bandeau final : un appel à l'action pleine largeur sur panneau de verre. */
export function CtaBanner({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <Container className="py-[92px]">
        <div className="glass reveal flex flex-wrap items-end justify-between gap-8 rounded-[2px] p-8 sm:p-10">
          <div>
            <Eyebrow tone="repair">Atelier</Eyebrow>
            <h2 className="mt-3 font-display text-[clamp(25px,2.6vw,34px)] font-extrabold leading-[0.95] tracking-[-0.035em]">{title}</h2>
            <p className="mt-3 max-w-[46ch] text-[16.5px] leading-[1.45] text-ink-soft">{text}</p>
          </div>
          <Link href={ROUTES.repair} className="btn-gradient flex items-center justify-center rounded-[2px] px-7 py-[15px] text-[15px] font-semibold max-sm:w-full">
            Démarrer mon devis
          </Link>
        </div>
      </Container>
    </section>
  );
}
