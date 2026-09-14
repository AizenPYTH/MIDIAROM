import "server-only";

/**
 * Les visuels de l'accueil.
 *
 * **Aucune photo n'est branchée, et c'est volontaire.** Le magasin fournira ses
 * propres visuels — consoles, figurines de personnages, atelier, façade — et ne
 * veut pas d'images choisies à sa place, même issues du projet.
 *
 * Les emplacements existent donc dans les composants, vides, et attendent
 * qu'on renseigne une entrée ici : rien d'autre ne sera à changer. En
 * attendant, chaque emplacement affiche la plaque d'attente de la charte, qui
 * est un état prévu et non un trou.
 *
 * Ce qui existe par ailleurs dans le dépôt, non branché sur l'accueil :
 * 13 détourés de consoles sur fond blanc (`public/medias/consoles/`, importés
 * par `npm run photos:consoles`, utilisés par les fiches de réparation) et une
 * photo de la devanture (`public/medias/facade-207-mediarom.webp`, publiée
 * dans la galerie).
 */

/**
 * La vidéo d'atelier de la section « Dans l'atelier ».
 *
 * `undefined` tant qu'aucune vidéo n'est fournie : le cadre reste alors son
 * image d'attente et le bouton Lire disparaît — la section est belle sans, ce
 * qui est la condition pour qu'elle ne soit jamais bloquante.
 *
 * Attendu : MP4 H.264 **et** WebM, 1920×1080, 20 à 40 s, moins de 6 Mo, sans
 * piste sonore dans le fichier. Plans utiles : console ouverte, nettoyage,
 * microsoudure au fer, test HDMI à l'écran, fermeture du boîtier.
 *
 *   export const WORKSHOP_VIDEO = { src: "/medias/atelier.mp4", poster: "/medias/atelier.jpg" };
 */
export const WORKSHOP_VIDEO: { src: string; poster?: string } | undefined = undefined;

/**
 * Boucle vidéo de démonstration du jeu vedette.
 *
 * Fabriquée pour ce projet : une animation dessinée sur un canvas puis
 * enregistrée. Elle n'est empruntée à personne, aucune licence tierce n'est en
 * jeu. Le champ `hero_video_url` d'un produit la remplace dès qu'une vraie
 * vidéo est disponible.
 */
export const DEMO_FEATURED_VIDEO = "/medias/demo/featured-loop.webm";

/**
 * Ce que le magasin fournira. Tenu à jour à la main : c'est la liste à lui
 * donner quand il demande pourquoi un emplacement reste sur une plaque.
 *
 * **Consoles uniquement** côté atelier : ni téléphone, ni ordinateur, ni
 * tablette n'apparaît sur ce site, donc aucune photo de ce genre n'est
 * attendue.
 */
export const MISSING_ASSETS = [
  { role: "Hero", need: "Composition à plat : console ouverte, manette, composants, tournevis. Fond clair, cadrage net. 5/4, 1600 px." },
  { role: "Plateformes — quatre cartes", need: "PlayStation sur l'établi · Nintendo Switch démontée · Xbox ouverte · consoles rétro en vitrine. 16/10, 1200 px." },
  { role: "Atelier — image d'attente", need: "Plan d'atelier, sert de poster à la vidéo. 16/9, 1920 px." },
  { role: "Atelier — vidéo", need: "MP4 + WebM, 1920×1080, 20 à 40 s, moins de 6 Mo, sans son. À renseigner dans WORKSHOP_VIDEO." },
  { role: "Rayons — trois cartes", need: "Rayon jeux vidéo · rayon consoles · vitrine de figurines de personnages de manga et d'anime. 4/3, 1200 px." },
  { role: "Magasin", need: "Façade ou intérieur, 207 rue de Rome. 4/3, 1600 px." },
  { role: "Produits", need: "Photos à déposer dans la fiche produit du back-office — ce sont elles que la boutique affiche." },
  { role: "Jeux — jaquettes", need: "Rien à fournir : elles viennent d'IGDB." },
] as const;
