import { describe, expect, it } from "vitest";
import { ENTITIES, formDataToObject, type FieldDef } from "@/lib/admin/entities";

/**
 * La fiche d'un article, rayon par rayon.
 *
 * Le formulaire montrait les vingt-huit colonnes de la table à tout le monde :
 * on demandait sa région et son modèle de console lié à une figurine. Les
 * champs sont désormais contextuels, et ce fichier tient les deux promesses qui
 * comptent :
 *
 *   1. chaque rayon ne voit que ses questions ;
 *   2. **masquer une question n'efface jamais la réponse** — un champ écarté
 *      reste posté, sinon enregistrer une figurine viderait en silence des
 *      colonnes qu'on n'avait pas l'intention de toucher.
 */

const produits = ENTITIES.products!;
const champ = (nom: string) => produits.fields.find((f) => f.name === nom)!;
const visible = (f: FieldDef, cat: string) => !f.categories || f.categories.includes(cat);
const libelle = (f: FieldDef, cat: string) => f.labelByCategory?.[cat] ?? f.label;

/** Ce que le formulaire montre pour un rayon donné, sections comprises. */
function champsVisibles(cat: string): FieldDef[] {
  return produits.fields.filter((f) => visible(f, cat));
}

describe("les champs d'un article suivent son rayon", () => {
  it("ne demande à une figurine que ce qui la concerne", () => {
    const noms = champsVisibles("COLLECTIBLE").map((f) => f.name);
    for (const attendu of ["name", "category", "condition", "description", "spec:Personnage", "spec:Fabricant", "edition", "ean", "price_cents", "quantity", "images", "is_active"]) {
      expect(noms, `${attendu} manque pour une figurine`).toContain(attendu);
    }
  });

  it("épargne à une figurine les champs d'une console", () => {
    const noms = champsVisibles("COLLECTIBLE").map((f) => f.name);
    // Région, modèle lié, contenu de boîte, vidéo, rétro : rien de tout cela
    // n'a de sens pour une figurine, et chacun allongeait la page d'une ligne.
    for (const absent of ["model_id", "region", "release_year", "includes", "hero_video_url", "hero_video_poster_path", "is_retro"]) {
      expect(noms, `${absent} ne devrait pas être proposé pour une figurine`).not.toContain(absent);
    }
  });

  it("appelle la plateforme par son nom dans chaque rayon", () => {
    // Une seule colonne pour deux réalités : c'est la ligne affichée au-dessus
    // du nom en boutique. On la renomme, on ne la duplique pas.
    expect(libelle(champ("platform"), "COLLECTIBLE")).toBe("Licence / série");
    expect(libelle(champ("platform"), "GAME")).toBe("Plateforme");
    expect(libelle(champ("platform"), "CONSOLE")).toBe("Plateforme");
    // Et elle reste obligatoire : la boutique l'affiche toujours.
    expect(champ("platform").required).toBe(true);
  });

  it("garde à un jeu et à une console ce qui les identifie", () => {
    const jeu = champsVisibles("GAME").map((f) => f.name);
    for (const attendu of ["platform", "edition", "region", "release_year", "ean", "includes"]) {
      expect(jeu, `${attendu} manque pour un jeu`).toContain(attendu);
    }
    const console = champsVisibles("CONSOLE").map((f) => f.name);
    for (const attendu of ["platform", "model_id", "spec:Stockage", "includes", "region"]) {
      expect(console, `${attendu} manque pour une console`).toContain(attendu);
    }
    expect(console).not.toContain("spec:Personnage");
  });

  it("range la référence et l'adresse de la fiche hors du chemin principal", () => {
    // Personne ne devrait avoir à saisir un SKU : il se fabrique depuis le nom.
    for (const nom of ["sku", "slug"]) {
      expect(champ(nom).advanced, `${nom} devrait être une option avancée`).toBe(true);
      expect(champ(nom).derive, `${nom} devrait se fabriquer tout seul`).toBeTruthy();
    }
    // …mais restent modifiables : un inventaire existant peut l'imposer.
    expect(champ("sku").type).toBe("text");
    expect(champ("slug").type).toBe("slug");
  });

  it("répartit les champs du chemin principal dans les sections annoncées", () => {
    const sections = produits.sections!;
    for (const f of produits.fields.filter((x) => !x.advanced)) {
      expect(sections, `${f.name} n'a pas de section connue`).toContain(f.section);
    }
  });
});

