import "server-only";
import type { Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BUCKET_FOR_KIND, validateUpload, type MediaKind } from "@/lib/security/upload";
import { isStaffRole } from "@/lib/orders/status";
import type { CurrentUser } from "@/lib/security/auth";
import { audit } from "@/lib/security/audit";

export type OrderMedia = Tables<"order_media">;

/** Can this user see this order's media? (owner or staff) */
export async function canAccessOrder(user: CurrentUser, orderId: string): Promise<boolean> {
  if (isStaffRole(user.profile.role)) return true;
  const { data } = await createSupabaseAdminClient().from("repair_orders").select("id").eq("id", orderId).eq("customer_id", user.id).maybeSingle();
  return Boolean(data);
}

/**
 * Registers a file that the browser uploaded directly to Supabase Storage
 * (bucket policies enforce MIME type, size and ownership at the storage
 * level). We re-check ownership, verify the object exists and record it.
 */
export async function registerUploadedMedia(input: {
  user: CurrentUser;
  orderId: string;
  kind: MediaKind;
  path: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string | null;
  caption: string | null;
  visibleToCustomer?: boolean;
}): Promise<OrderMedia> {
  const staff = isStaffRole(input.user.profile.role);
  if (!staff && input.kind !== "SAV") throw new Error("Type de fichier non autorisé");
  if (!(await canAccessOrder(input.user, input.orderId))) throw new Error("Accès refusé");

  const validation = validateUpload({ type: input.mimeType, size: input.sizeBytes }, input.kind);
  if (!validation.ok) throw new Error(validation.error);

  const bucket = BUCKET_FOR_KIND[input.kind];
  const expectedPrefix = `${input.orderId}/${input.kind}/`;
  if (!input.path.startsWith(expectedPrefix) || !/^[a-zA-Z0-9/_.-]+$/.test(input.path)) throw new Error("Chemin de fichier invalide");

  const db = createSupabaseAdminClient();
  const { data: exists } = await db.storage.from(bucket).createSignedUrl(input.path, 30);
  if (!exists) throw new Error("Fichier introuvable dans le stockage");

  const { data, error } = await db
    .from("order_media")
    .insert({
      order_id: input.orderId,
      kind: input.kind,
      bucket,
      path: input.path,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      original_name: input.originalName?.slice(0, 200) ?? null,
      caption: input.caption?.slice(0, 500) ?? null,
      is_video: validation.isVideo,
      is_visible_to_customer: staff ? (input.visibleToCustomer ?? true) : true,
      uploaded_by: input.user.id,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Enregistrement impossible");

  await db.from("order_events").insert({
    order_id: input.orderId,
    event_type: "MEDIA_ADDED",
    title: input.kind === "SAV" ? "Pièce jointe SAV ajoutée" : `Photo${validation.isVideo ? "/vidéo" : ""} ajoutée (${kindLabel(input.kind)})`,
    is_public: data.is_visible_to_customer,
    actor_id: input.user.id,
    metadata: { media_id: data.id, kind: input.kind },
  });
  await audit({ actorId: input.user.id, actorRole: input.user.profile.role, action: "media.added", resourceType: "order_media", resourceId: data.id, orderId: input.orderId, newValue: { kind: input.kind, path: input.path } });
  return data;
}

export async function deleteMedia(user: CurrentUser, mediaId: string): Promise<void> {
  if (!isStaffRole(user.profile.role)) throw new Error("Accès refusé");
  const db = createSupabaseAdminClient();
  const { data: media } = await db.from("order_media").select("*").eq("id", mediaId).maybeSingle();
  if (!media) return;
  await db.storage.from(media.bucket).remove([media.path]);
  await db.from("order_media").delete().eq("id", mediaId);
  await audit({ actorId: user.id, actorRole: user.profile.role, action: "media.deleted", resourceType: "order_media", resourceId: mediaId, orderId: media.order_id, oldValue: { path: media.path, kind: media.kind } });
}

/** Signed URLs for a list of media rows (caller already checked access). */
export async function signMedia(media: OrderMedia[], expiresIn = 900): Promise<(OrderMedia & { url: string | null })[]> {
  const db = createSupabaseAdminClient();
  const byBucket = new Map<string, OrderMedia[]>();
  for (const m of media) byBucket.set(m.bucket, [...(byBucket.get(m.bucket) ?? []), m]);
  const urls = new Map<string, string>();
  for (const [bucket, rows] of byBucket) {
    const { data } = await db.storage.from(bucket).createSignedUrls(
      rows.map((r) => r.path),
      expiresIn,
    );
    for (const item of data ?? []) if (item.signedUrl && item.path) urls.set(`${bucket}:${item.path}`, item.signedUrl);
  }
  return media.map((m) => ({ ...m, url: urls.get(`${m.bucket}:${m.path}`) ?? null }));
}

export function kindLabel(kind: MediaKind): string {
  const labels: Record<MediaKind, string> = {
    CUSTOMER: "Envoyé par le client",
    RECEPTION: "Réception",
    DIAGNOSTIC: "Diagnostic",
    REPAIR: "Réparation",
    SHIPPING: "Expédition",
    FINAL: "État final",
    DOCUMENT: "Document",
    SAV: "SAV",
    QUOTE: "Devis",
  };
  return labels[kind];
}
