"use client";

import { useActionState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/form";
import { linkGameAction, resyncGameAction, searchGamesForProductAction, type GameActionResult } from "@/app/admin/actions/games";
import type { Game, GameMatch } from "@/lib/igdb/types";

/**
 * Association d'un produit à sa fiche IGDB.
 *
 * L'écran montre pourquoi un candidat est proposé — score et motifs — plutôt
 * que d'imposer un choix : c'est l'atelier qui tranche, et il doit pouvoir
 * voir en un coup d'œil qu'une jaquette PS4 a été proposée pour un jeu PS5.
 * Toute association reste défaisable par « Dissocier ».
 */

function Feedback({ state }: { state: GameActionResult | null }) {
  if (!state) return null;
  return (
    <>
      <FormError message={!state.ok ? state.error : null} />
      <FormSuccess message={state.ok && "message" in state ? state.message : null} />
      {state.ok && "error" in state && state.error ? (
        <p className="rounded-[14px] border border-warning px-3 py-2 text-[13px] text-warning">{state.error}</p>
      ) : null}
    </>
  );
}

function confidenceTone(confidence: number): { label: string; className: string } {
  if (confidence >= 0.82) return { label: "Correspondance sûre", className: "text-success" };
  if (confidence >= 0.6) return { label: "À vérifier", className: "text-warning" };
  return { label: "Peu probable", className: "text-danger" };
}

function MatchRow({ productId, match }: { productId: string; match: GameMatch }) {
  const [state, action, pending] = useActionState<GameActionResult | null, FormData>(linkGameAction, null);
  const tone = confidenceTone(match.confidence);
  const { game } = match;
  return (
    <li className="flex flex-col gap-3 rounded-[18px] border border-border p-3 sm:flex-row sm:items-start">
      {game.cover ? (
        // Le CDN IGDB est déclaré dans next.config.ts : l'image passe par
        // l'optimiseur du projet comme n'importe quelle autre.
        <Image src={game.cover.url} alt="" width={64} height={85} className="w-16 shrink-0 rounded-[10px] object-cover" unoptimized />
      ) : (
        <span aria-hidden="true" className="flex h-[85px] w-16 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-border text-[10px] text-ink-muted">
          sans jaquette
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{game.name}</p>
        <p className="font-mono text-[11px] text-ink-muted">
          IGDB {game.igdbId}
          {game.releaseDate ? ` · ${game.releaseDate.slice(0, 4)}` : ""}
          {game.platforms.length ? ` · ${game.platforms.join(", ")}` : " · plateforme inconnue"}
        </p>
        <p className={`mt-1 font-mono text-[11px] uppercase tracking-[0.08em] ${tone.className}`}>
          {tone.label} — {Math.round(match.confidence * 100)} %
        </p>
        <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-ink-muted">
          {match.reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
        <form action={action} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="igdb_id" value={game.igdbId} />
          <input type="hidden" name="confidence" value={match.confidence.toFixed(3)} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Association…" : "Confirmer ce jeu"}
          </Button>
        </form>
        <Feedback state={state} />
      </div>
    </li>
  );
}

export function GameMatchPanel({
  productId,
  productName,
  platform,
  linked,
  syncedAt,
  matchSource,
  configurationError,
}: {
  productId: string;
  productName: string;
  platform: string | null;
  linked: Game | null;
  syncedAt: string | null;
  matchSource: string | null;
  configurationError: string | null;
}) {
  const router = useRouter();
  const [search, searchAction, searching] = useActionState<GameActionResult | null, FormData>(searchGamesForProductAction, null);
  const [link, linkAction, linking] = useActionState<GameActionResult | null, FormData>(linkGameAction, null);
  const [resync, resyncAction, resyncing] = useActionState<GameActionResult | null, FormData>(resyncGameAction, null);
  const matches = search?.ok && "matches" in search ? search.matches : [];

  if (configurationError) {
    return (
      <p className="rounded-[14px] border border-warning px-3 py-2 text-[13px] text-warning">
        IGDB n&apos;est pas configuré : renseignez TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET chez l&apos;hébergeur, puis
        redéployez. Le produit reste vendable avec ses propres photos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {linked ? (
        <div className="flex flex-col gap-3 rounded-[18px] border border-success p-3 sm:flex-row sm:items-start">
          {linked.cover ? (
            <Image src={linked.cover.url} alt="" width={64} height={85} className="w-16 shrink-0 rounded-[10px] object-cover" unoptimized />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{linked.name}</p>
            <p className="font-mono text-[11px] text-ink-muted">
              IGDB {linked.igdbId} · {linked.platforms.join(", ") || "plateforme inconnue"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-muted">
              {matchSource === "MANUAL" ? "Validé à la main" : matchSource === "BARCODE" ? "Reconnu par code-barres" : "Associé automatiquement"}
              {syncedAt ? ` · synchronisé le ${new Date(syncedAt).toLocaleDateString("fr-FR")}` : ""}
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {linked.artworks.length} visuel(s) large(s) · {linked.screenshots.length} capture(s)
              {linked.trailer ? " · bande-annonce disponible" : " · pas de bande-annonce"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <form action={resyncAction}>
                <input type="hidden" name="product_id" value={productId} />
                <Button type="submit" size="sm" variant="outline" disabled={resyncing}>
                  {resyncing ? "Synchronisation…" : "Resynchroniser"}
                </Button>
              </form>
              <form action={linkAction} onSubmit={() => setTimeout(() => router.refresh(), 400)}>
                <input type="hidden" name="product_id" value={productId} />
                <input type="hidden" name="igdb_id" value="" />
                <Button type="submit" size="sm" variant="outline" disabled={linking}>
                  Dissocier
                </Button>
              </form>
            </div>
            <Feedback state={resync} />
            <Feedback state={link} />
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ink-muted">
          Aucun jeu associé. Le produit s&apos;affiche avec ses propres photos ; l&apos;association ajoute jaquette, visuels et
          informations.
        </p>
      )}

      <form action={searchAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="product_id" value={productId} />
        <Field label="Rechercher sur IGDB" htmlFor="igdb-q" className="flex-1">
          <Input id="igdb-q" name="q" defaultValue={productName} maxLength={120} placeholder="Titre du jeu" />
        </Field>
        <Button type="submit" variant="outline" disabled={searching}>
          {searching ? "Recherche…" : "Chercher"}
        </Button>
      </form>
      <p className="text-[12px] text-ink-muted">
        La plateforme du produit{platform ? ` (${platform})` : " n'est pas renseignée, ce qui empêche de départager les versions"} sert à
        écarter les fiches d&apos;une autre machine.
      </p>

      <Feedback state={search} />
      {matches.length ? (
        <ul className="flex flex-col gap-2">
          {matches.map((m) => (
            <MatchRow key={m.game.igdbId} productId={productId} match={m} />
          ))}
        </ul>
      ) : search?.ok ? (
        <p className="text-[13px] text-ink-muted">Aucun jeu trouvé pour cette recherche.</p>
      ) : null}
    </div>
  );
}
