import "server-only";
import { getServerEnv } from "@/lib/env";
import type { IgdbGame } from "@/lib/igdb/types";

/**
 * Client IGDB bas niveau : jeton Twitch et requêtes HTTP, rien d'autre.
 *
 * IGDB s'interroge en APIcalypse, un langage de requête maison envoyé en corps
 * de POST. L'authentification est un jeton applicatif Twitch (client credentials)
 * valable ~60 jours, qu'on garde en mémoire du processus : le redemander à
 * chaque requête ferait un aller-retour de plus et compterait dans le quota.
 *
 * Rien ici ne connaît nos produits ni notre base : la traduction se fait dans
 * normalize.ts, la logique métier dans service.ts.
 */

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";
const TIMEOUT_MS = 8_000;
/** Marge avant expiration : un jeton qui expire en vol coûte une requête ratée. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export class IgdbConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IgdbConfigurationError";
  }
}

/** IGDB a répondu, mais mal — ou n'a pas répondu du tout. Jamais fatal. */
export class IgdbRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** Vrai quand réessayer plus tard a un sens (429, 5xx, délai dépassé). */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "IgdbRequestError";
  }
}

interface Credentials {
  clientId: string;
  clientSecret: string;
}

function credentials(): Credentials {
  const env = getServerEnv();
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    throw new IgdbConfigurationError("TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET sont requis pour interroger IGDB.");
  }
  return { clientId: env.TWITCH_CLIENT_ID, clientSecret: env.TWITCH_CLIENT_SECRET };
}

/** IGDB est-il utilisable ? Sans jeter, pour l'afficher quelque part. */
export function igdbConfigurationError(): string | null {
  try {
    credentials();
    return null;
  } catch (error) {
    if (error instanceof IgdbConfigurationError) return error.message;
    throw error;
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlightToken: Promise<string> | null = null;

/**
 * Jeton applicatif Twitch, mis en cache jusqu'à son expiration.
 *
 * `inFlightToken` évite que dix requêtes simultanées déclenchent dix
 * authentifications au démarrage : elles attendent toutes la même promesse.
 */
async function accessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
    return cachedToken.value;
  }
  if (!forceRefresh && inFlightToken) return inFlightToken;

  const { clientId, clientSecret } = credentials();
  const fetchToken = async (): Promise<string> => {
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" });
    const response = await withTimeout((signal) => fetch(TOKEN_URL, { method: "POST", body, signal, cache: "no-store" }));
    if (!response.ok) {
      // Le corps de la réponse Twitch peut refléter les paramètres envoyés :
      // on ne journalise que le statut, jamais le corps ni les identifiants.
      throw new IgdbRequestError(`Authentification Twitch refusée (HTTP ${response.status}).`, response.status, response.status >= 500);
    }
    const json = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new IgdbRequestError("Authentification Twitch : réponse sans jeton.", null, false);
    cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  };

  inFlightToken = fetchToken().finally(() => {
    inFlightToken = null;
  });
  return inFlightToken;
}

async function withTimeout(run: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new IgdbRequestError(`IGDB n'a pas répondu en ${TIMEOUT_MS} ms.`, null, true);
    }
    throw new IgdbRequestError("IGDB est injoignable.", null, true);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envoie une requête APIcalypse et renvoie le tableau de résultats.
 *
 * Un 401 signifie presque toujours un jeton périmé côté Twitch avant la date
 * annoncée : on le renouvelle une fois, puis on abandonne pour de bon.
 */
async function query<T>(endpoint: string, apicalypse: string, retryOnUnauthorized = true): Promise<T[]> {
  const { clientId } = credentials();
  const token = await accessToken();
  const response = await withTimeout((signal) =>
    fetch(`${API_URL}/${endpoint}`, {
      method: "POST",
      headers: { "Client-ID": clientId, Authorization: `Bearer ${token}`, Accept: "application/json" },
      body: apicalypse,
      signal,
      cache: "no-store",
    }),
  );

  if (response.status === 401 && retryOnUnauthorized) {
    await accessToken(true);
    return query<T>(endpoint, apicalypse, false);
  }
  if (response.status === 429) {
    throw new IgdbRequestError("Quota IGDB atteint (4 requêtes par seconde).", 429, true);
  }
  if (!response.ok) {
    throw new IgdbRequestError(`IGDB a répondu HTTP ${response.status}.`, response.status, response.status >= 500);
  }
  return (await response.json()) as T[];
}

/**
 * Les champs demandés à IGDB, une fois pour toutes.
 *
 * Volontairement court : chaque champ élargit la réponse et le stockage. La
 * liste est extensible — ajouter un champ ici et son équivalent dans
 * normalize.ts suffit à enrichir toutes les fiches.
 */
const FIELDS = [
  "id", "name", "slug", "summary", "storyline", "first_release_date",
  "total_rating", "total_rating_count",
  "cover.image_id", "cover.width", "cover.height",
  "artworks.image_id", "artworks.width", "artworks.height",
  "screenshots.image_id", "screenshots.width", "screenshots.height",
  "platforms.name", "platforms.abbreviation",
  "genres.name",
  "involved_companies.developer", "involved_companies.publisher", "involved_companies.company.name",
  "videos.video_id", "videos.name",
  "external_games.category", "external_games.uid",
].join(",");

/** Échappe une valeur pour une chaîne APIcalypse (guillemets et antislashs). */
function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Recherche par nom. `limit` est borné par l'appelant. */
export async function searchGames(term: string, limit: number): Promise<IgdbGame[]> {
  // `where version_parent = null` écarte les rééditions parasites (démos,
  // versions régionales) qui doublonnent le jeu principal dans les résultats.
  return query<IgdbGame>(
    "games",
    `search ${quote(term)}; fields ${FIELDS}; where version_parent = null; limit ${limit};`,
  );
}

/** Récupère des jeux par identifiant IGDB, en une seule requête. */
export async function getGamesByIds(ids: number[]): Promise<IgdbGame[]> {
  if (!ids.length) return [];
  return query<IgdbGame>("games", `fields ${FIELDS}; where id = (${ids.join(",")}); limit ${ids.length};`);
}

/**
 * Cherche un jeu par code-barres via la table `external_games` d'IGDB.
 *
 * C'est la piste la plus fiable quand elle aboutit : un EAN désigne une
 * édition précise sur une plateforme précise. Elle échoue souvent — IGDB ne
 * référence pas tous les codes-barres —, d'où le repli sur le nom.
 */
export async function findGameIdByExternalUid(uid: string): Promise<number | null> {
  const rows = await query<{ id: number; game?: number }>(
    "external_games",
    `fields game; where uid = ${quote(uid)}; limit 1;`,
  );
  return rows[0]?.game ?? null;
}
