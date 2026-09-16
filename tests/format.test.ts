import { describe, expect, it } from "vitest";
import { formatPrice, formatRepairPrice } from "@/lib/utils/format";

describe("formatRepairPrice", () => {
  /**
   * Trois états, un seul champ pour les départager.
   *
   * Le montant ne suffisait pas : « 0 € » servait à la fois de « je ne facture
   * rien » et de « je ne sais pas encore combien ». La fonction répondait donc
   * « Sur devis » à une prestation offerte, et le catalogue ne pouvait pas
   * annoncer la gratuité. C'est désormais `price_is_provisional` qui tranche.
   */
  it("annonce « Nécessite un devis » quand le prix n'est pas arbitré", () => {
    expect(formatRepairPrice(0, true)).toBe("Nécessite un devis");
    // Même avec un montant résiduel en base, le drapeau l'emporte : aucun prix
    // que le client n'a pas vu ne doit lui être présenté.
    expect(formatRepairPrice(4990, true)).toBe("Nécessite un devis");
  });

  it("distingue une prestation offerte d'une prestation à chiffrer", () => {
    expect(formatRepairPrice(0, false)).toBe("Gratuit");
    expect(formatRepairPrice(0, false)).not.toBe(formatRepairPrice(0, true));
  });

  it("affiche le tarif dès qu'il existe", () => {
    expect(formatRepairPrice(4990, false)).toBe(formatPrice(4990));
    expect(formatRepairPrice(12345, false)).toBe(formatPrice(12345));
  });

  it("ne présente jamais « 0,00 € » comme un prix non arbitré", () => {
    for (const [cents, devis] of [
      [0, true],
      [0, false],
      [4990, false],
    ] as const) {
      const rendu = formatRepairPrice(cents, devis);
      if (devis) expect(rendu).not.toMatch(/€/);
    }
  });
});
