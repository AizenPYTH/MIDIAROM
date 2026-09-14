import "server-only";
import { extractJsonLd, productFromSchema, productNodes } from "@/lib/catalog/providers/jsonld";
import type { CatalogProvider, ExternalImage, ExternalProduct, ProviderSearchResult } from "@/lib/catalog/providers/types";

/**
 * HobbyLink Japan.
 *
 * **Trois constats, dans l'ordre où ils sont tombés.**
 *
 * 1. L'acteur `jungle_synthesizer/…-catalog-scraper` n'accepte aucun terme de
 *    recherche — ses entrées sont `new_releases_weekly`, `preorder_status`,
 *    `category_backfill`, `sku_ids`. C'est un synchroniseur de catalogue, pas
 *    un moteur de recherche. HTTP 400.
 * 2. Lire les données structurées de la page de recherche : 200, 218 000
 *    caractères, **zéro** bloc JSON-LD. Les résultats sont rendus par le
 *    navigateur. Aucune lecture de HTML ne peut donc les atteindre.
 * 3. HLJ ne publie aucune API de recherche. Le seul point d'entrée public
 *    connu, `/search/livePrice/?item_codes=…`, renvoie des prix pour des
 *    références qu'on connaît déjà : il ne cherche pas.
 *
 * **Ce qu'on utilise donc : un acteur Apify dédié à la recherche HLJ, qui
 * existe déjà.** `lulzasaur/hlj-scraper` prend des mots-clés (`searchQueries`)
 * et rend nom, prix (USD et JPY), fabricant, catégorie, disponibilité, date de
 * sortie, GTIN, image et URL. C'est exactement la recherche voulue, maintenue
 * par quelqu'un d'autre : rien à réparer chez nous quand HLJ change son HTML.
 * Il tourne chez Apify, donc aussi bien depuis un poste que depuis Vercel —
 * un navigateur sans interface dans notre propre serveur ne tiendrait ni l'un
 * ni l'autre.
 *
 * Il est le **défaut**, pas une valeur en dur : `HLJ_APIFY_ACTOR` et
 * `HLJ_APIFY_INPUT` permettent d'en changer sans toucher au code — par exemple
 * pour `jpmarketdata/hlj-hobby-market-checker`, qui cherche aussi par mot-clé.
 * C'est la leçon du HTTP 400 : l'entrée d'un acteur appartient à sa
 * documentation, pas à nos suppositions.
 *
 * `HLJ_SEARCH_API` reste prioritaire si un jour un endpoint JSON est constaté
 * (`npm run check:hlj -- "…" --discover` sert à le chercher) : une requête vaut
 * toujours mieux qu'un navigateur.
 *
 * La lecture d'un résultat est tolérante — plusieurs noms possibles par
 * information — et n'invente rien : un champ absent reste `null`.
 */

export const HLJ_SOURCE = "HLJ";
const BASE = "https://www.hlj.com";
const TIMEOUT_MS = 90_000;

/**
 * L'acteur de recherche HLJ par défaut et l'entrée que sa documentation
 * décrit : `searchQueries` (les mots-clés), `maxItems`, `scrapeDetails`.
 */
const ACTEUR_DEFAUT = "lulzasaur/hlj-scraper";
const ENTREE_DEFAUT = '{"searchQueries":["{q}"],"maxItems":{limit},"scrapeDetails":true}';

/** Fiches détaillées ouvertes pour compléter, au plus. Jamais tout le catalogue. */
const DETAIL_MAX = 12;
const DETAIL_PARALLELE = 4;

function userAgent(): string {
  return process.env.HLJ_USER_AGENT?.trim() || "MediaromCatalogBot/1.0 (+https://207mediarom.fr)";
}

function actor(): string {
  return process.env.HLJ_APIFY_ACTOR?.trim() || ACTEUR_DEFAUT;
}

function actorInput(): string {
  return process.env.HLJ_APIFY_INPUT?.trim() || ENTREE_DEFAUT;
}

/** `{q}` encodé pour une URL, `{limit}` tel quel. */
export function fillUrl(template: string, term: string, limit: number): string {
  return template.replaceAll("{q}", encodeURIComponent(term)).replaceAll("{limit}", String(limit));
}

/**
 * Le même gabarit, mais destiné à un corps JSON : le terme y est échappé à la
 * manière JSON, pas à la manière URL. Les confondre transformait
 * « luffy gear 5 » en « luffy%20gear%205 » dans l'entrée de l'acteur.
 */
