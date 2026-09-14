import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findGameIdByExternalUid, getGamesByIds, IgdbConfigurationError, IgdbRequestError, searchGames } from "@/lib/igdb/client";
import { normalizeGame } from "@/lib/igdb/normalize";
import { rankMatches, scoreMatch } from "@/lib/igdb/match";
import type { Game, GameLookupHints, GameMatch, IgdbGame } from "@/lib/igdb/types";
import type { Json } from "@/types/database";

/**
 * Couche métier IGDB : cache d'abord, réseau ensuite, jamais d'échec fatal.
 *
 * Règle qui gouverne tout le fichier : **une page qui s'affiche n'appelle
 * jamais IGDB**. Les lectures (`getGame`, `getGames`) ne lisent que notre
 * base ; seules les fonctions explicitement nommées `sync*` et `searchGames*`,
 * déclenchées par le back-office ou une tâche, sortent sur le réseau.
 *
 * Voir aussi lib/igdb/client.ts (HTTP), normalize.ts (traduction),
 * match.ts (choix du bon jeu).
 */

/** Au-delà, une fiche en cache est considérée comme à rafraîchir. */
const FRESHNESS_DAYS = 30;

export interface SyncResult {
  game: Game | null;
  /** D'où vient la fiche renvoyée : utile pour l'afficher et pour les tests. */
  source: "cache" | "igdb" | "unavailable";
  error: string | null;
}

function isStale(syncedAt: string | null): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > FRESHNESS_DAYS * 86_400_000;
}

/** Traduit une panne IGDB en phrase affichable, sans jamais laisser fuiter un secret. */
function describeError(error: unknown): string {
  if (error instanceof IgdbConfigurationError) return "IGDB n'est pas configuré.";
  if (error instanceof IgdbRequestError) return error.message;
  return "IGDB est momentanément indisponible.";
}

// ---------------------------------------------------------------------------
// Lectures — base seule, jamais de réseau
// ---------------------------------------------------------------------------

/** Fiche en cache, ou null. N'appelle jamais IGDB. */
export async function getGame(igdbId: number): Promise<Game | null> {
  const { data } = await createSupabaseAdminClient().from("igdb_games").select("data").eq("igdb_id", igdbId).maybeSingle();
  return (data?.data as Game | undefined) ?? null;
}

/**
 * Plusieurs fiches en une requête.
 *
 * C'est la fonction qui rend l'accueil tenable : vingt cartes se résolvent en
 * un seul aller-retour vers notre base, zéro vers IGDB.
 */
