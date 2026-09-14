import { describe, expect, it } from "vitest";
import { formatPrice, formatRepairPrice } from "@/lib/utils/format";

describe("formatRepairPrice", () => {
  // Régression : le catalogue arrive entièrement non chiffré. Rendu par
  // formatPrice, il annonçait « 0,00 € » — une réparation gratuite — sur les
  // pages publiques et dans les données structurées envoyées à Google.
  it("dit « Sur devis » tant que le tarif n'est pas saisi", () => {
    expect(formatRepairPrice(0, true)).toBe("Sur devis");
    expect(formatRepairPrice(4990, true)).toBe("Sur devis");
    expect(formatRepairPrice(0, false)).toBe("Sur devis");
  });

  it("affiche le tarif dès qu'il existe", () => {
    expect(formatRepairPrice(4990, false)).toBe(formatPrice(4990));
    expect(formatRepairPrice(12345, false)).toBe(formatPrice(12345));
  });
});
