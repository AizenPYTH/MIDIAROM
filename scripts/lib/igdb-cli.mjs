/**
 * Accès IGDB partagé par les scripts en ligne de commande.
 *
 * **Pourquoi ce fichier existe.** `check-igdb.mjs` et `demo-games.mjs`
 * portaient chacun leur copie de l'authentification et de la requête. Les deux
 * copies ont divergé : l'une filtrait `where version_parent = null`, l'autre y
 * avait ajouté `& category = 0`, un champ qu'IGDB n'alimente plus. La seconde
 * renvoyait donc 200 avec une liste vide, et les 28 titres ressortaient
 * « introuvables » sans la moindre erreur HTTP. La requête est désormais
 * définie **une seule fois**, ici, et le test `tests/igdb-cli.test.ts` vérifie
 * qu'elle reste alignée sur celle de `lib/igdb/client.ts`, qui sert le
 * back-office.
 *
 * Ne journalise jamais le secret ni le jeton.
 */
import { readFileSync } from "node:fs";

/**
 * Variables de `.env.local`, sans écraser celles déjà posées dans le shell.
 *
 * Le chemin est résolu depuis **ce** fichier (`scripts/lib/`), pas depuis
 * l'appelant : le module reste juste où qu'il soit importé.
 */
export function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* pas de .env.local : on se contente de l'environnement */
  }
}

/**
 * Les champs demandés à IGDB.
 *
 * Copie délibérée de `FIELDS` dans `lib/igdb/client.ts` : ce fichier-là importe
 * `server-only` et l'alias `@/`, que `node` ne sait pas résoudre. Un test tient
 * les deux listes identiques.
 */
export const FIELDS = [
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

/** Échappe une valeur pour une chaîne APIcalypse, comme `quote()` côté application. */
export function quote(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * **La** requête de recherche, définie une fois pour toutes.
 *
 * Un seul filtre : `version_parent = null`, qui écarte les rééditions
 * parasites. On n'ajoute rien d'autre — notamment pas de filtre sur `category`,
 * champ qu'IGDB a remplacé par `game_type` et qui ne renvoie plus rien. Le tri
 * du meilleur candidat se fait côté appelant, sur les résultats reçus.
 */
export function searchBody(term, { fields = FIELDS, limit = 8 } = {}) {
  return `search ${quote(term)}; fields ${fields}; where version_parent = null; limit ${limit};`;
}

/** IGDB ou Twitch a répondu, mais mal. Porte de quoi diagnostiquer. */
export class IgdbCliError extends Error {
  constructor(message, status = null, detail = null) {
    super(message);
    this.name = "IgdbCliError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Jeton applicatif Twitch (client credentials, aucune URL de redirection).
 *
 * Le corps de la réponse peut refléter les paramètres envoyés : en cas de
 * refus on ne remonte que le statut, jamais le corps.
 */
export async function twitchToken(id, secret) {
  let response;
  try {
    response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
    });
  } catch (error) {
    throw new IgdbCliError(`Twitch est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new IgdbCliError(`Authentification Twitch refusée (HTTP ${response.status}).`, response.status);
  const json = await response.json();
  if (!json.access_token) throw new IgdbCliError("Authentification Twitch : réponse sans jeton.");
  return json;
}

/**
 * Envoie une requête APIcalypse à `/v4/games`.
 *
 * En cas de refus, remonte le statut **et le début du corps** : c'est là
 * qu'IGDB explique un champ inconnu ou une syntaxe invalide. Le corps envoyé
 * ne contient que de l'APIcalypse, jamais d'identifiant — on peut l'afficher.
 */
export async function igdbGames({ id, token, body, debug = false }) {
  if (debug) console.log(`  → POST https://api.igdb.com/v4/games\n    ${body}`);
  let response;
  try {
    response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": id, Authorization: `Bearer ${token}`, Accept: "application/json" },
      body,
    });
  } catch (error) {
    throw new IgdbCliError(`IGDB est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new IgdbCliError(`IGDB a répondu HTTP ${response.status}.`, response.status, detail || null);
  }
  const json = await response.json();
  if (!Array.isArray(json)) throw new IgdbCliError("IGDB a répondu autre chose qu'une liste.", 200, JSON.stringify(json).slice(0, 300));
  if (debug) console.log(`  ← HTTP ${response.status}, ${json.length} résultat(s)`);
  return json;
}

/** Explique un refus d'authentification, dans l'ordre de probabilité. */
export function explainAuthFailure(status) {
  if (status === 403 || status === 400) {
    return [
      "Identifiants refusés par Twitch. Dans l'ordre de probabilité :",
      "  • le Client Type de l'application est « Public » — il doit être « Confidential »,",
      "    sinon le secret délivré n'est pas valable pour ce flux ;",
      "  • le secret a été régénéré depuis la copie (Twitch invalide l'ancien) ;",
      "  • une espace ou un retour à la ligne s'est glissé dans la variable.",
    ].join("\n");
  }
  if (status === 429) return "Trop de tentatives d'authentification. Patientez une minute.";
  if (status === 401) return "Jeton refusé : l'application Twitch n'a peut-être pas accès à IGDB.";
  if (status >= 500) return "Twitch est momentanément indisponible. Réessayez plus tard.";
  return "Échec inattendu de l'authentification.";
}