export async function getGames(igdbIds: number[]): Promise<Map<number, Game>> {
  const out = new Map<number, Game>();
  const ids = [...new Set(igdbIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return out;
  const { data } = await createSupabaseAdminClient().from("igdb_games").select("igdb_id, data").in("igdb_id", ids);
  for (const row of data ?? []) out.set(Number(row.igdb_id), row.data as unknown as Game);
  return out;
}

// ---------------------------------------------------------------------------
// Écritures — réseau autorisé
// ---------------------------------------------------------------------------

async function cacheGames(games: Game[]): Promise<void> {
  if (!games.length) return;
  await createSupabaseAdminClient()
    .from("igdb_games")
    .upsert(
      games.map((g) => ({ igdb_id: g.igdbId, name: g.name, slug: g.slug, data: g as unknown as Json, synced_at: new Date().toISOString() })),
      { onConflict: "igdb_id" },
    );
}

/**
 * Cherche des jeux sur IGDB et les note face au produit décrit par `hints`.
 *
 * Les fiches rencontrées sont mises en cache au passage : une recherche de
 * l'atelier prépare l'affichage qui suivra.
 */
export async function searchGameMatches(hints: GameLookupHints, limit = 10): Promise<{ matches: GameMatch[]; error: string | null }> {
  try {
    // 1. Le code-barres, quand il est connu d'IGDB : il désigne l'édition et
    //    la plateforme exactes, il n'y a plus rien à deviner.
    if (hints.ean) {
      const byBarcode = await findGameIdByExternalUid(hints.ean);
      if (byBarcode) {
        const raw = await getGamesByIds([byBarcode]);
        const games = raw.map(normalizeGame);
        await cacheGames(games);
        if (games[0]) return { matches: [scoreMatch(games[0], hints, true)], error: null };
      }
    }

    // 2. Sinon la recherche par nom, puis le départage par plateforme.
    const raw: IgdbGame[] = await searchGames(hints.name, Math.min(Math.max(limit, 1), 25));
    const games = raw.map(normalizeGame);
    await cacheGames(games);
    return { matches: rankMatches(games, hints), error: null };
  } catch (error) {
    console.error("[igdb] recherche impossible —", describeError(error));
    return { matches: [], error: describeError(error) };
  }
}

/**
 * Récupère une fiche : cache s'il est frais, IGDB sinon.
 *
 * En cas de panne IGDB, une fiche périmée vaut mieux que rien — c'est le
 * premier repli demandé (données locales avant placeholder).
 */
export async function syncGame(igdbId: number, options: { force?: boolean } = {}): Promise<SyncResult> {
  const db = createSupabaseAdminClient();
  const { data: cached } = await db.from("igdb_games").select("data, synced_at").eq("igdb_id", igdbId).maybeSingle();
  const cachedGame = (cached?.data as Game | undefined) ?? null;

  if (cachedGame && !options.force && !isStale(cached?.synced_at ?? null)) {
    return { game: cachedGame, source: "cache", error: null };
  }

  try {
    const raw = await getGamesByIds([igdbId]);
    const game = raw[0] ? normalizeGame(raw[0]) : null;
    if (!game) {
      // IGDB a répondu que ce jeu n'existe pas : ce n'est pas une panne.
      return { game: cachedGame, source: cachedGame ? "cache" : "unavailable", error: "Jeu introuvable sur IGDB." };
    }
    await cacheGames([game]);
    return { game, source: "igdb", error: null };
  } catch (error) {
    const message = describeError(error);
    console.error(`[igdb] synchronisation du jeu ${igdbId} impossible —`, message);
    return { game: cachedGame, source: cachedGame ? "cache" : "unavailable", error: message };
  }
}

/**
 * Associe un jeu à un produit. Toujours réversible : `igdbId = null` dissocie.
 *
 * `source` dit comment l'association a été faite. Une correspondance validée
 * à la main (MANUAL) n'est jamais écrasée par une passe automatique : voir
 * syncProductsNeedingMatch.
 */
export async function linkProductToGame(
  productId: string,
  igdbId: number | null,
  source: "AUTO" | "MANUAL" | "BARCODE",
  confidence: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (igdbId !== null) {
    // La contrainte de clé étrangère impose que la fiche soit en cache.
    const result = await syncGame(igdbId);
    if (!result.game) return { ok: false, error: result.error ?? "Fiche IGDB indisponible." };
  }
  const { error } = await createSupabaseAdminClient()
    .from("products")
    .update({
      igdb_game_id: igdbId,
      igdb_match_source: igdbId === null ? null : source,
      igdb_match_confidence: igdbId === null ? null : confidence,
      igdb_synced_at: igdbId === null ? null : new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Ce que l'on sait d'un produit, sous la forme attendue par le moteur. */
export function hintsFromProduct(product: {
  name: string;
  platform: string | null;
  ean: string | null;
  sku: string | null;
  edition: string | null;
  region: string | null;
  release_year: number | null;
}): GameLookupHints {
  return {
    name: product.name,
    platform: product.platform,
    ean: product.ean,
    sku: product.sku,
    edition: product.edition,
    region: product.region,
    releaseYear: product.release_year,
  };
}

// ---------------------------------------------------------------------------
// Entretien d'un catalogue important
// ---------------------------------------------------------------------------

export interface MaintenanceReport {
  examined: number;
  refreshed: number;
  linked: number;
  failed: number;
  /** Premier motif d'échec rencontré, pour le journal du travail nocturne. */
  error: string | null;
}

/**
 * Rafraîchit les fiches périmées, par petits paquets.
 *
 * Le quota IGDB (4 req/s) est tenu par la file d'attente du client ; la borne
 * `limit` évite en plus qu'une nuit de rattrapage s'éternise sur un catalogue
 * de plusieurs milliers de jeux. Le reste passera la nuit suivante : une fiche
 * périmée reste parfaitement affichable entre-temps.
 */
export async function refreshStaleGames(limit = 50): Promise<MaintenanceReport> {
  const report: MaintenanceReport = { examined: 0, refreshed: 0, linked: 0, failed: 0, error: null };
  const cutoff = new Date(Date.now() - FRESHNESS_DAYS * 86_400_000).toISOString();
  const { data } = await createSupabaseAdminClient()
    .from("igdb_games")
    .select("igdb_id")
    .lt("synced_at", cutoff)
    .order("synced_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 500));

  for (const row of data ?? []) {
    report.examined += 1;
    const result = await syncGame(Number(row.igdb_id), { force: true });
    if (result.source === "igdb") report.refreshed += 1;
    else {
      report.failed += 1;
      report.error ??= result.error;
      // IGDB est en panne ou le quota est épuisé : inutile d'insister sur les
      // centaines de fiches suivantes, la nuit prochaine reprendra la liste.
      if (result.source === "unavailable") break;
    }
  }
  return report;
}

/**
 * Cherche une correspondance pour les produits « Jeu » qui n'en ont pas.
 *
 * N'associe QUE les correspondances sûres (au-dessus du seuil), et ne touche
 * jamais à un produit déjà associé — une validation humaine ne doit jamais
 * être défaite par une passe automatique. Les cas douteux restent à traiter
 * dans le back-office, ce qui est exactement le but du score.
 */
export async function matchUnlinkedGames(limit = 25): Promise<MaintenanceReport> {
  const report: MaintenanceReport = { examined: 0, refreshed: 0, linked: 0, failed: 0, error: null };
  const { data } = await createSupabaseAdminClient()
    .from("products")
    .select("id, name, platform, ean, sku, edition, region, release_year")
    .eq("category", "GAME")
    .eq("is_active", true)
    .is("igdb_game_id", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  for (const product of data ?? []) {
    report.examined += 1;
    const { matches, error } = await searchGameMatches(hintsFromProduct(product), 5);
    if (error) {
      report.failed += 1;
      report.error ??= error;
      break; // IGDB indisponible : on arrête là.
    }
    const best = matches[0];
    if (!best?.isConfident) continue;
    const source = best.reasons[0]?.startsWith("Code-barres") ? "BARCODE" : "AUTO";
    const linked = await linkProductToGame(product.id, best.game.igdbId, source, best.confidence);
    if (linked.ok) report.linked += 1;
    else report.failed += 1;
  }
  return report;
}
