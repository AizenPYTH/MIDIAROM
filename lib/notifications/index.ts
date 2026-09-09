import "server-only";
import type { Json, Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider } from "@/lib/email";
import { getBrandSettings, getSetting } from "@/lib/settings";
import { ROUTES, SITE_URL } from "@/config/site";
import * as T from "@/emails/templates";
import type { EmailBrand, RenderedEmail } from "@/emails/layout";
import { formatDate } from "@/lib/utils/format";

/**
 * Centralised notification dispatcher. Every business event goes through
 * `notifyOrderEvent`: it renders the template, records an outbox row in
 * `notifications`, sends the e-mail and stores the result. Failures are
 * recorded, never thrown to the caller.
 */
export type NotificationEvent =
  | { type: "ORDER_PAID"; hasLabel: boolean }
  | { type: "LABEL_AVAILABLE"; trackingNumber: string }
  | { type: "PACKAGE_RECEIVED" }
  | { type: "DIAGNOSIS_DONE"; customerSummary: string | null }
  | { type: "QUOTE_SENT"; quote: Tables<"supplementary_quotes"> }
  | { type: "QUOTE_ACCEPTED"; quote: Tables<"supplementary_quotes"> }
  | { type: "QUOTE_REFUSED"; quote: Tables<"supplementary_quotes">; consequence: string }
  | { type: "REPAIR_DONE" }
  | { type: "TESTS_DONE" }
  | { type: "SHIPPED"; trackingNumber: string | null; carrierName: string | null; carrierTrackingUrl: string | null }
  | { type: "DELIVERED" }
  | { type: "REVIEW_REQUEST"; reviewToken: string }
  | { type: "UNREPAIRABLE"; explanation: string }
  | { type: "MESSAGE"; message: string }
  | { type: "SAV_UPDATE"; status: string; message: string | null };

type Order = Tables<"repair_orders">;

async function emailBrand(): Promise<EmailBrand> {
  const brand = await getBrandSettings();
  return { name: brand.name, siteUrl: SITE_URL, email: brand.email };
}

function baseContext(order: Order, brand: EmailBrand): T.OrderEmailContext {
  return {
    brand,
    firstName: order.customer_first_name,
    orderNumber: order.order_number,
    modelName: order.model_name,
    repairName: order.repair_name,
    totalCents: order.total_cents,
    trackingUrl: `${SITE_URL}${ROUTES.tracking}/${order.tracking_token}`,
    accountUrl: `${SITE_URL}${ROUTES.accountOrders}/${order.id}`,
  };
}

async function render(order: Order, event: NotificationEvent): Promise<RenderedEmail> {
  const brand = await emailBrand();
  const ctx = baseContext(order, brand);
  switch (event.type) {
    case "ORDER_PAID": {
      const shipping = await getSetting("shipping_info");
      return T.orderConfirmed({
        ...ctx,
        hasLabel: event.hasLabel,
        labelUrl: null,
        packagingUrl: `${SITE_URL}${ROUTES.packaging}`,
        workshopAddress: [shipping.workshop_receiving_name, shipping.workshop_receiving_address].filter(Boolean).join(", "),
      });
    }
    case "LABEL_AVAILABLE":
      return T.labelAvailable({ ...ctx, trackingNumber: event.trackingNumber });
    case "PACKAGE_RECEIVED":
      return T.packageReceived(ctx);
    case "DIAGNOSIS_DONE":
      return T.diagnosisDone({ ...ctx, customerSummary: event.customerSummary });
    case "QUOTE_SENT":
      return T.quoteSent({
        ...ctx,
        quoteNumber: event.quote.quote_number,
        quoteTitle: event.quote.title,
        quoteAmountCents: event.quote.total_cents,
        quoteMessage: event.quote.message,
        expiresAt: event.quote.expires_at ? formatDate(event.quote.expires_at) : null,
        quoteUrl: `${SITE_URL}${ROUTES.accountOrders}/${order.id}/devis/${event.quote.id}`,
      });
    case "QUOTE_ACCEPTED":
      return T.quoteAccepted({
        ...ctx,
        quoteNumber: event.quote.quote_number,
        quoteAmountCents: event.quote.total_cents,
        paymentRequired: event.quote.requires_payment && event.quote.total_cents > 0 && !event.quote.paid_at,
        payUrl: `${SITE_URL}${ROUTES.accountOrders}/${order.id}/devis/${event.quote.id}`,
      });
    case "QUOTE_REFUSED":
      return T.quoteRefused({ ...ctx, quoteNumber: event.quote.quote_number, consequence: event.consequence });
    case "REPAIR_DONE":
      return T.repairDone(ctx);
    case "TESTS_DONE":
      return T.testsDone(ctx);
    case "SHIPPED":
      return T.shipped({ ...ctx, trackingNumber: event.trackingNumber, carrierName: event.carrierName, carrierTrackingUrl: event.carrierTrackingUrl });
    case "DELIVERED":
      return T.delivered(ctx);
    case "REVIEW_REQUEST":
      return T.reviewRequest({ ...ctx, reviewUrl: `${SITE_URL}/avis/${event.reviewToken}` });
    case "UNREPAIRABLE":
      return T.unrepairable({ ...ctx, explanation: event.explanation });
    case "MESSAGE":
      return T.customerMessage({ ...ctx, message: event.message });
    case "SAV_UPDATE":
      return T.savUpdate({ ...ctx, status: event.status, message: event.message });
  }
}

