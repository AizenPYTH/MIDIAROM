import "server-only";

/**
 * Small in-memory sliding window limiter. Good enough for a single Node
 * instance (public tracking form, login attempts, analytics ingestion).
 * For multi-instance deployments swap the store for Redis/Upstash — the
 * interface stays the same.
 */
interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    store.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  if (store.size > MAX_KEYS) {
    // Drop the oldest entries to bound memory.
    const keys = store.keys();
    for (let i = 0; i < 1000; i++) {
      const k = keys.next().value;
      if (k === undefined) break;
      store.delete(k);
    }
  }
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}
