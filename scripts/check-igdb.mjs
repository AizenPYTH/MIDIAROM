#!/usr/bin/env node
/**
 * Vérifie la connexion IGDB de bout en bout, sans rien écrire en base.
 *
 *   node scripts/check-igdb.mjs            # authentification seule
 *   node scripts/check-igdb.mjs "zelda"    # + une vraie recherche
 *
 * Lit TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET depuis l'environnement ou
 * .env.local. N'affiche jamais le secret ni le jeton.
 */
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* pas de .env.local : on se contente de l'environnement */
  }
}
loadEnvLocal();

const id = process.env.TWITCH_CLIENT_ID;
const secret = process.env.TWITCH_CLIENT_SECRET;
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

/**
 * Traduit un refus de Twitch en cause probable. On n'affiche jamais le corps de
 * la réponse : il peut refléter les paramètres envoyés, donc le secret.
 */
function explainAuthFailure(status) {
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
  if (status >= 500) return "Twitch est momentanément indisponible. Réessayez plus tard.";
  return "Échec inattendu de l'authentification.";
}

let token;
try {
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
  });
  if (!response.ok) {
    console.log(`\n✗ Authentification Twitch refusée (HTTP ${response.status}).`);
    console.log(explainAuthFailure(response.status));
    process.exit(1);
  }
  token = await response.json();
} catch (error) {
  console.log(`\n✗ Twitch est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  console.log("  Vérifiez votre connexion réseau ou un éventuel proxy d'entreprise.");
  process.exit(1);
}

const days = Math.round((token.expires_in ?? 0) / 86400);
console.log(`\n✓ Authentification Twitch réussie — jeton valable ~${days} jour(s).`);

const term = process.argv[2];
if (!term) {
  console.log("  Ajoutez un terme pour tester une recherche : node scripts/check-igdb.mjs \"zelda\"");
  process.exit(0);
}

let games;
try {
  const response = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": id, Authorization: `Bearer ${token.access_token}` },
    body: `search "${term.replace(/"/g, '\\"')}"; fields name,slug,first_release_date,platforms.name; where version_parent = null; limit 5;`,
  });
  if (!response.ok) {
    console.log(`\n✗ IGDB a répondu HTTP ${response.status}.`);
    if (response.status === 429) console.log("  Quota atteint : 4 requêtes par seconde.");
    if (response.status === 401) console.log("  Jeton refusé : l'application Twitch n'a peut-être pas accès à IGDB.");
    process.exit(1);
  }
  games = await response.json();
} catch (error) {
  console.log(`\n✗ IGDB est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log(`\n✓ Recherche « ${term} » — ${games.length} résultat(s) :`);
for (const g of games) {
  const year = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : "????";
  console.log(`  ${String(g.id).padStart(7)}  ${year}  ${g.name}  [${(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}]`);
}
