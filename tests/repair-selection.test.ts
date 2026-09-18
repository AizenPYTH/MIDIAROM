import { describe, expect, it } from "vitest";
import { MAX_LISTE_COURTE, listeCourte, listeLongue, type PrestationClassable } from "@/lib/repair/selection";

/**
 * Ce que le client voit d'abord.
 *
 * Le catalogue de l'atelier compte 1 189 prestations, jusqu'à quatre-vingt-neuf
 * pour une seule console. Ces tests protègent les deux promesses du parcours
 * simplifié : on n'en montre jamais plus de neuf d'emblée, et **aucune** ne
 * disparaît — ce qui n'est pas mis en avant se retrouve derrière « Autre
 * problème », à un geste.
 */

const p = (id: string, extra: Partial<PrestationClassable> = {}): PrestationClassable => ({ id, name: id, ...extra });

const CATALOGUE: PrestationClassable[] = [
  p("hdmi", { isFeatured: true, featuredOrder: 1, categoryName: "Image & HDMI", categoryOrder: 10 }),
  p("hdmi-tmds", { categoryName: "Image & HDMI", categoryOrder: 10, displayOrder: 2 }),
  p("hdmi-ic", { categoryName: "Image & HDMI", categoryOrder: 10, displayOrder: 3 }),
  p("allumage", { isFeatured: true, featuredOrder: 2, categoryName: "Allumage", categoryOrder: 20 }),
  p("court-circuit", { categoryName: "Allumage", categoryOrder: 20, displayOrder: 2 }),
  p("surchauffe", { isFeatured: true, featuredOrder: 3, categoryName: "Refroidissement", categoryOrder: 30 }),
];

describe("la liste courte", () => {
  it("rend les prestations mises en avant, dans l'ordre du back-office", () => {
    expect(listeCourte(CATALOGUE).map((r) => r.id)).toEqual(["hdmi", "allumage", "surchauffe"]);
  });

  it("suit un ordre réarrangé au back-office, pas l'ordre du catalogue", () => {
    const inverse = CATALOGUE.map((r) => (r.isFeatured ? { ...r, featuredOrder: 10 - (r.featuredOrder ?? 0) } : r));
    expect(listeCourte(inverse).map((r) => r.id)).toEqual(["surchauffe", "allumage", "hdmi"]);
  });

  it("ne déborde jamais du plafond, quoi que coche le vendeur", () => {
    const trop = Array.from({ length: MAX_LISTE_COURTE + 12 }, (_, i) => p(`r${i}`, { isFeatured: true, featuredOrder: i + 1 }));
    expect(listeCourte(trop)).toHaveLength(MAX_LISTE_COURTE);
  });

  it("départage les ex æquo par l'ordre du catalogue, puis par le nom", () => {
    const exaequo = [
      p("b", { isFeatured: true, featuredOrder: 1, displayOrder: 5 }),
      p("a", { isFeatured: true, featuredOrder: 1, displayOrder: 5 }),
      p("c", { isFeatured: true, featuredOrder: 1, displayOrder: 1 }),
    ];
    expect(listeCourte(exaequo).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

describe("le repli, quand rien n'est mis en avant", () => {
  // La migration `repairs_featured` s'applique à la main sur Supabase, et le
  // code peut tourner avant elle. Un écran vide serait le pire des deux mondes.
  const sansMiseEnAvant = CATALOGUE.map(({ isFeatured: _i, featuredOrder: _f, ...reste }) => reste);

  it("propose une prestation par famille de pannes, dans l'ordre des familles", () => {
    expect(listeCourte(sansMiseEnAvant).map((r) => r.id)).toEqual(["hdmi", "allumage", "surchauffe"]);
  });

  it("ne rend pas trois variantes de la même famille", () => {
    const familles = listeCourte(sansMiseEnAvant).map((r) => r.categoryName);
    expect(new Set(familles).size).toBe(familles.length);
  });

  it("tient debout sur un catalogue sans famille du tout", () => {
    const nues = [p("a"), p("b")];
    expect(listeCourte(nues).map((r) => r.id)).toEqual(["a"]);
  });

  it("ne rend rien pour un modèle sans prestation", () => {
    expect(listeCourte([])).toEqual([]);
  });
});

describe("ce qui attend derrière « Autre problème »", () => {
  it("garde tout le reste du catalogue, sans exception", () => {
    const courte = listeCourte(CATALOGUE);
    const longue = listeLongue(CATALOGUE, courte);
    // La règle qui compte : simplifier la vitrine ne retire rien du catalogue.
    expect(courte.length + longue.length).toBe(CATALOGUE.length);
    expect(longue.map((r) => r.id)).toEqual(["hdmi-tmds", "hdmi-ic", "court-circuit"]);
  });

  it("ne répète pas ce qui est déjà proposé d'emblée", () => {
    const courte = listeCourte(CATALOGUE);
    const longue = listeLongue(CATALOGUE, courte);
    for (const r of longue) expect(courte.some((c) => c.id === r.id)).toBe(false);
  });

  it("est vide quand tout le catalogue du modèle tient dans la liste courte", () => {
    const petit = [p("a", { isFeatured: true, featuredOrder: 1 }), p("b", { isFeatured: true, featuredOrder: 2 })];
    expect(listeLongue(petit, listeCourte(petit))).toEqual([]);
  });
});
