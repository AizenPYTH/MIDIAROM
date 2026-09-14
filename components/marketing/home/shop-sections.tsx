import Link from "next/link";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { ROUTES } from "@/config/site";
import type { Product } from "@/lib/shop/catalog";
import { CONDITION_LABELS, stockState } from "@/lib/shop/status";
import { formatPrice } from "@/lib/utils/format";

/**
 * Rayons secondaires de l'accueil : ce qui passe sur le banc, puis consoles,
 * collectors et accessoires.
 *
 * Les trois rayons lisent le **vrai catalogue**, filtré par catégorie. Aucune
 * donnée n'est inventée : un rayon vide ne s'affiche pas du tout, plutôt que
 * d'annoncer un stock qui n'existe pas. Ils sont donc déjà prêts à recevoir
 * leurs produits — il suffit que l'atelier les saisisse.
 */

const LIME = "#d8ff3e";
const CYAN = "#33e1ff";
const VIOLET = "#7c5cff";
const ROSE = "#ff5ca8";

const SERVICES = [
  { name: "Consoles de salon", from: "dès 49 €", note: "PS5, PS4, Xbox, Switch. HDMI, alimentation, lecteur, surchauffe.", color: CYAN },
  { name: "Manettes", from: "dès 39 €", note: "Dérive des sticks, boutons morts, port de charge, la paire de Joy-Con.", color: LIME },
  { name: "Smartphones", from: "dès 59 €", note: "Écran, batterie, connecteur de charge, désoxydation après dégât liquide.", color: VIOLET },
  { name: "iPhone", from: "dès 69 €", note: "Vitre et bloc écran, batterie, Face ID, pièces d'origine sur demande.", color: ROSE },
  { name: "PC et portables", from: "dès 55 €", note: "Nettoyage, pâte thermique, SSD, clavier, réinstallation complète.", color: CYAN },
  { name: "Rétro", from: "dès 65 €", note: "Recap condensateurs, pile de sauvegarde, sortie RGB ou HDMI.", color: LIME },
];

/** Ce qui passe sur le banc. Les tarifs viennent du handoff, mot pour mot. */
export function ServicesGrid() {
  return (
    <section id="services" style={{ position: "relative", padding: "110px 30px", maxWidth: 1420, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 26, flexWrap: "wrap", marginBottom: 44 }}>
        <h2 data-reveal="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,5.2vw,74px)", lineHeight: 0.9, letterSpacing: "-0.04em", maxWidth: "18ch" }}>
          Ce qui passe sur le banc.
        </h2>
        <Link href={ROUTES.repair} style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid rgba(244,242,255,0.35)", paddingBottom: 4, whiteSpace: "nowrap" }}>
          Tous les tarifs
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px,1fr))", gap: 16 }}>
        {SERVICES.map((service) => (
          <Link
            key={service.name}
            href={ROUTES.repair}
            data-reveal="1"
            className="glass"
            style={{ position: "relative", overflow: "hidden", borderRadius: 26, padding: 22, display: "flex", flexDirection: "column", gap: 9, color: "#f4f2ff", minHeight: 128 }}
          >
            <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
              <strong style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 23, letterSpacing: "-0.03em" }}>{service.name}</strong>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, whiteSpace: "nowrap", color: service.color }}>{service.from}</span>
            </span>
            <span style={{ fontSize: 14.5, lineHeight: 1.45, color: "#9a95c4" }}>{service.note}</span>
          </Link>
        ))}
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

function ProductRow({ product }: { product: Product }) {
  const photo = (product.images ?? [])[0] ?? null;
  return (
    <Link href={`${ROUTES.shop}/${product.slug}`} data-reveal="1" data-row="1" style={{ display: "grid", gridTemplateColumns: "minmax(96px, 150px) 1fr", gap: 22, alignItems: "center", padding: "20px 0", borderTop: "1px solid rgba(255,244,234,0.1)" }}>
      <span style={{ position: "relative", display: "block", aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,244,234,0.14)", background: "rgba(255,244,234,0.04)" }}>
        <SafeImage src={photo} sizes="150px" fallback={<span />} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9a695" }}>
          {CONDITION_LABELS[product.condition]}
        </span>
        <strong style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(19px,2.2vw,27px)", letterSpacing: "-0.03em", color: "#fff4ea" }}>{product.name}</strong>
        {product.description ? (
          <span style={{ fontSize: 14.5, lineHeight: 1.45, color: "#e4c9bd", maxWidth: "48ch" }}>{product.description}</span>
        ) : null}
        <span style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "#ff9a5c" }}>{formatPrice(product.price_cents)}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9a695" }}>{stockLabel(product)}</span>
        </span>
      </span>
    </Link>
  );
}

function ProductCard({ product }: { product: Product }) {
  const photo = (product.images ?? [])[0] ?? null;
  return (
    <Link href={`${ROUTES.shop}/${product.slug}`} data-reveal="1" data-card="1" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <span data-card-frame="1" style={{ position: "relative", display: "block", aspectRatio: "3/4", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,244,234,0.16)", background: "rgba(255,244,234,0.04)" }}>
        <SafeImage src={photo} sizes="(max-width: 900px) 45vw, 300px" fallback={<span />} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9a695" }}>
          {product.platform || CONDITION_LABELS[product.condition]}
        </span>
        <strong style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.025em", color: "#fff4ea" }}>{product.name}</strong>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "#ff9a5c" }}>{formatPrice(product.price_cents)}</span>
      </span>
    </Link>
  );
}

function Rayon({ title, eyebrow, href, children }: { title: string; eyebrow?: string; href?: string; children: React.ReactNode }) {
  return (
    <section data-warm="1" style={{ position: "relative", background: "#0d0710", padding: "80px 30px" }}>
      <div style={{ maxWidth: 1420, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 38 }}>
          <h2 data-reveal="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px,4.2vw,58px)", letterSpacing: "-0.04em", color: "#fff4ea" }}>
            {title}
          </h2>
          <span style={{ display: "flex", gap: 20, alignItems: "baseline", flexWrap: "wrap" }}>
            {eyebrow ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c9a695" }}>{eyebrow}</span>
            ) : null}
            {href ? (
              <Link href={href} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff4ea", borderBottom: "1px solid rgba(255,244,234,0.35)", paddingBottom: 3, whiteSpace: "nowrap" }}>
                Tout le rayon
              </Link>
            ) : null}
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}

/**
 * Les rayons hors jeux vidéo.
 *
 * Chacun disparaît quand son rayon est vide : le magasin physique est plein,
 * mais la page ne prétend pas avoir en ligne ce qui n'y est pas.
 */
export function ShopRows({ consoles, collectibles, accessories }: { consoles: Product[]; collectibles: Product[]; accessories: Product[] }) {
  return (
    <>
      {consoles.length ? (
        <Rayon title="Dernières consoles" href={`${ROUTES.shop}?category=consoles`}>
          <div>
            {consoles.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </div>
        </Rayon>
      ) : null}

      {collectibles.length ? (
        <Rayon title="Meilleures figurines" eyebrow="Sélection de la vitrine" href={`${ROUTES.shop}?category=collector`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 22 }}>
            {collectibles.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Rayon>
      ) : null}

      {accessories.length ? (
        <Rayon title="Le moment" eyebrow="En rayon cette semaine" href={`${ROUTES.shop}?category=accessoires`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 22 }}>
            {accessories.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Rayon>
      ) : null}
    </>
  );
}
