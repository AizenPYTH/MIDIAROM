import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROUTES } from "@/config/site";

/** Exchanges the Supabase auth code (magic link, e-mail confirmation, recovery) for a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? ROUTES.account;
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : ROUTES.account;
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`${ROUTES.login}?error=lien-invalide`, url.origin));
}
