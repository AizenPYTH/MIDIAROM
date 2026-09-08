import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/types/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminRole, isStaffRole, type UserRole } from "@/lib/orders/status";
import { ROUTES } from "@/config/site";

export type Profile = Tables<"profiles">;

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Current user + profile, de-duplicated per request. Validates the JWT with
 * Supabase Auth (getUser) — never trusts a locally decoded session.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? profile.email, profile };
});

/** Throws (for actions/route handlers) when nobody is logged in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentification requise", "UNAUTHENTICATED");
  return user;
}

export async function requireRole(roles: readonly UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.profile.role)) throw new AuthError("Accès refusé", "FORBIDDEN");
  return user;
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isStaffRole(user.profile.role)) throw new AuthError("Accès réservé à l'atelier", "FORBIDDEN");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isAdminRole(user.profile.role)) throw new AuthError("Accès réservé aux administrateurs", "FORBIDDEN");
  return user;
}

/** Page helpers: redirect instead of throwing. */
export async function requireUserOrRedirect(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.login}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireStaffOrRedirect(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.admin)}`);
  if (!isStaffRole(user.profile.role)) redirect(ROUTES.account);
  return user;
}

export async function requireAdminOrRedirect(): Promise<CurrentUser> {
  const user = await requireStaffOrRedirect();
  if (!isAdminRole(user.profile.role)) redirect(ROUTES.admin);
  return user;
}
