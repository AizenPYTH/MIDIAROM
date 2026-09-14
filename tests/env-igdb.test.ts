import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Câblage des identifiants IGDB.
 *
 * Aucune valeur réelle n'apparaît ici : les tests posent des marqueurs
 * reconnaissables dans l'environnement du processus de test, le temps d'une
 * assertion. Ce qui est vérifié, c'est que `getServerEnv()` lit bien
 * `process.env` au moment de l'appel — donc au runtime — et non une valeur
 * figée à la compilation.
 */
const MARKER_ID = "marqueur-de-test-non-secret";
const MARKER_SECRET = "marqueur-de-test-non-secret-2";

/**
 * Le schéma serveur exige d'autres variables (Supabase) pour se valider. On
 * pose des marqueurs pour celles-là aussi : ce ne sont pas des secrets, et
 * sans elles la validation échouerait avant d'atteindre ce qu'on teste.
 */
function stubRequired() {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "marqueur-de-test-non-secret-supabase";
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "marqueur-de-test-non-secret-anon";
}

async function freshEnv() {
  stubRequired();
  // getServerEnv met son résultat en cache : sans reset, le deuxième test
  // relirait la valeur du premier et ne prouverait rien.
  vi.resetModules();
  return (await import("@/lib/env")).getServerEnv();
}

afterEach(() => {
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
  vi.unstubAllEnvs();
});

describe("identifiants IGDB", () => {
  it("sont absents par défaut, sans faire échouer la validation", async () => {
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
    const env = await freshEnv();
    expect(env.TWITCH_CLIENT_ID).toBeUndefined();
    expect(env.TWITCH_CLIENT_SECRET).toBeUndefined();
  });

  it("sont lus depuis process.env au moment de l'appel", async () => {
    process.env.TWITCH_CLIENT_ID = MARKER_ID;
    process.env.TWITCH_CLIENT_SECRET = MARKER_SECRET;
    const env = await freshEnv();
    expect(env.TWITCH_CLIENT_ID).toBe(MARKER_ID);
    expect(env.TWITCH_CLIENT_SECRET).toBe(MARKER_SECRET);
  });

  it("n'expose aucune variante publique du secret", async () => {
    // Un NEXT_PUBLIC_* serait inliné dans le JavaScript du navigateur : il ne
    // doit jamais en exister pour ces deux valeurs.
    process.env.TWITCH_CLIENT_SECRET = MARKER_SECRET;
    stubRequired();
    vi.resetModules();
    const { getPublicEnv } = await import("@/lib/env");
    const publicEnv = getPublicEnv() as Record<string, unknown>;
    for (const value of Object.values(publicEnv)) {
      expect(String(value ?? "")).not.toContain(MARKER_SECRET);
    }
    expect(Object.keys(publicEnv).some((k) => k.includes("TWITCH"))).toBe(false);
  });
});
