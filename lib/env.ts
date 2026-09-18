import { z } from "zod";

/**
 * Environment validation. Server-only secrets are validated lazily (on first
 * access) so that the client bundle never imports them and builds do not
 * fail on missing optional integrations.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_ADS_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  PAYMENT_PROVIDER: z.enum(["stripe", "mock"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["resend", "console"]).default("console"),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Atelier <no-reply@example.com>"),
  SHIPPING_PROVIDER: z.enum(["mock"]).default("mock"),
  SHIPPING_PROVIDER_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  /**
   * Mode démonstration : les intégrations simulées sont tolérées en production.
   *
   * Sans lui, une construction de production refuse le paiement simulé et
   * l'envoi d'e-mails en console — et c'est la bonne règle : un simulateur
   * ferait passer des dossiers pour payés. Mais une démonstration client tourne
   * sur une construction de production, et doit pouvoir dérouler le tunnel.
   *
   * Il s'allume donc **à la main**, jamais par défaut, et le site l'annonce :
   * un bandeau permanent dit que rien n'est encaissé. On ne peut pas l'oublier
   * allumé sans que tout le monde le voie.
   */
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

let publicEnvCache: PublicEnv | null = null;
let serverEnvCache: ServerEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (publicEnvCache) return publicEnvCache;
  // NEXT_PUBLIC_* must be referenced explicitly so Next.js inlines them client side.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
    );
  }
  publicEnvCache = parsed.data;
  return parsed.data;
}

export function getServerEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache;
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must never be called in the browser");
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
    );
  }
  // Mock integrations are refused in production where they are USED
  // (lib/stripe, lib/email, lib/shipping), so that `next build` and pages
  // that never touch them keep working.
  serverEnvCache = parsed.data;
  return parsed.data;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * La démonstration a-t-elle le droit de tourner sur des intégrations simulées ?
 *
 * Vrai hors production — un développeur n'a pas de clé Stripe — ou en
 * production quand `DEMO_MODE` est posé explicitement.
 */
export function mockAutorise(): boolean {
  return process.env.NODE_ENV !== "production" || getServerEnv().DEMO_MODE;
}
