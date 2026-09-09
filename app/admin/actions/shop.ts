"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff, requireAdmin } from "@/lib/security/auth";
import { adjustStock, transitionShopOrder } from "@/lib/shop/orders";
import { SHOP_ORDER_STATUSES, type ShopOrderStatus } from "@/lib/shop/status";
import { addTradeInNote, sendTradeInOffer, setTradeInStatus } from "@/lib/tradein/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/admin/actions/orders";

const fail = (error: string): ActionResult => ({ ok: false, error });
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

// ---------------------------------------------------------------------------
// Commandes boutique
// ---------------------------------------------------------------------------
export async function shopOrderStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const to = str(formData, "status") as ShopOrderStatus;
  if (!SHOP_ORDER_STATUSES.includes(to)) return fail("Statut inconnu");
  try {
    await transitionShopOrder({
      orderId,
      to,
      actor: { id: user.id, role: user.profile.role },
      note: str(formData, "note") || null,
      carrierName: str(formData, "carrier_name") || undefined,
      trackingNumber: str(formData, "tracking_number") || undefined,
      trackingUrl: str(formData, "tracking_url") || undefined,
    });
    revalidatePath(`/admin/shop-orders/${orderId}`);
    revalidatePath("/admin/shop-orders");
    return { ok: true, message: "Commande mise à jour." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Mise à jour impossible");
  }
}

export async function shopOrderTrackingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const db = createSupabaseAdminClient();
  const { error } = await db.from("shop_orders").update({ carrier_name: str(formData, "carrier_name") || null, tracking_number: str(formData, "tracking_number") || null, tracking_url: str(formData, "tracking_url") || null }).eq("id", orderId);
  if (error) return fail(error.message);
  await db.from("shop_order_history").insert({ order_id: orderId, from_status: null, to_status: (await db.from("shop_orders").select("status").eq("id", orderId).single()).data?.status ?? "PAID", actor_id: user.id, note: `Suivi colis mis à jour : ${str(formData, "tracking_number") || "—"}` });
  revalidatePath(`/admin/shop-orders/${orderId}`);
  return { ok: true, message: "Suivi enregistré." };
}

export async function shopOrderNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const orderId = str(formData, "order_id");
  const body = str(formData, "body");
  if (body.length < 2) return fail("Note vide");
  const db = createSupabaseAdminClient();
  const { data: order } = await db.from("shop_orders").select("internal_notes").eq("id", orderId).single();
  await db.from("shop_orders").update({ internal_notes: [order?.internal_notes, `${new Date().toLocaleString("fr-FR")} — ${user.profile.first_name ?? ""} : ${body}`].filter(Boolean).join("\n") }).eq("id", orderId);
  revalidatePath(`/admin/shop-orders/${orderId}`);
  return { ok: true, message: "Note ajoutée." };
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------
export async function stockAdjustAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const productId = str(formData, "product_id");
  const delta = Number.parseInt(str(formData, "delta"), 10);
  if (!Number.isFinite(delta) || delta === 0) return fail("Quantité invalide (ex. +3 ou -1)");
  try {
    await adjustStock({ productId, delta, reason: str(formData, "reason") || "ADJUSTMENT", note: str(formData, "note") || null, actor: { id: user.id, role: user.profile.role } });
    revalidatePath(`/admin/stock/${productId}`);
    revalidatePath("/admin/stock");
    revalidatePath("/boutique", "layout");
    return { ok: true, message: "Stock mis à jour." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Ajustement impossible");
  }
}

// ---------------------------------------------------------------------------
// Reprises
// ---------------------------------------------------------------------------
export async function tradeInOfferAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const id = str(formData, "request_id");
  const amount = Math.round(Number(str(formData, "offer").replace(",", ".")) * 100);
  const validity = Number.parseInt(str(formData, "validity_days") || "14", 10);
  if (!Number.isFinite(amount) || amount < 0) return fail("Montant invalide");
  try {
    await sendTradeInOffer({ id, offerCents: amount, note: str(formData, "note") || null, validityDays: Number.isFinite(validity) && validity > 0 ? validity : 14, actor: user });
    revalidatePath(`/admin/trade-ins/${id}`);
    revalidatePath("/admin/trade-ins");
    return { ok: true, message: "Offre envoyée au client." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Envoi impossible");
  }
}

export async function tradeInStatusAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const id = str(formData, "request_id");
  const to = str(formData, "status");
  if (to !== "REFUSED" && to !== "CLOSED") return;
  try {
    await setTradeInStatus({ id, to, note: str(formData, "note") || null, actor: user });
  } catch (error) {
    redirect(`/admin/trade-ins/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Impossible")}`);
  }
  revalidatePath(`/admin/trade-ins/${id}`);
  revalidatePath("/admin/trade-ins");
  redirect(`/admin/trade-ins/${id}`);
}

export async function tradeInNoteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const id = str(formData, "request_id");
  const body = str(formData, "body");
  if (body.length < 2) return fail("Note vide");
  await addTradeInNote({ id, body, actor: user });
  revalidatePath(`/admin/trade-ins/${id}`);
  return { ok: true, message: "Note ajoutée." };
}
