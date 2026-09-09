/**
 * Payment abstraction. Stripe is the reference implementation; a mock exists
 * for development. Payment confirmation ALWAYS comes from the webhook /
 * server-side verification, never from the browser.
 */
export interface CreateCheckoutInput {
  paymentId: string; // our payments.id (idempotency + reconciliation)
  orderId: string;
  orderNumber: string;
  purpose: "INITIAL" | "QUOTE" | "SHOP";
  quoteId?: string | null;
  customerEmail: string;
  amountCents: number;
  currency: string;
  description: string;
  lineItems: { label: string; amountCents: number; quantity: number }[];
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  providerSessionId: string;
  redirectUrl: string;
}

export interface PaymentConfirmation {
  providerSessionId: string;
  providerPaymentId: string | null;
  amountCents: number;
  currency: string;
  paymentId: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly code: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /** Server-side verification of a session (used as a fallback to the webhook). */
  verifySession(providerSessionId: string): Promise<PaymentConfirmation | null>;
  refund(providerPaymentId: string, amountCents: number, reason?: string): Promise<{ refundId: string }>;
}
