import "server-only";
import type { CatalogProvider, ExternalImage, ExternalProduct, ProviderSearchResult } from "@/lib/catalog/providers/types";

/**
 * HobbyLink Japan, via un acteur Apify.
 *
 * **Pourquoi Apify plutôt qu'un scraper maison.** HLJ n'expose pas d'API
 * publique. Écrire et maintenir un analyseur HTML, c'est s'engager à le réparer
 * chaque fois que la boutique change une classe CSS — pour un usage qui se
 * compte en quelques recherches par semaine. Un acteur Apify absorbe cette
 * maintenance, et le jour où il ne convient plus, seul ce fichier change : le
 * reste du back-office ne connaît que `ExternalProduct`.
 *
 * **La recherche est à la demande.** Rien n'est aspiré en masse, rien n'est
 * stocké avant un import explicite. On interroge sur un terme, on montre
 * quelques résultats, l'atelier en choisit un.
 *
 * **Le format de sortie n'est pas garanti.** Un acteur Apify n'est pas un
 * contrat d'API : les noms de champs varient d'un acteur à l'autre et peuvent
 * changer. La lecture ci-dessous est donc tolérante — elle essaie plusieurs
 * noms pour chaque information — et `npm run check:hlj -- "luffy" --raw`
 * affiche l'objet brut pour ajuster la correspondance en une fois plutôt qu'à
 * l'aveugle.
 *
 * Configuration (jamais en dur, jamais NEXT_PUBLIC_) :
 *   APIFY_TOKEN     jeton de l'API Apify
 *   HLJ_APIFY_ACTOR identifiant de l'acteur, par exemple « user~hlj-scraper »
 */

const TIMEOUT_MS = 45_000;
export const HLJ_SOURCE = "HLJ";

/** Premier champ non vide parmi plusieurs noms possibles. */
function pick(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** Les visuels, sous les différentes formes qu'un acteur peut rendre. */
function pickImages(raw: Record<string, unknown>, pageUrl: string | null): ExternalImage[] {
  const urls: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && /^https?:\/\//.test(v.trim())) urls.push(v.trim());
    else if (v && typeof v === "object" && "url" in v) push((v as { url: unknown }).url);
  };
  for (const key of ["images", "imageUrls", "photos", "gallery"]) {
    const value = raw[key];
    if (Array.isArray(value)) value.forEach(push);
  }
  for (const key of ["image", "imageUrl", "thumbnail", "mainImage"]) push(raw[key]);
  return [...new Set(urls)].slice(0, 8).map((url) => ({ url, source: HLJ_SOURCE, sourceUrl: pageUrl }));
}

/** Prix en centimes. Accepte « 12800 », « ¥12,800 », « 12800 JPY ». */
function pickPriceCents(raw: Record<string, unknown>): number | null {
  const brut = pick(raw, "priceCents", "price", "salePrice", "currentPrice");
  if (!brut) return null;
  const chiffres = brut.replace(/[^\d.,]/g, "").replace(/,/g, "");
  const valeur = Number.parseFloat(chiffres);
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  // Un acteur qui renvoie déjà des centimes nomme son champ ainsi ; sinon la
  // valeur est dans l'unité de la devise.
  return raw.priceCents !== undefined ? Math.round(valeur) : Math.round(valeur * 100);
}

/** Une ligne du dataset Apify → notre modèle. Null si elle est inexploitable. */
export function toExternalProduct(raw: Record<string, unknown>): ExternalProduct | null {
  const name = pick(raw, "name", "title", "productName");
  if (!name) return null;
  const url = pick(raw, "url", "link", "productUrl", "detailUrl");
  const ref = pick(raw, "ref", "code", "sku", "itemCode", "productCode", "id") ?? url;
  if (!ref) return null;

  return {
    ref,
    name,
    url,
    manufacturer: pick(raw, "manufacturer", "maker", "brand", "company"),
    series: pick(raw, "series", "franchise", "license", "lineup", "category"),
    character: pick(raw, "character", "characterName", "subject"),
    ean: pick(raw, "jan", "ean", "barcode", "janCode", "gtin"),
    size: pick(raw, "size", "height", "scale", "dimensions"),
    releaseDate: pick(raw, "releaseDate", "release", "releaseMonth", "shipDate"),
    description: pick(raw, "description", "summary", "details"),
    images: pickImages(raw, url),
    priceCents: pickPriceCents(raw),
    currency: pick(raw, "currency") ?? (pick(raw, "price")?.includes("¥") ? "JPY" : null),
  };
}

function credentials(): { token: string; actor: string } | null {
  const token = process.env.APIFY_TOKEN?.trim();
  const actor = process.env.HLJ_APIFY_ACTOR?.trim();
  return token && actor ? { token, actor } : null;
}

export const hljProvider: CatalogProvider = {
  id: HLJ_SOURCE,
  label: "HobbyLink Japan",

  configurationError() {
    if (credentials()) return null;
    return "APIFY_TOKEN et HLJ_APIFY_ACTOR sont requis pour interroger HobbyLink Japan. Voir docs/FIGURINES.md.";
  },

  async search(term: string, limit: number): Promise<ProviderSearchResult> {
    const creds = credentials();
    if (!creds) return { products: [], error: this.configurationError() };
    const recherche = term.trim();
    if (!recherche) return { products: [], error: "Terme de recherche vide." };

    // `run-sync-get-dataset-items` lance l'acteur et attend son résultat : pas
    // de file à surveiller, pas d'état à stocker. C'est ce qui rend cet import
    // simple, et c'est aussi pourquoi le délai est généreux.
    const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(creds.actor)}/run-sync-get-dataset-items`);
    url.searchParams.set("token", creds.token);
    url.searchParams.set("limit", String(limit));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Les acteurs ne s'accordent pas sur le nom du champ de recherche : on
        // envoie les trois usuels, ceux qu'il ignore ne le gênent pas.
        body: JSON.stringify({ search: recherche, query: recherche, keyword: recherche, maxItems: limit }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        // Le corps peut contenir le jeton en écho : on ne remonte que le statut.
        return { products: [], error: `HobbyLink Japan : l'acteur Apify a répondu HTTP ${response.status}.` };
      }
      const json: unknown = await response.json();
      if (!Array.isArray(json)) return { products: [], error: "HobbyLink Japan : réponse inattendue de l'acteur." };

      const products = json
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map(toExternalProduct)
        .filter((p): p is ExternalProduct => p !== null)
        .slice(0, limit);

      if (!products.length) {
        return { products: [], error: `Aucun résultat exploitable pour « ${recherche} ».` };
      }
      return { products, error: null };
    } catch (error) {
      const abandon = error instanceof Error && error.name === "AbortError";
      return {
        products: [],
        error: abandon ? `HobbyLink Japan n'a pas répondu en ${TIMEOUT_MS / 1000} s.` : "HobbyLink Japan est injoignable.",
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
