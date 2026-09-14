import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Chaîne IGDB complète, du HTTP jusqu'à l'accueil.
 *
 * Le VRAI code du client est exercé — jeton Twitch, en-têtes, requête
 * APIcalypse, file d'attente, reprise sur 401, cache en base, correspondance,
 * normalisation. Seul `fetch` est intercepté, à la frontière réseau : c'est ce
 * qui permet de tout vérifier sans identifiants et sans appeler IGDB.
 *
 * Les identifiants posés ici sont des marqueurs explicitement non secrets :
 * `credentials()` exige seulement que les deux variables soient présentes.
 */
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const d = enabled ? describe : describe.skip;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const GAMES_URL = "https://api.igdb.com/v4/games";

// --- Fiches IGDB de référence, à la forme exacte demandée par le client -----
const TLOU2_PS5 = {
  id: 200_001,
  name: "The Last of Us Part II Remastered",
  slug: "the-last-of-us-part-ii-remastered",
  summary: "  Ellie poursuit sa vengeance.  ",
  first_release_date: 1705276800, // 2024-01-15
  total_rating: 88.4,
  total_rating_count: 312,
  cover: { id: 1, image_id: "co7abc", width: 1200, height: 1600 },
  artworks: [{ id: 2, image_id: "ar7aaa", width: 1920, height: 1080 }],
  screenshots: [{ id: 3, image_id: "sc7aaa" }, { id: 4, image_id: "sc7bbb" }],
  platforms: [{ id: 167, name: "PlayStation 5" }],
  genres: [{ id: 31, name: "Adventure" }],
  involved_companies: [
    { developer: true, company: { id: 1, name: "Naughty Dog" } },
    { publisher: true, company: { id: 2, name: "Sony Interactive Entertainment" } },
  ],
  videos: [{ id: 5, name: "Announce Trailer", video_id: "abcd1234" }],
};
const TLOU2_PS4 = {
  id: 200_002,
  name: "The Last of Us Part II",
  slug: "the-last-of-us-part-ii",
  first_release_date: 1592179200, // 2020-06-15
  cover: { id: 6, image_id: "co7ddd" },
  platforms: [{ id: 48, name: "PlayStation 4" }],
};
/** Fiche squelettique : aucun visuel, aucune société, aucune vidéo. */
const BARE = { id: 200_003, name: "Jeu sans visuel", slug: "jeu-sans-visuel", platforms: [{ id: 167, name: "PlayStation 5" }] };

let calls: { url: string; body: string | null; headers: Record<string, string> }[] = [];
let tokenCalls = 0;
let nextGamesResponse: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function installFetchStub() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : null;
    calls.push({ url, body, headers });
    if (url.startsWith(TOKEN_URL)) {
      tokenCalls += 1;
      return jsonResponse({ access_token: "jeton-de-test-non-secret", expires_in: 5_184_000 });
    }
    if (url.startsWith(GAMES_URL)) return nextGamesResponse();
    if (url.startsWith("https://api.igdb.com/v4/external_games")) return jsonResponse([]);
    // Supabase et le reste passent par le vrai réseau local.
    return originalFetch(input as RequestInfo, init);
  });
}
const originalFetch = globalThis.fetch;

const createdProducts: string[] = [];
const cachedIds = [TLOU2_PS5.id, TLOU2_PS4.id, BARE.id];

