import "server-only";
import type { Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getShippingProvider, hasShippingProvider } from "@/lib/shipping";
import type { ShippingAddress } from "@/lib/shipping/types";
import { getSetting } from "@/lib/settings";
import { addOrderEvent, type Actor, type Order } from "@/lib/orders/service";
import { audit } from "@/lib/security/audit";

type Shipment = Tables<"shipments">;

function customerAddress(order: Order): ShippingAddress {
  const a = order.shipping_address as Record<string, string | null>;
  return {
    name: `${order.customer_first_name} ${order.customer_last_name}`,
    line1: a.line1 ?? "",
    line2: a.line2 ?? null,
    postal_code: a.postal_code ?? "",
    city: a.city ?? "",
    country_code: a.country_code ?? "FR",
    phone: order.customer_phone,
    email: order.customer_email,
  };
}

async function workshopAddress(): Promise<ShippingAddress> {
  const [brand, shipping] = await Promise.all([getSetting("brand"), getSetting("shipping_info")]);
  return {
    name: shipping.workshop_receiving_name || brand.name,
    line1: brand.address_line1,
    postal_code: brand.postal_code,
    city: brand.city,
    country_code: "FR",
    email: brand.email,
    phone: brand.phone,
  };
}

/**
 * Creates a carrier label for an order (outbound = customer → workshop,
 * return = workshop → customer), stores the PDF in the private
 * shipping-media bucket and records the shipment + timeline event.
 */
