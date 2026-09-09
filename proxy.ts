import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy (formerly middleware): refreshes the Supabase session and
 * redirects unauthenticated users away from private areas. Role checks
 * (admin vs technician vs customer) are done server-side in layouts/actions
 * with the validated profile — the proxy is only a first, cheap gate.
 */
const PROTECTED_PREFIXES = ["/compte", "/admin"];
const AUTH_PAGES = ["/connexion", "/inscription"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // « error » signale une session inexploitable (profil manquant) : renvoyer vers
  // l'espace client bouclerait avec la redirection posée par le layout.
  if (user && AUTH_PAGES.includes(pathname) && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone();
    url.pathname = "/compte";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|ico|pdf)$).*)"],
};
