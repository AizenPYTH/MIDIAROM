#!/usr/bin/env node
/**
 * Éprouve la recherche de figurines, et aide à trouver la bonne source.
 *
 *   npm run check:hlj -- "luffy gear 5"
 *   npm run check:hlj -- "luffy gear 5" --raw        # + la fiche brute
 *   npm run check:hlj -- "luffy gear 5" --discover   # HLJ appelle-t-il une API ?
 *
 * Sans option, ce script fait **exactement** ce que fait l'écran
 * Admin → Catalogue → Importer une figurine : même provider, même requête,
 * même lecture, même limite. Il ne peut donc pas passer pendant que l'écran
 * échoue, ni l'inverse.
 *
 * La recherche passe par l'acteur Apify dédié à HobbyLink Japan, parce que la
 * page de résultats de HLJ est rendue par le navigateur — 200, 218 000
 * caractères, aucune donnée structurée — et que HLJ ne publie pas d'API de
 * recherche. Il suffit donc de APIFY_TOKEN dans .env.local.
 *
 * `--discover` reste utile pour une seule question : la page appelle-t-elle un
 * endpoint JSON qu'on pourrait interroger directement, sans acteur ni coût ?
 * Il lit la page, suit ses bundles JavaScript et rapporte les endpoints,
 * moteurs de recherche et clés publiques qu'il y trouve. On regarde avant
 * d'écrire du code, au lieu de deviner une troisième fois.
 *
 * Sortie propre : aucun `process.exit()` pendant qu'une requête est en vol.
 */import { loadEnvLocal } from "./lib/igdb-cli.mjs";
import { apiKeyHints, endpointsFrom, enginesIn, scriptUrls, searchForm, stateBlobs } from "./lib/hlj-discover.mjs";

loadEnvLocal();

const args = process.argv.slice(2);
const term = args.find((a) => !a.startsWith("--"));
const discover = args.includes("--discover");
const raw = args.includes("--raw");

const UA = process.env.HLJ_USER_AGENT?.trim() || "MediaromCatalogBot/1.0 (+https://207mediarom.fr)";
const PAGE = process.env.HLJ_SEARCH_URL?.trim() || "https://www.hlj.com/search/?Word={q}";

async function get(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" }, redirect: "follow" });
    return { status: r.status, body: await r.text(), url: r.url || url };
  } catch (error) {
    return { status: 0, body: "", url, error: error instanceof Error ? error.message : String(error) };
  }
}

