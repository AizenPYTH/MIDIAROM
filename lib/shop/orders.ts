import "server-only";
import type { Json, Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getProductsByIds } from "@/lib/shop/catalog";
import { canShopTransition, computeShopTotals, normalizeCart, type ShopOrderStatus } from "@/lib/shop/status";
import { getPaymentProvider } from "@/lib/stripe";
import { getSetting } from "@/lib/settings";
import { resolveCustomer, CreateOrderError } from "@/lib/orders/create-order";
import { audit } from "@/lib/security/audit";
import { emailBrand, sendCustomerEmail } from "@/lib/notifications";
import * as T from "@/emails/templates";
import { ROUTES, SITE_URL } from "@/config/site";
import type { ShopOrderInput } from "@/lib/orders/schemas";
import type { CurrentUser } from "@/lib/security/auth";

export type ShopOrder = Tables<"shop_orders">;
export type ShopOrderItem = Tables<"shop_order_items">;

export interface ShopActor {
  id: string | null;
  role: string;
}

/** Prix serveur du panier : produits actifs, stock disponible, totaux. */
export async function priceCart(rawLines: { productId: string; quantity: number }[], fulfillment: "PICKUP" | "SHIPPING") {
  const lines = normalizeCart(rawLines);
  const [products, shop, rules] = await Promise.all([getProductsByIds(lines.map((l) => l.productId)), getSetting("shop"), getSetting("business_rules")]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const priced = lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product || !product.is_active) throw new CreateOrderError("Un article de votre panier n'est plus disponible.", "lines");
    if (product.quantity < line.quantity) throw new CreateOrderError(`Stock insuffisant pour « ${product.name} » (${product.quantity} disponible${product.quantity > 1 ? "s" : ""}).`, "lines");
    return { ...line, product, unitPriceCents: product.price_cents, totalCents: product.price_cents * line.quantity, label: product.name, available: product.quantity };
  });
  if (fulfillment === "SHIPPING" && !shop.shipping_enabled) throw new CreateOrderError("L'envoi n'est pas disponible pour le moment.", "fulfillment");
  if (fulfillment === "PICKUP" && !shop.pickup_enabled) throw new CreateOrderError("Le retrait au magasin n'est pas disponible pour le moment.", "fulfillment");
  const totals = computeShopTotals({ lines: priced, fulfillment, shippingFeeCents: shop.shipping_fee_cents, freeShippingThresholdCents: shop.free_shipping_threshold_cents, vatRateBp: rules.vat_rate_bp });
  return { lines: priced, totals, shop, rules };
}

export interface CreateShopOrderResult {
  orderId: string;
  orderNumber: string;
  redirectUrl: string;
}

