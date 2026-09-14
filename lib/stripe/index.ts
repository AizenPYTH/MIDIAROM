import "server-only";
import { getServerEnv } from "@/lib/env";
import type { PaymentProvider } from "@/lib/stripe/types";
import { StripePaymentProvider } from "@/lib/stripe/providers/stripe";
import { MockPaymentProvider } from "@/lib/stripe/providers/mock";

/**
 * Le site tourne sans configuration de paiement utilisable.
 *
 * C'est une erreur d'exploitation, pas un incident : réessayer n'y changera
 * rien tant que les variables d'environnement n'ont pas été posées. Le type
 * existe pour que les tunnels de commande le disent au client au lieu de lui
 * proposer de recommencer (voir app/(marketing)/commande/[repairId]/actions.ts).
 */
export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "stripe") {
    if (!env.STRIPE_SECRET_KEY) {
      throw new PaymentConfigurationError("PAYMENT_PROVIDER=stripe mais STRIPE_SECRET_KEY est absente.");
    }
    provider = new StripePaymentProvider(env.STRIPE_SECRET_KEY);
  } else {
    // Le simulateur encaisse sans rien encaisser : en production il ferait
    // passer des dossiers pour payés. On refuse, bruyamment.
    if (env.NODE_ENV === "production") {
      throw new PaymentConfigurationError(
        "Le paiement simulé est refusé en production. Posez PAYMENT_PROVIDER=stripe et STRIPE_SECRET_KEY.",
      );
    }
    provider = new MockPaymentProvider();
  }
  return provider;
}

export function isMockPayments(): boolean {
  return getServerEnv().PAYMENT_PROVIDER === "mock";
}

/**
 * Le paiement est-il utilisable ? Sans jeter, pour l'afficher quelque part.
 * Utilisé par le back-office, qui doit voir le problème avant les clients.
 */
export function paymentConfigurationError(): string | null {
  try {
    getPaymentProvider();
    return null;
  } catch (error) {
    if (error instanceof PaymentConfigurationError) return error.message;
    throw error;
  }
}
