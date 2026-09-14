import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Cache IGDB et replis, contre une vraie base.
 *
 * Ces tests n'appellent JAMAIS IGDB : ils vérifient précisément qu'une lecture
 * n'en a pas besoin, et que l'absence de configuration ou de fiche dégrade
 * proprement au lieu de casser la page.
 */
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const d = enabled ? describe : describe.skip;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

const FAKE_IGDB_ID = 999_000_001;
const created: string[] = [];

d("cache IGDB et repli de l'accueil", () => {
  afterAll(async () => {
    const db = admin();
    if (created.length) await db.from("products").delete().in("id", created);
    await db.from("igdb_games").delete().eq("igdb_id", FAKE_IGDB_ID);
  });

  it("lit une fiche en cache sans sortir sur le réseau", async () => {
    const { getGame } = await import("@/lib/igdb/service");
    const db = admin();
    const game = {
      igdbId: FAKE_IGDB_ID, name: "Jeu de test", slug: "jeu-de-test", summary: "Résumé.", storyline: null,
      releaseDate: "2024-01-01", platforms: ["PlayStation 5"], genres: ["Action"], developer: "Studio",
      publisher: "Éditeur", rating: 88, ratingCount: 10,
      cover: { imageId: "cotest", url: "https://images.igdb.com/igdb/image/upload/t_cover_big/cotest.jpg", width: 1200, height: 1600 },
      artworks: [], screenshots: [], trailer: null,
    };
    await db.from("igdb_games").upsert({ igdb_id: FAKE_IGDB_ID, name: game.name, slug: game.slug, data: game }, { onConflict: "igdb_id" });

    const read = await getGame(FAKE_IGDB_ID);
    expect(read?.name).toBe("Jeu de test");
    expect(read?.platforms).toEqual(["PlayStation 5"]);
  });

  it("résout plusieurs fiches en une seule requête", async () => {
    const { getGames } = await import("@/lib/igdb/service");
    const map = await getGames([FAKE_IGDB_ID, FAKE_IGDB_ID, 123_456_789]);
    expect(map.get(FAKE_IGDB_ID)?.name).toBe("Jeu de test");
    expect(map.has(123_456_789)).toBe(false);
  });

  it("sert l'accueil avec les données IGDB quand elles existent", async () => {
    const { getLatestGames } = await import("@/lib/shop/games");
    const db = admin();
    const suffix = Date.now();
    const { data } = await db
      .from("products")
      .insert({
        sku: `TEST-IGDB-${suffix}`, slug: `test-igdb-${suffix}`, name: "Jeu de test", category: "GAME",
        platform: "PlayStation 5", condition: "NEW", price_cents: 4990, quantity: 3,
        igdb_game_id: FAKE_IGDB_ID, is_active: true,
      })
      .select("id")
      .single();
    created.push(data!.id);

    const listings = await getLatestGames(20);
    const mine = listings.find((l) => l.productId === data!.id);
    expect(mine).toBeDefined();
    expect(mine!.coverUrl).toContain("images.igdb.com");
    expect(mine!.developer).toBe("Studio");
    expect(mine!.inStock).toBe(true);
  });

  it("affiche quand même un produit dont le jeu n'est pas associé", async () => {
    const { getLatestGames } = await import("@/lib/shop/games");
    const db = admin();
    const suffix = Date.now() + 1;
    const { data } = await db
      .from("products")
      .insert({
        sku: `TEST-ORPHAN-${suffix}`, slug: `test-orphan-${suffix}`, name: "Jeu sans fiche", category: "GAME",
        platform: "Nintendo Switch", condition: "USED_A", price_cents: 2990, quantity: 1,
        images: ["/medias/photo-produit.webp"], is_active: true,
      })
      .select("id")
      .single();
    created.push(data!.id);

    const mine = (await getLatestGames(20)).find((l) => l.productId === data!.id);
    expect(mine).toBeDefined();
    // Repli demandé : données locales, image locale, puis placeholder.
    expect(mine!.igdbId).toBeNull();
    expect(mine!.coverUrl).toBe("/medias/photo-produit.webp");
    expect(mine!.screenshotUrls).toEqual([]);
    expect(mine!.video).toBeNull();
  });

  it("dissocier laisse le produit en place", async () => {
    const { linkProductToGame } = await import("@/lib/igdb/service");
    const productId = created[0]!;
    const result = await linkProductToGame(productId, null, "MANUAL", null);
    expect(result.ok).toBe(true);
    const { data } = await admin().from("products").select("id, igdb_game_id").eq("id", productId).single();
    expect(data!.id).toBe(productId);
    expect(data!.igdb_game_id).toBeNull();
  });

  it("vider le cache ne supprime pas les produits", async () => {
    const db = admin();
    const productId = created[created.length - 1]!;
    await db.from("products").update({ igdb_game_id: FAKE_IGDB_ID }).eq("id", productId);
    await db.from("igdb_games").delete().eq("igdb_id", FAKE_IGDB_ID);
    const { data } = await db.from("products").select("id, igdb_game_id").eq("id", productId).single();
    expect(data!.id).toBe(productId);
    expect(data!.igdb_game_id).toBeNull(); // on delete set null
  });
});
