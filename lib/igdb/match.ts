import type { Game, GameLookupHints, GameMatch } from "@/lib/igdb/types";

/**
 * Choix du bon jeu pour un produit.
 *
 * Le risque réel n'est pas de ne rien trouver : c'est d'associer « FIFA 23 PS4 »
 * à la fiche PS5, et de vendre une jaquette qui n'est pas celle du produit. La
 * recherche IGDB par nom est volontairement permissive et remonte volontiers
 * les quatre versions d'un même titre ; c'est donc ici que se décide laquelle.
 *
 * Le score se compose ainsi :
 *
 *   nom          0 à 0,60   similarité, après retrait des mentions d'édition
 *   plateforme  −0,50 à 0,30  correspondance exacte, absence, ou contradiction
 *   édition      0 à 0,08   « Remastered », « Deluxe »… présents des deux côtés
 *   année        0 à 0,07   date de sortie proche de celle annoncée
 *
 * Une contradiction de plateforme est une pénalité, pas une élimination : un
 * produit mal saisi ne doit pas devenir introuvable. Mais elle fait tomber
 * sous le seuil, donc l'association passe par une validation humaine.
 */

/** Au-dessus, on peut associer sans demander. En dessous, l'atelier tranche. */
export const AUTO_MATCH_THRESHOLD = 0.82;

/** Mentions d'édition : comparées à part, retirées de la comparaison de noms. */
const EDITION_WORDS = [
  "remastered", "remaster", "remake", "definitive", "deluxe", "ultimate", "complete",
  "goty", "game of the year", "gold", "legacy", "anniversary", "collection",
  "director's cut", "directors cut", "standard", "special", "limited", "edition",
];

/**
 * Plateformes : nos libellés produit → noms IGDB.
 *
 * IGDB nomme « PlayStation 5 », le commerce écrit « PS5 », « PS 5 », « ps5 ».
 * Les deux côtés passent par cette table avant comparaison, ce qui évite de
 * comparer des orthographes.
 */
const PLATFORM_ALIASES: Record<string, string> = {
  ps5: "playstation 5", "playstation 5": "playstation 5", ps5digital: "playstation 5",
  ps4: "playstation 4", "playstation 4": "playstation 4",
  ps3: "playstation 3", "playstation 3": "playstation 3",
  ps2: "playstation 2", "playstation 2": "playstation 2",
  ps1: "playstation", psx: "playstation", playstation: "playstation",
  psvita: "playstation vita", vita: "playstation vita", "playstation vita": "playstation vita",
  psp: "playstation portable", "playstation portable": "playstation portable",
  "xbox series x": "xbox series x|s", "xbox series s": "xbox series x|s",
  "xbox series x|s": "xbox series x|s", "xbox series": "xbox series x|s",
  xsx: "xbox series x|s", xss: "xbox series x|s",
  "xbox one": "xbox one", xone: "xbox one",
  "xbox 360": "xbox 360", x360: "xbox 360",
  xbox: "xbox",
  switch: "nintendo switch", "nintendo switch": "nintendo switch",
  "switch oled": "nintendo switch", "switch lite": "nintendo switch",
  "nintendo switch 2": "nintendo switch 2", switch2: "nintendo switch 2",
  "wii u": "wii u", wii: "wii", "3ds": "nintendo 3ds", "nintendo 3ds": "nintendo 3ds",
  ds: "nintendo ds", "nintendo ds": "nintendo ds",
  gamecube: "nintendo gamecube", ngc: "nintendo gamecube",
  n64: "nintendo 64", "nintendo 64": "nintendo 64",
  gba: "game boy advance", "game boy advance": "game boy advance",
  pc: "pc (microsoft windows)", windows: "pc (microsoft windows)", steam: "pc (microsoft windows)",
};

/** Minuscules, sans accent, sans ponctuation, espaces normalisés. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ramène un libellé de plateforme à sa forme canonique IGDB. */
export function canonicalPlatform(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = normalizeText(value);
  if (!key) return null;
  if (PLATFORM_ALIASES[key]) return PLATFORM_ALIASES[key]!;
  // « PS 5 », « X 360 » : la normalisation a séparé la marque du numéro.
  const compact = key.replace(/\s+/g, "");
  if (PLATFORM_ALIASES[compact]) return PLATFORM_ALIASES[compact]!;
  // « PlayStation 5 Digital Edition » → « playstation 5 » : on retente sur des
  // préfixes de plus en plus courts avant d'abandonner.
  const words = key.split(" ");
  for (let end = words.length - 1; end >= 1; end -= 1) {
    const candidate = words.slice(0, end).join(" ");
    if (PLATFORM_ALIASES[candidate]) return PLATFORM_ALIASES[candidate]!;
  }
  return key;
}

