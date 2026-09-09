"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/audit";
import { ROUTES, SITE_URL } from "@/config/site";

export type AuthState = { error?: string; success?: string } | null;

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.account;
}

const loginSchema = z.object({ email: z.string().trim().email("E-mail invalide"), password: z.string().min(1, "Mot de passe requis") });
const registerSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(60),
  last_name: z.string().trim().min(1, "Nom requis").max(60),
  email: z.string().trim().email("E-mail invalide"),
  password: z.string().min(8, "8 caractères minimum").max(128),
});

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const meta = await requestMeta();
  if (!rateLimit(`login:${meta.ip ?? "unknown"}`, 20, 15 * 60_000).allowed) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou mot de passe incorrect." };
  redirect(safeNext(formData.get("next")));
}

export async function magicLinkAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const meta = await requestMeta();
  if (!rateLimit(`magic:${meta.ip ?? "unknown"}`, 5, 15 * 60_000).allowed) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "E-mail invalide" };
  const next = safeNext(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false } });
  if (error) return { error: "Impossible d'envoyer le lien. Vérifiez l'adresse." };
  return { success: "Si un compte existe avec cette adresse, un lien de connexion vient de vous être envoyé." };
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const meta = await requestMeta();
  if (!rateLimit(`register:${meta.ip ?? "unknown"}`, 5, 15 * 60_000).allowed) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  const parsed = registerSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const next = safeNext(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { first_name: parsed.data.first_name, last_name: parsed.data.last_name },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message.includes("registered") ? "Un compte existe déjà avec cette adresse." : "Inscription impossible. Vérifiez vos informations." };
  if (data.session) redirect(next);
  return { success: "Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous." };
}

export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const meta = await requestMeta();
  if (!rateLimit(`forgot:${meta.ip ?? "unknown"}`, 5, 15 * 60_000).allowed) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "E-mail invalide" };
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent("/nouveau-mot-de-passe")}` });
  return { success: "Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d'être envoyé." };
}

export async function updatePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = z.string().min(8, "8 caractères minimum").max(128).safeParse(formData.get("password"));
  if (!password.success) return { error: password.error.issues[0]?.message ?? "Mot de passe invalide" };
  if (password.data !== formData.get("confirm")) return { error: "Les deux mots de passe ne correspondent pas." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré." };
  redirect(ROUTES.account);
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(ROUTES.home);
}
