/**
 * Ce que le client voit d'abord, et ce qui attend derrière « Autre problème ».
 *
 * Module **pur** : aucune base de données, aucun `server-only`. Il travaille
 * sur la forme minimale d'une prestation, ce qui le rend lisible aussi bien par
 * la fiche de réparation (composant client) que par l'accueil (rendu serveur)
 * et par un test.
 *
 * Le catalogue de l'atelier compte plus de mille prestations — jusqu'à
 * quatre-vingt-neuf pour une seule console. C'est la bonne granularité pour un
 * réparateur qui saisit un dossier ; c'est un mur pour quelqu'un dont la
 * console ne s'allume plus.
 *
 * On en montre **cinq**, celles que le back-office met en avant pour ce modèle.
 * Le reste ne devient pas un second écran : ce qui n'est pas dans les cinq
 * passe par « Autre problème », où le client décrit sa panne et joint des
 * photos. La couverture des cas rares se fait par la description, jamais par
 * l'allongement de la liste.
 */

/** Le strict nécessaire pour trier une prestation. Le reste ne nous regarde pas. */
export interface PrestationClassable {
  id: string;
  /** Mise en avant au back-office (`repairs.is_featured`). */
  isFeatured?: boolean;
  /** Rang dans la liste courte (`repairs.featured_order`). */
  featuredOrder?: number;
  /** Nom de la famille de pannes, quand la prestation en a une. */
  categoryName?: string | null;
  categoryOrder?: number;
  displayOrder?: number;
  name?: string;
}

/**
 * Le plafond de la liste courte.
 *
 * Cinq. C'est ce qu'un œil embrasse sans lire — au-delà, on parcourt, et
 * parcourir une liste de pannes quand sa console vient de mourir est
 * exactement l'épreuve qu'on veut épargner. Le sixième cas n'est pas perdu
 * pour autant : il a sa porte, « Autre problème », et elle mène à quelqu'un
 * plutôt qu'à une liste.
 *
 * C'est aussi le plafond que pose la migration en amorçant la sélection.
 */
export const MAX_LISTE_COURTE = 5;

function rang(p: PrestationClassable): number {
  return p.featuredOrder ?? 0;
}

/**
 * Les prestations mises en avant, dans l'ordre choisi au back-office.
 *
 * **Le repli n'est pas décoratif.** Les colonnes `is_featured` /
 * `featured_order` arrivent par une migration appliquée à la main sur Supabase,
 * et le code peut être déployé avant : si aucune prestation n'est mise en avant
 * — migration pas encore jouée, ou vendeur ayant tout décoché — on rend une
 * tête de liste raisonnable plutôt qu'un écran vide. Une prestation par famille
 * de pannes, dans l'ordre des familles : c'est exactement la promesse « un
 * problème, une ligne », obtenue sans donnée supplémentaire.
 *
 * Le jour où la migration passe, la liste devient celle du vendeur, sans
 * redéploiement.
 */
export function listeCourte<T extends PrestationClassable>(prestations: readonly T[]): T[] {
  const misesEnAvant = prestations.filter((p) => p.isFeatured);
  if (misesEnAvant.length) {
    return [...misesEnAvant].sort((a, b) => rang(a) - rang(b) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.name ?? "").localeCompare(b.name ?? "", "fr")).slice(0, MAX_LISTE_COURTE);
  }

  const parFamille = new Map<string, T>();
  for (const p of [...prestations].sort((a, b) => (a.categoryOrder ?? 999) - (b.categoryOrder ?? 999) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0))) {
    const famille = p.categoryName ?? "";
    if (!parFamille.has(famille)) parFamille.set(famille, p);
  }
  return [...parFamille.values()].slice(0, MAX_LISTE_COURTE);
}

/**
 * Tout le reste, dans l'ordre du catalogue.
 *
 * Ce n'est pas un fond de tiroir : ce sont les prestations que l'atelier
 * réalise vraiment et que le client atteint en un geste. Rien n'est retiré du
 * catalogue pour alléger la vitrine.
 */
export function listeLongue<T extends PrestationClassable>(prestations: readonly T[], courte: readonly T[]): T[] {
  const vus = new Set(courte.map((p) => p.id));
  return prestations.filter((p) => !vus.has(p.id));
}
