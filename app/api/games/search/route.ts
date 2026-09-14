import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { searchGameMatches } from "@/lib/igdb/service";

/**
 * GET /api/games/search?q=…&platform=…&ean=…
 *
 * Recherche IGDB avec notation des candidats. **Réservée à l'atelier** : c'est
 * la seule route du site qui sort sur le réseau à la demande, et le quota IGDB
 * est de quatre requêtes par seconde pour toute l'application. L'ouvrir au
 * public reviendrait à donner à n'importe qui de quoi l'épuiser.
 *
 * Les pages publiques n'en ont pas besoin : elles lisent le cache
 * (lib/shop/games.ts).
 */
export const dynamic = "force-dynamic";

const schema = z.object({
  q: z.string().trim().min(2).max(120),
  platform: z.string().trim().max(60).optional(),
  ean: z.string().trim().regex(/^[0-9]{8,14}$/, "EAN invalide").optional(),
  edition: z.string().trim().max(60).optional(),
  releaseYear: z.coerce.number().int().min(1970).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export async function GET(request: Request) {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ ok: false, error: "Accès réservé à l'atelier." }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  // Deuxième garde-fou, après l'authentification : un compte d'atelier
  // compromis ne doit pas pouvoir épuiser le quota IGDB non plus.
  const limit = rateLimit(`igdb:search:${parsed.data.q.slice(0, 40)}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Trop de recherches. Réessayez dans un instant." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { q, platform, ean, edition, releaseYear, limit: max } = parsed.data;
  const { matches, error } = await searchGameMatches(
    { name: q, platform: platform ?? null, ean: ean ?? null, edition: edition ?? null, releaseYear: releaseYear ?? null },
    max,
  );

  // Une panne IGDB n'est pas une erreur du client : 200 avec une liste vide et
  // le motif, pour que le back-office l'affiche au lieu de planter.
  return NextResponse.json({ ok: true, matches, error }, { headers: { "Cache-Control": "no-store" } });
}
