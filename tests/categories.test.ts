import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  CATEGORY_SLUGS,
  DEPRECATED_CATEGORIES,
  PUBLIC_CATEGORIES,
  categoryFromSlug,
  type ProductCategory,
} from "@/lib/shop/status";

/**
 * La nomenclature des rayons.
 *
 * `MANGA` a été ajoutée en croyant que le magasin vendrait des tomes papier.
 * Il ne vend que des **figurines de personnages**, qui sont des `COLLECTIBLE`.
 * PostgreSQL ne sait pas retirer une valeur d'un type énuméré : la valeur
 * survit dans le type, et c'est précisément pour ça qu'il faut un test —
 * une valeur morte qu'on ne surveille pas finit par ressortir dans une liste.
 */

describe("rayons publics", () => {
  it("n'expose jamais une catégorie morte", () => {
    expect(PUBLIC_CATEGORIES).not.toContain("MANGA");
    for (const mort of DEPRECATED_CATEGORIES) expect(PUBLIC_CATEGORIES).not.toContain(mort);
  });

  it("expose les trois rayons du magasin", () => {
    for (const rayon of ["GAME", "CONSOLE", "COLLECTIBLE"] satisfies ProductCategory[]) {
      expect(PUBLIC_CATEGORIES).toContain(rayon);
    }
  });

  it("nomme les figurines par ce qu'elles sont", () => {
    expect(CATEGORY_LABELS.COLLECTIBLE).toBe("Figurines Manga / Anime");
  });

  it("ne parle nulle part de livres ou de tomes", () => {
    for (const rayon of PUBLIC_CATEGORIES) {
      expect(CATEGORY_LABELS[rayon]).not.toMatch(/livre|tome|papier|roman/i);
    }
  });
});

describe("categoryFromSlug", () => {
  it("résout les rayons publics", () => {
    expect(categoryFromSlug("jeux")).toBe("GAME");
    expect(categoryFromSlug("consoles")).toBe("CONSOLE");
    expect(categoryFromSlug("figurines")).toBe("COLLECTIBLE");
  });

  it("renvoie l'ancienne adresse ?cat=manga vers le rayon qui l'a reprise", () => {
    // `/boutique?cat=manga` a été publié : le laisser pointer vers une
    // catégorie interdite donnerait un rayon vide, pas une erreur visible.
    expect(categoryFromSlug("manga")).toBe("COLLECTIBLE");
  });

  it("ne résout jamais vers une catégorie morte", () => {
    for (const slug of Object.values(CATEGORY_SLUGS)) {
      const resolu = categoryFromSlug(slug);
      if (resolu) expect(DEPRECATED_CATEGORIES).not.toContain(resolu);
    }
  });

  it("ignore un slug inconnu", () => {
    expect(categoryFromSlug("chaussettes")).toBeNull();
    expect(categoryFromSlug(undefined)).toBeNull();
  });
});

describe("la base interdit la valeur morte", () => {
  const migration = readFileSync(path.join(__dirname, "../supabase/migrations/20260915000002_figurines_manga.sql"), "utf8");

  it("reclasse les produits qui la portaient", () => {
    expect(migration).toMatch(/update public\.products set category = 'COLLECTIBLE' where category = 'MANGA'/);
  });

  it("pose une contrainte qui empêche de l'employer à nouveau", () => {
    expect(migration).toContain("products_category_not_manga");
    expect(migration).toMatch(/check \(category <> 'MANGA'\)/);
  });

  it("ne réécrit pas la migration déjà appliquée", () => {
    const precedente = readFileSync(path.join(__dirname, "../supabase/migrations/20260915000001_manga.sql"), "utf8");
    expect(precedente).toContain("add value if not exists 'MANGA'");
  });
});

describe("le back-office ne peut pas produire la valeur morte", () => {
  const entities = readFileSync(path.join(__dirname, "../lib/admin/entities.ts"), "utf8");

  it("ne la propose pas dans le formulaire produit", () => {
    expect(entities).not.toMatch(/value: "MANGA"/);
  });

  it("ne l'accepte pas à la validation", () => {
    const enums = entities.match(/z\.enum\(\[[^\]]*"COLLECTIBLE"[^\]]*\]\)/g) ?? [];
    expect(enums.length).toBeGreaterThan(0);
    for (const e of enums) expect(e).not.toContain("MANGA");
  });
});