export async function createShipmentLabel(input: {
  order: Order;
  direction: "TO_WORKSHOP" | "TO_CUSTOMER";
  actor: Actor;
  parcel?: { weightGrams?: number; lengthCm?: number; widthCm?: number; heightCm?: number; declaredValueCents?: number; insured?: boolean };
}): Promise<Shipment> {
  const db = createSupabaseAdminClient();
  const { order } = input;

  const { data: method } = order.shipping_method_id
    ? await db.from("shipping_methods").select("*").eq("id", order.shipping_method_id).maybeSingle()
    : { data: null };
  const providerCode = method?.provider_code ?? null;
  if (!hasShippingProvider(providerCode)) {
    throw new Error("Aucun transporteur n'est configuré pour cette formule de transport");
  }
  const provider = getShippingProvider(providerCode);
  const workshop = await workshopAddress();
  const customer = customerAddress(order);
  const from = input.direction === "TO_WORKSHOP" ? customer : workshop;
  const to = input.direction === "TO_WORKSHOP" ? workshop : customer;

  const result = await provider.createLabel({
    orderNumber: order.order_number,
    from,
    to,
    parcel: {
      weightGrams: input.parcel?.weightGrams ?? 3000,
      lengthCm: input.parcel?.lengthCm,
      widthCm: input.parcel?.widthCm,
      heightCm: input.parcel?.heightCm,
      declaredValueCents: input.parcel?.declaredValueCents ?? method?.insurance_cents ?? undefined,
      insured: input.parcel?.insured ?? (method?.insurance_cents ?? 0) > 0,
    },
    serviceCode: method?.provider_service_code ?? null,
    reference: order.order_number,
  });

  let labelPath: string | null = null;
  if (result.labelPdf) {
    labelPath = `${order.id}/SHIPPING/${input.direction.toLowerCase()}-${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await db.storage.from("shipping-media").upload(labelPath, result.labelPdf, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      console.error("[shipping] label upload failed", uploadError.message);
      labelPath = null;
    } else {
      await db.from("order_media").insert({
        order_id: order.id,
        kind: "SHIPPING",
        bucket: "shipping-media",
        path: labelPath,
        mime_type: "application/pdf",
        size_bytes: result.labelPdf.byteLength,
        original_name: `etiquette-${order.order_number}.pdf`,
        caption: input.direction === "TO_WORKSHOP" ? "Étiquette d'envoi vers l'atelier" : "Étiquette de retour",
        is_visible_to_customer: input.direction === "TO_WORKSHOP",
        uploaded_by: input.actor.id,
      });
    }
  }

  const { data: shipment, error } = await db
    .from("shipments")
    .insert({
      order_id: order.id,
      direction: input.direction,
      provider_code: provider.code,
      service_code: result.serviceCode,
      carrier_name: result.carrierName,
      tracking_number: result.trackingNumber,
      tracking_url: result.trackingUrl,
      label_path: labelPath,
      provider_shipment_id: result.providerShipmentId,
      status: "LABEL_CREATED",
      weight_grams: input.parcel?.weightGrams ?? null,
      length_cm: input.parcel?.lengthCm ?? null,
      width_cm: input.parcel?.widthCm ?? null,
      height_cm: input.parcel?.heightCm ?? null,
      declared_value_cents: input.parcel?.declaredValueCents ?? method?.insurance_cents ?? null,
      is_insured: input.parcel?.insured ?? (method?.insurance_cents ?? 0) > 0,
      cost_cents: result.costCents || method?.estimated_cost_cents || 0,
      from_address: from as unknown as Record<string, string>,
      to_address: to as unknown as Record<string, string>,
      created_by: input.actor.id,
    })
    .select("*")
    .single();
  if (error || !shipment) throw new Error(error?.message ?? "Création de l'expédition impossible");

  await db.from("shipping_events").insert({ shipment_id: shipment.id, status: "LABEL_CREATED", description: "Étiquette créée" });
  await addOrderEvent({
    orderId: order.id,
    type: input.direction === "TO_WORKSHOP" ? "LABEL_CREATED" : "RETURN_LABEL_CREATED",
    title: input.direction === "TO_WORKSHOP" ? "Étiquette d'envoi disponible" : "Étiquette de retour créée",
    description: `Suivi ${result.trackingNumber}`,
    isPublic: input.direction === "TO_WORKSHOP",
    actorId: input.actor.id,
    metadata: { shipment_id: shipment.id, tracking_number: result.trackingNumber },
  });
  await audit({
    actorId: input.actor.id,
    actorRole: input.actor.role === "SYSTEM" ? null : input.actor.role,
    action: "shipment.label_created",
    resourceType: "shipments",
    resourceId: shipment.id,
    orderId: order.id,
    newValue: { direction: input.direction, tracking_number: result.trackingNumber },
  });
  return shipment;
}

/** Records a shipment manually (customer ships by themselves, or carrier without API). */
export async function recordManualShipment(input: {
  order: Order;
  direction: "TO_WORKSHOP" | "TO_CUSTOMER";
  carrierName: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  costCents?: number;
  weightGrams?: number | null;
  actor: Actor;
}): Promise<Shipment> {
  const db = createSupabaseAdminClient();
  const { data: shipment, error } = await db
    .from("shipments")
    .insert({
      order_id: input.order.id,
      direction: input.direction,
      provider_code: "manual",
      carrier_name: input.carrierName,
      tracking_number: input.trackingNumber,
      tracking_url: input.trackingUrl ?? null,
      status: "IN_TRANSIT",
      cost_cents: input.costCents ?? 0,
      weight_grams: input.weightGrams ?? null,
      shipped_at: new Date().toISOString(),
      created_by: input.actor.id,
    })
    .select("*")
    .single();
  if (error || !shipment) throw new Error(error?.message ?? "Enregistrement impossible");
  await db.from("shipping_events").insert({ shipment_id: shipment.id, status: "IN_TRANSIT", description: "Colis remis au transporteur" });
  await addOrderEvent({
    orderId: input.order.id,
    type: input.direction === "TO_WORKSHOP" ? "CUSTOMER_SHIPPED" : "RETURN_SHIPPED",
    title: input.direction === "TO_WORKSHOP" ? "Colis expédié vers l'atelier" : "Console expédiée",
    description: `${input.carrierName} — suivi ${input.trackingNumber}`,
    actorId: input.actor.id,
    metadata: { shipment_id: shipment.id, tracking_number: input.trackingNumber },
  });
  return shipment;
}

/** Signed URL for a private label / media file (permission must be checked by the caller). */
export async function signedMediaUrl(bucket: string, path: string, expiresInSeconds = 600): Promise<string | null> {
  const { data, error } = await createSupabaseAdminClient().storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("[storage] signed url failed", error.message);
    return null;
  }
  return data.signedUrl;
}
