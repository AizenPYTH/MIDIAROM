import "server-only";

/**
 * Les visuels de l'accueil.
 *
 * Ce sont ceux du magasin, déposés dans `public/images/home/`. On ne va en
 * chercher aucun ailleurs : le rayon montré doit être le rayon vendu.
 *
 * Un emplacement dont l'entrée vaut `null` affiche la plaque d'attente de la
 * charte — un état prévu, et non un trou. Brancher une photo se fait ici et
 * nulle part ailleurs.
 *
 * Ce qui existe par ailleurs dans le dépôt, non branché sur l'accueil :
 * 13 détourés de consoles sur fond blanc (`public/medias/consoles/`, importés
 * par `npm run photos:consoles`, utilisés par les fiches de réparation) et une
 * photo de la devanture (`public/medias/facade-207-mediarom.webp`, publiée
 * dans la galerie).
 */

/**
 * Les visuels branchés, emplacement par emplacement.
 *
 * Ils forment une campagne : même noir, même blanc, même bleu d'atelier `#0f5ed7`,
 * même lumière d'atelier. `HomeVisual` s'occupe du reste — cadrage sans
 * déformation, chargement différé sauf pour le hero, texte alternatif, repli
 * sur la plaque d'attente si un fichier manque.
 *
 * Les trois affiches de rayon sont livrées en **3/2** et composées : elles
 * portent déjà le nom du rayon et sa phrase. Leur carte est donc dessinée au
 * même rapport, et n'écrit rien par-dessus (`ShopCategories`).
 */
type HomeVisualKey = "hero" | "atelier" | "jeux" | "consoles" | "figurines" | "magasin";

export const HOME_VISUALS: Record<HomeVisualKey, string | null> = {
  /**
   * Cadre carré du hero. Le visuel déposé le 18/09, 1254 × 1254.
   *
   * Il remplace « réparation des consoles.png », qui était en 1372 × 1147 :
   * c'est pour cela que le cadre du hero passe de ce rapport-là au carré, dans
   * `HeroV9`. Le format du cadre suit toujours celui du fichier — c'est la
   * seule façon de n'avoir ni déformation ni recadrage.
   */
  hero: "/images/home/reparation gaming luffy.png",
  /**
   * Cadre 16/9 de « Dans l'atelier ». Sert aussi d'affiche à la vidéo.
   *
   * ⚠︎ **En attente de la vraie photo.** Le fichier livré sous le nom
   * « dasn l'atelier.png » est le même octet pour octet que l'affiche du rayon
   * jeux vidéo (md5 identique) : l'afficher ici montrerait une boutique là où
   * la section promet un atelier. On garde donc la plaque d'attente, qui est
   * un état prévu. Il suffira de remettre un chemin ici quand la photo — ou la
   * vidéo, voir `WORKSHOP_VIDEO` — arrivera.
   */
  atelier: null,
  /** Affiche de rayon 3/2 — jeux vidéo. */
  jeux: "/images/home/jeux video.png",
  /** Affiche de rayon 3/2 — consoles. */
  consoles: "/images/home/consoles.png",
  /** Affiche de rayon 3/2 — figurines manga / anime. */
  figurines: "/images/home/figurines.png",
  /**
   * La devanture, bloc « Le magasin ».
   *
   * Vraie photo du 207 rue de Rome, déjà dans le dépôt et publiée dans la
   * galerie. Elle est en 3/4 : le cadre du bloc étant plus large, le point
   * focal remonte sur l'enseigne plutôt que sur le trottoir.
   */
  magasin: "/medias/facade-207-mediarom.webp",
};

export { PLATFORM_VISUALS } from "@/lib/content/platform-visuals";

/**
 * Où regarder quand le cadre est plus étroit que l'image.
 *
 * Ne concerne plus que le hero et l'atelier : les trois affiches de rayon sont
 * montrées à leur rapport d'origine et la devanture en entier, donc rien n'y
 * est recadré et il n'y a aucun point focal à choisir.
 */
export const HOME_VISUAL_FOCUS = {
  hero: { position: "50% 50%", mobile: "50% 45%" },
  atelier: { position: "50% 50%", mobile: "55% 50%" },
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
  hero: "Une PlayStation 5 avec sa manette DualSense, le jeu Elden Ring et une figurine de Luffy, sur le comptoir du 207 MÉDI@ROM",
  atelier: "L'établi de l'atelier : console ouverte, outillage de précision et pièces détachées",
  jeux: "Boîtiers de jeux PS5 et Nintendo Switch empilés devant une PlayStation 5 et une Switch",
  consoles: "Xbox Series X, PlayStation 5, Nintendo Switch et Steam Deck alignées sur l'établi",
  figurines: "Figurines de Luffy, Son Goku et Tanjiro devant une vitrine de figurines manga",
  magasin: "La devanture du magasin 207 MÉDI@ROM, rue de Rome à Marseille, vitrine de consoles et de jeux",
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
  { role: "Hero", need: "Livré : « reparation gaming luffy.png », carré 1254 px, composition PS5 / Elden Ring / figurine Luffy aux couleurs de l'enseigne." },
  { role: "Plateformes — quatre cartes", need: "Livrées. PlayStation · Nintendo Switch · Xbox · consoles rétro, sur l'établi." },
  { role: "Atelier — image d'attente", need: "Plan d'atelier, sert de poster à la vidéo. 16/9, 1920 px. ⚠︎ Le fichier « dasn l'atelier.png » livré est un doublon de l'affiche « jeux video.png » : l'emplacement attend toujours sa vraie photo." },
  { role: "Atelier — vidéo", need: "MP4 + WebM, 1920×1080, 20 à 40 s, moins de 6 Mo, sans son. À renseigner dans WORKSHOP_VIDEO." },
  { role: "Rayons — trois affiches", need: "Livrées. Rayon jeux vidéo · rayon consoles · vitrine de figurines. 3/2, 1536 px." },
  { role: "Magasin", need: "Livrée : la devanture, `public/medias/facade-207-mediarom.webp`. Une vue de l'intérieur en 4/3, 1600 px, serait un plus." },
  { role: "Produits", need: "Photos à déposer dans la fiche produit du back-office — ce sont elles que la boutique affiche." },
  { role: "Jeux — jaquettes", need: "Une photo par jeu, ajoutée depuis le back-office au moment de créer l'annonce." },
] as const;
