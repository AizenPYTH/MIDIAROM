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
 * Les cinq visuels de l'accueil.
 *
 * Ils forment une campagne : même noir, même blanc, même rouge `#d81f26`,
 * même lumière d'atelier. Les brancher se fait ici et nulle part ailleurs —
 * `HomeVisual` s'occupe du reste (recadrage sans déformation, chargement
 * différé sauf pour le hero, texte alternatif).
 *
 * **Tant qu'une entrée vaut `null`, son emplacement affiche la plaque
 * d'attente de la charte.** C'est voulu : un chemin qui pointe vers un fichier
 * absent donne une image cassée en production, ce qui est pire qu'une plaque.
 *
 * Pour les activer : déposer les cinq fichiers dans `public/medias/accueil/`
 * sous exactement ces noms, puis remplacer `null` par le chemin commenté.
 * Format conseillé : WebP, largeur 1600 px, moins de 400 Ko.
 */
export const HOME_VISUALS = {
  /** Cadre 5/4 du hero. PS5, Xbox Series X et Switch sur fond blanc. */
  hero: "/images/home/réparation des consoles.png",
  /**
   * Cadre 16/9 de « Dans l'atelier ». Sert aussi d'affiche à la vidéo.
   *
   * ⚠︎ Le fichier livré est **le même octet pour octet** que celui du rayon
   * jeux vidéo (md5 identique) : la section montre donc une photo de boutique
   * là où elle promet l'atelier. Le chemin est bon — déposer la vraie photo
   * sous ce nom suffit, sans toucher au code.
   */
  atelier: "/images/home/dasn l'atelier.png",
  /** Carte de rayon 4/3 — jeux vidéo. */
  jeux: "/images/home/jeux video.png",
  /** Carte de rayon 4/3 — consoles. */
  consoles: "/images/home/consoles.png",
  /** Carte de rayon 4/3 — figurines manga / anime. */
  figurines: "/images/home/figurines.png",
};

/**
 * Les visuels des cartes de plateforme, section « Votre panne est probablement
 * prise en charge ».
 *
 * Nintendo Switch reste sur la plaque d'attente : son fichier n'est pas encore
 * livré, et mettre la photo d'une autre console à sa place serait pire qu'une
 * plaque. La clé correspond à `Platform.key` dans
 * `components/marketing/home/content.ts`.
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
};

/**
 * Où regarder quand le cadre est plus étroit que l'image.
 *
 * Les cinq visuels sont construits en paysage, avec leur sujet à droite du
 * tiers gauche. Sur un cadre de carte en 4/3, et plus encore sur un téléphone,
 * un recadrage centré coupe donc les consoles ou les figurines en deux. Ces
 * points focaux sont ce qui les garde entières.
 */
export const HOME_VISUAL_FOCUS = {
  hero: { position: "50% 50%", mobile: "50% 45%" },
  atelier: { position: "50% 50%", mobile: "55% 50%" },
  jeux: { position: "62% 50%", mobile: "68% 55%" },
  consoles: { position: "58% 55%", mobile: "62% 58%" },
  figurines: { position: "58% 50%", mobile: "60% 52%" },
} as const;

/**
 * Ce que dit un lecteur d'écran, et ce que voit un moteur de recherche.
 *
 * Écrits à côté des chemins pour qu'ils ne soient pas oubliés le jour où les
 * photos arrivent. Ils décrivent la scène, sans répéter le titre de la section
 * qui les surplombe — un texte alternatif qui redit « Jeux vidéo » juste sous
 * un titre « Jeux vidéo » n'apprend rien à personne.
 */
export const HOME_VISUAL_ALTS = {
  hero: "PlayStation 5, Xbox Series X et Nintendo Switch avec une manette DualSense, sur fond blanc",
  atelier: "L'établi de l'atelier : console ouverte, outillage de précision et pièces détachées",
  jeux: "Boîtiers de jeux PS5 et Nintendo Switch empilés devant une PlayStation 5 et une Switch",
  consoles: "Xbox Series X, PlayStation 5, Nintendo Switch et Steam Deck alignées sur l'établi",
  figurines: "Figurines de Luffy, Son Goku et Tanjiro devant une vitrine de figurines manga",
} as const;

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
  { role: "Jeux — jaquettes", need: "Une photo par jeu, ajoutée depuis le back-office au moment de créer l'annonce." },
] as const;
