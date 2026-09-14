#!/usr/bin/env node
/**
 * Vérifie l'accès à HobbyLink Japan, sans rien écrire en base.
 *
 *   npm run check:hlj                    # la configuration est-elle lue ?
 *   npm run check:hlj -- "luffy gear 5"  # + une vraie recherche
 *   npm run check:hlj -- "luffy" --raw   # + l'objet brut du premier résultat
 *
 * `--raw` est là pour une raison précise : un acteur Apify n'est pas un contrat
 * d'API, ses noms de champs varient. Si une information attendue ressort vide,
 * cette sortie montre comment l'acteur la nomme réellement, et la
 * correspondance de lib/catalog/providers/hlj.ts s'ajuste en une fois.
 *
 * N'affiche jamais le jeton.
 */
import { loadEnvLocal } from "./lib/igdb-cli.mjs";

loadEnvLocal();

const token = process.env.APIFY_TOKEN;
const actor = process.env.HLJ_APIFY_ACTOR;
const mask = (v) => (v ? `${v.slice(0, 5)}…${v.slice(-3)} (${v.length} caractères)` : "ABSENT");

console.log(`APIFY_TOKEN     : ${mask(token)}`);
console.log(`HLJ_APIFY_ACTOR : ${actor || "ABSENT"}`);

if (!token || !actor) {
  console.log("\n✗ L'import de figurines n'est pas configuré.");
  console.log("  1. Créez un compte Apify et récupérez le jeton (Settings → Integrations).");
  console.log("  2. Choisissez un acteur qui sait lire HobbyLink Japan.");
  console.log("  3. Posez APIFY_TOKEN et HLJ_APIFY_ACTOR dans .env.local (jamais NEXT_PUBLIC_*).");
  console.log("  Le reste du site fonctionne sans : seul l'écran d'import est masqué.");
  process.exit(1);
}

const term = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!term) {
  console.log('\n  Ajoutez un terme pour tester : npm run check:hlj -- "luffy gear 5"');
  process.exit(0);
}

const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`);
url.searchParams.set("token", token);
url.searchParams.set("limit", "5");

console.log(`\n→ recherche « ${term} » chez l'acteur ${actor}…`);
let items;
try {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ search: term, query: term, keyword: term, maxItems: 5 }),
  });
  if (!response.ok) {
    console.log(`\n✗ L'acteur a répondu HTTP ${response.status}.`);
    if (response.status === 401 || response.status === 403) console.log("  Jeton refusé, ou l'acteur n'est pas accessible à ce compte.");
    if (response.status === 404) console.log("  Acteur introuvable : vérifiez HLJ_APIFY_ACTOR (forme « utilisateur~nom-acteur »).");
    process.exit(1);
  }
  items = await response.json();
} catch (error) {
  console.log(`\n✗ Apify est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!Array.isArray(items) || !items.length) {
  console.log("\n✗ L'acteur n'a renvoyé aucun élément. Vérifiez le nom du champ de recherche qu'il attend.");
  process.exit(1);
}

const { toExternalProduct } = await import("../lib/catalog/providers/hlj.ts");
console.log(`\n✓ ${items.length} élément(s) reçu(s). Lecture :\n`);
for (const item of items) {
  const p = toExternalProduct(item);
  if (!p) {
    console.log("  ✗ élément illisible (ni nom ni référence)");
    continue;
  }
  const manquants = ["manufacturer", "series", "ean", "size"].filter((k) => !p[k]);
  console.log(`  ✓ ${p.name}`);
  console.log(`     réf ${p.ref} · ${p.manufacturer ?? "fabricant ?"} · ${p.images.length} image(s)`);
  if (manquants.length) console.log(`     champs vides : ${manquants.join(", ")}`);
}

if (process.argv.includes("--raw")) {
  console.log("\n--- objet brut du premier résultat ---");
  console.log(JSON.stringify(items[0], null, 2).slice(0, 3000));
}
