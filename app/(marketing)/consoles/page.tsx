import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { getActiveBrands, getActiveModels } from "@/lib/repair/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils/cn";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Consoles — fiches, réparations et produits",
  description: "Toutes les consoles prises en charge, de la NES à la PS5 : variantes, pannes fréquentes, réparations et prix, produits en vente.",
  alternates: { canonical: `${SITE_URL}${ROUTES.consoles}` },
};

/** Index des fiches consoles : marques → modèles, avec le nombre de réparations publiées et de produits en vente. */
export default async function ConsolesIndexPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const [brands, models] = await Promise.all([getActiveBrands(), getActiveModels()]);
  const db = createSupabaseAdminClient();
  const [{ data: repairRows }, { data: productRows }] = await Promise.all([
    db.from("repairs").select("model_id").eq("is_active", true).eq("is_seo_published", true),
    db.from("products").select("model_id, platform").eq("is_active", true).gt("quantity", 0),
  ]);
  const repairCount = new Map<string, number>();
  for (const r of repairRows ?? []) repairCount.set(r.model_id, (repairCount.get(r.model_id) ?? 0) + 1);
  const productCount = new Map<string, number>();
  for (const p of productRows ?? []) if (p.model_id) productCount.set(p.model_id, (productCount.get(p.model_id) ?? 0) + 1);

  const filters = [
    { key: "all", label: "Toutes" },
    ...brands.map((b) => ({ key: b.slug, label: b.name })),
    { key: "retro", label: "Rétro" },
    { key: "portable", label: "Portables" },
  ];
  const current = filters.some((x) => x.key === f) ? f! : "all";
  const visible = models.filter((m) => (current === "all" ? true : current === "retro" ? m.is_retro : current === "portable" ? m.is_handheld : brands.find((b) => b.id === m.brand_id)?.slug === current));

  return (
    <>
      <section className="border-b border-border bg-bg-alt">
        <Container className="py-14">
          <Eyebrow tone="repair">Consoles</Eyebrow>
          <h1 className="mt-2 text-[clamp(32px,4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">Toutes les consoles, de la NES à la PS5.</h1>
          <p className="mt-3 max-w-[48ch] text-[17px] leading-[1.5] text-ink-soft">Chaque fiche regroupe les variantes du modèle, ses pannes fréquentes, les réparations proposées par l&apos;atelier avec leurs prix, et ce que nous avons en rayon pour cette console.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {filters.map((x) => (
              <Link key={x.key} href={x.key === "all" ? ROUTES.consoles : `${ROUTES.consoles}?f=${x.key}`} className={cn("whitespace-nowrap border border-border-strong px-3.5 py-[9px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink", current === x.key ? "bg-paper-strong" : "bg-transparent hover:border-ink")} aria-current={current === x.key ? "true" : undefined}>
                {x.label}
              </Link>
            ))}
          </div>
        </Container>
      </section>
      <Container className="py-14">
        <div className="space-y-10">
          {brands.map((brand) => {
            const brandModels = visible.filter((m) => m.brand_id === brand.id);
            if (!brandModels.length) return null;
            return (
              <div key={brand.id}>
                <h2 className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-muted">{brand.name}</h2>
                <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
                  {brandModels.map((m) => {
                    const repairs = repairCount.get(m.id) ?? 0;
                    const products = productCount.get(m.id) ?? 0;
                    return (
                      <li key={m.id}>
                        <Link href={`${ROUTES.consoles}/${m.slug}`} className="flex h-full flex-col gap-1.5 border border-border-strong bg-surface p-[14px] transition-colors hover:border-accent">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-[16px] font-semibold text-ink">{m.name}</span>
                            {m.release_year ? <span className="font-mono text-[11px] text-ink-muted">{m.release_year}</span> : null}
                          </span>
                          <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                            {m.is_retro ? "rétro" : "actuelle"}
                            {m.is_handheld ? " · portable" : ""}
                            {m.variants.length ? ` · ${m.variants.length} variante${m.variants.length > 1 ? "s" : ""}` : ""}
                          </span>
                          <span className="mt-auto pt-1 text-[12.5px] text-ink-faint">
                            {repairs ? `${repairs} réparation${repairs > 1 ? "s" : ""}` : "diagnostic sur demande"}
                            {products ? ` · ${products} en rayon` : ""}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {!visible.length ? <p className="text-sm text-ink-muted">Aucune console ne correspond à ce filtre.</p> : null}
        </div>
      </Container>
    </>
  );
}