export function fillInput(template: string, term: string, limit: number): string {
  const jsonTerme = JSON.stringify(term).slice(1, -1);
  return template
    .replaceAll("{q}", jsonTerme)
    .replaceAll("{limit}", String(limit))
    .replaceAll("{url}", `${BASE}/search/?Word=${encodeURIComponent(term)}`);
}

// ───────────────────────────── lecture d'un résultat ─────────────────────────

/** Premier champ non vide parmi plusieurs noms possibles. */
function pick(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (value && typeof value === "object") {
      const nom = (value as Record<string, unknown>).name;
      if (typeof nom === "string" && nom.trim()) return nom.trim();
    }
  }
  return null;
}

function pickImages(raw: Record<string, unknown>, pageUrl: string | null): ExternalImage[] {
  const urls: string[] = [];
  const push = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(push);
    if (v && typeof v === "object") return push((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).src);
    if (typeof v !== "string" || !v.trim()) return;
    try {
      urls.push(new URL(v.trim(), BASE).toString());
    } catch {
      /* URL inexploitable */
    }
  };
  for (const key of ["images", "imageUrls", "photos", "gallery", "image", "imageUrl", "imageURL", "thumbnail", "mainImage"]) {
    push(raw[key]);
  }
  return [...new Set(urls)].slice(0, 8).map((url) => ({ url, source: HLJ_SOURCE, sourceUrl: pageUrl }));
}

/** Un montant écrit de n'importe quelle façon, en centimes. Null si ce n'en est pas un. */
function cents(brut: string | null, dejaEnCentimes: boolean): number | null {
  if (!brut) return null;
  const valeur = Number.parseFloat(brut.replace(/[^\d.,]/g, "").replace(/,/g, ""));
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  return Math.round(dejaEnCentimes ? valeur : valeur * 100);
}

/**
 * Le prix affiché et sa devise.
 *
 * L'acteur HLJ rend le prix en yens et en dollars ; aucun des deux n'est la
 * devise de MIDIAROM. On garde donc le montant **et** sa devise, pour que la
 * fiche importée dise d'où vient le chiffre plutôt que de le faire passer pour
 * un prix en euros. Le brouillon créé, lui, part à 0 € : c'est le magasin qui
 * fixe ses prix.
 */
function pickPrice(raw: Record<string, unknown>): { priceCents: number | null; currency: string | null } {
  const explicite = cents(pick(raw, "priceCents"), true);
  if (explicite) return { priceCents: explicite, currency: pick(raw, "currency") };

  const devise = pick(raw, "currency");
  const generique = cents(pick(raw, "price", "salePrice", "currentPrice", "sellingPrice"), false);
  if (generique) return { priceCents: generique, currency: devise };

  const jpy = cents(pick(raw, "priceJpy", "price_jpy", "priceYen", "jpy"), false);
  if (jpy) return { priceCents: jpy, currency: "JPY" };

  const usd = cents(pick(raw, "priceUsd", "price_usd", "usd"), false);
  if (usd) return { priceCents: usd, currency: "USD" };

  return { priceCents: null, currency: null };
}

/**
 * Un élément quelconque — ligne d'API ou item d'acteur Apify — vers notre
 * modèle. Sans nom ni référence exploitable, il est écarté plutôt que deviné.
 */
export function toExternalProduct(raw: Record<string, unknown>): ExternalProduct | null {
  const name = pick(raw, "name", "title", "productName", "itemName");
  if (!name) return null;
  const urlBrut = pick(raw, "url", "link", "productUrl", "detailUrl", "itemUrl");
  const url = urlBrut ? (() => { try { return new URL(urlBrut, BASE).toString(); } catch { return null; } })() : null;
  const ref = pick(raw, "ref", "code", "sku", "itemCode", "productCode", "itemNo", "id") ?? url;
  if (!ref) return null;

  return {
    ref,
    name,
    url,
    manufacturer: pick(raw, "manufacturer", "maker", "brand", "company"),
    series: pick(raw, "series", "franchise", "license", "lineup", "category"),
    character: pick(raw, "character", "characterName", "subject"),
    ean: pick(raw, "jan", "ean", "barcode", "janCode", "gtin", "gtin13"),
    size: pick(raw, "size", "height", "scale", "dimensions"),
    releaseDate: pick(raw, "releaseDate", "release", "releaseMonth", "shipDate"),
    description: pick(raw, "description", "summary", "details", "availability", "stockStatus"),
    images: pickImages(raw, url),
    ...pickPrice(raw),
  };
}

