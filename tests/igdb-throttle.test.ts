import { describe, expect, it } from "vitest";

/**
 * Le quota IGDB est de 4 requêtes par seconde pour toute l'application.
 *
 * On ne teste pas le client (qui exige `server-only` et une configuration) mais
 * l'algorithme d'espacement lui-même, reproduit à l'identique : c'est lui qui
 * décide, et une régression y ferait refuser toute synchronisation de masse.
 */
const MIN_INTERVAL_MS = 1000 / 4;

function makeThrottle() {
  let queueTail: Promise<void> = Promise.resolve();
  let lastRequestAt = 0;
  return function throttle<T>(run: () => Promise<T>): Promise<T> {
    const slot = queueTail.then(async () => {
      const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
    });
    queueTail = slot.then(() => undefined, () => undefined);
    return slot.then(run);
  };
}

describe("espacement des appels IGDB", () => {
  it("n'attend pas pour un appel isolé", async () => {
    const throttle = makeThrottle();
    const started = Date.now();
    await throttle(async () => "ok");
    expect(Date.now() - started).toBeLessThan(MIN_INTERVAL_MS);
  });

  it("espace huit appels d'au moins 250 ms", async () => {
    const throttle = makeThrottle();
    const stamps: number[] = [];
    await Promise.all(
      Array.from({ length: 8 }, () => throttle(async () => { stamps.push(Date.now()); })),
    );
    expect(stamps).toHaveLength(8);
    for (let i = 1; i < stamps.length; i += 1) {
      // Marge de 20 ms : les minuteurs de Node ne sont pas au millimètre.
      expect(stamps[i]! - stamps[i - 1]!).toBeGreaterThanOrEqual(MIN_INTERVAL_MS - 20);
    }
  }, 10_000);

  it("respecte l'ordre d'arrivée", async () => {
    const throttle = makeThrottle();
    const seen: number[] = [];
    await Promise.all([1, 2, 3, 4].map((n) => throttle(async () => { seen.push(n); })));
    expect(seen).toEqual([1, 2, 3, 4]);
  }, 10_000);

  it("continue d'avancer après un appel en échec", async () => {
    const throttle = makeThrottle();
    await expect(throttle(async () => { throw new Error("IGDB injoignable"); })).rejects.toThrow();
    // Le suivant doit passer : une panne ne doit pas geler la file.
    await expect(throttle(async () => "ok")).resolves.toBe("ok");
  }, 10_000);
});
