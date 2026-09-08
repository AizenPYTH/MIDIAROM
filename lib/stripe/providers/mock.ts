import "server-only";
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentConfirmation, PaymentProvider } from "@/lib/stripe/types";

/**
 * DEVELOPMENT ONLY. Redirects to an internal page that simulates the hosted
 * checkout. Confirmation still goes through the same server-side
 * `confirmPayment` path as the Stripe webhook. Refused in production by
 * lib/env.ts and lib/stripe/index.ts.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly code = "mock";

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const sessionId = `mock_cs_${crypto.randomUUID()}`;
    const url = new URL("/paiement/simulation", input.successUrl);
    url.search = "";
    url.searchParams.set("session", sessionId);
    url.searchParams.set("payment", input.paymentId);
    url.searchParams.set("success", input.successUrl);
    url.searchParams.set("cancel", input.cancelUrl);
    return { providerSessionId: sessionId, redirectUrl: url.toString() };
  }

  async verifySession(): Promise<PaymentConfirmation | null> {
    // The mock has no external state: confirmation is done by the simulation page action.
    return null;
  }

  async refund(): Promise<{ refundId: string }> {
    return { refundId: `mock_re_${crypto.randomUUID()}` };
  }
}
