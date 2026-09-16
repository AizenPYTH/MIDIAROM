import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { getProductCategoryCounts, getProductPlatforms, getProducts, type ProductFilters } from "@/lib/shop/catalog";
import { getRayons } from "@/lib/shop/categories";
import { codeDuSlug, libelleDe, rayonsPublics, slugDe } from "@/lib/shop/rayons";
import { ShopCategories } from "@/components/marketing/home/sections";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

/**
 * Chaque rayon est une page à part entière.
 *
 * Les trois rayons partageaient un seul titre, une seule description et une
 * seule adresse canonique : pour un moteur de recherche comme pour un lien
 * partagé, « Figurines » et « Consoles » étaient la même page. C'est ce que
 * signalait la maquette, où les trois entrées du menu pointaient sur la même
 * ancre.
 *
 * Le paramètre `cat` décide donc aussi des métadonnées, et la canonique porte
 * le rayon. Les autres filtres — état, plateforme, prix, tri — n'y figurent
 * pas : ce sont des vues d'un même rayon, pas des pages distinctes, et les
 * indexer produirait des dizaines de doublons.
 */
const RAYONS_SEO: Record<string, { titre: string; description: string }> = {
  jeux: {
    titre: "Jeux vidéo — neuf, occasion testée, import et collector",
    description: "Le rayon jeux vidéo du 207 rue de Rome : PlayStation, Nintendo, Xbox et rétro, neufs et d'occasion testés. Retrait en boutique ou envoi suivi.",
  },
  consoles: {
    titre: "Consoles — récentes et rétro, révisées en atelier",
    description: "Consoles PlayStation, Nintendo, Xbox et rétro, révisées dans notre atelier de Marseille, garanties trois mois. Manettes et accessoires.",
  },
  figurines: {
    titre: "Figurines manga et anime — One Piece, Naruto, Dragon Ball",
    description: "Figurines de personnages manga et anime : One Piece, Naruto, Dragon Ball, Demon Slayer, Jujutsu Kaisen. En rayon au 207 rue de Rome à Marseille.",
  },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { cat } = await searchParams;
  const rayons = await getRayons();
  const code = codeDuSlug(rayons, cat);
  // La canonique porte toujours le slug **propre** du rayon, jamais l'alias par
  // lequel on est arrivé : `?cat=manga` et `?cat=figurines` montrent le même
  // rayon, et deux canoniques différentes en feraient deux pages aux yeux d'un
  // moteur.
  const slugCanonique = code ? slugDe(rayons, code) : cat;
  const redige = slugCanonique ? RAYONS_SEO[slugCanonique] : undefined;

  // Un rayon créé au back-office n'a pas de texte rédigé : on en fabrique un
  // honnête à partir de son libellé plutôt que de lui donner le titre général
  // de la boutique, qui ferait de lui un doublon aux yeux d'un moteur.
  if (!redige && code) {
    const label = libelleDe(rayons, code);
    return {
      title: `${label} — 207 rue de Rome, Marseille`,
      description: `Le rayon ${label.toLowerCase()} du 207 MÉDI@ROM : stock du magasin, retrait en boutique ou envoi suivi.`,
      alternates: { canonical: `${SITE_URL}${ROUTES.shop}?cat=${slugCanonique}` },
    };
  }
  if (!redige) {
    return {
      title: "Boutique — consoles, jeux, figurines, rétro",
      description: "Le stock du magasin en ligne : consoles neuves et d'occasion révisées, jeux, figurines manga et anime, rétrogaming. Retrait en boutique ou envoi.",
      alternates: { canonical: `${SITE_URL}${ROUTES.shop}` },
    };
  }
  return {
    title: redige.titre,
    description: redige.description,
    alternates: { canonical: `${SITE_URL}${ROUTES.shop}?cat=${slugCanonique}` },
  };
}

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
  const [products, platforms, counts, rayons] = await Promise.all([getProducts(filters), getProductPlatforms(), getProductCategoryCounts(), getRayons()]);
  const rayonCourant = codeDuSlug(rayons, sp.cat);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Container className="py-[72px]">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Boutique</Eyebrow>
          <h1 className="mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{rayonCourant ? libelleDe(rayons, rayonCourant) : sp.retro === "1" ? "Rétro & occasion" : "En rayon cette semaine"}</h1>
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

      {/* Les trois rayons, en grand, quand on arrive sans filtre : c'est la
          première chose qu'une boutique doit montrer. Sans son titre : la page
          en porte déjà un, et le sien annoncerait la boutique à quelqu'un qui y
          est déjà. */}
      {!sp.cat && sp.retro !== "1" && !sp.q ? (
        <div className="-mx-4 mb-8 sm:-mx-8">
          <ShopCategories heading={false} />
        </div>
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
        {rayonsPublics(rayons)
          .filter((r) => (counts[r.code] ?? 0) > 0)
          .map((r) => (
            <Chip key={r.code} href={buildHref(sp, { cat: r.slug, retro: undefined })} active={sp.cat === r.slug}>
              {r.label} · {counts[r.code]}
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
        <ProductGrid>
          {products.map((p) => (
            <li key={p.id} className="min-w-0">
              <ProductCard product={p} />
            </li>
          ))}
        </ProductGrid>
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
