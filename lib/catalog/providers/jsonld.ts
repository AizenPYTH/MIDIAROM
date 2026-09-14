import type { ExternalImage, ExternalProduct } from "@/lib/catalog/providers/types";

/**
 * Lecture des données structurées schema.org d'une page produit.
 *
 * **Pourquoi celles-ci plutôt que le HTML.** La première version envoyait un
 * terme de recherche à un acteur Apify qui n'en accepte pas — un schéma deviné,
 * jamais vérifié, et un HTTP 400 à la première tentative réelle. Lire les
 * classes CSS d'une boutique n'aurait pas valu mieux : elles changent sans
 * préavis et personne ne s'est engagé sur elles.
 *
 * `<script type="application/ld+json">` est autre chose : un format **public et
 * documenté** (schema.org), que les boutiques publient pour Google et qu'elles
 * ont donc tout intérêt à garder stable. On dépend d'une norme, pas du secret
 * d'implémentation d'un tiers.
 *
 * Ce fichier ne fait aucune requête : il transforme du texte en produits, et se
 * teste entièrement hors ligne.
 */

/** Un bloc `<script type="application/ld+json">`, quels que soient ses attributs. */
const BLOCS = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Tous les nœuds JSON-LD d'une page, `@graph` aplati.
 *
 * Un bloc illisible est ignoré plutôt que de faire échouer la page : une
 * boutique publie souvent plusieurs blocs, et un seul mal formé ne doit pas
 * emporter les autres.
 */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const pousser = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(pousser);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node["@graph"]) pousser(node["@graph"]);
    nodes.push(node);
  };

  for (const match of html.matchAll(BLOCS)) {
    const brut = match[1]?.trim();
    if (!brut) continue;
    try {
      pousser(JSON.parse(brut));
    } catch {
      /* bloc illisible : on passe au suivant */
    }
  }
  return nodes;
}

function isType(node: Record<string, unknown>, type: string): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase() === type.toLowerCase();
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && x.toLowerCase() === type.toLowerCase());
  return false;
}

/** Les nœuds `Product`, y compris ceux emballés dans un `ItemList`. */
export function productNodes(nodes: Record<string, unknown>[]): Record<string, unknown>[] {
  const produits: Record<string, unknown>[] = [];
  for (const node of nodes) {
    if (isType(node, "Product")) {
      produits.push(node);
      continue;
    }
    if (isType(node, "ItemList") && Array.isArray(node.itemListElement)) {
      for (const item of node.itemListElement) {
        if (!item || typeof item !== "object") continue;
        const element = item as Record<string, unknown>;
        // Un élément de liste emballe son produit dans `item`, mais toutes les
        // boutiques ne posent pas le `@type: ListItem` : on regarde l'emballage
        // d'abord, puis l'élément lui-même.
        for (const cible of [element.item, element]) {
          if (cible && typeof cible === "object" && isType(cible as Record<string, unknown>, "Product")) {
            produits.push(cible as Record<string, unknown>);
            break;
          }
        }
      }
    }
  }
  return produits;
}

/** Les URL de produits listées par un `ItemList`, quand il ne porte que des liens. */
export function productUrls(nodes: Record<string, unknown>[], base: string): string[] {
  const urls: string[] = [];
  const ajouter = (value: unknown) => {
    if (typeof value !== "string") return;
    try {
      urls.push(new URL(value, base).toString());
    } catch {
      /* URL inexploitable */
    }
  };
  for (const node of nodes) {
    if (!isType(node, "ItemList") || !Array.isArray(node.itemListElement)) continue;
    for (const item of node.itemListElement) {
      if (typeof item === "string") {
        ajouter(item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const element = item as Record<string, unknown>;
      ajouter(element.url);
      const cible = element.item;
      if (cible && typeof cible === "object") ajouter((cible as Record<string, unknown>).url);
      else ajouter(cible);
    }
  }
  return [...new Set(urls)];
}

/** Chaîne non vide, en acceptant qu'un champ schema.org soit un objet nommé. */
function texte(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    for (const v of value) {
      const t = texte(v);
      if (t) return t;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return texte(node.name) ?? texte(node["@value"]) ?? null;
  }
  return null;
}

/** Les images d'un `Product` : chaîne, tableau, ou `ImageObject`. */
function images(value: unknown, base: string): string[] {
  const urls: string[] = [];
  const ajouter = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(ajouter);
    if (v && typeof v === "object") return ajouter((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).contentUrl);
    if (typeof v !== "string" || !v.trim()) return;
    try {
      urls.push(new URL(v.trim(), base).toString());
    } catch {
      /* URL inexploitable */
    }
  };
  ajouter(value);
  return [...new Set(urls)].slice(0, 8);
}

/** `offers` peut être un objet, un tableau, ou une `AggregateOffer`. */
function offre(value: unknown): { priceCents: number | null; currency: string | null } {
  const premier = Array.isArray(value) ? value[0] : value;
  if (!premier || typeof premier !== "object") return { priceCents: null, currency: null };
  const node = premier as Record<string, unknown>;
  const brut = texte(node.price) ?? texte(node.lowPrice);
  const valeur = brut ? Number.parseFloat(brut.replace(/[^\d.]/g, "")) : NaN;
  return {
    priceCents: Number.isFinite(valeur) && valeur > 0 ? Math.round(valeur * 100) : null,
    currency: texte(node.priceCurrency),
  };
}

/** Dimensions : schema.org les éclate en hauteur / largeur / profondeur. */
function taille(node: Record<string, unknown>): string | null {
  const direct = texte(node.size);
  if (direct) return direct;
  const parts = [
    texte(node.height) ? `H ${texte(node.height)}` : null,
    texte(node.width) ? `L ${texte(node.width)}` : null,
    texte(node.depth) ? `P ${texte(node.depth)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" × ") : null;
}

/**
 * Un `Product` schema.org → notre modèle.
 *
 * Rien n'est inventé : un champ que la page ne publie pas reste `null`. Sans
 * nom ni référence exploitable, la fiche est écartée.
 */
export function productFromSchema(node: Record<string, unknown>, source: string, pageUrl: string): ExternalProduct | null {
  const name = texte(node.name);
  if (!name) return null;

  const url = (() => {
    const brut = texte(node.url);
    if (!brut) return pageUrl;
    try {
      return new URL(brut, pageUrl).toString();
    } catch {
      return pageUrl;
    }
  })();

  const ref = texte(node.sku) ?? texte(node.mpn) ?? texte(node.productID) ?? texte(node.identifier) ?? url;
  if (!ref) return null;

  const { priceCents, currency } = offre(node.offers);
  const visuels: ExternalImage[] = images(node.image, pageUrl).map((u) => ({ url: u, source, sourceUrl: url }));

  return {
    ref,
    name,
    url,
    manufacturer: texte(node.brand) ?? texte(node.manufacturer),
    series: texte(node.isPartOf) ?? texte(node.category),
    character: texte(node.character) ?? null,
    ean: texte(node.gtin13) ?? texte(node.gtin) ?? texte(node.gtin12) ?? texte(node.gtin8) ?? null,
    size: taille(node),
    releaseDate: texte(node.releaseDate) ?? texte(node.productionDate),
    description: texte(node.description),
    images: visuels,
    priceCents,
    currency,
  };
}