/**
 * Les éléments d'une réponse JSON, où qu'ils soient rangés.
 *
 * Apify rend un tableau nu, mais les acteurs n'ont pas tous la même façon
 * d'emballer leurs résultats et aucun ne garantit la sienne. On cherche donc
 * d'abord les noms usuels, puis n'importe quel tableau d'objets, en
 * descendant de quelques niveaux — assez pour une enveloppe, pas assez pour
 * partir en exploration.
 */
export function itemsFromJson(json: unknown, profondeur = 4): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
  if (!json || typeof json !== "object" || profondeur <= 0) return [];
  const node = json as Record<string, unknown>;
  for (const key of ["products", "items", "results", "hits", "data", "docs", "records"]) {
    const found = itemsFromJson(node[key], profondeur - 1);
    if (found.length) return found;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const found = itemsFromJson(value, profondeur - 1);
      if (found.length) return found;
    }
  }
  return [];
}

// ────────────────────────────── accès au réseau ──────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response | { error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: { "User-Agent": userAgent(), ...(init.headers ?? {}) },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const abandon = error instanceof Error && error.name === "AbortError";
    return { error: abandon ? `Pas de réponse en ${TIMEOUT_MS / 1000} s.` : "Source injoignable." };
  } finally {
    clearTimeout(timer);
  }
}

/** Une fiche détaillée, par ses données structurées. */
async function fetchDetail(url: string): Promise<ExternalProduct | null> {
  const response = await fetchWithTimeout(url, { headers: { Accept: "text/html" } });
  if ("error" in response || !response.ok) return null;
  const html = await response.text();
  const node = productNodes(extractJsonLd(html))[0];
  return node ? productFromSchema(node, HLJ_SOURCE, response.url || url) : null;
}

/**
 * Complète les fiches auxquelles il manque l'essentiel, par vagues bornées.
 *
 * Désactivé par défaut, et volontairement. L'acteur dédié rend déjà fabricant
 * et GTIN ; ouvrir douze pages de plus rallongerait chaque recherche de
 * l'admin pour un gain qu'on n'a pas constaté — la page de recherche de HLJ ne
 * publie aucune donnée structurée, et rien ne prouve que ses fiches produit en
 * publient. `HLJ_ENRICH_DETAILS=1` l'active pour qui veut vérifier.
 */
async function enrich(liste: ExternalProduct[]): Promise<ExternalProduct[]> {
  if (process.env.HLJ_ENRICH_DETAILS?.trim() !== "1") return liste;
  const aOuvrir = liste.filter((p) => p.url && (!p.manufacturer || !p.ean)).slice(0, DETAIL_MAX);
  if (!aOuvrir.length) return liste;

  const details = new Map<string, ExternalProduct>();
  for (let i = 0; i < aOuvrir.length; i += DETAIL_PARALLELE) {
    const vague = await Promise.all(aOuvrir.slice(i, i + DETAIL_PARALLELE).map((p) => fetchDetail(p.url!)));
    vague.forEach((d, j) => {
      const source = aOuvrir[i + j];
      if (d && source?.url) details.set(source.url, d);
    });
  }

  return liste.map((p) => {
    const d = p.url ? details.get(p.url) : undefined;
    if (!d) return p;
    return {
      ...p,
      manufacturer: p.manufacturer ?? d.manufacturer,
      series: p.series ?? d.series,
      character: p.character ?? d.character,
      ean: p.ean ?? d.ean,
      size: p.size ?? d.size,
      releaseDate: p.releaseDate ?? d.releaseDate,
      description: p.description ?? d.description,
      images: p.images.length ? p.images : d.images,
      priceCents: p.priceCents ?? d.priceCents,
      currency: p.currency ?? d.currency,
    };
  });
}

// ─────────────────────────────── les stratégies ───────────────────────────────

