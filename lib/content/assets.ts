import "server-only";

/**
 * Les visuels réellement présents dans le projet.
 *
 * Inventaire exhaustif au 14/09/2026 : 13 photos de consoles (détourées sur
 * fond blanc, importées par `npm run photos:consoles`) et une photo de la
 * façade du magasin. Rien d'autre — ni photo d'atelier, ni avant/après, ni
 * vidéo.
 *
 * Ce fichier existe pour que ce constat soit vérifiable en un endroit : toute
 * section de l'accueil qui affiche une photo vient piocher ici, et
 * `MISSING_ASSETS` dit noir sur blanc ce qui manque encore. Aucune section ne
 * doit inventer un chemin d'image.
 *
 * Les photos de consoles sont des **détourés sur blanc** : elles se posent en
 * `object-fit: contain` dans un cadre clair, jamais en fond plein écran sur le
 * noir de la charte, qui jurerait.
 */

/** Photo de la devanture, 207 rue de Rome. Vraie photo du magasin. */
export const STOREFRONT = "/medias/facade-207-mediarom.webp";

/** Détourés de consoles, par slug de modèle. */
export const CONSOLE_PHOTOS: Record<string, string> = {
  ps4: "/medias/consoles/ps4.webp",
  "ps4-slim": "/medias/consoles/ps4-slim.webp",
  "ps4-pro": "/medias/consoles/ps4-pro.webp",
  switch: "/medias/consoles/switch.webp",
  "switch-oled": "/medias/consoles/switch-oled.webp",
  "switch-lite": "/medias/consoles/switch-lite.webp",
  "switch-v2": "/medias/consoles/switch-v2.webp",
  "switch-2": "/medias/consoles/switch-2.webp",
  "xbox-series-x": "/medias/consoles/xbox-series-x.webp",
  "xbox-series-s": "/medias/consoles/xbox-series-s.webp",
  "xbox-one": "/medias/consoles/xbox-one.webp",
  "xbox-one-s": "/medias/consoles/xbox-one-s.webp",
  "xbox-one-x": "/medias/consoles/xbox-one-x.webp",
};

export function consolePhoto(slug: string | null | undefined): string | null {
  return slug ? (CONSOLE_PHOTOS[slug] ?? null) : null;
}

/**
 * Visuel des cartes « Ce qui passe sur le banc ».
 *
 * Seules trois des six prestations trouvent une photo juste dans ce qu'on a.
 * Mettre une PlayStation sur « Smartphones » serait un mensonge visuel : ces
 * trois cartes gardent l'aplat de la charte jusqu'à ce que les photos
 * arrivent (voir MISSING_ASSETS).
 */
export const SERVICE_PHOTOS: Record<string, string | null> = {
  "Consoles de salon": CONSOLE_PHOTOS["ps4"] ?? null,
  Manettes: CONSOLE_PHOTOS["switch"] ?? null,
  Smartphones: null,
  iPhone: null,
  "PC et portables": null,
  // Aucune photo de console rétro au catalogue : une Xbox One à cette
  // place illustrerait faux. L'aplat est plus honnête.
  Rétro: null,
};

/**
 * Ce qu'il manque, et pour quoi faire. Tenu à jour à la main : c'est la liste
 * à donner au client quand il demande pourquoi une scène reste sur un aplat.
 */
export const MISSING_ASSETS = [
  { role: "Récit de l'atelier — avant", need: "Photo d'un appareil en panne, ouvert sur le banc. Format 5/4, 1600 px de large." },
  { role: "Récit de l'atelier — après", need: "Le même appareil réparé et refermé, cadrage identique. C'est le volet qui se découvre." },
  { role: "Services — Smartphones", need: "Photo d'un smartphone démonté (écran, nappe, outils). 16/11." },
  { role: "Services — iPhone", need: "Photo d'un iPhone ouvert ou d'un bloc écran. 16/11." },
  { role: "Services — PC et portables", need: "Photo d'un portable ouvert, ventirad ou SSD. 16/11." },
  { role: "Services — Rétro", need: "Photo d'une console rétro (N64, SNES, Mega Drive) ou d'une carte recapée. 16/11." },
  { role: "Jeu vedette — vidéo de fond", need: "Vidéo courte dont vous disposez légalement (MP4 H.264, muette, 10–20 s), à renseigner dans Stock → hero_video_url." },
  { role: "Jeux — covers et artworks", need: "Rien à fournir : ils viennent d'IGDB dès qu'un produit « Jeu » est associé à sa fiche dans Stock." },
] as const;
