import { describe, expect, it } from "vitest";
import {
  ALIAS_SLUGS,
  RAYONS_PAR_DEFAUT,
  articleDe,
  codeDuSlug,
  codifieRayon,
  courtLabel,
  libelleDe,
  ordonnes,
  rayonsPublics,
  slugDe,
  slugifieRayon,
  type Rayon,
} from "@/lib/shop/rayons";

/**
 * Les rayons sont désormais une donnée que le vendeur modifie.
 *
 * Ces tests protègent les deux choses qui casseraient le magasin s'il s'y
 * trompait : les adresses déjà publiées doivent continuer de mener quelque
 * part, et un rayon inconnu ne doit jamais faire disparaître un libellé.
 */

const NOUVEAU: Rayon = { code: "GOODIES", label: "Goodies et porte-clés", short: "Goodie", slug: "goodies", position: 25, isPublic: true };

describe("les rayons livrés par défaut", () => {
  it("reprennent exactement les cinq rayons d'origine, codes et slugs compris", () => {
    expect(RAYONS_PAR_DEFAUT.map((r) => r.code)).toEqual(["GAME", "CONSOLE", "COLLECTIBLE", "ACCESSORY", "PART"]);
    expect(slugDe(RAYONS_PAR_DEFAUT, "GAME")).toBe("jeux");
    expect(slugDe(RAYONS_PAR_DEFAUT, "CONSOLE")).toBe("consoles");
    expect(slugDe(RAYONS_PAR_DEFAUT, "COLLECTIBLE")).toBe("figurines");
  });

  it("ne mettent en vitrine que les trois rayons de vente", () => {
    expect(rayonsPublics(RAYONS_PAR_DEFAUT).map((r) => r.code)).toEqual(["GAME", "CONSOLE", "COLLECTIBLE"]);
  });

  it("ne promettent pas de tomes papier : le magasin ne vend que des figurines", () => {
    for (const r of rayonsPublics(RAYONS_PAR_DEFAUT)) {
      expect(r.label).not.toMatch(/livre|tome|papier|roman/i);
    }
  });

  it("n'ont ni code ni slug en double", () => {
    expect(new Set(RAYONS_PAR_DEFAUT.map((r) => r.code)).size).toBe(RAYONS_PAR_DEFAUT.length);
    expect(new Set(RAYONS_PAR_DEFAUT.map((r) => r.slug)).size).toBe(RAYONS_PAR_DEFAUT.length);
  });
});

describe("résolution d'un slug d'adresse", () => {
  it("retrouve le rayon des trois adresses publiées", () => {
    expect(codeDuSlug(RAYONS_PAR_DEFAUT, "jeux")).toBe("GAME");
    expect(codeDuSlug(RAYONS_PAR_DEFAUT, "consoles")).toBe("CONSOLE");
    expect(codeDuSlug(RAYONS_PAR_DEFAUT, "figurines")).toBe("COLLECTIBLE");
  });

  it("garde l'ancienne adresse /boutique?cat=manga vivante", () => {
    expect(ALIAS_SLUGS.manga).toBe("COLLECTIBLE");
    expect(codeDuSlug(RAYONS_PAR_DEFAUT, "manga")).toBe("COLLECTIBLE");
  });

  it("résout un rayon créé après coup, sans rien redéployer", () => {
    expect(codeDuSlug([...RAYONS_PAR_DEFAUT, NOUVEAU], "goodies")).toBe("GOODIES");
  });

  it("ne résout pas un alias dont le rayon cible a disparu", () => {
    const sansFigurines = RAYONS_PAR_DEFAUT.filter((r) => r.code !== "COLLECTIBLE");
    expect(codeDuSlug(sansFigurines, "manga")).toBeNull();
  });

  it("renvoie null sur une adresse inconnue ou vide", () => {
    expect(codeDuSlug(RAYONS_PAR_DEFAUT, "chaussettes")).toBeNull();
    expect(codeDuSlug(RAYONS_PAR_DEFAUT, undefined)).toBeNull();
  });
});

describe("libellés", () => {
  it("donnent la section au pluriel et l'article au singulier", () => {
    expect(libelleDe(RAYONS_PAR_DEFAUT, "CONSOLE")).toBe("Consoles");
    expect(articleDe(RAYONS_PAR_DEFAUT, "CONSOLE")).toBe("Console");
  });

  it("se rabattent sur le code plutôt que sur le vide quand le rayon a disparu", () => {
    // Un produit peut pointer vers un rayon retiré de la liste : au
    // back-office, lire « GOODIES » vaut mieux que lire une case vide.
    expect(libelleDe(RAYONS_PAR_DEFAUT, "GOODIES")).toBe("GOODIES");
    expect(slugDe(RAYONS_PAR_DEFAUT, "GOODIES")).toBe("");
  });
});

describe("ordre d'affichage", () => {
  it("suit la position, puis le nom à position égale", () => {
    const melange: Rayon[] = [
      { code: "B", label: "Bravo", short: "B", slug: "b", position: 10, isPublic: true },
      { code: "A", label: "Alpha", short: "A", slug: "a", position: 10, isPublic: true },
      { code: "C", label: "Charlie", short: "C", slug: "c", position: 5, isPublic: true },
    ];
    expect(ordonnes(melange).map((r) => r.code)).toEqual(["C", "A", "B"]);
  });

  it("insère un rayon nouveau à sa place, pas à la fin", () => {
    expect(rayonsPublics([...RAYONS_PAR_DEFAUT, NOUVEAU]).map((r) => r.code)).toEqual(["GAME", "CONSOLE", "GOODIES", "COLLECTIBLE"]);
  });
});

describe("ce que la saisie propose au vendeur", () => {
  it("fabrique un slug lisible à partir d'un nom accentué", () => {
    expect(slugifieRayon("Cartes à collectionner")).toBe("cartes-a-collectionner");
    expect(slugifieRayon("  Goodies & porte-clés  ")).toBe("goodies-porte-cles");
  });

  it("fabrique un code conforme à ce que la base accepte", () => {
    expect(codifieRayon("Cartes à collectionner")).toBe("CARTES_A_COLLECTIONNER");
    // La base exige une première lettre : un nom qui commence par un chiffre
    // est préfixé plutôt que refusé.
    expect(codifieRayon("2e main")).toBe("R_2E_MAIN");
    expect(codifieRayon("   ")).toBe("");
  });

  it("ne produit jamais un code trop long pour la colonne", () => {
    expect(codifieRayon("Un nom de rayon absolument interminable pour tester la troncature").length).toBeLessThanOrEqual(32);
  });
});

describe("le libellé court de la barre de navigation", () => {
  const court = courtLabel;

  it("laisse les libellés courts intacts", () => {
    expect(court("Jeux vidéo")).toBe("Jeux vidéo");
    expect(court("Consoles")).toBe("Consoles");
  });

  it("coupe sur le séparateur avant de couper sur les mots", () => {
    expect(court("Figurines Manga / Anime")).toBe("Figurines Manga");
  });

  it("ramène un rayon au nom long à son premier mot", () => {
    expect(court("Cartes à collectionner")).toBe("Cartes");
    expect(court("Goodies et porte-clés")).toBe("Goodies");
  });

  it("garde deux mots quand le premier n'apprend rien", () => {
    expect(court("Kit de remplacement complet")).toBe("Kit de");
  });
});
