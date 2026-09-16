/**
 * Les rayons de la boutique — la liste, et ce qu'on peut en faire.
 *
 * Module **pur** : aucune base de données, aucun `server-only`. Il est lisible
 * par un composant client comme par un test. Les fonctions prennent la liste en
 * paramètre ; c'est `lib/shop/categories.ts` qui va la chercher en base.
 *
 * Pourquoi une liste et non un type énuméré : ouvrir un rayon de plus — des
 * goodies, des cartes à collectionner — demandait jusqu'ici une migration et un
 * déploiement. Le vendeur le fait désormais depuis le back-office. La
 * conséquence pour le code est simple et vaut d'être dite : **plus rien ne doit
 * écrire la liste en dur**, et tout ce qui affiche un rayon doit savoir quoi
 * faire d'un code qu'il ne connaît pas.
 */

export interface Rayon {
  /** Clé technique, celle que `products.category` porte. Ne s'affiche jamais. */
  code: string;
  /** Le nom de la section : « Consoles ». */
  label: string;
  /** Le nom d'un article : « Console ». Pour le coin d'une vignette. */
  short: string;
  /** Segment d'adresse : `/boutique?cat=consoles`. */
  slug: string;
  position: number;
  /** Faux = rayon interne, géré au back-office et invisible en boutique. */
  isPublic: boolean;
}

/**
 * Les cinq rayons livrés avec le magasin.
 *
 * Ils ne sont pas la vérité — la base l'est — mais ils sont le **repli** : si
 * la table n'a pas encore été créée (migration pas encore jouée sur
 * l'environnement), la boutique continue de fonctionner exactement comme avant
 * au lieu d'afficher un magasin sans rayons. Ils servent aussi de valeurs par
 * défaut dans les tests.
 *
 * `ACCESSORY` et `PART` sont internes : l'atelier suit des manettes de
 * remplacement et des pièces détachées, mais MÉDI@ROM n'est pas une boutique
 * d'informatique et ne les met pas en vitrine.
 */
export const RAYONS_PAR_DEFAUT: readonly Rayon[] = [
  { code: "GAME", label: "Jeux vidéo", short: "Jeu", slug: "jeux", position: 10, isPublic: true },
  { code: "CONSOLE", label: "Consoles", short: "Console", slug: "consoles", position: 20, isPublic: true },
  // Les figurines de personnages — One Piece, Naruto, Dragon Ball… — et les
  // collectors de jeu vidéo partagent ce rayon. Le magasin ne vend pas de tomes
  // papier : voir l'alias « manga » plus bas.
  { code: "COLLECTIBLE", label: "Figurines Manga / Anime", short: "Figurine", slug: "figurines", position: 30, isPublic: true },
  { code: "ACCESSORY", label: "Accessoires", short: "Accessoire", slug: "accessoires", position: 40, isPublic: false },
  { code: "PART", label: "Pièces", short: "Pièce", slug: "pieces", position: 50, isPublic: false },
];

/**
 * Anciens slugs qui doivent continuer à mener quelque part.
 *
 * `/boutique?cat=manga` a été publié et indexé : le laisser pointer vers un
 * rayon inexistant donnerait une page vide. Il mène au rayon qui a repris son
 * contenu. Un alias ne s'enlève pas : une adresse publiée est un engagement.
 */
export const ALIAS_SLUGS: Readonly<Record<string, string>> = { manga: "COLLECTIBLE" };

/** La liste, triée comme elle s'affiche. */
export function ordonnes(rayons: readonly Rayon[]): Rayon[] {
  return [...rayons].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "fr"));
}

/** Les rayons montrés au public, dans l'ordre. */
export function rayonsPublics(rayons: readonly Rayon[]): Rayon[] {
  return ordonnes(rayons).filter((r) => r.isPublic);
}

export function rayonDe(rayons: readonly Rayon[], code: string | null | undefined): Rayon | null {
  if (!code) return null;
  return rayons.find((r) => r.code === code) ?? null;
}

/**
 * Le libellé d'un code.
 *
 * Le repli est le code lui-même, jamais une chaîne vide : un rayon supprimé de
 * la liste pendant qu'un produit y pointe encore doit rester identifiable dans
 * le back-office. Mieux vaut lire « GOODIES » que rien.
 */
export function libelleDe(rayons: readonly Rayon[], code: string | null | undefined): string {
  return rayonDe(rayons, code)?.label ?? code ?? "";
}

/** Le libellé au singulier, pour qualifier **un** article. */
export function articleDe(rayons: readonly Rayon[], code: string | null | undefined): string {
  return rayonDe(rayons, code)?.short ?? code ?? "";
}

export function slugDe(rayons: readonly Rayon[], code: string | null | undefined): string {
  return rayonDe(rayons, code)?.slug ?? "";
}

/** Le code d'un slug d'adresse, alias compris. `null` si personne ne le porte. */
export function codeDuSlug(rayons: readonly Rayon[], slug: string | null | undefined): string | null {
  if (!slug) return null;
  const direct = rayons.find((r) => r.slug === slug);
  if (direct) return direct.code;
  const alias = ALIAS_SLUGS[slug];
  return alias && rayons.some((r) => r.code === alias) ? alias : null;
}

/**
 * Le libellé court d'un rayon, pour une barre de navigation.
 *
 * Une entrée de menu se lit d'un coup d'œil et partage sa ligne avec sept
 * autres, la recherche, trois utilitaires et un bouton : « Cartes à
 * collectionner » n'y tient pas. On coupe d'abord sur un séparateur explicite,
 * puis, au-delà de douze caractères, on garde le premier mot — « Figurines
 * Manga / Anime » devient « Figurines », « Cartes à collectionner » devient
 * « Cartes ». Douze et non seize : mesuré à 1440 px, « Figurines Manga »
 * poussait le bouton rouge sur une deuxième ligne pour un visiteur connecté,
 * dont l'entête porte « Mon espace » et non « Compte ». Un premier mot de trois
 * lettres (« Kit », « Les ») n'apprend rien : on en garde deux.
 *
 * Le libellé complet reste celui du pied de page, du fil d'Ariane et du titre
 * de la page de rayon : c'est le menu, et lui seul, qui abrège.
 */
export function courtLabel(label: string): string {
  const tete = label.split(/\s+[—/·]\s+/)[0]?.trim() ?? label;
  if (tete.length <= 12) return tete;
  const mots = tete.split(/\s+/);
  const un = mots[0] ?? tete;
  return un.length >= 4 ? un : mots.slice(0, 2).join(" ");
}

/**
 * Le slug que produirait un libellé.
 *
 * Sert au back-office : le vendeur saisit « Cartes à collectionner », la
 * machine propose « cartes-a-collectionner ». Il reste modifiable — c'est une
 * adresse publique, elle mérite d'être relue.
 */
export function slugifieRayon(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Le code que produirait un libellé.
 *
 * Majuscules, sans accent, souligné comme séparateur — la forme des cinq codes
 * d'origine. Vide ou commençant par un chiffre, on préfixe : la base exige que
 * le code commence par une lettre.
 */
export function codifieRayon(texte: string): string {
  const brut = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  if (!brut) return "";
  return /^[A-Z]/.test(brut) ? brut : `R_${brut}`.slice(0, 32);
}
