/**
 * Le vocabulaire IGDB, en français.
 *
 * IGDB ne sert que de l'anglais : genres, modes, et des résumés rédigés par sa
 * communauté. Le site est en français, du premier au dernier mot. On traduit
 * donc ce qui est traduisible — un vocabulaire fermé, court, vérifiable — et on
 * **n'affiche pas** les résumés anglais plutôt que d'en inventer une traduction
 * ou, pire, un texte promotionnel qu'aucune source n'aurait écrit.
 *
 * Les titres des jeux restent tels quels : ce sont des noms commerciaux
 * déposés, pas du texte à traduire. « The Legend of Zelda » ne devient pas
 * « La Légende de Zelda » sur une jaquette française.
 */

/** Genres IGDB → genres français. Liste fermée : ce sont les seuls qu'IGDB émet. */
const GENRES: Record<string, string> = {
  "Point-and-click": "Pointer-et-cliquer",
  Fighting: "Combat",
  Shooter: "Tir",
  Music: "Musique",
  Platform: "Plateforme",
  Puzzle: "Réflexion",
  Racing: "Course",
  "Real Time Strategy (RTS)": "Stratégie temps réel",
  "Role-playing (RPG)": "Jeu de rôle",
  Simulator: "Simulation",
  Sport: "Sport",
  Strategy: "Stratégie",
  "Turn-based strategy (TBS)": "Stratégie au tour par tour",
  Tactical: "Tactique",
  "Hack and slash/Beat 'em up": "Action-baston",
  "Quiz/Trivia": "Quiz",
  Pinball: "Flipper",
  Adventure: "Aventure",
  Indie: "Indépendant",
  Arcade: "Arcade",
  "Visual Novel": "Roman visuel",
  "Card & Board Game": "Cartes et plateau",
  MOBA: "MOBA",
};

/**
 * Traduit un genre IGDB. Un genre inconnu est **écarté** plutôt qu'affiché en
 * anglais : mieux vaut une ligne plus courte qu'un mot étranger au milieu.
 */
export function genreFr(genre: string): string | null {
  return GENRES[genre] ?? null;
}

/** Les genres d'une fiche, traduits, dans l'ordre, sans les inconnus. */
export function genresFr(genres: string[], limit = 2): string[] {
  return genres.map(genreFr).filter((g): g is string => g !== null).slice(0, limit);
}

/**
 * Plateformes IGDB → nom court d'usage courant en français.
 *
 * IGDB écrit « PC (Microsoft Windows) » ou « Nintendo Switch 2 » ; le rayon dit
 * « PC » et « Switch 2 ». Une plateforme non listée garde son nom : ce sont des
 * marques, elles ne se traduisent pas.
 */
const PLATFORMS: Record<string, string> = {
  "PC (Microsoft Windows)": "PC",
  "PlayStation 5": "PlayStation 5",
  "PlayStation 4": "PlayStation 4",
  "PlayStation 3": "PlayStation 3",
  "Xbox Series X|S": "Xbox Series X|S",
  "Xbox One": "Xbox One",
  "Nintendo Switch": "Nintendo Switch",
  "Nintendo Switch 2": "Nintendo Switch 2",
  "Nintendo 3DS": "Nintendo 3DS",
  "Wii U": "Wii U",
  Mac: "Mac",
  Linux: "Linux",
};

export function platformFr(platform: string): string {
  return PLATFORMS[platform] ?? platform;
}

/** L'année d'une date ISO, ou null. Le rayon annonce une année, pas un jour. */
export function yearOf(iso: string | null): string | null {
  if (!iso) return null;
  const year = iso.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}
