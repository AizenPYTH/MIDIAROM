import "server-only";
import type { Json } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRepairById, getRepairOffer } from "@/lib/repair/catalog";
import { priceSelection } from "@/lib/pricing/service";
import { PricingError } from "@/lib/pricing/engine";
import { getPaymentProvider } from "@/lib/stripe";
import { getSetting } from "@/lib/settings";
import { addOrderEvent } from "@/lib/orders/service";
import { audit } from "@/lib/security/audit";
import { trackServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { sendAccountCreatedEmail } from "@/lib/notifications";
import { CUSTOMER_MEDIA_BUCKET, moveDraftPhotos } from "@/lib/media/drafts";
import { ROUTES, SITE_URL } from "@/config/site";
import type { CreateOrderInput } from "@/lib/orders/schemas";
import type { CurrentUser } from "@/lib/security/auth";

export class CreateOrderError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "CreateOrderError";
  }
}

/**
 * Finds or creates the customer profile for a checkout (repair or shop).
 * - Logged in: the current user (the e-mail typed at checkout is stored on the order).
 * - Guest with a known e-mail: order attached to that existing account (they log in to see it).
 * - Guest with a new e-mail: account created, "set your password" e-mail sent.
 */
export interface CustomerIdentity {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | undefined;
}

export async function resolveCustomer(input: { customer: CustomerIdentity }, currentUser: CurrentUser | null): Promise<{ id: string; created: boolean }> {
  if (currentUser) return { id: currentUser.id, created: false };
  const db = createSupabaseAdminClient();
  const email = input.customer.email.toLowerCase();
  const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return { id: existing.id, created: false };

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { first_name: input.customer.first_name, last_name: input.customer.last_name, phone: input.customer.phone || null },
  });
  if (error || !created.user) {
    throw new CreateOrderError("Impossible de créer votre espace client. Vérifiez votre adresse e-mail.", "customer.email");
  }
  // The DB trigger creates the profile; make sure it exists before continuing.
  await db.from("profiles").upsert(
    { id: created.user.id, email, first_name: input.customer.first_name, last_name: input.customer.last_name, phone: input.customer.phone || null },
    { onConflict: "id" },
  );

  // Server-generated links cannot use the PKCE flow: send the token hash to our
  // callback, which calls verifyOtp() and opens a session (see app/auth/callback).
  const { data: link } = await db.auth.admin.generateLink({ type: "recovery", email });
  if (link?.properties?.hashed_token) {
    const setPasswordUrl = `${SITE_URL}/auth/callback?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery&next=${encodeURIComponent("/nouveau-mot-de-passe")}`;
    await sendAccountCreatedEmail(email, input.customer.first_name, setPasswordUrl);
  }
  return { id: created.user.id, created: true };
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  redirectUrl: string;
}

