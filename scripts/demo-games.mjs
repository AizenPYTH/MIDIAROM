#!/usr/bin/env node
/**
 * Remplit la vitrine de démonstration de l'accueil depuis IGDB.
 *
 *   npm run demo:games              # résout les titres et écrit le fichier
 *   npm run demo:games -- --debug   # + la requête envoyée et la réponse reçue
 *   npm run demo:games -- --dry-run # ne touche ni la base ni le fichier
 *   npm run demo:games -- --clear   # vide la vitrine
 *
 * Les identifiants IGDB ne sont jamais écrits à la main : le script cherche
 * chaque titre de `DEMO_GAME_TITLES`, retient la meilleure fiche, écrit sa
 * version normalisée dans le cache `igdb_games` et consigne le couple
 * { igdbId, title } dans `lib/shop/demo-games.json`.
 *
 * Authentification, requête et champs viennent de `scripts/lib/igdb-cli.mjs`,
 * partagé avec `npm run check:igdb` : les deux commandes envoient exactement la
 * même requête. La normalisation vient de `lib/igdb/normalize.ts`, le fichier
 * qui sert déjà le back-office — rien n'est recopié ici.
 *
 * Demande TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET (voir docs/IGDB.md) et un
 * accès réseau à api.igdb.com.
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { explainAuthFailure, IgdbCliError, igdbGames, loadEnvLocal, searchBody, twitchToken } from "./lib/igdb-cli.mjs";

loadEnvLocal();

const OUT = new URL("../lib/shop/demo-games.json", import.meta.url);
const debug = process.argv.includes("--debug");
const dryRun = process.argv.includes("--dry-run");

if (process.argv.includes("--clear")) {
  try {
    unlinkSync(OUT);
    console.log("✓ Vitrine de démonstration vidée.");
  } catch {
    console.log("Rien à vider.");
  }
  process.exit(0);
}

/**
 * La normalisation réelle du projet, importée telle quelle.
 *
 * `normalize.ts` ne fait que des imports de types, effacés par le décodage TS
 * de Node : aucun alias `@/` n'est résolu à l'exécution. Disponible par défaut
 * depuis Node 22.18 ; en dessous, il faut `--experimental-strip-types`.
 */
let normalizeGame;
try {
  ({ normalizeGame } = await import("../lib/igdb/normalize.ts"));
} catch (error) {
  console.error("✗ Impossible de charger lib/igdb/normalize.ts.");
  console.error(`  Node ${process.versions.node} — il faut Node 22.18 ou plus récent,`);
  console.error("  ou relancer avec : node --experimental-strip-types scripts/demo-games.mjs");
  console.error(`  Détail : ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const id = process.env.TWITCH_CLIENT_ID;
const secret = process.env.TWITCH_CLIENT_SECRET;
if (!id || !secret) {
  console.error("✗ TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET sont requis. Voir docs/IGDB.md.");
  console.error("  Pour diagnostiquer la connexion : npm run check:igdb -- \"zelda\"");
  process.exit(1);
}

// Les titres sont lus depuis la source TypeScript : une seule liste à tenir.
const titles = [
  ...readFileSync(new URL("../lib/shop/demo-games.ts", import.meta.url), "utf8")
    .match(/export const DEMO_GAME_TITLES = \[([\s\S]*?)\] as const;/)[1]
    .matchAll(/"((?:[^"\\]|\\.)*)"/g),
].map((m) => m[1].replace(/\\"/g, '"'));

console.log(`${titles.length} titres à résoudre.`);

let token;
try {
  token = await twitchToken(id, secret);
} catch (error) {
  console.error(`✗ ${error.message}`);
  if (error instanceof IgdbCliError && error.status) console.error(explainAuthFailure(error.status));
  process.exit(1);
}

/** Quota IGDB : 4 requêtes par seconde. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Le meilleur candidat pour un titre.
 *
 * La requête ne filtre que les rééditions ; le tri se fait ici, sur les
 * résultats reçus. Le nom exact d'abord — c'est ce qui distingue « Elden Ring »
 * de son extension —, puis le plus grand nombre de votes, qui départage une
 * édition principale d'un portage confidentiel.
 */
function bestMatch(found, title) {
  const wanted = title.toLowerCase();
  const exact = found.filter((g) => g.name?.toLowerCase() === wanted);
  return (exact.length ? exact : found).sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0))[0];
}

const entries = [];
const rows = [];
/** Comptage des causes d'échec : un diagnostic vaut mieux qu'un total nul. */
const failures = { vide: 0, sansJaquette: 0, erreur: 0 };

for (const title of titles) {
  try {
    const found = await igdbGames({ id, token: token.access_token, body: searchBody(title), debug });
    const pick = bestMatch(found, title);
    if (!pick) {
      failures.vide += 1;
      console.log(`  ✗ ${title} — aucun résultat IGDB`);
      continue;
    }
    const game = normalizeGame(pick);
    if (!game.cover) {
      failures.sansJaquette += 1;
      console.log(`  ✗ ${title} — sans jaquette, écarté`);
      continue;
    }
    rows.push({ igdb_id: game.igdbId, name: game.name, slug: game.slug, data: game, synced_at: new Date().toISOString() });
    entries.push({ igdbId: game.igdbId, title: game.name });
    console.log(`  ✓ ${String(game.igdbId).padStart(7)}  ${game.name}${game.artworks.length ? "" : "  (sans artwork)"}`);
  } catch (error) {
    failures.erreur += 1;
    console.log(`  ✗ ${title} — ${error.message}`);
    if (error.detail) console.log(`      réponse d'IGDB : ${error.detail}`);
    // Une panne d'authentification ou de réseau se répète sur les 27 titres
    // suivants : mieux vaut s'arrêter et le dire.
    if (error instanceof IgdbCliError && (error.status === 401 || error.status === 403 || error.status === null)) {
      console.error("\n✗ Arrêt : la connexion à IGDB ne fonctionne pas.");
      console.error('  Diagnostic : npm run check:igdb -- "zelda"');
      process.exit(1);
    }
  }
  await wait(260);
}

if (!entries.length) {
  console.error("\n✗ Aucun jeu résolu : rien n'est écrit.");
  console.error(`  sans résultat : ${failures.vide} · sans jaquette : ${failures.sansJaquette} · en erreur : ${failures.erreur}`);
  if (failures.vide === titles.length) {
    console.error("  IGDB a répondu, mais n'a rien renvoyé pour aucun titre — c'est la");
    console.error("  signature d'un filtre `where` trop restrictif dans la requête.");
    console.error("  Relancez avec --debug pour voir la requête exactement telle qu'elle part.");
  }
  process.exit(1);
}

if (dryRun) {
  console.log(`\n✓ ${entries.length} jeux résolus. --dry-run : ni la base ni le fichier n'ont été touchés.`);
  process.exit(0);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await db.from("igdb_games").upsert(rows, { onConflict: "igdb_id" });
if (error) {
  console.error(`✗ Écriture du cache : ${error.message}`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(entries, null, 2) + "\n");
console.log(`\n✓ ${entries.length} jeux en cache et dans lib/shop/demo-games.json.`);
if (failures.vide || failures.sansJaquette || failures.erreur) {
  console.log(`  Écartés — sans résultat : ${failures.vide} · sans jaquette : ${failures.sansJaquette} · en erreur : ${failures.erreur}`);
}
console.log("  Ce sont des jeux de démonstration : ils ne sont pas au catalogue et ne sont pas achetables.");
console.log("  Pour les retirer : npm run demo:games -- --clear");
