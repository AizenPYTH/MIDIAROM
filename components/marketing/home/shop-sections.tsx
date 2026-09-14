import Image from "next/image";
import Link from "next/link";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { SERVICE_PHOTOS } from "@/lib/content/assets";
import { ROUTES } from "@/config/site";
import type { Product } from "@/lib/shop/catalog";
import { CATEGORY_SLUGS, CONDITION_LABELS, stockState, type ProductCategory } from "@/lib/shop/status";
import { formatPrice } from "@/lib/utils/format";

/**
 * Les deux blocs de la boutique : ce que l'atelier répare, puis ce qu'il vend.
 *
 * La boutique est orientée **gaming et pop culture** : jeux vidéo, consoles,
 * figurines, manga & anime. Rien d'autre. L'atelier répare aussi des
 * smartphones et des PC — le parcours de devis les propose toujours — mais ce
 * ne sont pas des rayons du magasin, et les mettre en avant ici brouillerait
 * ce que MÉDI@ROM vend.
 *
 * Aucune donnée n'est inventée : les rayons lisent le vrai catalogue, un rayon
 * vide s'annonce comme tel plutôt que d'afficher un stock qui n'existe pas.
 */

const LIME = "#d8ff3e";
const CYAN = "#33e1ff";
const VIOLET = "#7c5cff";
const ROSE = "#ff5ca8";
const EMBER = "#ff7a3d";

/**
 * Ce qui passe sur le banc, côté jeu.
 *
 * Les trois familles de machines d'abord, puis les interventions les plus
 * demandées. Les tarifs sont ceux du parcours de devis.
 */
const SERVICES = [
  { name: "Nintendo Switch", from: "dès 49 €", note: "Dérive des Joy-Con, port de charge, lecteur de cartouches, écran.", color: ROSE },
  { name: "PlayStation", from: "dès 49 €", note: "PS5, PS4, PS3. Port HDMI, surchauffe, lecteur Blu-ray, alimentation.", color: CYAN },
  { name: "Xbox", from: "dès 49 €", note: "Series X|S, One, 360. HDMI, ventilation, lecteur, alimentation.", color: LIME },
  { name: "Manettes", from: "dès 39 €", note: "Dérive des sticks, boutons morts, gâchettes, port de charge.", color: VIOLET },
  { name: "Écran & connecteur", from: "dès 59 €", note: "Dalle, vitre, nappe, port de charge dessoudé, faux contacts.", color: EMBER },
  { name: "Rétro", from: "dès 65 €", note: "Recap condensateurs, pile de sauvegarde, sortie RGB ou HDMI.", color: LIME },
];

