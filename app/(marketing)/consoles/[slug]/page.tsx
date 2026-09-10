import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES, SITE_URL } from "@/config/site";
import { Breadcrumbs, Container, Eyebrow } from "@/components/ui/misc";
import { ProductCard } from "@/components/shop/product-card";
import { getActiveModels, getModelBySlug, getRepairsForModel } from "@/lib/repair/catalog";
import { getProducts } from "@/lib/shop/catalog";
import { getBrandSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/utils/format";
import { publicMediaUrl } from "@/components/marketing/gallery";

export const revalidate = 600;

/**
 * Nom complet d'un modèle. Beaucoup de modèles portent déjà la marque dans leur
 * nom (« PlayStation 4 Pro » chez la marque « PlayStation ») : la préfixer une
 * seconde fois donnerait « PlayStation PlayStation 4 Pro ».
 */
function fullModelName(model: { name: string; brand: { name: string } }): string {
  return model.name.startsWith(model.brand.name) ? model.name : `${model.brand.name} ${model.name}`;
}

export async function generateStaticParams() {
  const models = await getActiveModels().catch(() => []);
  return models.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const model = await getModelBySlug(slug);
  if (!model) return { title: "Console introuvable" };
  return {
    title: `${fullModelName(model)} — fiche console, réparations et produits`,
    description: model.description ?? `${model.name} : variantes, pannes fréquentes, réparations avec prix et garantie, consoles, jeux et accessoires en vente.`,
    alternates: { canonical: `${SITE_URL}${ROUTES.consoles}/${model.slug}` },
  };
}

/**
 * Fiche console : description, variantes du modèle, pannes fréquentes, réparations
 * disponibles (prix, délai, garantie) liées au modèle exact, produits en vente pour
 * ce modèle (console, jeux) et accessoires de la plateforme, autres modèles de la famille.
 */
export default async function ConsolePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = await getModelBySlug(slug);
  if (!model) notFound();
  const [repairs, brand, models, forModel, forPlatform] = await Promise.all([
    getRepairsForModel(model.id),
    getBrandSettings(),
    getActiveModels(model.brand_id),
    getProducts({ modelId: model.id, sort: "recent" }, 8),
    getProducts({ platform: model.short_name ?? model.name, sort: "recent" }, 24),
  ]);
  const seen = new Set(forModel.map((p) => p.id));
  // Consoles / collectors de la plateforme non rattachés au modèle exact (ex. autre révision) : avec le modèle.
  const consoles = [...forModel, ...forPlatform.filter((p) => !seen.has(p.id) && (p.category === "CONSOLE" || p.category === "COLLECTIBLE"))];
  const accessories = forPlatform.filter((p) => !seen.has(p.id) && (p.category === "ACCESSORY" || p.category === "PART"));
  const games = forPlatform.filter((p) => !seen.has(p.id) && p.category === "GAME");
  const siblings = models.filter((m) => m.id !== model.id && (model.family ? m.family === model.family : true)).slice(0, 8);
  const mainRepairs = repairs.filter((r) => !r.is_diagnostic_only);
  const diagnostic = repairs.find((r) => r.is_diagnostic_only);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: fullModelName(model),
    brand: { "@type": "Brand", name: model.brand.name },
    description: model.description ?? undefined,
    url: `${SITE_URL}${ROUTES.consoles}/${model.slug}`,
    ...(mainRepairs.length ? { offers: mainRepairs.map((r) => ({ "@type": "Offer", name: r.name, price: (r.price_cents / 100).toFixed(2), priceCurrency: "EUR", seller: { "@type": "LocalBusiness", name: brand.name } })) } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="border-b border-border bg-bg-alt">
        <Container className="py-12">
          <Breadcrumbs items={[{ label: "Accueil", href: ROUTES.home }, { label: "Consoles", href: ROUTES.consoles }, { label: model.name }]} />
          <div className="mt-6 grid gap-10 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            <div>
              <Eyebrow tone="repair">{model.brand.name}</Eyebrow>
              <h1 className="mt-2 text-[clamp(32px,4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">{model.name}</h1>
              <p className="mt-3 max-w-[48ch] text-[17px] leading-[1.5] text-ink-soft">{model.description ?? `${fullModelName(model)}${model.release_year ? `, sortie en ${model.release_year}` : ""}. Prise en charge à l'atelier pour diagnostic et réparation.`}</p>
              <dl className="mt-5 grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
                {model.release_year ? (
                  <div className="flex justify-between gap-3 border-b border-dotted border-border-strong pb-1">
                    <dt className="text-ink-muted">Sortie</dt>
                    <dd className="font-mono">{model.release_year}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-b border-dotted border-border-strong pb-1">
                  <dt className="text-ink-muted">Génération</dt>
                  <dd className="font-mono">{model.is_retro ? "rétro" : "actuelle"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-dotted border-border-strong pb-1">
                  <dt className="text-ink-muted">Format</dt>
                  <dd className="font-mono">{model.is_handheld ? "portable" : "salon"}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-dotted border-border-strong pb-1">
                  <dt className="text-ink-muted">Réparations</dt>
                  <dd className="font-mono">{mainRepairs.length || "sur devis"}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href={`${ROUTES.repair}/${model.slug}`} className="bg-accent px-[22px] py-3.5 text-[15px] font-semibold text-white hover:bg-ink-900">
                  Faire réparer ma {model.name}
                </Link>
                <Link href={`${ROUTES.shop}?plateforme=${encodeURIComponent(model.short_name ?? model.name)}`} className="border border-ink px-[22px] py-3.5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-paper">
                  Voir en boutique
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Photo du modèle : téléversée depuis Catalogue → Modèles. Tant qu'aucune
                  photo n'est publiée, l'aperçu rayé le dit explicitement plutôt que
                  d'afficher une image d'illustration qui ne serait pas la console. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden border border-border-strong bg-surface sm:col-span-2">
                {model.image_path ? (
                  <Image src={publicMediaUrl(model.image_path)} alt={fullModelName(model)} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" priority />
                ) : (
                  <div className="photo-placeholder h-full w-full text-[11.5px]">photo {model.name.toLowerCase()}</div>
                )}
              </div>
              <div className="border border-border-strong bg-surface p-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Variantes prises en charge</span>
                {model.variants.length ? (
                  <ul className="mt-2 flex flex-col gap-1.5 text-[14.5px] text-ink">
                    {model.variants.map((v) => (
                      <li key={v} className="border-b border-dotted border-border-strong pb-1">
                        {v}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[14px] text-ink-faint">Toutes les révisions du modèle.</p>
                )}
              </div>
              <div className="border border-border-strong bg-surface p-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">Pannes fréquentes</span>
                {model.common_issues.length ? (
                  <ul className="mt-2 flex flex-col gap-1.5 text-[14.5px] text-ink">
                    {model.common_issues.map((v) => (
                      <li key={v} className="border-b border-dotted border-border-strong pb-1">
                        {v}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[14px] text-ink-faint">Diagnostic à réception pour toute panne.</p>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="reparations" className="bg-ink-900 text-paper">
        <Container className="py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow tone="repair">Atelier</Eyebrow>
              <h2 className="mt-2 text-[clamp(26px,3vw,38px)] font-extrabold leading-[1.05] tracking-[-0.02em]">Réparations disponibles — {model.name}</h2>
              <p className="mt-2 max-w-[46ch] text-[15.5px] text-[#c4bdae]">Prix TTC main-d&apos;œuvre et pièces comprises, garantie sur l&apos;intervention. Une autre panne ? Le diagnostic{diagnostic ? ` (${formatPrice(diagnostic.price_cents)}, déduit si réparation)` : ""} couvre tout le reste.</p>
            </div>
            <Link href={`${ROUTES.repair}/${model.slug}`} className="font-mono text-[12px] uppercase tracking-[0.06em] text-accent-light underline underline-offset-4">
              Démarrer une réparation
            </Link>
          </div>
          {repairs.length ? (
            <ul className="mt-8 grid gap-px bg-ink-700 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
              {repairs.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 bg-ink-900 p-4">
                  <Link href={`${ROUTES.repair}/${model.slug}/${r.fault.slug}`} className="flex items-start justify-between gap-3 hover:text-accent-light">
                    <span className="text-[16px] font-semibold">{r.fault.name}</span>
                    <span className="whitespace-nowrap font-mono text-[15px] text-[#e4dccb]">{formatPrice(r.price_cents)}</span>
                  </Link>
                  {r.summary ? <span className="text-[13.5px] text-[#a39c8c]">{r.summary}</span> : null}
                  <span className="mt-auto font-mono text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                    {r.lead_time_days_min !== null && r.lead_time_days_max !== null ? `${r.lead_time_days_min}–${r.lead_time_days_max} j` : "délai sur diagnostic"}
                    {r.warranty_months > 0 ? ` · garantie ${r.warranty_months} mois` : ""}
                    {r.is_diagnostic_only ? " · déduit si réparation" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 border border-ink-650 p-[18px] text-[14.5px] text-[#c4bdae]">
              Aucune réparation publiée pour ce modèle pour le moment. Écrivez-nous depuis la page{" "}
              <Link href={ROUTES.contact} className="text-accent-light underline">
                contact
              </Link>
              .
            </p>
          )}
        </Container>
      </section>

      <Container className="py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Boutique</Eyebrow>
            <h2 className="mt-2 text-[clamp(26px,3vw,38px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">En rayon pour la {model.name}</h2>
          </div>
          <Link href={`${ROUTES.shop}?plateforme=${encodeURIComponent(model.short_name ?? model.name)}`} className="font-mono text-[12px] uppercase tracking-[0.06em] text-sale underline underline-offset-4">
            Tout voir en boutique
          </Link>
        </div>
        {consoles.length || games.length || accessories.length ? (
          <div className="mt-8 space-y-10">
            {consoles.length ? (
              <div>
                <h3 className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">Consoles et produits {model.name}</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-3.5 sm:[grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                  {consoles.slice(0, 8).map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ) : null}
            {games.length ? (
              <div>
                <h3 className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">Jeux</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-3.5 sm:[grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                  {games.slice(0, 8).map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ) : null}
            {accessories.length ? (
              <div>
                <h3 className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">Accessoires et pièces</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-3.5 sm:[grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                  {accessories.slice(0, 8).map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-[14.5px] text-ink-faint">
            Rien en rayon pour ce modèle en ce moment. Vous en avez une à vendre ?{" "}
            <Link href={ROUTES.tradeIn} className="text-sale underline">
              Estimer ma reprise
            </Link>
          </p>
        )}
      </Container>

      {siblings.length ? (
        <section className="border-t border-border bg-bg-alt">
          <Container className="py-12">
            <h2 className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">Autres consoles {model.brand.name}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {siblings.map((m) => (
                <li key={m.id}>
                  <Link href={`${ROUTES.consoles}/${m.slug}`} className="inline-block border border-border-strong chip text-ink hover:border-ink">
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  );
}
