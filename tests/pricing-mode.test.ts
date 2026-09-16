import { describe, expect, it } from "vitest";
import { ENTITIES, formDataToObject } from "@/lib/admin/entities";
import { pricingModeOf, pricingSummary } from "@/lib/shop/pricing-mode";

/**
 * Prix fixe ou devis : le choix de l'atelier, pas une déduction.
 *
 * Le back-office écrivait `price_is_provisional: priceCents === 0`. Deux
 * conséquences, toutes deux visibles par le client :
 *
 *   — une prestation offerte était impossible à publier : la mettre à 0 €
 *     la faisait basculer en « sur devis » ;
 *   — l'atelier ne pouvait pas déclarer qu'une intervention exige un devis
 *     sans en effacer le tarif, ni l'inverse.
 *
 * Le mode est désormais posé explicitement, et ces tests tiennent la promesse
 * qui compte : **le montant ne décide plus de rien**.
 */

const reparations = ENTITIES.repairs!;

/** Ce que poste la fiche : le mode, et le montant seulement s'il y en a un. */
function poste(mode: "FIXED" | "QUOTE", prix?: string): FormData {
  const fd = new FormData();
  fd.set("pricing_mode", mode);
  if (prix !== undefined) fd.set("price", prix);
  return fd;
}

describe("le mode de tarification est un choix, pas une déduction", () => {
  it("enregistre un prix fixe tel qu'il a été saisi", () => {
    const out = formDataToObject(reparations, poste("FIXED", "49,90"));
    expect(out.price_cents).toBe(4990);
    expect(out.price_is_provisional).toBe(false);
  });

  it("accepte le point comme la virgule", () => {
    expect(formDataToObject(reparations, poste("FIXED", "49.90")).price_cents).toBe(4990);
  });

  it("garde 0 € comme un vrai prix : la prestation est offerte, pas à chiffrer", () => {
    const out = formDataToObject(reparations, poste("FIXED", "0"));
    expect(out.price_cents).toBe(0);
    // Le point de bascule de l'ancien code : c'est ici qu'il basculait en devis.
    expect(out.price_is_provisional).toBe(false);
    expect(pricingSummary(0, false)).toBe("Gratuit");
  });

  it("n'attend aucun montant en mode devis, et n'en laisse aucun traîner", () => {
    const out = formDataToObject(reparations, poste("QUOTE"));
    expect(out.price_is_provisional).toBe(true);
    // Zéro et non « le prix d'avant » : le moteur de tarification lit cette
    // colonne, un reliquat serait facturé au client sans qu'il l'ait vu.
    expect(out.price_cents).toBe(0);
  });

  it("ignore un montant envoyé malgré le mode devis", () => {
    // Un navigateur qui reposte l'ancien champ ne doit pas rétablir un tarif.
    const out = formDataToObject(reparations, poste("QUOTE", "49,90"));
    expect(out.price_cents).toBe(0);
    expect(out.price_is_provisional).toBe(true);
  });

  it("fait aller-retour entre les deux modes sans perdre le sens", () => {
    const fixe = formDataToObject(reparations, poste("FIXED", "49,90"));
    const devis = formDataToObject(reparations, poste("QUOTE"));
    const refixe = formDataToObject(reparations, poste("FIXED", "59,00"));
    expect([fixe.price_is_provisional, devis.price_is_provisional, refixe.price_is_provisional]).toEqual([false, true, false]);
    expect([fixe.price_cents, devis.price_cents, refixe.price_cents]).toEqual([4990, 0, 5900]);
  });

  it("refuse un prix fixe illisible plutôt que d'enregistrer n'importe quoi", () => {
    expect(Number.isNaN(formDataToObject(reparations, poste("FIXED", "abc")).price_cents as number)).toBe(true);
    expect(formDataToObject(reparations, poste("FIXED", "")).price_cents).toBe("");
  });
});

describe("la fiche déclare bien une tarification, et le schéma la valide", () => {
  it("expose un champ « pricing » et non deux champs séparés", () => {
    const champ = reparations.fields.find((f) => f.name === "price_cents");
    expect(champ?.type).toBe("pricing");
    // Un champ « price_is_provisional » distinct rouvrirait la contradiction :
    // on pourrait cocher « devis » en laissant un prix, ou l'inverse.
    expect(reparations.fields.some((f) => f.name === "price_is_provisional")).toBe(false);
  });

  /**
   * On valide la charge que le formulaire produit vraiment, pas une charge
   * reconstruite à la main : c'est le seul moyen de vérifier que le champ
   * `pricing` alimente bien les deux colonnes attendues par le schéma.
   */
  it("valide les trois états tels que le formulaire les envoie", () => {
    const soumission = (mode: "FIXED" | "QUOTE", prix?: string) => {
      const fd = new FormData();
      for (const f of reparations.fields) if (f.type !== "pricing") fd.set(f.name, "");
      fd.set("model_id", "00000000-0000-4000-8000-000000000001");
      fd.set("fault_id", "00000000-0000-4000-8000-000000000002");
      fd.set("name", "Réparation témoin");
      fd.set("slug", "reparation-temoin");
      fd.set("pricing_mode", mode);
      if (prix !== undefined) fd.set("price", prix);
      return reparations.schema.safeParse(formDataToObject(reparations, fd));
    };

    const fixe = soumission("FIXED", "49,90");
    expect(fixe.success, fixe.success ? "" : fixe.error.issues[0]?.message).toBe(true);
    expect(fixe.success && fixe.data).toMatchObject({ price_cents: 4990, price_is_provisional: false });

    const gratuit = soumission("FIXED", "0");
    expect(gratuit.success && gratuit.data).toMatchObject({ price_cents: 0, price_is_provisional: false });

    const devis = soumission("QUOTE");
    expect(devis.success && devis.data).toMatchObject({ price_cents: 0, price_is_provisional: true });
  });
});

describe("les libellés du back-office", () => {
  it("résume chaque ligne sans jamais dire « sur devis »", () => {
    expect(pricingSummary(5000, false)).toBe("Prix fixe — 50,00 €");
    expect(pricingSummary(0, false)).toBe("Gratuit");
    expect(pricingSummary(0, true)).toBe("Nécessite un devis");
    for (const s of [pricingSummary(5000, false), pricingSummary(0, false), pricingSummary(0, true)]) {
      expect(s.toLowerCase()).not.toContain("sur devis");
    }
  });

  it("ouvre le contrôle sur le mode réellement enregistré", () => {
    expect(pricingModeOf(true)).toBe("QUOTE");
    expect(pricingModeOf(false)).toBe("FIXED");
  });
});
