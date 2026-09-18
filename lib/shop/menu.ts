/**
 * Ce qu'un rayon montre quand on le survole dans l'en-tête.
 *
 * Module **pur** : aucune base de données, aucun `server-only`. Il reçoit la
 * liste des rayons, les valeurs du catalogue et les compteurs ; il rend le
 * contenu du volet. C'est `app/(marketing)/layout.tsx` qui va chercher les
 * données et `components/marketing/header.tsx` qui les dessine.
 *
 * Pourquoi ici plutôt que dans l'en-tête : l'en-tête est un composant serveur
 * qui importe un module client ; ce qu'il contient ne se teste pas seul. Les
 * règles ci-dessous — combien d'entrées, dans quel ordre, avec quel mot — sont
 * celles qui peuvent se dégrader sans que rien ne casse, et elles ont donc leur
 * banc d'essai (`tests/menu.test.ts`).
 */

import { ROUTES } from "@/config/site";
import { courtLabel, motDuTag, type Rayon } from "@/lib/shop/rayons";

/**
 * Combien d'entrées un volet montre avant de renvoyer au rayon.
 *
 * Huit. Un menu qui déroulerait quarante licences n'abrège plus rien : il refait
 * la page qu'il est censé remplacer. Mais couper à six retirait les deux Xbox du
 * rayon « Consoles », qui en compte huit — le magasin en vend, et son menu n'en
 * montrait aucune. Huit tient en trois cents pixels et laisse de la marge avant
 * que la troncature ne morde.
 */
export const MAX_VOLET = 8;

/** Une valeur de `products.platform` employée dans un rayon, et son volume. */
export interface TagRayon {
  rayon: string;
  valeur: string;
  nombre: number;
}

export interface VoletRayon {
  /** Ce que la colonne annonce : « plateformes », « licences ». */
  intitule: string;
  liens: { href: string; label: string }[];
  /** Le lien du bas, vers le rayon entier. */
  plus: { href: string; label: string };
}

/**
 * Le lien du bas de chaque volet.
 *
 * Deux mots, les mêmes partout. Il a d'abord porté le compte du rayon — « Voir
 * les 9 consoles » — ce qui était juste et se mettait à jour tout seul, mais
 * n'aurait plus rien voulu dire avec trois cents références : personne ne
 * clique sur « Voir les 312 jeux vidéo » pour savoir ce qu'il y a derrière. Le
 * volet montre déjà ce qui compte ; ce lien dit seulement qu'il y a la suite.
 */
export const LIBELLE_PLUS = "Voir plus";

export interface EntreeRayon {
  href: string;
  label: string;
  volet?: VoletRayon;
}

/**
 * Les entrées de rayon de la barre de navigation, volet compris.
 *
 * Le volet montre ce que le rayon contient vraiment : « Consoles » déplie les
 * consoles en vente, « Jeux vidéo » leurs plateformes, « Figurines » leurs
 * licences. C'est la même colonne `products.platform` dans les trois cas, et
 * c'est le rayon qui dit comment elle s'appelle chez lui (`tagLabel`) — la
 * confondre donnait un menu « plateformes » qui proposait « One Piece ».
 *
 * Les mieux fournies d'abord : à huit places, autant montrer ce que le magasin
 * a réellement en rayon plutôt que le début de l'alphabet. À volume égal,
 * l'ordre alphabétique départage, pour que le menu ne bouge pas d'une visite à
 * l'autre.
 *
 * Un rayon sans article n'ouvre pas de volet vide : il reste un lien simple.
 */
export function entreesDesRayons(rayons: readonly Rayon[], tags: readonly TagRayon[]): EntreeRayon[] {
  return rayons.map((r) => {
    const href = `${ROUTES.shop}?cat=${r.slug}`;
    const siens = tags.filter((t) => t.rayon === r.code).sort((a, b) => b.nombre - a.nombre || a.valeur.localeCompare(b.valeur, "fr"));
    return {
      href,
      label: courtLabel(r.label),
      volet: siens.length
        ? {
            intitule: `${motDuTag(rayons, r.code)}s`,
            liens: siens.slice(0, MAX_VOLET).map((t) => ({ href: `${href}&plateforme=${encodeURIComponent(t.valeur)}`, label: t.valeur })),
            plus: { href, label: LIBELLE_PLUS },
          }
        : undefined,
    };
  });
}
