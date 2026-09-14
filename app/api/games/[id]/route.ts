import { NextResponse } from "next/server";
import { z } from "zod";
import { getGame } from "@/lib/igdb/service";

/**
 * GET /api/games/:igdbId — une fiche normalisée, telle qu'en cache.
 *
 * Lecture pure : ne sort jamais sur le réseau, donc publique et sans risque
 * pour le quota. Un jeu absent du cache répond 404 — c'est au back-office de
 * le synchroniser, pas à un visiteur de le déclencher.
 */
export const dynamic = "force-dynamic";

const schema = z.coerce.number().int().positive();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(id);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Identifiant invalide." }, { status: 400 });

  const game = await getGame(parsed.data);
  if (!game) return NextResponse.json({ ok: false, error: "Fiche inconnue." }, { status: 404 });

  return NextResponse.json(
    { ok: true, game },
    // Le cache est en base : celui du CDN n'a qu'à éviter les rafales.
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } },
  );
}
