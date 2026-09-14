#!/usr/bin/env node
/**
 * Jeux de démonstration pour tester la section « Derniers jeux » de l'accueil.
 *
 *   node scripts/homepage-fixtures.mjs up      # pose les cas de test
 *   node scripts/homepage-fixtures.mjs down    # les retire tous
 *   node scripts/homepage-fixtures.mjs empty   # catalogue vide (= down)
 *   node scripts/homepage-fixtures.mjs status  # ce qui est en place
 *
 * CE N'EST PAS UN SEED DE PRODUCTION. Tous les produits posés ici portent le
 * préfixe de SKU « DEMO-HP- » et `down` les supprime tous : rien ne peut se
 * confondre avec le vrai catalogue, qui reste vide tant que l'atelier n'a rien
 * saisi. Les fiches IGDB sont écrites directement dans le cache, sans appeler
 * IGDB : le script tourne donc sans identifiants.
 *
 * Couvre les états que l'accueil doit savoir afficher :
 *   1. jeu complet, avec vidéo de fond
 *   2. jeu complet, sans vidéo (doit retomber sur l'artwork)
 *   3. jeu sans artwork (doit retomber sur la jaquette, puis la photo produit)
 *   4. jeu sans aucune fiche IGDB (photos du produit seules)
 *   5. jeu en rupture de stock
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PREFIX = "DEMO-HP-";
const IMG = (id, size) => `https://images.igdb.com/igdb/image/upload/t_${size}/${id}.jpg`;

/** Fiche normalisée (modèle Game), écrite telle quelle dans le cache. */
function fiche({ id, name, slug, platforms, cover, artwork, screenshots = [], trailer = null, year }) {
  return {
    igdbId: id, name, slug,
    summary: `Résumé de démonstration pour ${name}.`,
    storyline: null,
    releaseDate: year ? `${year}-01-01` : null,
    platforms, genres: ["Action"],
    developer: "Studio de démonstration", publisher: "Éditeur de démonstration",
    rating: 85, ratingCount: 100,
    cover: cover ? { imageId: cover, url: IMG(cover, "cover_big"), width: 1200, height: 1600 } : null,
    artworks: artwork ? [{ imageId: artwork, url: IMG(artwork, "1080p"), width: 1920, height: 1080 }] : [],
    screenshots: screenshots.map((s) => ({ imageId: s, url: IMG(s, "screenshot_big"), width: 1280, height: 720 })),
    trailer: trailer
      ? { provider: "youtube", videoId: trailer, title: "Bande-annonce", posterUrl: `https://img.youtube.com/vi/${trailer}/maxresdefault.jpg`, watchUrl: `https://www.youtube.com/watch?v=${trailer}` }
      : null,
  };
}

const GAMES = [
  fiche({ id: 900_001, name: "Démo — jeu vedette avec vidéo", slug: "demo-video", platforms: ["PlayStation 5"], cover: "co1a01", artwork: "ar1a01", screenshots: ["sc1a01", "sc1a02", "sc1a03"], trailer: "dQw4w9WgXcQ", year: 2025 }),
  fiche({ id: 900_002, name: "Démo — jeu complet sans vidéo", slug: "demo-sans-video", platforms: ["Nintendo Switch"], cover: "co1a02", artwork: "ar1a02", screenshots: ["sc1b01", "sc1b02"], year: 2024 }),
  fiche({ id: 900_003, name: "Démo — jeu sans artwork", slug: "demo-sans-artwork", platforms: ["Xbox Series X|S"], cover: "co1a03", artwork: null, screenshots: [], year: 2023 }),
];

const PRODUCTS = [
  { sku: `${PREFIX}VIDEO`, slug: "demo-hp-video", name: "Démo — jeu vedette avec vidéo", platform: "PlayStation 5", condition: "NEW", price_cents: 6999, compare_at_price_cents: 7999, quantity: 5, igdb_game_id: 900_001, is_featured: true, display_order: 1, hero_video_url: "https://cdn.example.com/demo-hero.mp4", hero_video_poster_path: null },
  { sku: `${PREFIX}NOVIDEO`, slug: "demo-hp-sans-video", name: "Démo — jeu complet sans vidéo", platform: "Nintendo Switch", condition: "NEW", price_cents: 5499, quantity: 3, igdb_game_id: 900_002, display_order: 2 },
  { sku: `${PREFIX}NOART`, slug: "demo-hp-sans-artwork", name: "Démo — jeu sans artwork", platform: "Xbox Series X|S", condition: "USED_A", price_cents: 2999, quantity: 2, igdb_game_id: 900_003, display_order: 3 },
  { sku: `${PREFIX}NOIGDB`, slug: "demo-hp-sans-fiche", name: "Démo — jeu sans fiche IGDB", platform: "PlayStation 4", condition: "USED_B", price_cents: 1499, quantity: 1, igdb_game_id: null, images: ["/medias/facade-207-mediarom.webp"], display_order: 4 },
  { sku: `${PREFIX}RUPTURE`, slug: "demo-hp-rupture", name: "Démo — jeu en rupture", platform: "PlayStation 5", condition: "NEW", price_cents: 7999, quantity: 0, igdb_game_id: 900_001, display_order: 5 },
];

async function up() {
  const { error: cacheError } = await db.from("igdb_games").upsert(
    GAMES.map((g) => ({ igdb_id: g.igdbId, name: g.name, slug: g.slug, data: g, synced_at: new Date().toISOString() })),
    { onConflict: "igdb_id" },
  );
  if (cacheError) throw new Error(`cache IGDB : ${cacheError.message}`);

  const { error } = await db.from("products").upsert(
    // Un upsert envoie null pour toute colonne omise : les valeurs par défaut
    // de la table ne s'appliquent pas. Toutes les colonnes NOT NULL doivent
    // donc être fournies explicitement.
    PRODUCTS.map((p) => ({
      category: "GAME", is_active: true, specs: {}, includes: [], images: [],
      cost_cents: 0, low_stock_threshold: 2, is_retro: false, is_featured: false,
      display_order: 0, ...p,
    })),
    { onConflict: "sku" },
  );
  if (error) throw new Error(`produits : ${error.message}`);
  console.log(`✓ ${GAMES.length} fiche(s) en cache, ${PRODUCTS.length} produit(s) de démonstration.`);
  await status();
}

async function down() {
  const { data } = await db.from("products").select("id, sku").like("sku", `${PREFIX}%`);
  if (data?.length) await db.from("products").delete().in("id", data.map((p) => p.id));
  await db.from("igdb_games").delete().in("igdb_id", GAMES.map((g) => g.igdbId));
  console.log(`✓ ${data?.length ?? 0} produit(s) et ${GAMES.length} fiche(s) retirés.`);
  await status();
}

async function status() {
  const { count: demo } = await db.from("products").select("id", { count: "exact", head: true }).like("sku", `${PREFIX}%`);
  const { count: all } = await db.from("products").select("id", { count: "exact", head: true });
  const { count: games } = await db.from("products").select("id", { count: "exact", head: true }).eq("category", "GAME").eq("is_active", true);
  const { count: cached } = await db.from("igdb_games").select("igdb_id", { count: "exact", head: true });
  console.log(`  produits : ${all ?? 0} (dont ${demo ?? 0} de démonstration) · jeux actifs : ${games ?? 0} · fiches en cache : ${cached ?? 0}`);
}

const action = process.argv[2] ?? "status";
const actions = { up, down, empty: down, status };
if (!actions[action]) {
  console.error(`Action inconnue : ${action}. Attendu : up | down | empty | status`);
  process.exit(1);
}
await actions[action]();
