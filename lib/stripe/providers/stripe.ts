import "server-only";
import Stripe from "stripe";
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentConfirmation, PaymentProvider } from "@/lib/stripe/types";

export class StripePaymentProvider implements PaymentProvider {
  readonly code = "stripe";
  readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: input.paymentId,
        line_items: input.lineItems.map((li) => ({
          quantity: li.quantity,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: li.amountCents,
            product_data: { name: li.label },
          },
        })),
        metadata: {
          payment_id: input.paymentId,
          order_id: input.orderId,
          order_number: input.orderNumber,
          purpose: input.purpose,
          quote_id: input.quoteId ?? "",
        },
        payment_intent_data: {
          description: input.description,
          metadata: { order_number: input.orderNumber, payment_id: input.paymentId },
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        locale: "fr",
      },
      { idempotencyKey: `checkout_${input.paymentId}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { providerSessionId: session.id, redirectUrl: session.url };
  }

  async verifySession(providerSessionId: string): Promise<PaymentConfirmation | null> {
    const session = await this.stripe.checkout.sessions.retrieve(providerSessionId);
    if (session.payment_status !== "paid") return null;
    return confirmationFromSession(session);
  }

  async refund(providerPaymentId: string, amountCents: number, reason?: string): Promise<{ refundId: string }> {
    const refund = await this.stripe.refunds.create({
      payment_intent: providerPaymentId,
      amount: amountCents,
      ...(reason ? { metadata: { reason } } : {}),
    });
    return { refundId: refund.id };
  }

  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}

export function confirmationFromSession(session: Stripe.Checkout.Session): PaymentConfirmation | null {
  const paymentId = session.metadata?.payment_id ?? session.client_reference_id;
  if (!paymentId) return null;
  return {
    providerSessionId: session.id,
    providerPaymentId:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    amountCents: session.amount_total ?? 0,
    currency: (session.currency ?? "eur").toUpperCase(),
    paymentId,
    raw: session,
  };
}
