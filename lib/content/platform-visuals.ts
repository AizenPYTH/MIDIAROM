/**
 * Les photographies de famille de consoles.
 *
 * Module **pur**, sans `server-only` : la fiche de réparation est un composant
 * client et pose ces photos derrière ses tuiles. `lib/content/assets.ts`, qui
 * lit la base, le réexporte pour que rien n'ait à changer d'import.
 */

/**
 * Les visuels des cartes de plateforme, section « Votre panne est probablement
 * prise en charge ».
 *
 * La clé correspond à `Platform.key` dans
 * `components/marketing/home/content.ts`.
 *
 * **Un chemin déclaré ici n'a pas besoin que le fichier existe déjà.**
 * `HomeVisual` est un composant client justement pour ça : si le fichier
 * manque, il bascule sur la plaque d'attente de la charte au lieu de laisser
 * l'icône d'image cassée du navigateur. Le chemin de la Switch est donc posé
 * d'avance — déposer le fichier suffit à allumer la carte, sans toucher au
 * code.
 */
export const PLATFORM_VISUALS: Record<string, { src: string; alt: string; position: string; mobile: string }> = {
  playstation: {
    src: "/images/home/playstation.png",
    alt: "Console PlayStation 5 sur l'établi de l'atelier",
    position: "50% 50%",
    mobile: "52% 50%",
  },
  xbox: {
    src: "/images/home/xbox.png",
    alt: "Console Xbox Series X ouverte sur l'établi",
    position: "50% 50%",
    mobile: "52% 50%",
  },
  retro: {
    src: "/images/home/retro.png",
    alt: "Consoles rétro en vitrine : Nintendo 64, Super Nintendo et Mega Drive",
    position: "50% 50%",
    mobile: "52% 50%",
  },
  /**
   * La console est au centre du cadre et le sujet remplit la largeur : le
   * recadrage 16/10 reste centré, y compris au téléphone où le cadre se
   * resserre.
   */
  switch: {
    src: "/images/home/switch.png",
    alt: "Nintendo Switch aux Joy-Con bleu et rouge sur l'établi de l'atelier, coque démontée et outillage de précision à côté",
    position: "50% 50%",
    mobile: "50% 50%",
  },
};
