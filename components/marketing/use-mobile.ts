"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Le seuil où la mise en page passe d'une grille à une colonne unique. */
export const MQ_MOBILE = "(max-width: 1023px)";

/**
 * Le seuil du téléphone proprement dit — le `sm` de Tailwind, moins un pixel.
 *
 * Distinct de `MQ_MOBILE` : une tablette de 800 px reçoit la mise en page en
 * une colonne, mais pas la trame de la fiche de réparation, qui est écrite pour
 * un pouce et 390 px de large.
 */
export const MQ_TELEPHONE = "(max-width: 639px)";

/**
 * « Sommes-nous sur un petit écran ? », lu comme une source extérieure.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` alimenté par un effet : React
 * sait alors que la valeur du serveur diffère de celle du navigateur et gère
 * l'hydratation lui-même, au lieu de nous faire écrire un état qui se corrige
 * après coup — ce qui laissait voir, le temps d'une image, les panneaux dépliés
 * avant qu'ils ne se replient.
 *
 * Le repli serveur est `false`, donc « large », donc « tout déplié » : le
 * balisage livré contient l'intégralité du contenu. Sans JavaScript, rien ne se
 * replie et la page reste entièrement lisible — c'est la règle du handoff.
 */
export function useMobile(requete: string = MQ_MOBILE): boolean {
  const souscrire = useCallback(
    (rappel: () => void) => {
      const mq = window.matchMedia(requete);
      mq.addEventListener("change", rappel);
      return () => mq.removeEventListener("change", rappel);
    },
    [requete],
  );
  return useSyncExternalStore(
    souscrire,
    () => window.matchMedia(requete).matches,
    () => false,
  );
}