/** Crée la commande (PENDING), ses lignes et la session de paiement. Le stock est décrémenté à la confirmation du paiement. */
export async function createShopOrderAndCheckout(input: ShopOrderInput, currentUser: CurrentUser | null): Promise<CreateShopOrderResult> {
  const db = createSupabaseAdminClient();
  const { lines, totals, rules } = await priceCart(input.lines, input.fulfillment);
  if (input.fulfillment === "SHIPPING" && !input.address) throw new CreateOrderError("Adresse de livraison requise.", "address.line1");
  const [checkout, customer] = await Promise.all([getSetting("checkout"), resolveCustomer(input, currentUser)]);
  const email = input.customer.email.toLowerCase();

  const { data: order, error } = await db
    .from("shop_orders")
    .insert({
      customer_id: customer.id,
      customer_first_name: input.customer.first_name,
      customer_last_name: input.customer.last_name,
      customer_email: email,
      customer_phone: input.customer.phone || null,
      fulfillment: input.fulfillment,
      shipping_address: input.fulfillment === "SHIPPING" && input.address ? ({ ...input.address, line2: input.address.line2 || null } as unknown as Json) : null,
      status: "PENDING",
      subtotal_cents: totals.subtotalCents,
      shipping_cents: totals.shippingCents,
      total_cents: totals.totalCents,
      vat_rate_bp: rules.vat_rate_bp,
      customer_notes: input.customer_notes || null,
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_version: checkout.terms_version,
    })
    .select("*")
    .single();
  if (error || !order) {
    console.error("[shop] insert failed", error?.message);
    throw new CreateOrderError("La création de la commande a échoué. Merci de réessayer.");
  }
  const { error: itemsError } = await db.from("shop_order_items").insert(
    lines.map((l) => ({ order_id: order.id, product_id: l.product.id, sku: l.product.sku, label: l.product.name, platform: l.product.platform, condition: l.product.condition, quantity: l.quantity, unit_price_cents: l.unitPriceCents, total_cents: l.totalCents })),
  );
  if (itemsError) {
    await db.from("shop_orders").delete().eq("id", order.id);
    throw new CreateOrderError("La création de la commande a échoué. Merci de réessayer.");
  }
  await db.from("shop_order_history").insert({ order_id: order.id, from_status: null, to_status: "PENDING", actor_id: currentUser?.id ?? null, note: "Commande créée" });

  const provider = getPaymentProvider();
  const { data: payment, error: paymentError } = await db
    .from("payments")
    .insert({ order_id: null, shop_order_id: order.id, purpose: "SHOP", provider: provider.code, amount_cents: totals.totalCents, currency: "EUR", status: "PENDING" })
    .select("*")
    .single();
  if (paymentError || !payment) throw new CreateOrderError("Initialisation du paiement impossible.");

  const successUrl = `${SITE_URL}${ROUTES.shopConfirmation}/${order.id}?token=${order.tracking_token}&payment=${payment.id}`;
  const cancelUrl = `${SITE_URL}${ROUTES.shopCheckout}?cancelled=1`;
  const session = await provider.createCheckout({
    paymentId: payment.id,
    orderId: order.id,
    orderNumber: order.order_number,
    purpose: "SHOP",
    customerEmail: email,
    amountCents: totals.totalCents,
    currency: "EUR",
    description: `Commande ${order.order_number}`,
    lineItems: [...lines.map((l) => ({ label: l.label, amountCents: l.unitPriceCents, quantity: l.quantity })), ...(totals.shippingCents ? [{ label: "Livraison", amountCents: totals.shippingCents, quantity: 1 }] : [])],
    successUrl,
    cancelUrl,
  });
  await db.from("payments").update({ provider_session_id: session.providerSessionId }).eq("id", payment.id);
  await audit({ actorId: currentUser?.id ?? null, actorRole: currentUser?.profile.role ?? null, action: "shop_order.created", resourceType: "shop_orders", resourceId: order.id, newValue: { order_number: order.order_number, total_cents: totals.totalCents } });
  return { orderId: order.id, orderNumber: order.order_number, redirectUrl: session.redirectUrl };
}

export async function getShopOrderById(orderId: string): Promise<ShopOrder> {
  const { data, error } = await createSupabaseAdminClient().from("shop_orders").select("*").eq("id", orderId).single();
  if (error || !data) throw new Error("Commande introuvable");
  return data;
}

async function shopEmailContext(order: ShopOrder): Promise<T.ShopEmailContext> {
  const db = createSupabaseAdminClient();
  const [{ data: items }, brand] = await Promise.all([db.from("shop_order_items").select("label, quantity, total_cents").eq("order_id", order.id), emailBrand()]);
  return {
    brand,
    firstName: order.customer_first_name,
    orderNumber: order.order_number,
    totalCents: order.total_cents,
    fulfillment: order.fulfillment,
    accountUrl: `${SITE_URL}${ROUTES.accountShopOrders}/${order.id}`,
    lines: (items ?? []).map((i) => ({ label: i.label, quantity: i.quantity, totalCents: i.total_cents })),
  };
}

/** Appelé par confirmPayment : passe la commande en PAYÉE, décrémente le stock, notifie. Idempotent. */
export async function handleShopPaymentConfirmed(orderId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const order = await getShopOrderById(orderId);
  if (order.status !== "PENDING") return;
  const { data: items } = await db.from("shop_order_items").select("*").eq("order_id", orderId);
  const now = new Date().toISOString();
  await db.from("shop_orders").update({ status: "PAID", paid_at: now }).eq("id", orderId).eq("status", "PENDING");
  await db.from("shop_order_history").insert({ order_id: orderId, from_status: "PENDING", to_status: "PAID", actor_id: null, note: "Paiement confirmé" });
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const { data: product } = await db.from("products").select("quantity").eq("id", item.product_id).maybeSingle();
    if (!product) continue;
    await db.from("products").update({ quantity: Math.max(0, product.quantity - item.quantity) }).eq("id", item.product_id);
    await db.from("stock_movements").insert({ product_id: item.product_id, delta: -item.quantity, reason: "ORDER_PAID", reference_id: orderId, note: order.order_number });
  }
  const shop = await getSetting("shop");
  const ctx = await shopEmailContext({ ...order, status: "PAID" });
  await sendCustomerEmail({ to: order.customer_email, recipientId: order.customer_id, eventType: "SHOP_ORDER_PAID", shopOrderId: orderId, rendered: T.shopOrderConfirmed({ ...ctx, pickupNote: shop.pickup_note, shippingNote: shop.shipping_note }) });
}