export async function notifyOrderEvent(order: Order, event: NotificationEvent): Promise<void> {
  const db = createSupabaseAdminClient();
  let subject: string | null = null;
  try {
    const rendered = await render(order, event);
    subject = rendered.subject;
    const { data: row } = await db
      .from("notifications")
      .insert({
        recipient_id: order.customer_id,
        recipient_email: order.customer_email,
        order_id: order.id,
        event_type: event.type,
        channel: "EMAIL",
        subject: rendered.subject,
        payload: { event: event.type, text: rendered.text } as Json,
        status: "PENDING",
      })
      .select("id")
      .single();

    try {
      const result = await getEmailProvider().send({ to: order.customer_email, subject: rendered.subject, html: rendered.html, text: rendered.text });
      if (row) {
        await db.from("notifications").update({ status: "SENT", sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId }).eq("id", row.id);
      }
    } catch (sendError) {
      console.error("[notifications] send failed", sendError);
      if (row) await db.from("notifications").update({ status: "FAILED", error: String(sendError) }).eq("id", row.id);
    }
  } catch (error) {
    console.error("[notifications] render failed", error);
    await db.from("notifications").insert({
      recipient_id: order.customer_id,
      recipient_email: order.customer_email,
      order_id: order.id,
      event_type: event.type,
      channel: "EMAIL",
      subject,
      status: "FAILED",
      error: String(error),
    });
  }
}

/** Sends the "set your password" e-mail for accounts created at checkout. */
export async function sendAccountCreatedEmail(email: string, firstName: string, setPasswordUrl: string): Promise<void> {
  try {
    const brand = await emailBrand();
    const rendered = T.accountCreated({ brand, firstName, setPasswordUrl });
    await getEmailProvider().send({ to: email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  } catch (error) {
    console.error("[notifications] account e-mail failed", error);
  }
}

/**
 * E-mail transactionnel hors dossier de réparation (commande boutique, reprise) :
 * enregistré dans `notifications` puis envoyé. Les échecs sont journalisés, jamais levés.
 */
export async function sendCustomerEmail(input: {
  to: string;
  recipientId: string | null;
  eventType: string;
  rendered: RenderedEmail;
  shopOrderId?: string | null;
  tradeInId?: string | null;
}): Promise<void> {
  const db = createSupabaseAdminClient();
  const { data: row } = await db
    .from("notifications")
    .insert({
      recipient_id: input.recipientId,
      recipient_email: input.to,
      shop_order_id: input.shopOrderId ?? null,
      trade_in_id: input.tradeInId ?? null,
      event_type: input.eventType,
      channel: "EMAIL",
      subject: input.rendered.subject,
      payload: { event: input.eventType, text: input.rendered.text } as Json,
      status: "PENDING",
    })
    .select("id")
    .single();
  try {
    const result = await getEmailProvider().send({ to: input.to, subject: input.rendered.subject, html: input.rendered.html, text: input.rendered.text });
    if (row) await db.from("notifications").update({ status: "SENT", sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId }).eq("id", row.id);
  } catch (error) {
    console.error("[notifications] send failed", error);
    if (row) await db.from("notifications").update({ status: "FAILED", error: String(error) }).eq("id", row.id);
  }
}

export { emailBrand };