describe("masquer une question n'efface pas la réponse", () => {
  /** Ce que poste le formulaire d'une figurine : les champs écartés voyagent cachés. */
  function posteFigurine(existant: Record<string, unknown>): FormData {
    const fd = new FormData();
    fd.set("name", "Monkey D. Luffy — Gear 5");
    fd.set("category", "COLLECTIBLE");
    fd.set("condition", "NEW");
    fd.set("platform", "One Piece");
    fd.set("sku", "FIG-0001");
    fd.set("slug", "figurine-luffy");
    fd.set("price_cents", "89.99");
    fd.set("quantity", "3");
    fd.set("spec:Personnage", "Monkey D. Luffy");
    fd.set("spec:Fabricant", "Banpresto");
    // Les champs hors rayon, tels que le composant les poste en caché.
    fd.set("region", String(existant.region ?? ""));
    fd.set("includes", (existant.includes as string[] | undefined)?.join("\n") ?? "");
    fd.set("hero_video_url", String(existant.hero_video_url ?? ""));
    fd.set("specs", JSON.stringify(existant.specs ?? {}));
    for (const p of (existant.images as string[] | undefined) ?? []) fd.append("images", p);
    return fd;
  }

  it("conserve région, contenu et vidéo d'un article déjà rempli", () => {
    const existant = { region: "PAL", includes: ["Socle", "Boîte d'origine"], hero_video_url: "https://exemple.test/v.mp4", images: [], specs: {} };
    const out = formDataToObject(produits, posteFigurine(existant));
    expect(out.region).toBe("PAL");
    expect(out.includes).toEqual(["Socle", "Boîte d'origine"]);
    expect(out.hero_video_url).toBe("https://exemple.test/v.mp4");
  });

  it("garde les photos dans l'ordre où le sélecteur les a laissées", () => {
    // Le premier chemin est la vignette du rayon : l'ordre est une décision de
    // l'utilisateur, pas un détail de sérialisation.
    const out = formDataToObject(produits, posteFigurine({ images: ["produits/b.jpg", "produits/a.jpg"] }));
    expect(out.images).toEqual(["produits/b.jpg", "produits/a.jpg"]);
  });
});

describe("les champs nommés écrivent dans les caractéristiques", () => {
  it("fond « Personnage » et « Fabricant » dans specs sans toucher au reste", () => {
    const out = formDataToObject(produits, (() => {
      const fd = new FormData();
      fd.set("specs", JSON.stringify({ Hauteur: "25 cm" }));
      fd.set("spec:Personnage", "Son Goku");
      fd.set("spec:Fabricant", "Bandai");
      return fd;
    })());
    expect(out.specs).toEqual({ Hauteur: "25 cm", Personnage: "Son Goku", Fabricant: "Bandai" });
  });

  it("retire une clé qu'on a vidée plutôt que d'afficher une ligne blanche", () => {
    const out = formDataToObject(produits, (() => {
      const fd = new FormData();
      fd.set("specs", JSON.stringify({ Personnage: "Son Goku", Hauteur: "25 cm" }));
      fd.set("spec:Personnage", "   ");
      return fd;
    })());
    expect(out.specs).toEqual({ Hauteur: "25 cm" });
  });

  it("ne touche pas à une clé dont le champ n'était pas à l'écran", () => {
    // « Stockage » n'existe que pour une console : sur une figurine, le champ
    // n'est pas posté, et la clé doit survivre telle quelle.
    const out = formDataToObject(produits, (() => {
      const fd = new FormData();
      fd.set("specs", JSON.stringify({ Stockage: "1 To" }));
      return fd;
    })());
    expect(out.specs).toEqual({ Stockage: "1 To" });
  });
});
