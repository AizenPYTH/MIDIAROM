import "server-only";
import type { Json, Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canRoleTransition, canTransition, type OrderStatus, type UserRole } from "@/lib/orders/status";
import { audit } from "@/lib/security/audit";
import { notifyOrderEvent, type NotificationEvent } from "@/lib/notifications";

export type Order = Tables<"repair_orders">;

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_TRANSITION" | "FORBIDDEN" | "PRECONDITION",
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export interface Actor {
  id: string | null;
  role: UserRole | "SYSTEM";
}

export const SYSTEM_ACTOR: Actor = { id: null, role: "SYSTEM" };

export async function getOrderById(orderId: string): Promise<Order> {
  const { data, error } = await createSupabaseAdminClient().from("repair_orders").select("*").eq("id", orderId).maybeSingle();
  if (error || !data) throw new OrderError("Dossier introuvable", "NOT_FOUND");
  return data;
}

export async function addOrderEvent(input: {
  orderId: string;
  type: string;
  title: string;
  description?: string | null;
  isPublic?: boolean;
  actorId?: string | null;
  metadata?: Record<string, Json>;
}): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("order_events").insert({
    order_id: input.orderId,
    event_type: input.type,
    title: input.title,
    description: input.description ?? null,
    is_public: input.isPublic ?? true,
    actor_id: input.actorId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("[orders] event insert failed", error.message);
}

const TIMESTAMP_FOR_STATUS: Partial<Record<OrderStatus, keyof Order>> = {
  PAID: "paid_at",
  RECEIVED: "received_at",
  READY_TO_SHIP: "repaired_at",
  SHIPPED: "shipped_at",
  DELIVERED: "delivered_at",
  COMPLETED: "completed_at",
  CANCELLED: "cancelled_at",
};

const EVENT_TITLES: Partial<Record<OrderStatus, string>> = {
  PAID: "Paiement confirmé",
  AWAITING_SHIPMENT: "En attente de votre colis",
  IN_TRANSIT_TO_WORKSHOP: "Colis en transit vers l'atelier",
  RECEIVED: "Colis reçu à l'atelier",
  RECEPTION_CHECK: "Contrôle de réception en cours",
  DIAGNOSIS: "Diagnostic en cours",
  WAITING_CUSTOMER_APPROVAL: "En attente de votre décision",
  APPROVED: "Accord enregistré",
  REPAIRING: "Réparation en cours",
  QUALITY_CONTROL: "Contrôle qualité",
  READY_TO_SHIP: "Réparation terminée, prête à expédier",
  SHIPPED: "Console expédiée",
  DELIVERED: "Colis livré",
  COMPLETED: "Dossier terminé",
  CANCELLED: "Dossier annulé",
  REFUSED_QUOTE: "Devis refusé",
  UNREPAIRABLE: "Réparation impossible",
  RETURN_REQUIRED: "Retour de la console nécessaire",
  SAV: "Demande SAV ouverte",
  DISPUTED: "Litige en cours",
};

/** Notifications automatically triggered by a status change. */
function notificationForStatus(status: OrderStatus): NotificationEvent | null {
  switch (status) {
    case "RECEIVED":
      return { type: "PACKAGE_RECEIVED" };
    case "QUALITY_CONTROL":
      return { type: "REPAIR_DONE" };
    case "READY_TO_SHIP":
      return { type: "TESTS_DONE" };
    case "DELIVERED":
      return { type: "DELIVERED" };
    default:
      return null;
  }
}

/**
 * Moves an order to a new status with full traceability:
 * state machine check, role check, timestamps, timeline event, audit log,
 * automatic customer notification.
 */
export async function transitionOrder(input: {
  orderId: string;
  to: OrderStatus;
  actor: Actor;
  reason?: string | null;
  publicDescription?: string | null;
  notify?: boolean;
  metadata?: Record<string, Json>;
}): Promise<Order> {
  const db = createSupabaseAdminClient();
  const order = await getOrderById(input.orderId);
  const from = order.status;
  if (from === input.to) return order;

  const allowed = input.actor.role === "SYSTEM" ? canTransition(from, input.to) : canRoleTransition(input.actor.role, from, input.to);
  if (!allowed) {
    throw new OrderError(`Transition ${from} → ${input.to} non autorisée`, "INVALID_TRANSITION");
  }

  const patch: Partial<Order> = { status: input.to };
  const tsField = TIMESTAMP_FOR_STATUS[input.to];
  if (tsField && !order[tsField]) {
    (patch as Record<string, unknown>)[tsField] = new Date().toISOString();
  }

  const { data: updated, error } = await db.from("repair_orders").update(patch).eq("id", order.id).select("*").single();
  if (error || !updated) throw new OrderError(error?.message ?? "Mise à jour impossible", "PRECONDITION");

  // The DB trigger records order_status_history; we store who did it + reason.
  const { data: historyRow } = await db
    .from("order_status_history")
    .select("id")
    .eq("order_id", order.id)
    .eq("to_status", input.to)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (historyRow) {
    await db.from("order_status_history").update({ changed_by: input.actor.id, reason: input.reason ?? null }).eq("id", historyRow.id);
  }

  await addOrderEvent({
    orderId: order.id,
    type: `STATUS_${input.to}`,
    title: EVENT_TITLES[input.to] ?? input.to,
    description: input.publicDescription ?? null,
    actorId: input.actor.id,
    metadata: { from, to: input.to, ...(input.metadata ?? {}) },
  });

  await audit({
    actorId: input.actor.id,
    actorRole: input.actor.role === "SYSTEM" ? null : input.actor.role,
    action: "order.status_changed",
    resourceType: "repair_orders",
    resourceId: order.id,
    orderId: order.id,
    oldValue: { status: from },
    newValue: { status: input.to, reason: input.reason ?? null },
  });

  if (input.notify !== false) {
    const notification = notificationForStatus(input.to);
    if (notification) await notifyOrderEvent(updated, notification);
  }
  return updated;
}
