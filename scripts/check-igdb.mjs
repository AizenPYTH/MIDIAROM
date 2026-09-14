#!/usr/bin/env node
/**
 * Vérifie la connexion IGDB de bout en bout, sans rien écrire en base.
 *
 *   node scripts/check-igdb.mjs                    # authentification seule
 *   node scripts/check-igdb.mjs "zelda"            # + une vraie recherche
 *   node scripts/check-igdb.mjs "zelda" --debug    # + la requête envoyée
 *
 * Lit TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET depuis l'environnement ou
 * .env.local. N'affiche jamais le secret ni le jeton.
 *
 * Utilise le même socle que `npm run demo:games` (scripts/lib/igdb-cli.mjs) :
 * si cette vérification passe, la vitrine de démonstration passe aussi.
 */
import { explainAuthFailure, IgdbCliError, igdbGames, loadEnvLocal, searchBody, twitchToken } from "./lib/igdb-cli.mjs";

loadEnvLocal();

const id = process.env.TWITCH_CLIENT_ID;
const secret = process.env.TWITCH_CLIENT_SECRET;
const debug = process.argv.includes("--debug");
const mask = (v) => (v ? `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} caractères)` : "ABSENTE");

console.log(`TWITCH_CLIENT_ID     : ${mask(id)}`);
console.log(`TWITCH_CLIENT_SECRET : ${secret ? "présente (masquée)" : "ABSENTE"}`);

if (!id || !secret) {
  console.log("\n✗ IGDB n'est pas configuré.");
  console.log("  1. https://dev.twitch.tv/console/apps → Register Your Application");
  console.log("  2. Poser TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET (jamais NEXT_PUBLIC_*)");
  console.log("  Le site fonctionne sans : les produits gardent leurs propres photos.");
  process.exit(1);
}

let token;
try {
  token = await twitchToken(id, secret);
} catch (error) {
  console.log(`\n✗ ${error.message}`);
  if (error instanceof IgdbCliError && error.status) console.log(explainAuthFailure(error.status));
  else console.log("  Vérifiez votre connexion réseau ou un éventuel proxy d'entreprise.");
  process.exit(1);
}

console.log(`\n✓ Authentification Twitch réussie — jeton valable ~${Math.round((token.expires_in ?? 0) / 86400)} jour(s).`);

const term = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!term) {
  console.log('  Ajoutez un terme pour tester une recherche : node scripts/check-igdb.mjs "zelda"');
  process.exit(0);
}

let games;
try {
  games = await igdbGames({
    id,
    token: token.access_token,
    // Mêmes champs restreints qu'avant : cette vérification n'a pas besoin des
    // visuels, seulement de prouver que la requête aboutit.
    body: searchBody(term, { fields: "id,name,slug,first_release_date,platforms.name", limit: 5 }),
    debug,
  });
} catch (error) {
  console.log(`\n✗ ${error.message}`);
  if (error.detail) console.log(`  Réponse d'IGDB : ${error.detail}`);
  if (error.status === 429) console.log("  Quota atteint : 4 requêtes par seconde.");
  if (error.status === 401) console.log("  Jeton refusé : l'application Twitch n'a peut-être pas accès à IGDB.");
  process.exit(1);
}

console.log(`\n✓ Recherche « ${term} » — ${games.length} résultat(s) :`);
for (const g of games) {
  const year = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : "????";
  console.log(`  ${String(g.id).padStart(7)}  ${year}  ${g.name}  [${(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}]`);
}