d("chaîne IGDB de bout en bout", () => {
  beforeEach(() => {
    calls = [];
    tokenCalls = 0;
    nextGamesResponse = () => jsonResponse([TLOU2_PS5, TLOU2_PS4]);
    process.env.TWITCH_CLIENT_ID = "marqueur-de-test-non-secret-id";
    process.env.TWITCH_CLIENT_SECRET = "marqueur-de-test-non-secret-secret";
    vi.resetModules(); // vide le cache de jeton et d'environnement entre scénarios
    installFetchStub();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
  });

  afterAll(async () => {
    const db = admin();
    if (createdProducts.length) await db.from("products").delete().in("id", createdProducts);
    await db.from("igdb_games").delete().in("igdb_id", cachedIds);
  });

  // --- 1. Recherche depuis le back-office ---------------------------------
  it("1. recherche : authentifie, interroge IGDB et classe les candidats", async () => {
    const { searchGameMatches } = await import("@/lib/igdb/service");
    const { matches, error } = await searchGameMatches(
      { name: "The Last of Us Part II Remastered", platform: "PS5", releaseYear: 2024 },
      10,
    );

    expect(error).toBeNull();
    expect(matches).toHaveLength(2);

    // Le bon jeu d'abord, et suffisamment sûr pour être associé.
    expect(matches[0]!.game.igdbId).toBe(TLOU2_PS5.id);
    expect(matches[0]!.isConfident).toBe(true);
    // La version PS4 est reléguée ET signalée.
    expect(matches[1]!.game.igdbId).toBe(TLOU2_PS4.id);
    expect(matches[1]!.isConfident).toBe(false);
    expect(matches[1]!.reasons.join(" ")).toContain("ABSENTE");
    // Et suffisamment bas pour s'afficher en rouge « Peu probable » plutôt
    // qu'en orange « À vérifier » : c'est là le rôle de la pénalité.
    expect(matches[1]!.confidence).toBeLessThan(0.6);

    // Le protocole réellement envoyé.
    const tokenCall = calls.find((c) => c.url.startsWith(TOKEN_URL))!;
    expect(tokenCall).toBeDefined();
    expect(tokenCall.url).not.toContain("marqueur"); // identifiants dans le corps, pas dans l'URL
    const gamesCall = calls.find((c) => c.url === GAMES_URL)!;
    expect(gamesCall.headers["client-id"]).toBe("marqueur-de-test-non-secret-id");
    expect(gamesCall.headers.authorization).toBe("Bearer jeton-de-test-non-secret");
    expect(gamesCall.body).toContain('search "The Last of Us Part II Remastered"');
    expect(gamesCall.body).toContain("version_parent = null");
    expect(gamesCall.body).toContain("cover.image_id");
  });

  it("1b. les indices envoyés à IGDB viennent bien de la fiche produit", async () => {
    // Maillon entre le back-office et le service : c'est hintsFromProduct qui
    // transporte plateforme, EAN et édition jusqu'au moteur. Les perdre en
    // route ramènerait la recherche à une correspondance naïve sur le nom.
    const { hintsFromProduct } = await import("@/lib/igdb/service");
    const hints = hintsFromProduct({
      name: "FIFA 23", platform: "PlayStation 5", ean: "5030948123456",
      sku: "FIFA23-PS5", edition: "Ultimate", region: "PAL", release_year: 2022,
    });
    expect(hints).toEqual({
      name: "FIFA 23", platform: "PlayStation 5", ean: "5030948123456",
      sku: "FIFA23-PS5", edition: "Ultimate", region: "PAL", releaseYear: 2022,
    });
  });

  it("1c. un EAN connu d'IGDB court-circuite la recherche par nom", async () => {
    const { searchGameMatches } = await import("@/lib/igdb/service");
    // Le stub répond sur external_games avec le jeu PS5.
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, body: typeof init?.body === "string" ? init.body : null, headers: {} });
      if (url.startsWith(TOKEN_URL)) return jsonResponse({ access_token: "jeton-de-test-non-secret", expires_in: 5_184_000 });
      if (url.startsWith("https://api.igdb.com/v4/external_games")) return jsonResponse([{ id: 1, game: TLOU2_PS5.id }]);
      if (url.startsWith(GAMES_URL)) return jsonResponse([TLOU2_PS5]);
      return originalFetch(input as RequestInfo, init);
    });

    const { matches } = await searchGameMatches({ name: "peu importe le titre", platform: "PS5", ean: "5030948123456" }, 5);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.confidence).toBe(1);
    expect(matches[0]!.isConfident).toBe(true);
    expect(matches[0]!.reasons[0]).toContain("Code-barres");
    // Le nom n'a jamais servi : aucune requête `search`.
    expect(calls.filter((c) => c.body?.includes("search "))).toHaveLength(0);
  });

  // --- 3. Normalisation ----------------------------------------------------
  it("3. normalise jaquette, artwork et captures selon leur usage", async () => {
    const { getGame } = await import("@/lib/igdb/service");
    const { cardImage, heroImage } = await import("@/lib/igdb/normalize");
    const game = (await getGame(TLOU2_PS5.id))!;

    expect(game.cover!.url).toContain("/t_cover_big/co7abc.jpg");
    expect(game.artworks[0]!.url).toContain("/t_1080p/ar7aaa.jpg");
    expect(game.screenshots.map((s) => s.imageId)).toEqual(["sc7aaa", "sc7bbb"]);
    expect(cardImage(game)!.imageId).toBe("co7abc");   // carte  → jaquette
    expect(heroImage(game)!.imageId).toBe("ar7aaa");   // hero   → artwork

    expect(game.releaseDate).toBe("2024-01-15");
    expect(game.developer).toBe("Naughty Dog");
    expect(game.publisher).toBe("Sony Interactive Entertainment");
    expect(game.rating).toBe(88);
    expect(game.summary).toBe("Ellie poursuit sa vengeance.");
    expect(game.trailer).toEqual({
      provider: "youtube",
      videoId: "abcd1234",
      title: "Announce Trailer",
      posterUrl: "https://img.youtube.com/vi/abcd1234/maxresdefault.jpg",
      watchUrl: "https://www.youtube.com/watch?v=abcd1234",
    });
  });

  // --- 5. Cache ------------------------------------------------------------
  it("5. cache : une lecture ne touche jamais au réseau", async () => {
    const { getGame, getGames } = await import("@/lib/igdb/service");
    calls = [];
    const one = await getGame(TLOU2_PS5.id);
    const many = await getGames([TLOU2_PS5.id, TLOU2_PS4.id]);
    expect(one!.name).toBe(TLOU2_PS5.name);
    expect(many.size).toBe(2);
    expect(calls.filter((c) => c.url.startsWith("https://api.igdb.com") || c.url.startsWith(TOKEN_URL))).toHaveLength(0);
  });

  it("5b. une fiche fraîche n'est pas resynchronisée", async () => {
    const { syncGame } = await import("@/lib/igdb/service");
    calls = [];
    const result = await syncGame(TLOU2_PS5.id);
    expect(result.source).toBe("cache");
    expect(calls.filter((c) => c.url === GAMES_URL)).toHaveLength(0);
  });

  // --- 6. Synchronisation --------------------------------------------------
  it("6. synchronisation forcée : rappelle IGDB et met le cache à jour", async () => {
    const { syncGame, getGame } = await import("@/lib/igdb/service");
    nextGamesResponse = () => jsonResponse([{ ...TLOU2_PS5, name: "Titre corrigé par IGDB", total_rating: 91 }]);
    const result = await syncGame(TLOU2_PS5.id, { force: true });

    expect(result.source).toBe("igdb");
    expect(result.game!.name).toBe("Titre corrigé par IGDB");
    expect(calls.filter((c) => c.url === GAMES_URL)).toHaveLength(1);
    // Et le cache porte bien la nouvelle valeur.
    expect((await getGame(TLOU2_PS5.id))!.rating).toBe(91);
  });

  it("6b. un seul jeton pour plusieurs requêtes", async () => {
    const { syncGame } = await import("@/lib/igdb/service");
    nextGamesResponse = () => jsonResponse([TLOU2_PS5]);
    await syncGame(TLOU2_PS5.id, { force: true });
    await syncGame(TLOU2_PS5.id, { force: true });
    await syncGame(TLOU2_PS5.id, { force: true });
    expect(tokenCalls).toBe(1);
  });

  it("6c. un jeton refusé est renouvelé une fois, puis la requête est rejouée", async () => {
    const { syncGame } = await import("@/lib/igdb/service");
    let first = true;
    nextGamesResponse = () => {
      if (first) { first = false; return new Response("", { status: 401 }); }
      return jsonResponse([TLOU2_PS5]);
    };
    const result = await syncGame(TLOU2_PS5.id, { force: true });
    expect(result.source).toBe("igdb");
    expect(tokenCalls).toBe(2); // jeton initial + renouvellement
  });

  // --- 7. Replis -----------------------------------------------------------
  it("7. IGDB en panne : la fiche en cache est servie, la page tient", async () => {
    const { syncGame } = await import("@/lib/igdb/service");
    nextGamesResponse = () => new Response("", { status: 503 });
    const result = await syncGame(TLOU2_PS5.id, { force: true });
    expect(result.source).toBe("cache");
    expect(result.game).not.toBeNull();
    expect(result.error).toContain("503");
  });

  it("7b. quota atteint : message explicite, pas d'exception", async () => {
    const { searchGameMatches } = await import("@/lib/igdb/service");
    nextGamesResponse = () => new Response("", { status: 429 });
    const { matches, error } = await searchGameMatches({ name: "peu importe" }, 5);
    expect(matches).toEqual([]);
    expect(error).toContain("Quota");
  });

  it("7c. jeu absent du cache ET IGDB en panne : aucune exception", async () => {
    const { syncGame } = await import("@/lib/igdb/service");
    nextGamesResponse = () => new Response("", { status: 500 });
    const result = await syncGame(999_999_123, { force: true });
    expect(result.source).toBe("unavailable");
    expect(result.game).toBeNull();
  });

  it("7d. fiche sans aucun visuel : normalisée sans jeter", async () => {
    const { syncGame } = await import("@/lib/igdb/service");
    const { cardImage, heroImage } = await import("@/lib/igdb/normalize");
    nextGamesResponse = () => jsonResponse([BARE]);
    const result = await syncGame(BARE.id, { force: true });
    const game = result.game!;
    expect(game.cover).toBeNull();
    expect(game.artworks).toEqual([]);
    expect(game.trailer).toBeNull();
    expect(game.developer).toBeNull();
    expect(cardImage(game)).toBeNull();
    expect(heroImage(game)).toBeNull();
  });

  // --- 2, 4, 8 : association, accueil, vidéo -------------------------------
  it("2. associe un produit « Jeu » à sa fiche, et sait le dissocier", async () => {
    const { linkProductToGame } = await import("@/lib/igdb/service");
    const db = admin();
    const suffix = Date.now();
    const { data } = await db
      .from("products")
      .insert({ sku: `TEST-LINK-${suffix}`, slug: `test-link-${suffix}`, name: "The Last of Us Part II Remastered", category: "GAME", platform: "PlayStation 5", condition: "NEW", price_cents: 4990, quantity: 2, is_active: true })
      .select("id").single();
    createdProducts.push(data!.id);

    const linked = await linkProductToGame(data!.id, TLOU2_PS5.id, "MANUAL", 0.95);
    expect(linked.ok).toBe(true);
    const { data: after } = await db.from("products").select("igdb_game_id, igdb_match_source, igdb_match_confidence, igdb_synced_at").eq("id", data!.id).single();
    expect(Number(after!.igdb_game_id)).toBe(TLOU2_PS5.id);
    expect(after!.igdb_match_source).toBe("MANUAL");
    expect(Number(after!.igdb_match_confidence)).toBeCloseTo(0.95, 2);
    expect(after!.igdb_synced_at).not.toBeNull();

    // Réversible.
    expect((await linkProductToGame(data!.id, null, "MANUAL", null)).ok).toBe(true);
    const { data: unlinked } = await db.from("products").select("igdb_game_id, igdb_match_source").eq("id", data!.id).single();
    expect(unlinked!.igdb_game_id).toBeNull();
    expect(unlinked!.igdb_match_source).toBeNull();
    // Puis on ré-associe pour le test suivant.
    await linkProductToGame(data!.id, TLOU2_PS5.id, "MANUAL", 0.95);
  });

  it("4 + 8. getHomepageGames sert les jeux enrichis, vidéo comprise", async () => {
    const db = admin();
    const productId = createdProducts[0]!;
    await db.from("products").update({
      is_featured: true,
      hero_video_url: "https://cdn.example.com/promo-tlou2.mp4",
      hero_video_poster_path: "/medias/affiche-tlou2.webp",
    }).eq("id", productId);

    calls = [];
    const { getHomepageGames } = await import("@/lib/shop/games");
    const { featured, latest } = await getHomepageGames(12);

    // Aucun appel IGDB pour afficher l'accueil.
    expect(calls.filter((c) => c.url.startsWith("https://api.igdb.com") || c.url.startsWith(TOKEN_URL))).toHaveLength(0);

    expect(featured).not.toBeNull();
    expect(featured!.productId).toBe(productId);
    expect(featured!.igdbId).toBe(TLOU2_PS5.id);
    expect(featured!.coverUrl).toContain("co7abc");
    expect(featured!.heroUrl).toContain("ar7aaa");
    expect(featured!.screenshotUrls).toHaveLength(2);
    expect(featured!.developer).toBe("Naughty Dog");
    expect(featured!.priceCents).toBe(4990);
    expect(featured!.inStock).toBe(true);

    // 8. La vidéo de fond est prête, avec son affiche.
    expect(featured!.video).toEqual({
      url: "https://cdn.example.com/promo-tlou2.mp4",
      posterUrl: "/medias/affiche-tlou2.webp",
    });
    // La bande-annonce reste une référence distincte, jamais un fichier.
    expect(featured!.trailerUrl).toBe("https://www.youtube.com/watch?v=abcd1234");

    expect(latest.some((l) => l.productId === productId)).toBe(true);
  });

  it("8b. sans affiche renseignée, la vidéo retombe sur l'artwork", async () => {
    const db = admin();
    const productId = createdProducts[0]!;
    await db.from("products").update({ hero_video_poster_path: null }).eq("id", productId);
    const { getFeaturedGame } = await import("@/lib/shop/games");
    const featured = await getFeaturedGame();
    expect(featured!.video!.posterUrl).toContain("ar7aaa");
  });

  it("7e. produit sans fiche IGDB : ses propres photos, aucune donnée inventée", async () => {
    const db = admin();
    const suffix = Date.now() + 7;
    const { data } = await db
      .from("products")
      .insert({ sku: `TEST-NOIGDB-${suffix}`, slug: `test-noigdb-${suffix}`, name: "Jeu non associé", category: "GAME", platform: "Nintendo Switch", condition: "USED_A", price_cents: 1990, quantity: 0, images: ["/medias/photo-locale.webp"], is_active: true })
      .select("id").single();
    createdProducts.push(data!.id);

    const { getLatestGames } = await import("@/lib/shop/games");
    const listing = (await getLatestGames(20)).find((l) => l.productId === data!.id)!;
    expect(listing.igdbId).toBeNull();
    expect(listing.coverUrl).toBe("/medias/photo-locale.webp");
    expect(listing.heroUrl).toBe("/medias/photo-locale.webp");
    expect(listing.screenshotUrls).toEqual([]);
    expect(listing.video).toBeNull();
    expect(listing.trailerUrl).toBeNull();
    expect(listing.developer).toBeNull();
    expect(listing.inStock).toBe(false);
  });
});