if (!term) {
  console.log('Ajoutez un terme : npm run check:hlj -- "luffy gear 5"');
  process.exitCode = 0;
} else if (discover) {
  // ─────────────────────────── mode découverte ───────────────────────────
  const url = PAGE.includes("{q}") ? PAGE.replace("{q}", encodeURIComponent(term)) : `${PAGE}?Word=${encodeURIComponent(term)}`;
  console.log(`→ GET ${url}`);
  const page = await get(url);
  console.log(`← HTTP ${page.status}${page.error ? ` (${page.error})` : ""} · ${page.body.length} caractères\n`);

  if (!page.body) {
    console.log("✗ Page vide : impossible d'analyser.");
    process.exitCode = 1;
  } else {
    const form = searchForm(page.body);
    console.log("FORMULAIRE DE RECHERCHE");
    console.log(form ? `  action=${form.action ?? "—"} · champs: ${form.champs.join(", ") || "—"}` : "  non trouvé");

    console.log("\nÉTAT LAISSÉ DANS LA PAGE");
    const blobs = stateBlobs(page.body);
    console.log(blobs.length ? `  ${blobs.join(", ")}` : "  aucun (ni Next, ni Nuxt, ni Apollo)");

    console.log("\nMOTEUR DE RECHERCHE REPÉRÉ DANS LA PAGE");
    const moteursPage = enginesIn(page.body);
    console.log(moteursPage.length ? `  ${moteursPage.join(", ")}` : "  aucun");

    const endpointsPage = endpointsFrom(page.body, page.url);
    console.log("\nENDPOINTS DANS LA PAGE");
    console.log(endpointsPage.length ? endpointsPage.slice(0, 15).map((e) => `  · ${e}`).join("\n") : "  aucun");

    // Les bundles : c'est presque toujours là que l'appel est écrit.
    const scripts = scriptUrls(page.body, page.url).filter((s) => /\.js(\?|$)/i.test(s)).slice(0, 8);
    console.log(`\nBUNDLES JAVASCRIPT (${scripts.length} analysés)`);
    const moteursBundle = new Set();
    const endpointsBundle = new Set();
    const cles = new Set();
    for (const src of scripts) {
      const js = await get(src);
      if (!js.body) {
        console.log(`  ✗ ${src.split("/").pop()} — HTTP ${js.status}`);
        continue;
      }
      enginesIn(js.body).forEach((m) => moteursBundle.add(m));
      endpointsFrom(js.body, page.url).forEach((e) => endpointsBundle.add(e));
      apiKeyHints(js.body).forEach((k) => cles.add(k));
      console.log(`  ✓ ${src.split("/").pop()} — ${Math.round(js.body.length / 1024)} Ko`);
    }

    console.log("\nMOTEUR REPÉRÉ DANS LES BUNDLES");
    console.log(moteursBundle.size ? `  ${[...moteursBundle].join(", ")}` : "  aucun");
    console.log("\nCLÉS PUBLIQUES VISIBLES (masquées)");
    console.log(cles.size ? [...cles].map((k) => `  · ${k}`).join("\n") : "  aucune");
    console.log("\nENDPOINTS DANS LES BUNDLES");
    const tous = [...endpointsBundle].filter((e) => !endpointsPage.includes(e));
    console.log(tous.length ? tous.slice(0, 25).map((e) => `  · ${e}`).join("\n") : "  aucun");

    console.log("\n─────────────────────────────────────────────");
    console.log("Si une URL ci-dessus ressemble à une recherche produit, elle éviterait");
    console.log("l'acteur Apify. Posez-la dans .env.local, le terme à la place de {q} :");
    console.log("  HLJ_SEARCH_API=https://…/search?q={q}&limit={limit}");
    console.log("Sinon, il n'y a rien à faire : la recherche passe déjà par l'acteur.");
    console.log('Relancez sans option : npm run check:hlj -- "' + term + '"');
  }
} else {
  // ───────────────────── mode réel : le provider lui-même ─────────────────────
  // La même limite que l'écran d'import : une seule définition, partagée.
  const { SEARCH_LIMIT } = await import("../lib/catalog/providers/types.ts");
  const { hljProvider } = await import("../lib/catalog/providers/hlj.ts");
  const { sortFigurines } = await import("../lib/catalog/figurine-filter.ts");
  const probleme = hljProvider.configurationError();
  console.log(`Stratégie : ${hljProvider.strategyLabel()}`);
  if (probleme) {
    console.log(`\n✗ ${probleme}`);
    process.exitCode = 1;
  } else {
    console.log(`\n→ recherche « ${term} », ${SEARCH_LIMIT} résultats au plus…`);
    const { products, error, debug } = await hljProvider.search(term, SEARCH_LIMIT);
    if (debug) console.log(`   ${debug}`);
    if (!products.length) {
      console.log(`\n✗ ${error ?? "Aucun résultat."}`);
      process.exitCode = 1;
    } else {
      // Le même tri que l'écran d'import, sur les mêmes données.
      const { kept, rejected } = sortFigurines(products);
      console.log(`\n✓ ${products.length} fiche(s) — ${kept.length} gardée(s), ${rejected.length} écartée(s).\n`);

      for (const { product: p, verdict, reason } of kept) {
        const vides = ["manufacturer", "series", "ean", "size"].filter((k) => !p[k]);
        console.log(`  ${verdict === "figurine" ? "✓" : "?"} ${p.name}`);
        console.log(`     réf ${p.ref} · ${p.manufacturer ?? "fabricant ?"} · ${p.category ?? "rayon ?"} · ${p.images.length} image(s)`);
        if (reason) console.log(`     à vérifier : ${reason}`);
        if (vides.length) console.log(`     champs vides : ${vides.join(", ")}`);
      }

      if (rejected.length) {
        console.log("\n  Écartés — conservés dans les données, consultables et importables :");
        for (const { product: p, reason } of rejected) console.log(`  ✗ ${p.name}\n     ${reason}`);
      }

      if (raw) {
        console.log("\n--- première fiche gardée, telle qu'elle sera importée ---");
        console.log(JSON.stringify(kept[0]?.product ?? products[0], null, 2).slice(0, 2000));
      }
      if (!kept.length) process.exitCode = 1;
    }
  }
}
