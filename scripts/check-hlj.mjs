#!/usr/bin/env node
/**
 * Éprouve la recherche de figurines, sans rien écrire en base.
 *
 *   npm run check:hlj -- "luffy gear 5"
 *   npm run check:hlj -- "luffy gear 5" --raw   # + ce que la page contient
 *
 * Ce script fait **exactement** ce que fait l'écran d'import : une requête sur
 * la recherche de HobbyLink Japan, puis la lecture de ses données structurées
 * schema.org. Il ne peut donc pas passer pendant que l'écran échoue — c'est
 * précisément ce qui s'était produit avec la version Apify, qui envoyait un
 * champ que l'acteur n'accepte pas.
 *
 * `--raw` montre ce que la page publie réellement : nombre de blocs JSON-LD,
 * types rencontrés, début du premier bloc. Si HLJ change de format ou rend ses
 * résultats côté navigateur, cette sortie le dit en une fois.
 *
 * Sortie propre : aucun `process.exit()` pendant qu'une requête est en vol —
 * c'est ce qui provoquait l'assertion libuv
 * « !(handle->flags & UV_HANDLE_CLOSING) » en fin de script.
 */
import { loadEnvLocal } from "./lib/igdb-cli.mjs";

loadEnvLocal();

const BASE = "https://www.hlj.com";
const DEFAUT = `${BASE}/search/?Word={q}`;

const args = process.argv.slice(2);
const term = args.find((a) => !a.startsWith("--"));
const raw = args.includes("--raw");

/** Termine proprement : on pose le code, on laisse Node fermer ses poignées. */
function stop(code) {
  process.exitCode = code;
}

const modele = process.env.HLJ_SEARCH_URL?.trim() || DEFAUT;
console.log(`Recherche HLJ   : ${modele}${process.env.HLJ_SEARCH_URL ? "" : "  (défaut)"}`);
console.log(`User-Agent      : ${process.env.HLJ_USER_AGENT?.trim() || "MediaromCatalogBot/1.0  (défaut)"}`);

if (!term) {
  console.log('\n  Ajoutez un terme : npm run check:hlj -- "luffy gear 5"');
  stop(0);
} else {
  const url = modele.includes("{q}")
    ? modele.replace("{q}", encodeURIComponent(term))
    : `${modele}${modele.includes("?") ? "&" : "?"}Word=${encodeURIComponent(term)}`;

  console.log(`\n→ GET ${url}`);
  let html = null;
  let finalUrl = url;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": process.env.HLJ_USER_AGENT?.trim() || "MediaromCatalogBot/1.0 (+https://207mediarom.fr)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    console.log(`← HTTP ${response.status}`);
    if (!response.ok) {
      console.log("\n✗ HobbyLink Japan a refusé la requête.");
      if (response.status === 403) console.log("  Accès refusé : essayez un autre User-Agent via HLJ_USER_AGENT.");
      if (response.status === 404) console.log("  Page introuvable : l'URL de recherche a changé. Corrigez HLJ_SEARCH_URL.");
      stop(1);
    } else {
      html = await response.text();
      finalUrl = response.url || url;
    }
  } catch (error) {
    console.log(`\n✗ HobbyLink Japan est injoignable : ${error instanceof Error ? error.message : String(error)}`);
    stop(1);
  }

  if (html) {
    const { extractJsonLd, productNodes, productFromSchema, productUrls } = await import("../lib/catalog/providers/jsonld.ts");
    const nodes = extractJsonLd(html);
    const produits = productNodes(nodes);
    const liens = productUrls(nodes, finalUrl);

    console.log(`\n  page de ${html.length} caractères`);
    console.log(`  blocs JSON-LD : ${nodes.length}`);
    console.log(`  types         : ${[...new Set(nodes.map((n) => JSON.stringify(n["@type"]) ?? "?"))].join(", ") || "aucun"}`);
    console.log(`  produits      : ${produits.length}`);
    console.log(`  liens listés  : ${liens.length}`);

    if (produits.length) {
      console.log("\n✓ Lecture des fiches :\n");
      for (const node of produits.slice(0, 5)) {
        const p = productFromSchema(node, "HLJ", finalUrl);
        if (!p) {
          console.log("  ✗ fiche sans nom exploitable");
          continue;
        }
        const vides = ["manufacturer", "series", "ean", "size"].filter((k) => !p[k]);
        console.log(`  ✓ ${p.name}`);
        console.log(`     réf ${p.ref} · ${p.manufacturer ?? "fabricant ?"} · ${p.images.length} image(s)`);
        if (vides.length) console.log(`     champs vides : ${vides.join(", ")} (l'import ouvrira la fiche détaillée)`);
      }
    } else if (liens.length) {
      console.log("\n✓ La page ne liste que des liens : l'import ouvrira les fiches détaillées.");
      liens.slice(0, 5).forEach((l) => console.log(`  · ${l}`));
    } else {
      console.log("\n✗ Aucune donnée structurée exploitable sur cette page.");
      console.log("  Deux causes possibles, dans cet ordre :");
      console.log("   1. l'URL de recherche a changé — corrigez HLJ_SEARCH_URL (le terme va à la place de {q}) ;");
      console.log("   2. HLJ rend ses résultats dans le navigateur — il faudra alors un acteur Apify");
      console.log("      qui exécute la page, ou une autre source. Relancez avec --raw pour trancher.");
      stop(1);
    }

    if (raw) {
      console.log("\n--- ce que la page contient ---");
      console.log(`title : ${html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "—"}`);
      if (nodes.length) {
        console.log("premier bloc JSON-LD :");
        console.log(JSON.stringify(nodes[0], null, 2).slice(0, 2500));
      } else {
        console.log("aucun bloc JSON-LD. Extrait du corps :");
        console.log(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\s+/g, " ").slice(0, 1200));
      }
    }
  }
}
