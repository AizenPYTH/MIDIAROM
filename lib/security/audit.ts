import "server-only";
import { headers } from "next/headers";
import type { Json, TablesInsert } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/orders/status";

export interface AuditEntry {
  actorId: string | null;
  actorRole: UserRole | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  orderId?: string | null;
  oldValue?: Json | null;
  newValue?: Json | null;
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return {
      ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : (h.get("x-real-ip") ?? null),
      userAgent: h.get("user-agent"),
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Writes an audit log line. Never throws (auditing must not break business flows). */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const meta = await requestMeta();
    const row: TablesInsert<"audit_logs"> = {
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      order_id: entry.orderId ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    };
    await createSupabaseAdminClient().from("audit_logs").insert(row);
  } catch (error) {
    console.error("[audit] failed", error);
  }
}
