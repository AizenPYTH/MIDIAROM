import Link from "next/link";
import { ROUTES } from "@/config/site";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";
import { GameCard, ProductCard, ProductGrid } from "@/components/shop/product-card";
import type { Product } from "@/lib/shop/catalog";
import type { GameListing } from "@/lib/shop/games";
import { CATEGORY_SLUGS, type ProductCategory } from "@/lib/shop/status";

/**
 * Les blocs commerciaux de l'accueil.
 *
 * MÉDI@ROM est d'abord une boutique : jeux vidéo, consoles, figurines manga /
 * anime. L'accueil raconte donc le rayon, pas l'entreprise — trois cartes de
 * catégorie juste sous le hero, puis de vraies grilles de produits.
 *
 * La réparation garde sa place, mais **en tant que service**, dans un bloc
 * visuellement séparé : c'est ce que l'atelier fait, pas ce qu'il vend. Les
 * smartphones et les PC y figurent à ce titre, et à ce titre seulement — jamais
 * comme rayon.
 */

/** Les trois rayons, dans l'ordre où le site les annonce partout. */
export const SHOP_CATEGORIES: {
  category: ProductCategory;
  name: string;
  /** Le nom au fil du texte : « Voir les 24 jeux vidéo ». */
  plural: string;
  note: string;
  accent: string;
}[] = [
  { category: "GAME", name: "Jeux vidéo", plural: "jeux vidéo", note: "Neuf et occasion testée, toutes générations.", accent: "rgba(14,116,144,0.20)" },
  { category: "CONSOLE", name: "Consoles", plural: "consoles", note: "Révisées en atelier, garanties trois mois.", accent: "rgba(77,124,15,0.20)" },
  { category: "COLLECTIBLE", name: "Figurines Manga / Anime", plural: "figurines", note: "One Piece, Naruto, Dragon Ball, Demon Slayer.", accent: "rgba(214,51,108,0.18)" },
];

export function categoryHref(category: ProductCategory): string {
  return `${ROUTES.shop}?cat=${CATEGORY_SLUGS[category]}`;
}

