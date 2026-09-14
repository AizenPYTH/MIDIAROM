#!/usr/bin/env node
/**
 * Remplit la vitrine de démonstration de l'accueil depuis IGDB.
 *
 *   npm run demo:games            # résout les titres et écrit le fichier
 *   npm run demo:games -- --clear # vide la vitrine
 *
 * Les identifiants IGDB ne sont jamais écrits à la main : le script cherche
 * chaque titre de `DEMO_GAME_TITLES`, retient la fiche la mieux notée, écrit sa
 * version normalisée dans le cache `igdb_games` et consigne le couple
 * { igdbId, title } dans `lib/shop/demo-games.json`.
 *
 * Demande TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET (voir docs/IGDB.md) et un
 * accès réseau à api.igdb.com.
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const OUT = new URL("../lib/shop/demo-games.json", import.meta.url);

if (process.argv.includes("--clear")) {
  try {
    unlinkSync(OUT);
    console.log("✓ Vitrine de démonstration vidée.");
  } catch {
    console.log("Rien à vider.");
  }
  process.exit(0);
}

const id = process.env.TWITCH_CLIENT_ID;
const secret = process.env.TWITCH_CLIENT_SECRET;
if (!id || !secret) {
  console.error("✗ TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET sont requis. Voir docs/IGDB.md.");
  process.exit(1);
}

// Les titres sont lus depuis la source TypeScript : une seule liste à tenir.
const titles = [
  ...readFileSync(new URL("../lib/shop/demo-games.ts", import.meta.url), "utf8")
    .match(/export const DEMO_GAME_TITLES = \[([\s\S]*?)\] as const;/)[1]
    .matchAll(/"((?:[^"\\]|\\.)*)"/g),
].map((m) => m[1].replace(/\\"/g, '"'));

console.log(`${titles.length} titres à résoudre.`);

const token = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
}).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Twitch HTTP ${r.status}`))));

const FIELDS = [
  "id", "name", "slug", "summary", "storyline", "first_release_date",
  "total_rating", "total_rating_count",
  "cover.image_id", "cover.width", "cover.height",
  "artworks.image_id", "artworks.width", "artworks.height",
  "screenshots.image_id", "screenshots.width", "screenshots.height",
  "platforms.name", "platforms.abbreviation", "genres.name",
  "involved_companies.developer", "involved_companies.publisher", "involved_companies.company.name",
  "videos.video_id", "videos.name",
].join(",");

/** Quota IGDB : 4 requêtes par seconde. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(term) {
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": id, Authorization: `Bearer ${token.access_token}` },
    body: `search "${term.replace(/"/g, '\\"')}"; fields ${FIELDS}; where version_parent = null & category = 0; limit 8;`,
  });
  if (!res.ok) throw new Error(`IGDB HTTP ${res.status}`);
  return res.json();
}

const IMG = (imageId, size) => `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;

/** Même normalisation que lib/igdb/normalize.ts — gardée alignée à la main. */
function normalize(raw) {
  const img = (i, size) => (i?.image_id ? { imageId: i.image_id, url: IMG(i.image_id, size), width: i.width ?? null, height: i.height ?? null } : null);
  const company = (role) => raw.involved_companies?.find((c) => c[role] && c.company?.name)?.company?.name ?? null;
  const videos = raw.videos ?? [];
  const trailer = videos.find((v) => /trailer/i.test(v.name ?? "")) ?? videos[0];
  const rating = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
  return {
    igdbId: raw.id, name: raw.name, slug: raw.slug,
    summary: raw.summary?.trim() || null, storyline: raw.storyline?.trim() || null,
    releaseDate: raw.first_release_date ? new Date(raw.first_release_date * 1000).toISOString().slice(0, 10) : null,
    platforms: (raw.platforms ?? []).map((p) => p.name).filter(Boolean),
    genres: (raw.genres ?? []).map((g) => g.name).filter(Boolean),
    developer: company("developer"), publisher: company("publisher"),
    rating: rating(raw.total_rating), ratingCount: rating(raw.total_rating_count),
    cover: img(raw.cover, "cover_big"),
    artworks: (raw.artworks ?? []).map((a) => img(a, "1080p")).filter(Boolean).slice(0, 6),
    screenshots: (raw.screenshots ?? []).map((s) => img(s, "screenshot_big")).filter(Boolean).slice(0, 8),
    trailer: trailer?.video_id
      ? { provider: "youtube", videoId: trailer.video_id, title: trailer.name ?? null,
          posterUrl: `https://img.youtube.com/vi/${trailer.video_id}/maxresdefault.jpg`,
          watchUrl: `https://www.youtube.com/watch?v=${trailer.video_id}` }
      : null,
  };
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const entries = [];
const rows = [];
for (const title of titles) {
  try {
    const found = await search(title);
    // Le meilleur candidat : le titre le plus proche, puis la meilleure note.
    const exact = found.filter((g) => g.name?.toLowerCase() === title.toLowerCase());
    const pick = (exact.length ? exact : found).sort((a, b) => (b.total_rating_count ?? 0) - (a.total_rating_count ?? 0))[0];
    if (!pick) { console.log(`  ✗ ${title} — introuvable`); continue; }
    const game = normalize(pick);
    if (!game.cover) { console.log(`  ✗ ${title} — sans jaquette, écarté`); continue; }
    rows.push({ igdb_id: game.igdbId, name: game.name, slug: game.slug, data: game, synced_at: new Date().toISOString() });
    entries.push({ igdbId: game.igdbId, title: game.name });
    console.log(`  ✓ ${String(game.igdbId).padStart(7)}  ${game.name}${game.artworks.length ? "" : "  (sans artwork)"}`);
  } catch (e) {
    console.log(`  ✗ ${title} — ${e.message}`);
  }
  await wait(260);
}

if (!entries.length) {
  console.error("\n✗ Aucun jeu résolu : rien n'est écrit.");
  process.exit(1);
}

const { error } = await db.from("igdb_games").upsert(rows, { onConflict: "igdb_id" });
if (error) { console.error(`✗ Écriture du cache : ${error.message}`); process.exit(1); }

writeFileSync(OUT, JSON.stringify(entries, null, 2) + "\n");
console.log(`\n✓ ${entries.length} jeux en cache et dans lib/shop/demo-games.json.`);
console.log("  Ce sont des jeux de démonstration : ils ne sont pas au catalogue et ne sont pas achetables.");
console.log("  Pour les retirer : npm run demo:games -- --clear");