/** Ce qui passe sur le banc. Une carte, une micro-interaction au survol. */
export function RepairServices() {
  return (
    <section id="services" style={{ position: "relative", padding: "104px 30px", maxWidth: 1420, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 26, flexWrap: "wrap", marginBottom: 44 }}>
        <h2 data-reveal="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,5.2vw,74px)", lineHeight: 0.9, letterSpacing: "-0.04em", maxWidth: "18ch" }}>
          Ce qui passe sur le banc.
        </h2>
        <Link href={ROUTES.repair} data-reveal="1" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid rgba(244,242,255,0.35)", paddingBottom: 4, whiteSpace: "nowrap" }}>
          Tous les tarifs
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px,1fr))", gap: 16 }}>
        {SERVICES.map((service) => (
          <Link key={service.name} href={ROUTES.repair} data-reveal="1" className="glass card-lift" style={{ position: "relative", overflow: "hidden", borderRadius: 26, padding: 0, display: "flex", flexDirection: "column", color: "#f4f2ff" }}>
            {/* Emplacement photo : le magasin fournira ses propres visuels. */}
            <span style={{ position: "relative", display: "block", aspectRatio: "16/11", overflow: "hidden", borderBottom: "1px solid rgba(244,242,255,0.1)", background: SERVICE_PHOTOS[service.name] ? "radial-gradient(120% 120% at 50% 40%, #f7f6fb, #d9d6e8)" : "transparent" }}>
              {SERVICE_PHOTOS[service.name] ? (
                <Image src={SERVICE_PHOTOS[service.name]!} alt="" fill sizes="(max-width: 900px) 90vw, 320px" style={{ objectFit: "contain", padding: 18 }} />
              ) : (
                <PhotoSlot label={service.name} accent={`${service.color}26`} />
              )}
            </span>
            <span style={{ padding: 22, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
              <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
                <strong style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 23, letterSpacing: "-0.03em" }}>{service.name}</strong>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, whiteSpace: "nowrap", color: service.color }}>{service.from}</span>
              </span>
              <span style={{ fontSize: 14.5, lineHeight: 1.45, color: "#9a95c4" }}>{service.note}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Les quatre rayons du magasin, dans l'ordre où on les annonce partout. */
export const SHOP_CATEGORIES: { category: ProductCategory; name: string; note: string; color: string }[] = [
  { category: "GAME", name: "Jeux vidéo", note: "Neuf et occasion testée, toutes générations.", color: CYAN },
  { category: "CONSOLE", name: "Consoles", note: "Révisées en atelier, garanties trois mois.", color: LIME },
  { category: "COLLECTIBLE", name: "Figurines", note: "Collectors, éditions limitées, pièces uniques.", color: ROSE },
  { category: "MANGA", name: "Manga & Anime", note: "Séries, tomes uniques, éditions collector.", color: EMBER },
];

/**
 * L'entrée de la boutique : quatre rayons, immédiatement compréhensibles.
 *
 * Chaque carte mène au rayon réel (`/boutique?cat=…`) et annonce ce qu'il
 * contient vraiment. Un rayon vide le dit — on ne promet pas un stock absent.
 */
export function ShopCategories({ counts }: { counts: Record<ProductCategory, number> }) {
  return (
    <section id="boutique" data-warm="1" style={{ position: "relative", background: "#0d0710", padding: "104px 30px 64px" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div className="anim-drift2" style={{ position: "absolute", top: "-8%", right: "-10%", width: 620, height: 620, borderRadius: 999, background: "radial-gradient(circle, #ff7a3d 0%, rgba(255,122,61,0) 68%)", filter: "blur(60px)", opacity: 0.26 }} />
      </div>

      <div style={{ position: "relative", maxWidth: 1420, margin: "0 auto" }}>
        <span data-reveal="1" style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#ffb38a" }}>
          207 rue de Rome · le magasin
        </span>
        <h2 data-reveal="1" style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(34px,5.6vw,86px)", lineHeight: 0.88, letterSpacing: "-0.045em", color: "#fff4ea" }}>
          La boutique.
        </h2>
        <p data-reveal="1" style={{ margin: "20px 0 0", fontSize: "clamp(16px,1.6vw,20px)", lineHeight: 1.42, maxWidth: "42ch", color: "#e4c9bd" }}>
          Gaming et pop culture, depuis trente ans. Le neuf, l&apos;occasion testée, le collector qu&apos;on ne trouve nulle part ailleurs.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 16, marginTop: 44 }}>
          {SHOP_CATEGORIES.map((rayon) => {
            const n = counts[rayon.category] ?? 0;
            return (
              <Link
                key={rayon.category}
                href={`${ROUTES.shop}?cat=${CATEGORY_SLUGS[rayon.category]}`}
                data-reveal="1"
                className="card-lift"
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  minHeight: 190,
                  padding: "26px 24px",
                  borderRadius: 24,
                  border: "1px solid rgba(255,244,234,0.16)",
                  background: `linear-gradient(158deg, ${rayon.color}1f, rgba(255,244,234,0.03))`,
                  color: "#fff4ea",
                  overflow: "hidden",
                }}
              >
                <span aria-hidden="true" style={{ position: "absolute", top: -40, right: -30, width: 150, height: 150, borderRadius: 999, background: `radial-gradient(circle, ${rayon.color}33, transparent 68%)`, filter: "blur(18px)" }} />
                <strong style={{ position: "relative", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,2.6vw,30px)", lineHeight: 1.02, letterSpacing: "-0.035em" }}>{rayon.name}</strong>
                <span style={{ position: "relative", fontSize: 14.5, lineHeight: 1.45, color: "#e4c9bd", flex: 1 }}>{rayon.note}</span>
                <span style={{ position: "relative", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: rayon.color }}>
                  {n > 0 ? `${n} référence${n > 1 ? "s" : ""} →` : "Arrivage en cours →"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Disponibilité, dite avec les mots du magasin plutôt qu'un chiffre brut. */
function stockLabel(product: Product): string {
  const state = stockState(product.quantity, product.low_stock_threshold);
  if (state === "OUT") return "Épuisé";
  if (product.quantity === 1) return "Pièce unique";
  return state === "LOW" ? `Plus que ${product.quantity}` : `${product.quantity} en stock`;
}

/** Une carte produit **réelle** : elle mène à sa fiche, avec son vrai prix. */
function ProductCard({ product, photo, accent }: { product: Product; photo: string | null; accent: string }) {
  return (
    <li style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
      <Link href={`${ROUTES.shop}/${product.slug}`} data-reveal="1" className="card-lift" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <span style={{ position: "relative", display: "block", aspectRatio: "3/4", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,244,234,0.16)", background: photo ? "radial-gradient(120% 120% at 50% 40%, #f7f6fb, #d9d6e8)" : "transparent" }}>
          <SafeImage src={photo} sizes="(max-width: 700px) 46vw, 240px" contain fallback={<PhotoSlot label={product.name} accent={accent} />} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9a695" }}>
            {product.platform || CONDITION_LABELS[product.condition]}
          </span>
          <strong style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16.5, lineHeight: 1.2, letterSpacing: "-0.025em", color: "#fff4ea" }}>{product.name}</strong>
          <span style={{ marginTop: "auto", display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "#ff9a5c" }}>{formatPrice(product.price_cents)}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a89689" }}>{stockLabel(product)}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Un rayon réel : titre, lien vers la catégorie, produits cliquables.
 *
 * Ne s'affiche pas du tout si le rayon est vide : mieux vaut une page plus
 * courte qu'une section qui promet un stock inexistant.
 */
export function ProductRail({
  title,
  category,
  products,
  photos,
  accent,
}: {
  title: string;
  category: ProductCategory;
  products: Product[];
  photos: Map<string, string | null>;
  accent: string;
}) {
  if (!products.length) return null;
  return (
    <section data-warm="1" aria-label={title} style={{ background: "#0d0710", padding: "26px 30px 44px" }}>
      <div style={{ maxWidth: 1420, margin: "0 auto" }}>
        <div data-reveal="1" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,2.8vw,36px)", letterSpacing: "-0.04em", color: "#fff4ea" }}>{title}</h3>
          <Link href={`${ROUTES.shop}?cat=${CATEGORY_SLUGS[category]}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffb38a" }}>
            Tout le rayon →
          </Link>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(clamp(150px, 17vw, 210px), 1fr))", gap: "26px 18px" }}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} photo={photos.get(product.id) ?? null} accent={accent} />
          ))}
        </ul>
      </div>
    </section>
  );
}