/** A — un endpoint JSON constaté, s'il en existe un. Une requête, aucun coût. */
async function viaJsonApi(template: string, term: string, limit: number): Promise<ProviderSearchResult> {
  const url = fillUrl(template, term, limit);
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if ("error" in response) return { products: [], error: `HobbyLink Japan : ${response.error}`, debug: `GET ${url}` };
  if (!response.ok) {
    return { products: [], error: `L'API de recherche a répondu HTTP ${response.status}.`, debug: `GET ${url}` };
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { products: [], error: "L'API de recherche n'a pas répondu en JSON. Vérifiez HLJ_SEARCH_API.", debug: `GET ${url}` };
  }
  const items = itemsFromJson(json);
  const products = items.map(toExternalProduct).filter((p): p is ExternalProduct => p !== null).slice(0, limit);
  return {
    products,
    error: products.length ? null : `Aucune fiche exploitable pour « ${term} ». ${items.length} élément(s) reçus.`,
    debug: `GET ${url} → ${items.length} élément(s), ${products.length} lisible(s)`,
  };
}

/** B — l'acteur Apify de recherche HLJ, qui exécute la page pour nous. */
async function viaApify(term: string, limit: number): Promise<ProviderSearchResult> {
  const token = process.env.APIFY_TOKEN!.trim();
  const nom = actor();
  const gabarit = actorInput();

  let input: unknown;
  try {
    input = JSON.parse(fillInput(gabarit, term, limit));
  } catch {
    return { products: [], error: "HLJ_APIFY_INPUT n'est pas un JSON valide une fois le terme inséré." };
  }

  // Le nom s'écrit « auteur/acteur » dans la documentation et « auteur~acteur »
  // dans l'URL de l'API. On accepte les deux pour que le copier-coller marche.
  const url =
    `https://api.apify.com/v2/acts/${encodeURIComponent(nom.replace("/", "~"))}` +
    `/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&limit=${limit}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if ("error" in response) return { products: [], error: `Apify : ${response.error}`, debug: `acteur ${nom}` };
  if (!response.ok) {
    // Le corps peut contenir le jeton en écho : on ne remonte que le statut.
    const pourquoi =
      response.status === 400
        ? ` Entrée refusée par l'acteur : comparez HLJ_APIFY_INPUT à la documentation de ${nom}.`
        : response.status === 401 || response.status === 403
          ? " Jeton refusé : vérifiez APIFY_TOKEN."
          : response.status === 404
            ? ` Acteur introuvable : vérifiez HLJ_APIFY_ACTOR (« ${nom} »).`
            : "";
    return { products: [], error: `L'acteur Apify a répondu HTTP ${response.status}.${pourquoi}`, debug: `POST acteur ${nom}` };
  }
  const json: unknown = await response.json();
  const items = itemsFromJson(json);
  const products = items.map(toExternalProduct).filter((p): p is ExternalProduct => p !== null).slice(0, limit);
  return {
    products,
    error: products.length ? null : `Aucun résultat HobbyLink Japan pour « ${term} ». ${items.length} élément(s) reçus de l'acteur.`,
    debug: `acteur ${nom} → ${items.length} élément(s), ${products.length} lisible(s)`,
  };
}

// ─────────────────────────────────── provider ───────────────────────────────────

export const hljProvider: CatalogProvider = {
  id: HLJ_SOURCE,
  label: "HobbyLink Japan",

  strategyLabel() {
    if (process.env.HLJ_SEARCH_API?.trim()) return "API JSON (HLJ_SEARCH_API)";
    return `acteur Apify de recherche HLJ (${actor()})`;
  },

  configurationError() {
    if (process.env.HLJ_SEARCH_API?.trim() || process.env.APIFY_TOKEN?.trim()) return null;
    return (
      "La recherche HobbyLink Japan a besoin de APIFY_TOKEN. La page de résultats de HLJ est rendue par le " +
      `navigateur : elle est donc interrogée via l'acteur de recherche ${ACTEUR_DEFAUT}, qui l'exécute. ` +
      "Créez un jeton sur apify.com (Settings → API & Integrations) et posez APIFY_TOKEN dans .env.local, " +
      "puis sur Vercel."
    );
  },

  async search(term: string, limit: number): Promise<ProviderSearchResult> {
    const recherche = term.trim();
    if (!recherche) return { products: [], error: "Terme de recherche vide." };

    const configuration = this.configurationError();
    if (configuration) return { products: [], error: configuration };

    const api = process.env.HLJ_SEARCH_API?.trim();
    const resultat = api ? await viaJsonApi(api, recherche, limit) : await viaApify(recherche, limit);
    if (!resultat.products.length) return resultat;

    return { ...resultat, products: await enrich(resultat.products) };
  },
};
