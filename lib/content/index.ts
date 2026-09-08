import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/database";

export type ContentBlock = Tables<"content_blocks">;
export type FaqItem = Tables<"faq_items">;

export const getContentBlock = cache(async (key: string): Promise<ContentBlock | null> => {
  const { data } = await createSupabaseAdminClient()
    .from("content_blocks")
    .select("*")
    .eq("key", key)
    .eq("is_published", true)
    .maybeSingle();
  return data ?? null;
});

export async function getContentBlocks(keys: readonly string[]): Promise<Record<string, ContentBlock>> {
  const { data } = await createSupabaseAdminClient()
    .from("content_blocks")
    .select("*")
    .in("key", [...keys])
    .eq("is_published", true);
  return Object.fromEntries((data ?? []).map((b) => [b.key, b]));
}

export function blockData<T>(block: ContentBlock | null | undefined, fallback: T): T {
  if (!block) return fallback;
  const data = block.data as Json;
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return { ...fallback, ...(data as Partial<T>) } as T;
  }
  return fallback;
}

export const getFaqItems = cache(async (category?: string): Promise<FaqItem[]> => {
  let query = createSupabaseAdminClient().from("faq_items").select("*").eq("is_active", true).order("display_order");
  if (category) query = query.eq("category", category);
  const { data } = await query;
  return data ?? [];
});

export const getSeoPage = cache(async (path: string) => {
  const { data } = await createSupabaseAdminClient().from("seo_pages").select("*").eq("path", path).maybeSingle();
  return data ?? null;
});

export const getLegalDocument = cache(async (slug: string) => {
  const { data } = await createSupabaseAdminClient()
    .from("legal_documents")
    .select("*")
    .eq("slug", slug)
    .eq("is_current", true)
    .maybeSingle();
  return data ?? null;
});

export const getGalleryItems = cache(async (category?: string) => {
  let query = createSupabaseAdminClient().from("gallery_items").select("*").eq("is_published", true).order("display_order");
  if (category) query = query.eq("category", category);
  const { data } = await query;
  return data ?? [];
});

export const getPackagingInstructions = cache(async (modelId?: string | null) => {
  const { data } = await createSupabaseAdminClient()
    .from("packaging_instructions")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  const all = data ?? [];
  return all.filter((i) => i.model_id === null || i.model_id === modelId);
});