export async function createOrderAndCheckout(input: CreateOrderInput, currentUser: CurrentUser | null): Promise<CreateOrderResult> {
  const db = createSupabaseAdminClient();
  const repair = await getRepairById(input.selection.repairId);
  if (!repair || !repair.is_active || !repair.model.is_active) throw new CreateOrderError("Cette réparation n'est plus disponible.");

  const offer = await getRepairOffer(repair);
  let pricing;
  try {
    pricing = await priceSelection(offer, input.selection);
  } catch (error) {
    if (error instanceof PricingError) throw new CreateOrderError(error.message);
    throw error;
  }
  const shippingMethod = offer.shippingMethods.find((m) => m.id === input.selection.shippingMethodId);
  if (!shippingMethod) throw new CreateOrderError("Formule de transport indisponible.", "selection.shippingMethodId");

  const [rules, checkout] = await Promise.all([getSetting("business_rules"), getSetting("checkout")]);
  const customer = await resolveCustomer(input, currentUser);
  const email = input.customer.email.toLowerCase();

  const { data: order, error: orderError } = await db
    .from("repair_orders")
    .insert({
      customer_id: customer.id,
      status: "PENDING_PAYMENT",
      brand_id: repair.model.brand.id,
      model_id: repair.model.id,
      fault_id: repair.fault.id,
      repair_id: repair.id,
      shipping_method_id: shippingMethod.id,
      brand_name: repair.model.brand.name,
      model_name: repair.model.name,
      fault_name: repair.fault.name,
      repair_name: repair.name,
      warranty_months: repair.warranty_months,
      customer_first_name: input.customer.first_name,
      customer_last_name: input.customer.last_name,
      customer_email: email,
      customer_phone: input.customer.phone || null,
      shipping_address: { ...input.address, line2: input.address.line2 || null } as unknown as Json,
      customer_notes: [input.customer_notes || null, input.console_already_opened ? "Console déjà ouverte / tentative de réparation antérieure déclarée." : null]
        .filter(Boolean)
        .join("\n") || null,
      console_serial_number: input.console_serial_number || null,
      symptoms: input.symptoms,
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_version: checkout.terms_version,
      currency: "EUR",
      subtotal_cents: pricing.subtotalCents,
      shipping_cents: pricing.shippingCents,
      total_cents: pricing.totalCents,
      vat_rate_bp: rules.vat_rate_bp,
      utm_source: input.attribution?.utm_source ?? null,
      utm_medium: input.attribution?.utm_medium ?? null,
      utm_campaign: input.attribution?.utm_campaign ?? null,
      utm_term: input.attribution?.utm_term ?? null,
      utm_content: input.attribution?.utm_content ?? null,
      landing_page: input.attribution?.landing_page ?? null,
      referrer: input.attribution?.referrer ?? null,
      analytics_session_id: input.attribution?.session_id ?? null,
    })
    .select("*")
    .single();
  if (orderError || !order) {
    console.error("[orders] insert failed", orderError?.message);
    throw new CreateOrderError("La création du dossier a échoué. Merci de réessayer.");
  }

  const { error: itemsError } = await db.from("repair_order_items").insert(
    pricing.lines.map((line) => ({
      order_id: order.id,
      item_type: line.type,
      source: "INITIAL" as const,
      reference_id: line.referenceId,
      label: line.label,
      description: line.includes?.length ? `Comprend : ${line.includes.join(", ")}` : null,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
      total_cents: line.totalCents,
      estimated_cost_cents: line.estimatedCostCents,
    })),
  );
  if (itemsError) {
    console.error("[orders] items insert failed", itemsError.message);
    throw new CreateOrderError("La création du dossier a échoué. Merci de réessayer.");
  }

  // Photos jointes par le client (brouillons déposés avant la commande) → médias du dossier, visibles par le client.
  if (input.photos.length) {
    const paths = await moveDraftPhotos(input.photos, `${order.id}/CUSTOMER`);
    if (paths.length) {
      await db.from("order_media").insert(
        paths.map((path) => ({ order_id: order.id, kind: "CUSTOMER" as const, bucket: CUSTOMER_MEDIA_BUCKET, path, mime_type: `image/${path.endsWith(".png") ? "png" : path.endsWith(".webp") ? "webp" : path.endsWith(".heic") ? "heic" : "jpeg"}`, size_bytes: 0, original_name: null, caption: "Photo envoyée par le client", is_visible_to_customer: true, uploaded_by: customer.created ? null : customer.id })),
      );
      await addOrderEvent({ orderId: order.id, type: "CUSTOMER_PHOTOS", title: `${paths.length} photo(s) jointe(s) par le client`, isPublic: true });
    }
  }

  const provider = getPaymentProvider();
  const { data: payment, error: paymentError } = await db
    .from("payments")
    .insert({ order_id: order.id, purpose: "INITIAL", provider: provider.code, amount_cents: pricing.totalCents, currency: "EUR", status: "PENDING" })
    .select("*")
    .single();
  if (paymentError || !payment) throw new CreateOrderError("Initialisation du paiement impossible.");

  const successUrl = `${SITE_URL}${ROUTES.checkout}/confirmation/${order.id}?token=${order.tracking_token}&payment=${payment.id}`;
  const cancelUrl = `${SITE_URL}${ROUTES.checkout}/${repair.id}?cancelled=1`;
  const session = await provider.createCheckout({
    paymentId: payment.id,
    orderId: order.id,
    orderNumber: order.order_number,
    purpose: "INITIAL",
    customerEmail: email,
    amountCents: pricing.totalCents,
    currency: "EUR",
    description: `${order.order_number} — ${repair.name}`,
    lineItems: pricing.lines.map((l) => ({ label: l.label, amountCents: l.unitPriceCents, quantity: l.quantity })),
    successUrl,
    cancelUrl,
  });
  await db.from("payments").update({ provider_session_id: session.providerSessionId }).eq("id", payment.id);

  await addOrderEvent({ orderId: order.id, type: "ORDER_CREATED", title: "Commande enregistrée", description: "En attente de confirmation du paiement.", actorId: currentUser?.id ?? null });
  await audit({ actorId: currentUser?.id ?? customer.id, actorRole: currentUser?.profile.role ?? "CUSTOMER", action: "order.created", resourceType: "repair_orders", resourceId: order.id, orderId: order.id, newValue: { total_cents: pricing.totalCents, repair_id: repair.id } });
  await trackServerEvent({
    event: ANALYTICS_EVENTS.START_PAYMENT,
    orderId: order.id,
    repairId: repair.id,
    userId: customer.id,
    sessionId: input.attribution?.session_id ?? null,
    valueCents: pricing.totalCents,
    attribution: input.attribution ?? null,
  });

  return { orderId: order.id, orderNumber: order.order_number, paymentId: payment.id, redirectUrl: session.redirectUrl };
}