/** Retire les mentions d'édition, pour comparer les titres entre eux. */
function stripEdition(value: string): string {
  let out = ` ${normalizeText(value)} `;
  for (const word of EDITION_WORDS) out = out.replaceAll(` ${word} `, " ");
  return out.replace(/\s+/g, " ").trim();
}

/** Mentions d'édition présentes dans un libellé. */
function editionTokens(value: string): Set<string> {
  const text = ` ${normalizeText(value)} `;
  return new Set(EDITION_WORDS.filter((w) => text.includes(` ${w} `)));
}

/** Distance de Levenshtein, deux lignes seulement (les titres sont courts). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** Similarité 0–1 entre deux titres déjà normalisés. */
export function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Un titre produit porte souvent la plateforme ou l'éditeur en suffixe :
  // l'inclusion vaut mieux qu'une distance qui pénaliserait ces mots en trop.
  if (a.includes(b) || b.includes(a)) return 0.92;
  const distance = levenshtein(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

/** Année de sortie annoncée par le produit, si elle est plausible. */
function hintYear(hints: GameLookupHints): number | null {
  if (hints.releaseYear && hints.releaseYear > 1970 && hints.releaseYear < 2100) return hints.releaseYear;
  return null;
}

/**
 * Note un jeu IGDB face à ce que l'on sait du produit.
 *
 * `exactExternalId` court-circuite tout : quand l'EAN a désigné ce jeu dans la
 * table `external_games` d'IGDB, l'édition et la plateforme sont déjà les
 * bonnes, il n'y a rien à deviner.
 */
export function scoreMatch(game: Game, hints: GameLookupHints, exactExternalId = false): GameMatch {
  if (exactExternalId) {
    return { game, confidence: 1, reasons: ["Code-barres reconnu par IGDB"], isConfident: true };
  }

  const reasons: string[] = [];
  let score = 0;

  const similarity = titleSimilarity(stripEdition(hints.name), stripEdition(game.name));
  score += similarity * 0.6;
  reasons.push(`Titre : ${Math.round(similarity * 100)} % de similarité`);

  const wanted = canonicalPlatform(hints.platform);
  if (!wanted) {
    reasons.push("Plateforme du produit non renseignée : aucun départage possible");
  } else {
    const available = game.platforms.map((p) => canonicalPlatform(p));
    if (available.includes(wanted)) {
      score += 0.3;
      reasons.push(`Plateforme ${hints.platform} présente sur la fiche`);
    } else if (!available.length) {
      reasons.push("Fiche IGDB sans plateforme : aucun départage possible");
    } else {
      // Le cœur du problème : cette fiche existe, mais pas pour cette machine.
      score -= 0.5;
      reasons.push(`Plateforme ${hints.platform} ABSENTE de la fiche (${game.platforms.join(", ")})`);
    }
  }

  const wantedEdition = editionTokens(hints.name + " " + (hints.edition ?? ""));
  if (wantedEdition.size) {
    const found = editionTokens(game.name);
    const common = [...wantedEdition].filter((t) => found.has(t));
    if (common.length) {
      score += 0.08;
      reasons.push(`Édition concordante (${common.join(", ")})`);
    } else {
      reasons.push(`Édition « ${[...wantedEdition].join(", ")} » absente du titre IGDB`);
    }
  }

  const year = hintYear(hints);
  if (year && game.releaseDate) {
    const gap = Math.abs(Number(game.releaseDate.slice(0, 4)) - year);
    if (gap === 0) {
      score += 0.07;
      reasons.push("Année de sortie identique");
    } else if (gap === 1) {
      score += 0.03;
      reasons.push("Année de sortie à un an près");
    } else {
      reasons.push(`Année de sortie éloignée de ${gap} ans`);
    }
  }

  const confidence = Math.min(1, Math.max(0, score));
  return { game, confidence, reasons, isConfident: confidence >= AUTO_MATCH_THRESHOLD };
}

/** Note et trie des candidats, du plus probable au moins probable. */
export function rankMatches(games: Game[], hints: GameLookupHints): GameMatch[] {
  return games.map((g) => scoreMatch(g, hints)).sort((a, b) => b.confidence - a.confidence);
}
