import { UPLOAD_LIMITS } from "@/config/site";
import type { Enums } from "@/types/database";

export type MediaKind = Enums<"media_kind">;

export const BUCKET_FOR_KIND: Record<MediaKind, string> = {
  RECEPTION: "reception-media",
  DIAGNOSTIC: "diagnostic-media",
  REPAIR: "repair-media",
  SHIPPING: "shipping-media",
  FINAL: "final-media",
  DOCUMENT: "documents",
  SAV: "sav-media",
  QUOTE: "diagnostic-media",
};

const EXTENSION_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

export interface UploadValidation {
  ok: true;
  extension: string;
  isVideo: boolean;
}
export interface UploadRejection {
  ok: false;
  error: string;
}

/** Validates MIME type and size server-side. Never trust the file name. */
export function validateUpload(file: { type: string; size: number }, kind: MediaKind): UploadValidation | UploadRejection {
  const isImage = (UPLOAD_LIMITS.allowedImageTypes as readonly string[]).includes(file.type);
  const isVideo = (UPLOAD_LIMITS.allowedVideoTypes as readonly string[]).includes(file.type);
  const isDoc = (UPLOAD_LIMITS.allowedDocumentTypes as readonly string[]).includes(file.type);

  if (kind === "DOCUMENT" && !isDoc) return { ok: false, error: "Seuls les PDF sont acceptés pour les documents." };
  if (kind === "SHIPPING" && !(isImage || isDoc)) return { ok: false, error: "Format non accepté (image ou PDF)." };
  if (kind !== "DOCUMENT" && kind !== "SHIPPING" && !(isImage || isVideo)) {
    return { ok: false, error: "Format non accepté (JPEG, PNG, WebP, HEIC, MP4, MOV, WebM)." };
  }
  const max = isVideo ? UPLOAD_LIMITS.videoMaxBytes : isDoc ? UPLOAD_LIMITS.documentMaxBytes : UPLOAD_LIMITS.imageMaxBytes;
  if (file.size <= 0 || file.size > max) {
    return { ok: false, error: `Fichier trop volumineux (max ${Math.round(max / 1024 / 1024)} Mo).` };
  }
  const extension = EXTENSION_FOR_MIME[file.type];
  if (!extension) return { ok: false, error: "Format non reconnu." };
  return { ok: true, extension, isVideo };
}

/** Safe storage path: <order_id>/<kind>/<uuid>.<ext> — user-provided names are never used. */
export function buildStoragePath(orderId: string, kind: MediaKind, extension: string): string {
  return `${orderId}/${kind}/${crypto.randomUUID()}.${extension}`;
}
