import "server-only";

/**
 * Les visuels réellement présents dans le projet.
 *
 * **Aucune photo n'est branchée sur l'accueil pour l'instant, et c'est
 * volontaire.** Le client fournira lui-même les visuels des consoles, des
 * figurines manga/anime et des services ; il ne veut pas d'images choisies à sa
 * place, même issues du projet.
 *
 * Les emplacements existent donc dans les composants, vides, et attendent
 * simplement qu'on renseigne une entrée ici : rien d'autre ne sera à changer.
 * En attendant, chaque emplacement affiche l'aplat teinté de son accent, qui
 * est un état prévu par la charte et non un trou.
 *
 * Ce qui existe par ailleurs dans le dépôt, non branché sur l'accueil :
 * 13 détourés de consoles sur fond blanc (`public/medias/consoles/`, importés
 * par `npm run photos:consoles`, utilisés par les fiches de réparation) et une
 * photo de la devanture (`public/medias/facade-207-mediarom.webp`, publiée
 * dans la galerie).
 */

/**
 * Visuel des cartes « Ce qui passe sur le banc ».
 *
 * Toutes nulles : les photos viendront du client. Renseigner un chemin ici
 * suffit à faire apparaître l'image, sans toucher au composant.
 */
export const SERVICE_PHOTOS: Record<string, string | null> = {
  "Consoles de salon": null,
  Manettes: null,
  Smartphones: null,
  iPhone: null,
  "PC et portables": null,
  Rétro: null,
};

/** Visuel du hero de réparation. À renseigner par le client. */
export const HERO_PHOTO: string | null = null;

/** Volet « avant / après » du récit de l'atelier. À renseigner par le client. */
export const STORY_BEFORE: string | null = null;
export const STORY_AFTER: string | null = null;

/** Visuel de l'entrée boutique. À renseigner par le client. */
export const SHOP_PHOTO: string | null = null;

/**
 * Boucle vidéo de démonstration du jeu vedette.
 *
 * Fabriquée pour ce projet : une animation de nuées dessinée sur un canvas puis
 * enregistrée. Elle n'est empruntée à personne, aucune licence tierce n'est en
 * jeu. Elle sert à éprouver la scène ; le champ `hero_video_url` d'un produit
 * la remplace dès qu'une vraie vidéo est disponible.
 */
export const DEMO_FEATURED_VIDEO = "/medias/demo/featured-loop.webm";

/**
 * Ce que le client fournira. Tenu à jour à la main : c'est la liste à lui
 * donner quand il demande pourquoi une scène reste sur un aplat.
 */
export const MISSING_ASSETS = [
  { role: "Hero réparation", need: "Visuel principal : appareil démonté, composants, écran. 4/3, 1600 px." },
  { role: "Récit — avant", need: "Appareil en panne, ouvert sur le banc. 5/4, 1600 px." },
  { role: "Récit — après", need: "Le même réparé, cadrage identique : c'est le volet qui se découvre." },
  { role: "Services — les six cartes", need: "Une photo par prestation (consoles, manettes, smartphones, iPhone, PC, rétro). 16/11." },
  { role: "Entrée boutique", need: "Photo du magasin ou d'un rayon. 4/5, 1400 px." },
  { role: "Consoles, figurines manga/anime", need: "Photos des produits, à déposer dans la fiche produit du back-office." },
  { role: "Jeu vedette — vidéo", need: "Facultatif : une vidéo dont vous disposez légalement, dans `hero_video_url`. Une boucle de démonstration tient la place." },
  { role: "Jeux — covers et artworks", need: "Rien à fournir : ils viennent d'IGDB." },
] as const;
