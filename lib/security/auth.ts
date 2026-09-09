import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/types/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
 * Compte authentifié dont la ligne `profiles` est introuvable côté client.
 *
 * Deux causes : le compte a été créé hors de l'application (dashboard Supabase,
 * import) avant que le déclencheur `on_auth_user_created` n'existe, ou la lecture
 * est refusée par RLS. Sans réparation, chaque page privée renvoie vers la page de
 * connexion, que le proxy renvoie vers l'espace client : boucle de redirection et
 * page blanche.
 *
 * On relit d'abord avec la clé de service (le profil peut exister sans être lisible),
 * puis on le recrée comme le ferait le déclencheur. Seule la ligne portant
 * l'identifiant du compte authentifié est touchée.
 */
async function resolveMissingProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }): Promise<Profile | null> {
  let db;
  try {
    db = createSupabaseAdminClient();
  } catch (error) {
    console.error("[auth] profil illisible et clé de service indisponible", { userId: user.id, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
  const { data: existing, error: readError } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (readError) {
    console.error("[auth] lecture du profil impossible avec la clé de service", { userId: user.id, message: readError.message });
    return null;
  }
  if (existing) return existing;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof meta[key] === "string" && meta[key] ? (meta[key] as string) : null);
  const { data: created, error: insertError } = await db
    .from("profiles")
    .insert({ id: user.id, email: user.email ?? "", first_name: text("first_name"), last_name: text("last_name"), phone: text("phone") })
    .select("*")
    .maybeSingle();
  if (insertError) {
    console.error("[auth] création du profil manquant impossible", { userId: user.id, message: insertError.message });
    return null;
  }
  console.warn("[auth] profil manquant recréé pour un compte authentifié", { userId: user.id });
  return created;
}

/**
 * Session Supabase et profil applicatif, dédupliqués par requête. Le JWT est
 * validé par Supabase Auth (getUser) : jamais décodé localement.
 *
 * `authenticated` distingue « personne n'est connecté » de « session valide mais
 * profil inexploitable » : les deux cas n'appellent pas la même redirection.
 */
export const getAuthState = cache(async (): Promise<{ authenticated: boolean; user: CurrentUser | null }> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { authenticated: false, user: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const resolved = profile ?? (await resolveMissingProfile(user));
  if (!resolved) return { authenticated: true, user: null };
  return { authenticated: true, user: { id: user.id, email: user.email ?? resolved.email, profile: resolved } };
});

/** Utilisateur courant, ou null si personne n'est connecté (ou profil inexploitable). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => (await getAuthState()).user);

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
  const { authenticated, user } = await getAuthState();
  if (user) return user;
  // Session valide mais profil inexploitable : renvoyer vers /connexion sans marqueur
  // ferait boucler le proxy, qui renvoie les personnes connectées vers l'espace client.
  if (authenticated) redirect(`${ROUTES.login}?error=profil-incomplet`);
  redirect(`${ROUTES.login}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export async function requireStaffOrRedirect(): Promise<CurrentUser> {
  const { authenticated, user } = await getAuthState();
  if (!user) redirect(authenticated ? `${ROUTES.login}?error=profil-incomplet` : `${ROUTES.login}?next=${encodeURIComponent(ROUTES.admin)}`);
  if (!isStaffRole(user.profile.role)) redirect(ROUTES.account);
  return user;
}

export async function requireAdminOrRedirect(): Promise<CurrentUser> {
  const user = await requireStaffOrRedirect();
  if (!isAdminRole(user.profile.role)) redirect(ROUTES.admin);
  return user;
}
