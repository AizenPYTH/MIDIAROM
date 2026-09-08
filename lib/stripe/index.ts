import "server-only";
import { getServerEnv } from "@/lib/env";
import type { PaymentProvider } from "@/lib/stripe/types";
import { StripePaymentProvider } from "@/lib/stripe/providers/stripe";
import { MockPaymentProvider } from "@/lib/stripe/providers/mock";

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "stripe") {
    if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe");
    provider = new StripePaymentProvider(env.STRIPE_SECRET_KEY);
  } else {
    if (env.NODE_ENV === "production") throw new Error("Mock payments are not allowed in production");
    provider = new MockPaymentProvider();
  }
  return provider;
}

export function isMockPayments(): boolean {
  return getServerEnv().PAYMENT_PROVIDER === "mock";
}