/** Changement de statut par l'atelier (préparée, expédiée, livrée, annulée) avec historique, stock et e-mails. */
export async function transitionShopOrder(input: { orderId: string; to: ShopOrderStatus; actor: ShopActor; note?: string | null; carrierName?: string | null; trackingNumber?: string | null; trackingUrl?: string | null }): Promise<ShopOrder> {
  const db = createSupabaseAdminClient();
  const order = await getShopOrderById(input.orderId);
  if (!canShopTransition(order.status, input.to)) throw new Error(`Transition ${order.status} → ${input.to} non autorisée`);
  const now = new Date().toISOString();
  const patch: Partial<ShopOrder> = { status: input.to };
  if (input.to === "PREPARED") patch.prepared_at = now;
  if (input.to === "SHIPPED") {
    patch.shipped_at = now;
    if (input.carrierName !== undefined) patch.carrier_name = input.carrierName;
    if (input.trackingNumber !== undefined) patch.tracking_number = input.trackingNumber;
    if (input.trackingUrl !== undefined) patch.tracking_url = input.trackingUrl;
  }
  if (input.to === "DELIVERED") patch.delivered_at = now;
  if (input.to === "CANCELLED") patch.cancelled_at = now;
  const { data: updated, error } = await db.from("shop_orders").update(patch).eq("id", order.id).select("*").single();
  if (error || !updated) throw new Error("Mise à jour impossible");
  await db.from("shop_order_history").insert({ order_id: order.id, from_status: order.status, to_status: input.to, actor_id: input.actor.id, note: input.note ?? null });
  await audit({ actorId: input.actor.id, actorRole: null, action: "shop_order.status", resourceType: "shop_orders", resourceId: order.id, oldValue: { status: order.status }, newValue: { status: input.to } });

  // Annulation après paiement : le stock est restitué (le remboursement se fait depuis la fiche paiement).
  if (input.to === "CANCELLED" && order.status !== "PENDING") {
    const { data: items } = await db.from("shop_order_items").select("*").eq("order_id", order.id);
    for (const item of items ?? []) {
      if (!item.product_id) continue;
      const { data: product } = await db.from("products").select("quantity").eq("id", item.product_id).maybeSingle();
      if (!product) continue;
      await db.from("products").update({ quantity: product.quantity + item.quantity }).eq("id", item.product_id);
      await db.from("stock_movements").insert({ product_id: item.product_id, delta: item.quantity, reason: "ORDER_CANCELLED", reference_id: order.id, actor_id: input.actor.id, note: order.order_number });
    }
  }

  const ctx = await shopEmailContext(updated);
  if (input.to === "PREPARED" && updated.fulfillment === "PICKUP") await sendCustomerEmail({ to: updated.customer_email, recipientId: updated.customer_id, eventType: "SHOP_ORDER_READY", shopOrderId: updated.id, rendered: T.shopOrderReady(ctx) });
  if (input.to === "SHIPPED" && updated.fulfillment === "SHIPPING") await sendCustomerEmail({ to: updated.customer_email, recipientId: updated.customer_id, eventType: "SHOP_ORDER_SHIPPED", shopOrderId: updated.id, rendered: T.shopOrderShipped({ ...ctx, carrierName: updated.carrier_name, trackingNumber: updated.tracking_number, trackingUrl: updated.tracking_url }) });
  if (input.to === "CANCELLED") await sendCustomerEmail({ to: updated.customer_email, recipientId: updated.customer_id, eventType: "SHOP_ORDER_CANCELLED", shopOrderId: updated.id, rendered: T.shopOrderCancelled({ ...ctx, reason: input.note ?? null }) });
  return updated;
}

/** Ajustement manuel de stock (inventaire, réception, casse). */
export async function adjustStock(input: { productId: string; delta: number; reason: string; note?: string | null; actor: ShopActor }): Promise<void> {
  const db = createSupabaseAdminClient();
  const { data: product } = await db.from("products").select("quantity, sku").eq("id", input.productId).maybeSingle();
  if (!product) throw new Error("Produit introuvable");
  const next = Math.max(0, product.quantity + input.delta);
  await db.from("products").update({ quantity: next }).eq("id", input.productId);
  await db.from("stock_movements").insert({ product_id: input.productId, delta: next - product.quantity, reason: input.reason, actor_id: input.actor.id, note: input.note ?? null });
  await audit({ actorId: input.actor.id, actorRole: null, action: "stock.adjusted", resourceType: "products", resourceId: input.productId, oldValue: { quantity: product.quantity }, newValue: { quantity: next, reason: input.reason } });
}
