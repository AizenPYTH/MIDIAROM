import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Photos déposées par un visiteur AVANT la création de sa demande (réparation,
 * reprise). Le navigateur téléverse dans le bucket privé `customer-media` sous
 * `drafts/<uuid>/<uuid>.<ext>` (taille et types limités par le bucket) ; le
 * serveur déplace ensuite les fichiers sous le préfixe définitif et n'accepte
 * que des chemins de cette forme.
 */
export const CUSTOMER_MEDIA_BUCKET = "customer-media";
const DRAFT_PATH = /^drafts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic)$/i;
export const MAX_DRAFT_PHOTOS = 6;

export function isDraftPath(path: string): boolean {
  return DRAFT_PATH.test(path);
}

/** Déplace les brouillons sous `<prefix>/` ; retourne les chemins finaux (les chemins invalides ou absents sont ignorés). */
export async function moveDraftPhotos(draftPaths: string[], prefix: string): Promise<string[]> {
  const db = createSupabaseAdminClient();
  const finalPaths: string[] = [];
  for (const path of draftPaths.slice(0, MAX_DRAFT_PHOTOS)) {
    if (!isDraftPath(path)) continue;
    const file = path.split("/").pop()!;
    const target = `${prefix}/${file}`;
    const { error } = await db.storage.from(CUSTOMER_MEDIA_BUCKET).move(path, target);
    if (error) {
      console.error("[drafts] move failed", path, error.message);
      continue;
    }
    finalPaths.push(target);
  }
  return finalPaths;
}

export async function signCustomerMedia(paths: string[], expiresIn = 900): Promise<{ path: string; url: string | null }[]> {
  if (!paths.length) return [];
  const db = createSupabaseAdminClient();
  const { data } = await db.storage.from(CUSTOMER_MEDIA_BUCKET).createSignedUrls(paths, expiresIn);
  return paths.map((path, i) => ({ path, url: data?.[i]?.signedUrl ?? null }));
}

/** Nettoyage des brouillons abandonnés (appelé par le cron quotidien). */
export async function purgeStaleDrafts(olderThanHours = 24): Promise<number> {
  const db = createSupabaseAdminClient();
  const { data: folders } = await db.storage.from(CUSTOMER_MEDIA_BUCKET).list("drafts", { limit: 1000 });
  const cutoff = Date.now() - olderThanHours * 3_600_000;
  let removed = 0;
  for (const folder of folders ?? []) {
    const { data: files } = await db.storage.from(CUSTOMER_MEDIA_BUCKET).list(`drafts/${folder.name}`, { limit: 100 });
    const stale = (files ?? []).filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff).map((f) => `drafts/${folder.name}/${f.name}`);
    if (stale.length) {
      await db.storage.from(CUSTOMER_MEDIA_BUCKET).remove(stale);
      removed += stale.length;
    }
  }
  return removed;
}
