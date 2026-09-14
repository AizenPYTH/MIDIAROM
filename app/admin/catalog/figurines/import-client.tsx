"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importFigurineAction, searchFigurinesAction, type FigurineImportState, type FigurineSearchState } from "@/app/admin/actions/figurines";
import type { ExternalProduct } from "@/lib/catalog/providers/types";
import type { JudgedProduct } from "@/lib/catalog/figurine-filter";

/**
 * L'écran d'import : un champ, des résultats, un bouton par fiche.
 *
 * Volontairement sans état local ni requête côté client : deux actions
 * serveur suffisent. La recherche part quand on valide, l'import quand on
 * clique — rien ne s'exécute tout seul, et aucune clé ne passe au navigateur.
 */

function Ligne({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-[12.5px] leading-[1.45]">
      <span className="shrink-0 font-mono uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      <span className="min-w-0 text-ink-soft">{value}</span>
    </div>
  );
}

/** « 12 800 JPY » — le prix de la source, jamais présenté comme un prix MÉDI@ROM. */
function prixSource(produit: ExternalProduct): string | null {
  if (!produit.priceCents || produit.priceCents <= 0) return null;
  const montant = (produit.priceCents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return produit.currency ? `${montant} ${produit.currency}` : montant;
}

function Carte({ juge }: { juge: JudgedProduct }) {
  const { product: produit, verdict, reason } = juge;
  const [state, action, pending] = useActionState<FigurineImportState, FormData>(importFigurineAction, { status: "idle" });
  const image = produit.images[0]?.url ?? null;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex gap-4">
        <span className="relative block w-[96px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-muted" style={{ aspectRatio: "3 / 4" }}>
          {image ? (
            // Image d'un catalogue tiers, affichée pour aider à choisir. Elle
            // n'est pas republiée sur la boutique : voir external_images.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-ink-faint">sans visuel</span>
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <strong className="font-display text-[15.5px] font-bold leading-[1.25] tracking-[-0.01em] text-ink">{produit.name}</strong>
          {verdict !== "figurine" && reason ? (
            <span className="w-fit rounded-full bg-warning-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-warning">
              {verdict === "ecarte" ? "Écarté" : "À vérifier"} · {reason}
            </span>
          ) : null}
          <Ligne label="Fabricant" value={produit.manufacturer} />
          <Ligne label="Série" value={produit.series} />
          <Ligne label="Rayon source" value={produit.category} />
          <Ligne label="Personnage" value={produit.character} />
          <Ligne label="JAN / EAN" value={produit.ean} />
          <Ligne label="Référence" value={produit.ref} />
          <Ligne label="Taille" value={produit.size} />
          <Ligne label="Sortie" value={produit.releaseDate} />
          <Ligne label="Dispo. source" value={produit.availability} />
          <Ligne label="Prix source" value={prixSource(produit)} />
          {produit.url ? (
            <a href={produit.url} target="_blank" rel="noreferrer noopener" className="font-mono text-[11px] uppercase tracking-[0.06em] text-accent hover:underline">
              Voir chez la source ↗
            </a>
          ) : null}
        </div>
      </div>

      {state.status === "done" ? (
        <p className={`rounded-xl px-3 py-2 text-[13px] ${state.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {state.message}
          {state.ok && state.productId ? (
            <>
              {" "}
              <Link href={`/admin/stock/${state.productId}`} className="underline">
                Compléter la fiche
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <form action={action}>
          <input type="hidden" name="payload" value={JSON.stringify(produit)} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-full bg-ink px-5 font-mono text-[11px] uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {pending ? "Import…" : "Importer en brouillon"}
          </button>
        </form>
      )}
    </li>
  );
}

export function FigurineImporter() {
  const [state, action, pending] = useActionState<FigurineSearchState, FormData>(searchFigurinesAction, { status: "idle" });

  return (
    <div className="mt-6">
      <form action={action} className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={state.status === "results" ? state.term : ""}
          placeholder="Luffy Gear 5"
          aria-label="Rechercher une figurine"
          className="min-w-0 flex-[1_1_280px] rounded-xl border border-border-strong bg-field px-4 py-3 text-[16px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[48px] cursor-pointer items-center rounded-xl bg-ink px-6 font-mono text-[11.5px] uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {pending ? "Recherche…" : "Rechercher"}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger">{state.error}</p>
      ) : null}

      {state.status === "results" ? (
        <>
          <p className="mt-5 font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
            {state.products.length} figurine{state.products.length > 1 ? "s" : ""} pour « {state.term} »
            {state.rejected.length ? ` · ${state.rejected.length} dérivé${state.rejected.length > 1 ? "s" : ""} écarté${state.rejected.length > 1 ? "s" : ""}` : ""}
          </p>

          {state.products.length ? (
            <ul className="mt-4 grid list-none gap-4 p-0 lg:grid-cols-2">
              {state.products.map((juge) => (
                <Carte key={juge.product.ref} juge={juge} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-[13.5px] text-ink-soft">
              Aucune figurine dans ces résultats. Les produits écartés restent consultables ci-dessous — et importables si
              le tri s&apos;est trompé.
            </p>
          )}

          {/*
            Les écartés ne sont pas supprimés. Un filtre qui se trompe sur un
            produit rare ne doit pas empêcher l'atelier de l'importer : deux
            clics suffisent à le récupérer.
          */}
          {state.rejected.length ? (
            <details className="mt-6 rounded-2xl border border-border bg-surface-muted p-4">
              <summary className="cursor-pointer font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">
                {state.rejected.length} produit{state.rejected.length > 1 ? "s" : ""} écarté
                {state.rejected.length > 1 ? "s" : ""} — t-shirts, stickers, goodies…
              </summary>
              <ul className="mt-4 grid list-none gap-4 p-0 lg:grid-cols-2">
                {state.rejected.map((juge) => (
                  <Carte key={juge.product.ref} juge={juge} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
