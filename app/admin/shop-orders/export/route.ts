import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/security/audit";
import { FULFILLMENT_LABELS, SHOP_ORDER_STATUS_LABELS, type ShopOrderStatus } from "@/lib/shop/status";

const FILTERS: Record<string, ShopOrderStatus[] | null> = {
  open: ["PAID", "PREPARED"],
  all: null,
  paid: ["PAID"],
  prepared: ["PREPARED"],
  shipped: ["SHIPPED"],
  pending: ["PENDING"],
  done: ["DELIVERED", "CANCELLED"],
};

const csvCell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Export CSV des commandes boutique (séparateur ; pour Excel FR). Réservé au personnel. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireStaff();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get("f") ?? "open";
  const filter = key in FILTERS ? FILTERS[key]! : FILTERS.open!;
  const q = url.searchParams.get("q")?.trim().replace(/[%,]/g, "") ?? "";
  const db = createSupabaseAdminClient();
  let query = db.from("shop_orders").select("*, items:shop_order_items(label, quantity, sku)").order("created_at", { ascending: false }).limit(2000);
  if (filter) query = query.in("status", filter);
  if (q) query = query.or(`order_number.ilike.%${q}%,customer_last_name.ilike.%${q}%,customer_email.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) console.error("[shop] export failed", error.message);
  const header = ["Numéro", "Date", "Statut", "Client", "E-mail", "Téléphone", "Mode", "Adresse", "Articles", "Sous-total", "Livraison", "Total", "Encaissé", "Transporteur", "Suivi"];
  const rows = (data ?? []).map((o) => {
    const address = (o.shipping_address ?? null) as Record<string, string | null> | null;
    const items = o.items as { label: string; quantity: number; sku: string | null }[];
    return [
      o.order_number,
      new Date(o.created_at).toLocaleString("fr-FR"),
      SHOP_ORDER_STATUS_LABELS[o.status],
      `${o.customer_first_name} ${o.customer_last_name}`,
      o.customer_email,
      o.customer_phone,
      FULFILLMENT_LABELS[o.fulfillment],
      address ? [address.line1, address.line2, address.postal_code, address.city].filter(Boolean).join(" ") : "",
      items.map((i) => `${i.sku ? `[${i.sku}] ` : ""}${i.label} x${i.quantity}`).join(" | "),
      (o.subtotal_cents / 100).toFixed(2),
      (o.shipping_cents / 100).toFixed(2),
      (o.total_cents / 100).toFixed(2),
      (o.paid_cents / 100).toFixed(2),
      o.carrier_name,
      o.tracking_number,
    ]
      .map(csvCell)
      .join(";");
  });
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "shop_orders.exported", resourceType: "shop_orders", resourceId: null, newValue: { count: rows.length, filter: url.searchParams.get("f") ?? "open" } });
  const body = `﻿${header.map(csvCell).join(";")}\n${rows.join("\n")}`;
  return new NextResponse(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
