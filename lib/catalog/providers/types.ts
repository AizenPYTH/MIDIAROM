/**
 * Le contrat d'un fournisseur de fiches produit externe.
 *
 * Un seul existe aujourd'hui — HobbyLink Japan, pour les figurines — mais le
 * jour où Rakuten ou un autre s'ajoute, il suffira d'écrire un second fichier
 * qui rend le même `ExternalProduct`. Le back-office et l'import ne connaissent
 * que ce type.
 *
 * Volontairement plat et tout en optionnel : une source qui ne renseigne pas la
 * taille ou le JAN ne doit pas faire échouer un import, et surtout rien ne doit
 * être inventé pour combler un trou.
 */

export interface ExternalImage {
  url: string;
  /** Le fournisseur, pour créditer et ne jamais s'approprier le visuel. */
  source: string;
  /** La page d'où vient l'image. */
  sourceUrl: string | null;
}

export interface ExternalProduct {
  /** Identifiant chez la source. C'est lui qui empêche un double import. */
  ref: string;
  name: string;
  /** Page d'origine, pour vérifier la fiche. */
  url: string | null;
  manufacturer: string | null;
  /** Licence ou gamme : « One Piece », « Figuarts ZERO »… */
  series: string | null;
  /**
   * Le rayon tel que la source le classe — « Figures », « Apparel »…
   *
   * C'est le classement du vendeur lui-même, donc le signal le plus fiable
   * pour trier figurines et dérivés : voir lib/catalog/figurine-filter.ts.
   */
  category: string | null;
  /** « In Stock », « Pre-order »… telle que la source l'écrit. */
  availability: string | null;
  character: string | null;
  /** Code-barres JAN / EAN. */
  ean: string | null;
  /** Hauteur ou échelle, telles que la source les écrit. */
  size: string | null;
  releaseDate: string | null;
  description: string | null;
  images: ExternalImage[];
  /** Prix chez la source, en centimes de sa devise. Indicatif, jamais repris. */
  priceCents: number | null;
  currency: string | null;
}

export interface ProviderSearchResult {
  products: ExternalProduct[];
  /** Message lisible si la recherche n'a pas pu aboutir. */
  error: string | null;
  /** Ce qui s'est passé, pour le script de vérification. Jamais affiché au client. */
  debug?: string;
}

export interface CatalogProvider {
  /** Identifiant court, stocké dans `products.source`. */
  readonly id: string;
  readonly label: string;
  /** Null si le fournisseur est utilisable, sinon ce qui manque. */
  configurationError(): string | null;
  /** Par quel chemin il interroge la source, en une ligne. */
  strategyLabel(): string;
  search(term: string, limit: number): Promise<ProviderSearchResult>;
}

/**
 * Le nombre de fiches qu'une recherche rapporte.
 *
 * Une seule définition, partagée par l'écran d'import et par
 * `npm run check:hlj` : le script de vérification doit poser exactement la même
 * question que l'admin, sinon il ne vérifie pas l'admin.
 */
export const SEARCH_LIMIT = 12;
