"use client";

import { useCallback, useId, useState, useSyncExternalStore } from "react";

/**
 * Une plateforme de réparation : carte sur desktop, ligne dépliable au doigt.
 *
 * Les quatre plateformes tiennent en grille sur un écran large. Sur téléphone,
 * la même grille devient quatre cartes pleine largeur qui s'empilent : chacune
 * porte un visuel, six lignes de tarif et un bouton, soit près de six cents
 * pixels. Il fallait faire défiler quatre écrans pour découvrir qu'on répare
 * aussi les Xbox — et la page d'accueil passait les onze mille pixels.
 *
 * Le handoff mobile répond par un accordéon : on voit les quatre noms d'un
 * coup, on ouvre celui qui concerne sa panne. Trois règles en découlent :
 *
 *   — le panneau est **ouvert dans le balisage** et se replie au montage : sans
 *     JavaScript la page reste entièrement lisible, et le rendu serveur ne
 *     cache rien à un moteur d'indexation ;
 *   — **aucun visuel dans l'en-tête replié** : une vignette de 56 × 44 ne dit
 *     rien qu'un nom ne dise mieux. L'image vit dans le panneau, en 16/9 ;
 *   — au-dessus de `lg`, le composant s'efface : la carte d'origine est rendue
 *     telle quelle, sans bouton ni état.
 */
const MQ_MOBILE = "(max-width: 1023px)";

/**
 * « Sommes-nous sur un petit écran ? », lu comme une source extérieure.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` alimenté par un effet : React
 * sait alors que la valeur du serveur diffère de celle du navigateur et gère
 * l'hydratation lui-même, au lieu de nous faire écrire un état qui se corrige
 * après coup — ce qui affichait brièvement quatre cartes dépliées avant de les
 * replier.
 */
function useMobile(): boolean {
  const souscrire = useCallback((rappel: () => void) => {
    const mq = window.matchMedia(MQ_MOBILE);
    mq.addEventListener("change", rappel);
    return () => mq.removeEventListener("change", rappel);
  }, []);
  return useSyncExternalStore(
    souscrire,
    () => window.matchMedia(MQ_MOBILE).matches,
    // Le serveur ne connaît pas la largeur : il répond « large », donc « déplié ».
    () => false,
  );
}

export function PlatformCard({
  titre,
  prix,
  modeles,
  nbPannes,
  visuel,
  children,
}: {
  titre: string;
  prix: string;
  modeles: string;
  nbPannes: number;
  visuel: React.ReactNode;
  children: React.ReactNode;
}) {
  const panneauId = useId();
  const mobile = useMobile();
  const [deplie, setDeplie] = useState(false);

  /**
   * Le panneau est ouvert partout sauf replié par l'utilisateur sur petit écran.
   *
   * Écrit dans ce sens, et non l'inverse, pour une raison précise : le rendu
   * serveur ne connaît pas la largeur de l'écran, il répond donc « large », donc
   * « ouvert ». Le balisage livré contient tout le contenu, et c'est le
   * navigateur qui replie une fois qu'il sait. Sans JavaScript, rien ne se
   * replie et la page reste entière.
   */
  const ouvert = !mobile || deplie;

  const corps = (
    <div className="flex flex-1 flex-col gap-[13px] p-5">
      {/* Sur mobile, le nom et le prix sont déjà dans l'en-tête replié. */}
      {!mobile ? (
        <span className="flex items-baseline justify-between gap-3">
          <strong className="text-[20px] font-bold tracking-[-0.025em]">{titre}</strong>
          <span className="whitespace-nowrap font-mono text-[12px] text-ink-muted">{prix}</span>
        </span>
      ) : null}
      <span className="font-mono text-[11px] tracking-[0.04em] text-ink-muted">{modeles}</span>
      {children}
    </div>
  );

  if (!mobile) {
    return (
      <li data-rise="1" data-card="1" className="flex min-w-0 flex-col border border-border bg-surface">
        {visuel}
        {corps}
      </li>
    );
  }

  return (
    <li data-card="1" className="flex min-w-0 flex-col border border-border bg-surface">
      <button
        type="button"
        onClick={() => setDeplie((v) => !v)}
        aria-expanded={ouvert}
        aria-controls={panneauId}
        className="flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-muted"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <strong className="text-[18px] font-bold tracking-[-0.025em] text-ink">{titre}</strong>
          <span className="font-mono text-[11px] tracking-[0.04em] text-ink-muted">
            {prix} · {nbPannes} pannes
          </span>
        </span>
        {/* La croix pivote de 45° : elle devient un « moins » à l'ouverture. */}
        <span
          aria-hidden="true"
          className="relative block h-5 w-5 shrink-0 text-ink transition-transform duration-200"
          style={{ transform: ouvert ? "rotate(45deg)" : "none" }}
        >
          <span className="absolute left-0 top-1/2 block h-[1.5px] w-5 -translate-y-1/2 bg-current" />
          <span className="absolute left-1/2 top-0 block h-5 w-[1.5px] -translate-x-1/2 bg-current" />
        </span>
      </button>
      <div id={panneauId} hidden={!ouvert} className="flex flex-col border-t border-border">
        {visuel}
        {corps}
      </div>
    </li>
  );
}
