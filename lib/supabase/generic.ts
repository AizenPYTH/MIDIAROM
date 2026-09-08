import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Schema-less service-role client used ONLY by the generic admin CRUD
 * (lib/admin/entities.ts), where the zod schema of each entity is the
 * validation layer. Everything else uses the typed admin client.
 */
type GenericTable = { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
type GenericDatabase = {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: SupabaseClient<GenericDatabase> | null = null;

export function createGenericAdminClient(): SupabaseClient<GenericDatabase> {
  if (client) return client;
  client = createClient<GenericDatabase>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
