import "server-only";
import { extractJsonLd, productFromSchema, productNodes, productUrls } from "@/lib/catalog/providers/jsonld";
import type { CatalogProvider, ExternalProduct, ProviderSearchResult } from "@/lib/catalog/providers/types";

/**
 * HobbyLink Japan, par sa propre recherche.
 *
 * **Ce qui a été essayé avant, et pourquoi ça ne marchait pas.** La première
 * version passait par l'acteur Apify
 * `jungle_synthesizer/hobbylinkjapan-…-catalog-scraper`, en lui envoyant un
 * terme de recherche. Cet acteur n'en accepte aucun : ses entrées sont
 * `new_releases_weekly`, `preorder_status`, `category_backfill` et `sku_ids`.
 * C'est un outil de **synchronisation de catalogue**, pas de recherche — d'où
 * le HTTP 400, et d'où l'impasse : aspirer tout HLJ pour chercher ensuite en
 * local est exactement ce qu'on veut éviter.
 *
 * **Ce qui est fait maintenant.** Une requête sur la page de recherche de HLJ,
 * à la demande, et la lecture de ses **données structurées schema.org**
 * (`<script type="application/ld+json">`). Pas de compte, pas de jeton, pas de
 * coût, pas de tiers — et surtout on dépend d'un format public que la boutique
 * publie pour Google, au lieu de ses classes CSS.
 *
 * **Deux choses n'ont pas pu être vérifiées d'ici** (le conteneur de
 * développement n'atteint pas hlj.com) et sont donc réglables sans redéployer :
 *
 *   HLJ_SEARCH_URL   modèle d'URL de recherche, `{q}` à la place du terme.
 *                    Défaut : https://www.hlj.com/search/?Word={q}
 *   HLJ_USER_AGENT   identification de l'atelier auprès de HLJ.
 *
 * Si HLJ rend ses résultats côté navigateur, cette page ne contiendra aucune
 * donnée structurée : le message d'erreur le dit explicitement et propose la
 * suite, plutôt que de renvoyer une liste vide sans raison.
 *
 * Volumétrie : une requête pour la recherche, puis au plus `DETAIL_MAX` fiches
 * détaillées, quatre à la fois. Rien n'est stocké avant un import explicite.
 */

export const HLJ_SOURCE = "HLJ";
const BASE = "https://www.hlj.com";
const DEFAUT_RECHERCHE = `${BASE}/search/?Word={q}`;
const TIMEOUT_MS = 12_000;
/** Fiches détaillées ouvertes après la recherche, pour le fabricant et le JAN. */
const DETAIL_MAX = 12;
const DETAIL_PARALLELE = 4;

function searchUrl(term: string): string {
  const modele = process.env.HLJ_SEARCH_URL?.trim() || DEFAUT_RECHERCHE;
  return modele.includes("{q}")
    ? modele.replace("{q}", encodeURIComponent(term))
    : `${modele}${modele.includes("?") ? "&" : "?"}Word=${encodeURIComponent(term)}`;
}

function userAgent(): string {
  return (
    process.env.HLJ_USER_AGENT?.trim() ||
    "MediaromCatalogBot/1.0 (+https://207mediarom.fr ; import ponctuel de fiches figurines)"
  );
}

/** Une page, ou null. Ne jette jamais : l'appelant décide quoi dire. */
async function fetchPage(url: string): Promise<{ html: string; url: string } | { error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { error: `HobbyLink Japan a répondu HTTP ${response.status}.` };
    return { html: await response.text(), url: response.url || url };
  } catch (error) {
    const abandon = error instanceof Error && error.name === "AbortError";
    return { error: abandon ? `HobbyLink Japan n'a pas répondu en ${TIMEOUT_MS / 1000} s.` : "HobbyLink Japan est injoignable." };
  } finally {
    clearTimeout(timer);
  }
}

/** Les fiches d'une page : ses `Product`, sinon les liens de son `ItemList`. */
export function readSearchPage(html: string, pageUrl: string): { products: ExternalProduct[]; urls: string[] } {
  const nodes = extractJsonLd(html);
  const products = productNodes(nodes)
    .map((node) => productFromSchema(node, HLJ_SOURCE, pageUrl))
    .filter((p): p is ExternalProduct => p !== null);
  return { products, urls: productUrls(nodes, pageUrl) };
}

/** Ouvre des fiches détaillées, par vagues, sans jamais dépasser la borne. */
async function fetchDetails(urls: string[]): Promise<ExternalProduct[]> {
  const out: ExternalProduct[] = [];
  const file = urls.slice(0, DETAIL_MAX);
  for (let i = 0; i < file.length; i += DETAIL_PARALLELE) {
    const vague = await Promise.all(
      file.slice(i, i + DETAIL_PARALLELE).map(async (url) => {
        const page = await fetchPage(url);
        if ("error" in page) return null;
        return readSearchPage(page.html, page.url).products[0] ?? null;
      }),
    );
    out.push(...vague.filter((p): p is ExternalProduct => p !== null));
  }
  return out;
}

/** Complète les fiches de la recherche par leur page détaillée quand il manque l'essentiel. */
function merge(liste: ExternalProduct[], details: ExternalProduct[]): ExternalProduct[] {
  const parUrl = new Map(details.map((d) => [d.url, d]));
  return liste.map((p) => {
    const detail = p.url ? parUrl.get(p.url) : undefined;
    if (!detail) return p;
    return {
      ...p,
      manufacturer: p.manufacturer ?? detail.manufacturer,
      series: p.series ?? detail.series,
      character: p.character ?? detail.character,
      ean: p.ean ?? detail.ean,
      size: p.size ?? detail.size,
      releaseDate: p.releaseDate ?? detail.releaseDate,
      description: p.description ?? detail.description,
      images: p.images.length ? p.images : detail.images,
      priceCents: p.priceCents ?? detail.priceCents,
      currency: p.currency ?? detail.currency,
    };
  });
}

export const hljProvider: CatalogProvider = {
  id: HLJ_SOURCE,
  label: "HobbyLink Japan",

  /** Aucune clé requise : la recherche est publique. */
  configurationError() {
    return null;
  },

  async search(term: string, limit: number): Promise<ProviderSearchResult> {
    const recherche = term.trim();
    if (!recherche) return { products: [], error: "Terme de recherche vide." };

    const page = await fetchPage(searchUrl(recherche));
    if ("error" in page) return { products: [], error: page.error };

    const { products, urls } = readSearchPage(page.html, page.url);

    // Cas courant : la page de résultats ne liste que des liens. On ouvre les
    // fiches, bornées et par vagues — jamais tout le catalogue.
    if (!products.length && urls.length) {
      const details = await fetchDetails(urls.slice(0, limit));
      if (details.length) return { products: details.slice(0, limit), error: null };
    }

    if (!products.length) {
      return {
        products: [],
        error:
          `Aucune fiche exploitable pour « ${recherche} ». La page de recherche de HobbyLink Japan n'expose pas de données ` +
          `structurées : soit le terme ne donne rien, soit les résultats sont rendus par le navigateur. Vérifiez avec ` +
          `« npm run check:hlj -- "${recherche}" --raw », et au besoin ajustez HLJ_SEARCH_URL.`,
      };
    }

    // Les fiches de résultats sont souvent partielles : on complète celles qu'on
    // va montrer, pas plus.
    const retenus = products.slice(0, limit);
    const aCompleter = retenus.filter((p) => !p.manufacturer || !p.ean).map((p) => p.url).filter((u): u is string => Boolean(u));
    const details = aCompleter.length ? await fetchDetails(aCompleter) : [];
    return { products: merge(retenus, details), error: null };
  },
};
