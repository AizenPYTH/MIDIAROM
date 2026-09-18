import "server-only";
import { getServerEnv, mockAutorise } from "@/lib/env";
import type { EmailProvider } from "@/lib/email/types";
import { ConsoleEmailProvider } from "@/lib/email/providers/console";
import { ResendEmailProvider } from "@/lib/email/providers/resend";

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const env = getServerEnv();
  switch (env.EMAIL_PROVIDER) {
    case "resend": {
      if (!env.EMAIL_PROVIDER_API_KEY) throw new Error("EMAIL_PROVIDER_API_KEY is required for Resend");
      provider = new ResendEmailProvider(env.EMAIL_PROVIDER_API_KEY, env.EMAIL_FROM);
      break;
    }
    case "console":
    default:
      if (!mockAutorise()) throw new Error("EMAIL_PROVIDER=console est refusé en production. Posez EMAIL_PROVIDER=resend, ou DEMO_MODE=1 pour une démonstration.");
      provider = new ConsoleEmailProvider();
  }
  return provider;
}
