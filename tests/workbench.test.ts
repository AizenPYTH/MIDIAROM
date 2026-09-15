import { describe, expect, it } from "vitest";
import { depuis, EN_COURS, joursDepuis, ORDRE, REGISTRES, registreOf } from "@/lib/admin/workbench";

/**
 * Le regroupement des statuts.
 *
 * C'est la seule pièce de l'écran de travail qui décide de quelque chose. Si un
 * statut tombe dans deux registres, la réparation apparaît deux fois et les
 * compteurs ne totalisent plus ; s'il n'en a aucun, elle disparaît de la liste
 * sans que personne s'en aperçoive.
 */

describe("registres de l'atelier", () => {
  it("ne classe jamais un statut dans deux registres", () => {
    const vus = new Set<string>();
    for (const r of ORDRE) {
      for (const s of REGISTRES[r].statuses) {
        expect(vus.has(s), `${s} apparaît deux fois`).toBe(false);
        vus.add(s);
      }
    }
  });

  it("retrouve le registre d'un statut, et seulement s'il est en cours", () => {
    expect(registreOf("DIAGNOSIS")).toBe("diag");
    expect(registreOf("WAITING_CUSTOMER_APPROVAL")).toBe("attente");
    expect(registreOf("REPAIRING")).toBe("atelier");
    expect(registreOf("READY_TO_SHIP")).toBe("prete");
    // Terminé ou abandonné : plus rien à faire, donc plus dans la liste.
    for (const s of ["DELIVERED", "COMPLETED", "CANCELLED", "SHIPPED"] as const) {
      expect(registreOf(s), s).toBeNull();
    }
  });

  it("garde « en cours » synchrone avec les registres", () => {
    expect(EN_COURS.length).toBe(ORDRE.reduce((n, r) => n + REGISTRES[r].statuses.length, 0));
    for (const s of EN_COURS) expect(registreOf(s)).not.toBeNull();
  });

  it("donne à chaque registre son action propre, jamais la même flèche", () => {
    const actions = ORDRE.map((r) => REGISTRES[r].action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});

describe("ancienneté d'un devis", () => {
  const T = Date.parse("2026-09-15T12:00:00Z");

  it("compte en jours pleins, sans arrondir vers le haut", () => {
    expect(joursDepuis("2026-09-15T08:00:00Z", T)).toBe(0);
    expect(joursDepuis("2026-09-14T08:00:00Z", T)).toBe(1);
    expect(joursDepuis("2026-09-11T13:00:00Z", T)).toBe(3);
  });

  it("ne rend pas de négatif ni de NaN", () => {
    expect(joursDepuis("2026-09-20T00:00:00Z", T)).toBe(0);
    expect(joursDepuis(null)).toBeNull();
    expect(joursDepuis("pas une date")).toBeNull();
  });

  it("se dit en français", () => {
    expect(depuis(0)).toBe("aujourd'hui");
    expect(depuis(1)).toBe("hier");
    expect(depuis(4)).toBe("il y a 4 jours");
    expect(depuis(null)).toBe("");
  });
});
