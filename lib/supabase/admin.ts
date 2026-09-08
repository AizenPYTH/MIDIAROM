import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getPublicEnv, getServerEnv } from "@/lib/env";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Service-role client. BYPASSES RLS. Server only. Every caller MUST have
 * checked permissions first (see lib/security/auth.ts). Never import from a
 * client component (the "server-only" guard makes the build fail if you do).
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  adminClient = createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
