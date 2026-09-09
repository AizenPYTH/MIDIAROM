import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration tests: run against a live Supabase-compatible stack
 * (`npx supabase start` locally). Enabled only when INTEGRATION=1.
 *   INTEGRATION=1 npm run test:integration
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The "server-only" guard is a build-time check for Next.js; neutralise it here.
      "server-only": path.resolve(__dirname, "tests/integration/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: "test" },
  },
});
