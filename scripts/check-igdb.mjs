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

const token = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
}).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));

const days = Math.round((token.expires_in ?? 0) / 86400);
console.log(`\n✓ Authentification Twitch réussie — jeton valable ~${days} jour(s).`);

const term = process.argv[2];
if (!term) {
  console.log("  Ajoutez un terme pour tester une recherche : node scripts/check-igdb.mjs \"zelda\"");
  process.exit(0);
}

const games = await fetch("https://api.igdb.com/v4/games", {
  method: "POST",
  headers: { "Client-ID": id, Authorization: `Bearer ${token.access_token}` },
  body: `search "${term.replace(/"/g, '\\"')}"; fields name,slug,first_release_date,platforms.name; where version_parent = null; limit 5;`,
}).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));

console.log(`\n✓ Recherche « ${term} » — ${games.length} résultat(s) :`);
for (const g of games) {
  const year = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : "????";
  console.log(`  ${String(g.id).padStart(7)}  ${year}  ${g.name}  [${(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}]`);
}
