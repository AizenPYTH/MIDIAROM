import type { ExternalProduct } from "@/lib/catalog/providers/types";

/**
 * Tri des résultats d'un catalogue tiers : figurines d'un côté, dérivés de
 * l'autre.
 *
 * Une recherche « luffy » chez HobbyLink Japan rend des figurines, mais aussi
 * des t-shirts, des stickers, des mugs et des bonbons. MÉDI@ROM ne vend que le
 * premier rayon.
 *
 * **Trois verdicts, pas deux.** Une frontière nette entre « figurine » et
 * « pas figurine » se trompe sur les cas réels : une *Mascot Figure* est une
 * figurine, un *Mascot Plush* est une peluche ; un *shokugan* est une vraie
 * figurine vendue avec un bonbon. Un veto sur « mascot » ou « candy » écarterait
 * donc de vrais produits. D'où :
 *
 *   · `figurine` — un mot du métier ou un fabricant de figurines le dit ;
 *   · `doute`    — un signal dans chaque sens, ou aucun. **Gardé et montré**,
 *                  avec la raison du doute ;
 *   · `ecarte`   — un mot d'exclusion, et rien pour le contredire.
 *
 * **Rien n'est supprimé.** Les écartés restent dans les données, consultables
 * et importables en un clic : un filtre qui se trompe sur un produit rare ne
 * doit pas devenir le problème de l'atelier.
 *
 * Les décisions se lisent dans les trois listes ci-dessous, pas dans le code.
 */

export type FigurineVerdict = "figurine" | "doute" | "ecarte";

export interface JudgedProduct {
  product: ExternalProduct;
  verdict: FigurineVerdict;
  /** Pourquoi ce verdict, en une phrase. Null quand le produit est net. */
  reason: string | null;
}

/** Les mots du métier. Leur présence suffit à qualifier une figurine. */
const FIGURINE = [
  "figure", "figures", "figurine", "figuarts", "nendoroid", "nendoroid doll", "figma",
  "pop up parade", "prize figure", "scale figure", "trading figure", "statue", "bust",
  "petit chara", "chibi", "kyun chara", "ichiban kuji", "garage kit", "resin kit",
  "action figure", "pvc figure", "vinyl figure", "sofubi", "soft vinyl",
];

/**
 * Des maisons qui ne font, ou presque, que des figurines. Un fabricant de cette
 * liste rattrape un titre qui ne dit rien.
 */
const FABRICANTS = [
  "good smile", "max factory", "kotobukiya", "megahouse", "banpresto", "bandai spirits",
  "alter", "furyu", "orange rouge", "union creative", "medicom", "kaiyodo", "myethos",
  "aniplex", "bellfine", "hobby max", "estream", "freeing", "phat", "ques q", "quesq",
  "alphamax", "native", "f nex", "fnex", "emontoys", "apex", "wonderful works",
];

/**
 * Ce que MÉDI@ROM ne vend pas.
 *
 * Volontairement précis : `gummy` et `wafer` plutôt que `candy`, qui écarterait
 * les *shokugan* ; pas de `mascot`, qui écarterait les *Mascot Figure* ; pas de
 * `stand` seul, qui écarterait le socle d'une Pop Up Parade.
 */
const EXCLUS = [
  // vêtement
  "t shirt", "tshirt", "tee", "shirt", "hoodie", "parka", "jacket", "cap", "socks",
  "apron", "cosplay", "costume", "wig", "apparel", "slippers",
  // papier, image, plat
  "sticker", "decal", "clear file", "poster", "tapestry", "wall scroll", "postcard",
  "shikishi", "art book", "artbook", "doujinshi", "magazine", "calendar", "notebook",
  "can badge", "pin badge", "bookmark", "acrylic stand", "acrylic charm", "acrylic block",
  "puzzle", "jigsaw", "playing cards", "trading card", "mouse pad", "mousepad",
  // confiserie
  "gummy", "gummies", "wafer", "chocolate", "biscuit", "ramune",
  // maison, accessoire
  "mug", "tumbler", "coaster", "towel", "cushion", "blanket", "bag", "tote", "wallet",
  "pouch", "keychain", "key chain", "key ring", "keyring", "strap", "lanyard",
  "chopsticks", "bento", "lunch box", "phone case", "smartphone",
  // bijou
  "necklace", "earrings", "bracelet", "wristwatch",
  // peluche
  "plush", "plushie", "nuigurumi",
  // accessoires de figurine, qui ne sont pas des figurines
  "figure case", "display case", "replacement parts", "option parts",
];

/**
 * Maquettes à monter. Ce sont des kits, pas des figurines peintes — un autre
 * métier et un autre public. Gardées en doute plutôt qu'écartées : c'est une
 * décision commerciale, pas une erreur de recherche.
 */
const MAQUETTES = [
  "model kit", "plastic model", "gunpla", "master grade", "real grade", "perfect grade",
  "high grade", "entry grade", "full mechanics", "30 minutes missions",
];

/** Minuscules, sans accents, ponctuation réduite à des espaces, bordée d'espaces. */
function normalise(...morceaux: (string | null)[]): string {
  return ` ${morceaux
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Les termes de la liste présents dans le texte, mots entiers. */
function trouve(texte: string, termes: string[]): string[] {
  return termes.filter((t) => texte.includes(` ${t.replace(/[^a-z0-9]+/g, " ")} `));
}

/**
 * Le verdict d'une fiche.
 *
 * Le titre et la catégorie de la source sont lus ensemble : la catégorie est le
 * classement du vendeur lui-même, donc le signal le plus sûr, et le titre
 * rattrape les catalogues qui n'en publient pas.
 */
export function judgeFigurine(product: ExternalProduct): { verdict: FigurineVerdict; reason: string | null } {
  const texte = normalise(product.name, product.category, product.series);
  const fabricant = normalise(product.manufacturer);

  const pour = trouve(texte, FIGURINE);
  const maison = trouve(fabricant, FABRICANTS);
  const contre = trouve(texte, EXCLUS);
  const maquette = trouve(texte, MAQUETTES);

  if (contre.length && !pour.length && !maison.length) {
    return { verdict: "ecarte", reason: `Ce n'est pas une figurine : « ${contre[0]} ».` };
  }
  if (contre.length) {
    return { verdict: "doute", reason: `Contient « ${contre[0]} » mais aussi « ${pour[0] ?? maison[0]} ». À vérifier.` };
  }
  if (maquette.length) {
    return { verdict: "doute", reason: `Maquette à monter (« ${maquette[0]} »), pas une figurine peinte.` };
  }
  if (pour.length || maison.length) return { verdict: "figurine", reason: null };
  return { verdict: "doute", reason: "Ni mot de figurine ni fabricant connu. À vérifier." };
}

/** L'ordre d'affichage : les certaines d'abord, les douteuses ensuite. */
const RANG: Record<FigurineVerdict, number> = { figurine: 0, doute: 1, ecarte: 2 };

/**
 * Sépare une liste de résultats. `kept` est ce que l'écran montre ; `rejected`
 * est conservé tel quel, consultable et importable — jamais jeté.
 */
export function sortFigurines(products: ExternalProduct[]): { kept: JudgedProduct[]; rejected: JudgedProduct[] } {
  const juges = products.map((product) => ({ product, ...judgeFigurine(product) }));
  return {
    kept: juges.filter((j) => j.verdict !== "ecarte").sort((a, b) => RANG[a.verdict] - RANG[b.verdict]),
    rejected: juges.filter((j) => j.verdict === "ecarte"),
  };
}
