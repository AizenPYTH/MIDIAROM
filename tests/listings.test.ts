import { describe, expect, it } from "vitest";
import { buildSku, priceToCents } from "@/lib/catalog/listing";

/**
 * Créer une annonce en six champs.
 *
 * Les deux seules choses que cette action fabrique à la place de l'utilisateur
 * — le montant et la référence — sont aussi les deux seules qui peuvent se
 * tromper en silence. Un prix mal lu passe en base sans erreur, et une
 * référence non unique casse la création du deuxième article de la journée.
 */

describe("prix saisi à la main", () => {
  it("accepte les deux façons d'écrire un montant en français", () => {
    expect(priceToCents("49,90")).toBe(4990);
    expect(priceToCents("49.90")).toBe(4990);
    expect(priceToCents("49")).toBe(4900);
    expect(priceToCents(" 129,50 €")).toBe(12950);
    expect(priceToCents("0")).toBe(0);
  });

  it("refuse ce qui n'est pas un montant plutôt que d'en inventer un", () => {
    // `Number("")` vaut 0 et `parseFloat("12abc")` vaut 12 : deux pièges qui
    // enregistrent un prix faux sans rien signaler.
    for (const saisie of ["", "gratuit", "12abc", "-5", "49,999", "1,2,3"]) {
      expect(priceToCents(saisie), saisie).toBeNull();
    }
  });
});

describe("référence fabriquée", () => {
  it("porte le rayon, la date et le nom", () => {
    const sku = buildSku("COLLECTIBLE", "Figurine Luffy Gear 5");
    expect(sku).toMatch(/^FIG-\d{6}-FIGURI-[A-Z0-9]{4}$/);
    expect(buildSku("GAME", "EA Sports FC 26")).toMatch(/^JEU-/);
    expect(buildSku("CONSOLE", "PS5 Slim")).toMatch(/^CON-/);
  });

  it("ne se répète pas pour deux articles du même nom", () => {
    const refs = new Set(Array.from({ length: 200 }, () => buildSku("GAME", "Zelda")));
    expect(refs.size).toBeGreaterThan(190);
  });

  it("survit à un nom qui ne donne aucune lettre", () => {
    expect(buildSku("GAME", "★★★")).toMatch(/^JEU-\d{6}-[A-Z]+-[A-Z0-9]{4}$/);
  });
});

describe("chemins de photos reçus du navigateur", () => {
  // La règle appliquée par l'action : un objet de notre bucket, jamais une URL.
  const accepte = (v: string) => /^[\w-]+\/[\w.-]+$/.test(v.trim());

  it("accepte un objet du bucket", () => {
    expect(accepte("produits/3f2a-91bc.webp")).toBe(true);
    expect(accepte("produits/photo_1.jpg")).toBe(true);
  });

  it("refuse tout ce qui pointerait ailleurs", () => {
    // Ces champs sont cachés, donc modifiables : une URL absolue ferait
    // afficher une image d'un autre domaine sur la fiche produit.
    for (const v of [
      "https://exemple.invalid/photo.jpg",
      "//exemple.invalid/photo.jpg",
      "../../etc/passwd",
      "produits/../secret.jpg",
      "produits/sous/dossier.jpg",
      "",
    ]) {
      expect(accepte(v), v).toBe(false);
    }
  });
});
