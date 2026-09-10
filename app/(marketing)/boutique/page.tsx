import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { ProductCard } from "@/components/shop/product-card";
import { getProductCategoryCounts, getProductPlatforms, getProducts, type ProductFilters } from "@/lib/shop/catalog";
import { CATEGORY_LABELS, CATEGORY_SLUGS, type ProductCategory } from "@/lib/shop/status";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique — consoles, jeux, accessoires, rétro",
  description: "Le stock du magasin en ligne : consoles neuves et d'occasion révisées, jeux, accessoires, rétrogaming. Retrait en boutique ou envoi.",
  alternates: { canonical: `${SITE_URL}${ROUTES.shop}` },
};

const SORTS: { key: NonNullable<ProductFilters["sort"]>; label: string }[] = [
  { key: "recent", label: "Nouveautés" },
  { key: "price-asc", label: "Prix croissant" },
  { key: "price-desc", label: "Prix décroissant" },
  { key: "name", label: "Nom" },
];

type Search = { q?: string; cat?: string; plateforme?: string; etat?: string; dispo?: string; retro?: string; tri?: string; min?: string; max?: string };

function buildHref(current: Search, patch: Partial<Search>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) params.set(k, v);
  const s = params.toString();
  return `${ROUTES.shop}${s ? `?${s}` : ""}`;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("border border-border-strong chip text-ink", active ? "bg-paper-strong" : "bg-transparent hover:border-ink")} aria-current={active ? "true" : undefined}>
      {children}
    </Link>
  );
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const cents = (v?: string) => (v && /^\d+([.,]\d{1,2})?$/.test(v) ? Math.round(Number(v.replace(",", ".")) * 100) : undefined);
  const sort = SORTS.find((s) => s.key === sp.tri)?.key;
  const filters: ProductFilters = {
    q: sp.q,
    category: sp.cat,
    platform: sp.plateforme,
    condition: sp.etat === "neuf" || sp.etat === "occasion" || sp.etat === "revise" ? sp.etat : undefined,
    availability: sp.dispo === "stock" ? "stock" : undefined,
    retro: sp.retro === "1",
    minCents: cents(sp.min),
    maxCents: cents(sp.max),
    sort,
  };
  const [products, platforms, counts] = await Promise.all([getProducts(filters), getProductPlatforms(), getProductCategoryCounts()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Container className="py-[72px]">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Boutique</Eyebrow>
          <h1 className="mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{sp.cat ? CATEGORY_LABELS[(Object.entries(CATEGORY_SLUGS).find(([, s]) => s === sp.cat)?.[0] ?? "CONSOLE") as ProductCategory] : sp.retro === "1" ? "Rétro & occasion" : "En rayon cette semaine"}</h1>
        </div>
        <span className="border-b border-sale font-mono text-[12.5px] uppercase tracking-[0.06em] text-sale">
          {products.length} / {total} réf.
        </span>
      </div>

      {total > 0 ? (
      <form method="get" action={ROUTES.shop} className="mb-4 flex flex-wrap items-center gap-2">
        {sp.cat ? <input type="hidden" name="cat" value={sp.cat} /> : null}
        {sp.retro ? <input type="hidden" name="retro" value={sp.retro} /> : null}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Rechercher un jeu, une console, une référence" aria-label="Recherche" className="min-w-0 flex-[1_1_260px] border border-border-strong bg-field px-3 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:py-[9px] sm:text-[14px]" />
        <select name="plateforme" defaultValue={sp.plateforme ?? ""} aria-label="Plateforme" className="flex-[1_1_150px] border border-border-strong bg-field px-3 py-3 font-mono text-[16px] uppercase tracking-[0.06em] text-ink sm:flex-none sm:py-[9px] sm:text-[12px]">
          <option value="">Toutes plateformes</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select name="etat" defaultValue={sp.etat ?? ""} aria-label="État" className="flex-[1_1_150px] border border-border-strong bg-field px-3 py-3 font-mono text-[16px] uppercase tracking-[0.06em] text-ink sm:flex-none sm:py-[9px] sm:text-[12px]">
          <option value="">Tout état</option>
          <option value="neuf">Neuf</option>
          <option value="occasion">Occasion</option>
          <option value="revise">Révisé</option>
        </select>
        <select name="tri" defaultValue={sp.tri ?? ""} aria-label="Tri" className="flex-[1_1_150px] border border-border-strong bg-field px-3 py-3 font-mono text-[16px] uppercase tracking-[0.06em] text-ink sm:flex-none sm:py-[9px] sm:text-[12px]">
          <option value="">Mise en avant</option>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <input name="min" defaultValue={sp.min ?? ""} placeholder="Prix min €" inputMode="decimal" aria-label="Prix minimum" className="w-[calc(50%-4px)] border border-border-strong bg-field px-3 py-3 font-mono text-[16px] text-ink placeholder:text-ink-muted sm:w-[110px] sm:py-[9px] sm:text-[12px]" />
        <input name="max" defaultValue={sp.max ?? ""} placeholder="Prix max €" inputMode="decimal" aria-label="Prix maximum" className="w-[calc(50%-4px)] border border-border-strong bg-field px-3 py-3 font-mono text-[16px] text-ink placeholder:text-ink-muted sm:w-[110px] sm:py-[9px] sm:text-[12px]" />
        <label className="flex min-h-11 items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink">
          <input type="checkbox" name="dispo" value="stock" defaultChecked={sp.dispo === "stock"} className="h-[18px] w-[18px] appearance-none border border-ink bg-field checked:bg-accent sm:h-4 sm:w-4" /> En stock
        </label>
        <button type="submit" className="chip flex-[1_1_120px] cursor-pointer bg-ink-900 text-paper hover:bg-sale sm:flex-none">
          Filtrer
        </button>
      </form>
      ) : null}

      {/* Bande à défilement horizontal au téléphone : les catégories restent sur
          une ligne au lieu d'occuper trois rangées avant le premier produit. */}
      {total > 0 ? (
      <div className="scroll-strip mb-[26px] gap-2 sm:flex-wrap">
        <Chip href={buildHref(sp, { cat: undefined, retro: undefined })} active={!sp.cat && sp.retro !== "1"}>
          Tout
        </Chip>
        {/* Une catégorie sans aucune référence n'est pas un filtre : c'est une
            promesse vide. On n'affiche que celles qui ont du stock. */}
        {(Object.keys(CATEGORY_LABELS) as ProductCategory[])
          .filter((c) => counts[c] > 0)
          .map((c) => (
            <Chip key={c} href={buildHref(sp, { cat: CATEGORY_SLUGS[c], retro: undefined })} active={sp.cat === CATEGORY_SLUGS[c]}>
              {CATEGORY_LABELS[c]} · {counts[c]}
            </Chip>
          ))}
        <Chip href={buildHref(sp, { retro: "1", cat: undefined })} active={sp.retro === "1"}>
          Rétro
        </Chip>
        <Chip href={buildHref(sp, { etat: "occasion" })} active={sp.etat === "occasion"}>
          Occasion
        </Chip>
      </div>
      ) : null}

      {products.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-3.5 sm:[grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border-strong bg-surface-muted px-6 py-8">
          {/* Deux états vides distincts : un catalogue sans aucune référence n'est
              pas un filtre trop étroit, et proposer d'élargir la recherche y
              serait trompeur. Même bloc, même mise en forme. */}
          {total === 0 ? (
            <>
              <p className="text-[15.5px] font-semibold text-ink">Aucun produit disponible pour le moment.</p>
              <p className="mt-1 text-sm text-ink-muted">
                Le rayon en ligne est en cours de mise à jour. Passez au magasin, ou{" "}
                <Link href={ROUTES.repair} className="text-sale underline">
                  faites réparer votre console
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-[15.5px] font-semibold text-ink">Aucun article ne correspond à ces critères.</p>
              <p className="mt-1 text-sm text-ink-muted">
                Élargissez la recherche ou{" "}
                <Link href={ROUTES.shop} className="text-sale underline">
                  affichez tout le catalogue
                </Link>
                .
              </p>
            </>
          )}
        </div>
      )}
      <p className="mt-8 text-[13px] text-ink-faint">Les états d&apos;occasion sont indiqués sur chaque fiche (grade A, B ou C, défauts détaillés). Un article d&apos;occasion n&apos;est jamais présenté comme neuf.</p>
    </Container>
  );
}