/** Les trois rayons en grandes cartes cliquables, juste sous le hero. */
export function CategoryCards({ counts }: { counts: Record<ProductCategory, number> }) {
  return (
    <section aria-label="Les rayons" className="mx-auto max-w-[1240px] px-5 pb-6 sm:px-8">
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-3">
        {SHOP_CATEGORIES.map((rayon) => {
          const n = counts[rayon.category] ?? 0;
          return (
            <li key={rayon.category} className="min-w-0">
              <Link
                href={categoryHref(rayon.category)}
                data-reveal="1"
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-[transform,box-shadow] duration-[260ms] ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[5px] hover:shadow-[0_22px_44px_rgba(24,30,45,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
              >
                {/* Emplacement du visuel de rayon : le magasin fournira ses
                    propres photos. En attendant, la plaque de la charte. */}
                <span className="relative block overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
                  <span className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.03]">
                    <PhotoSlot label={rayon.name} accent={rayon.accent} />
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-5">
                  <strong className="font-display text-[clamp(19px,2.2vw,25px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">{rayon.name}</strong>
                  <span className="text-[14.5px] leading-[1.45] text-ink-soft">{rayon.note}</span>
                  <span className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
                    {n > 0 ? `${n} référence${n > 1 ? "s" : ""}` : "Arrivage en cours"} →
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * « Voir plus », en bas du rayon.
 *
 * L'accueil ne montre que cinq articles par rayon : le visiteur doit voir les
 * trois rayons sans scroller longtemps, pas un seul rayon en entier. Ce bouton
 * est donc la suite du rayon, et il annonce ce qu'il y a derrière quand on le
 * sait — « Voir les 24 jeux vidéo » vaut mieux que « Voir plus ».
 */
function SeeMore({ href, plural, total, shown }: { href: string; plural: string; total?: number; shown: number }) {
  const reste = typeof total === "number" && total > shown;
  return (
    <div data-reveal="1" className="mt-10 flex justify-center">
      <Link
        href={href}
        className="inline-flex min-h-[52px] items-center rounded-full border border-border-strong px-8 text-[15px] font-semibold text-ink transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[3px] hover:border-ink hover:shadow-[0_18px_40px_rgba(20,17,15,0.12)]"
      >
        {reste ? `Voir les ${total} ${plural}` : `Voir tout le rayon ${plural}`}
      </Link>
    </div>
  );
}

/** L'en-tête d'un rayon : son titre, et le lien vers la catégorie entière. */
function RailHeader({ title, href, note }: { title: string; href: string; note?: string | null }) {
  return (
    <div data-reveal="1" className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h2 className="font-display text-[clamp(24px,3.2vw,38px)] font-extrabold tracking-[-0.035em] text-ink">{title}</h2>
        {note ? <p className="mt-1.5 text-[14.5px] text-ink-soft">{note}</p> : null}
      </div>
      <Link href={href} className="inline-flex min-h-[44px] items-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ink">
        Tout le rayon →
      </Link>
    </div>
  );
}

/** Un rayon de vrais produits. Ne s'affiche pas s'il est vide. */
export function ProductRail({ category, products, total }: { category: ProductCategory; products: Product[]; total?: number }) {
  if (!products.length) return null;
  const rayon = SHOP_CATEGORIES.find((c) => c.category === category);
  const href = categoryHref(category);
  return (
    <section aria-label={rayon?.name ?? "Rayon"} className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
      <RailHeader title={rayon?.name ?? "Rayon"} href={href} />
      <ProductGrid>
        {products.map((product) => (
          <li key={product.id} className="min-w-0">
            <ProductCard product={product} />
          </li>
        ))}
      </ProductGrid>
      <SeeMore href={href} plural={rayon?.plural ?? "produits"} total={total} shown={products.length} />
    </section>
  );
}

/**
 * Le rayon jeux **de démonstration**.
 *
 * Il ne sert que lorsque le catalogue ne contient encore aucun jeu. Les vrais
 * jeux passent par `ProductRail`, comme les consoles et les figurines : ce sont
 * des produits, ils s'ajoutent au panier, ils n'ont rien à faire ici.
 *
 * La distinction n'est pas cosmétique. Rendre un vrai jeu avec `GameCard` lui
 * collerait une pastille « Démo » et un prix indicatif alors qu'il est en stock
 * à son vrai prix — exactement le mensonge que toute cette séparation cherche à
 * éviter.
 */
export function DemoGamesRail({ games, total }: { games: GameListing[]; total?: number }) {
  if (!games.length) return null;
  const href = categoryHref("GAME");
  return (
    <section aria-label="Jeux vidéo" className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
      {/* La mention tient dans le sous-titre du rayon. En encadré, elle
          repoussait les jaquettes d'une hauteur de ligne pour rien. */}
      <RailHeader
        title="Jeux vidéo"
        href={href}
        note="Notre sélection du moment. Ces titres ne sont pas encore en rayon : prix indicatifs, on les fait venir sur demande."
      />
      <ProductGrid>
        {games.map((game) => (
          <li key={game.productId} className="min-w-0">
            <GameCard game={game} />
          </li>
        ))}
      </ProductGrid>
      <SeeMore href={href} plural="jeux vidéo" total={total} shown={games.length} />
    </section>
  );
}

/** Ce que l'atelier répare. Un service, pas un rayon — et ça se voit. */
const SERVICES = [
  { name: "Consoles", note: "PlayStation, Xbox, Nintendo Switch. HDMI, lecteur, surchauffe, alimentation.", from: "dès 49 €" },
  { name: "Manettes", note: "Dérive des sticks, boutons morts, gâchettes, port de charge.", from: "dès 39 €" },
  { name: "Smartphones & iPhone", note: "Écran, batterie, connecteur de charge, désoxydation.", from: "dès 59 €" },
  { name: "PC et portables", note: "Nettoyage, pâte thermique, SSD, clavier, réinstallation.", from: "dès 55 €" },
];

export function RepairBand() {
  return (
    <section id="reparation" aria-label="Réparation" className="border-y border-border bg-surface-muted">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0 max-w-[46ch]">
            <span data-reveal="1" className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">Le service</span>
            <h2 data-reveal="1" className="mt-3 font-display text-[clamp(26px,3.6vw,44px)] font-extrabold leading-[1] tracking-[-0.035em] text-ink">
              Votre appareil a un problème ?
            </h2>
            <p data-reveal="1" className="mt-3 text-[15.5px] leading-[1.5] text-ink-soft">
              Atelier à Marseille depuis 1997. Diagnostic sous 48 heures, devis avant toute intervention, garantie trois mois.
            </p>
          </div>
          <Link
            href={ROUTES.repair}
            data-reveal="1"
            className="inline-flex min-h-[52px] items-center rounded-full bg-ink px-7 font-semibold text-bg transition-opacity hover:opacity-85"
          >
            Obtenir un devis
          </Link>
        </div>

        <ul className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <li key={service.name} className="min-w-0">
              <Link
                href={ROUTES.repair}
                data-reveal="1"
                className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <strong className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{service.name}</strong>
                  <span className="whitespace-nowrap font-mono text-[12.5px] text-ink-muted">{service.from}</span>
                </span>
                <span className="text-[14px] leading-[1.45] text-ink-soft">{service.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
