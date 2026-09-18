import { describe, expect, it } from "vitest";
import { computePrice, PricingError } from "@/lib/pricing/engine";
import { canTransition, computeTimeline, ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders/status";
import { createQuoteRequestSchema } from "@/lib/orders/schemas";

/**
 * Les deux parcours, et la frontière entre eux.
 *
 * Le bug que ces tests verrouillent avait une seule cause : le moteur de prix
 * empilait `repair.priceCents` sans regarder `price_is_provisional`. Comme le
 * catalogue crée toutes les prestations à zéro « sur devis », une demande de
 * devis produisait une commande payable, franchissait PAID, et réclamait la
 * console d'un client qui n'avait jamais vu de prix.
 */

const surDevis = { id: "r-devis", name: "Aucun signal HDMI", priceCents: 0, isProvisional: true };
const prixFerme = { id: "r-ferme", name: "Nettoyage complet", priceCents: 4900, estimatedCostCents: 600 };
const option = { id: "o1", name: "Entretien thermique", priceCents: 2490 };
const pack = { id: "p1", name: "Pack entretien", priceCents: 3490, optionIds: ["o1"] };
const transport = { id: "s1", name: "Étiquette aller-retour", priceCents: 1490 };

const socle = { availableOptions: [option], availablePacks: [pack], selectedOptionIds: [], selectedPackIds: [], shipping: null, vatRateBp: 2000 };

describe("une prestation sans prix ne peut pas être facturée", () => {
  it("lève `requiresQuote` et laisse tous les montants à zéro", () => {
    const r = computePrice({ ...socle, repair: surDevis });
    expect(r.requiresQuote).toBe(true);
    expect(r.totalCents).toBe(0);
    expect(r.subtotalCents).toBe(0);
    expect(r.shippingCents).toBe(0);
    expect(r.vatCents).toBe(0);
  });

  it("n'émet qu'une ligne, la prestation demandée, à zéro", () => {
    const r = computePrice({ ...socle, repair: surDevis });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ type: "REPAIR", referenceId: "r-devis", unitPriceCents: 0, totalCents: 0 });
  });

  it("ignore un transport glissé dans la requête — le total reste nul", () => {
    // Le scénario de l'attaque : forger une sélection pour qu'une demande
    // gratuite reparte avec un montant payable.
    const r = computePrice({ ...socle, repair: surDevis, shipping: transport });
    expect(r.totalCents).toBe(0);
    expect(r.lines.some((l) => l.type === "SHIPPING")).toBe(false);
  });

  it("ignore options et packs, et le dit au client plutôt que d'échouer", () => {
    const r = computePrice({ ...socle, repair: surDevis, selectedOptionIds: ["o1"], selectedPackIds: ["p1"] });
    expect(r.totalCents).toBe(0);
    expect(r.lines).toHaveLength(1);
    expect(r.warnings.join(" ")).toContain("chiffrées par l'atelier");
  });

  it("refuse toujours une option inconnue, même sans rien à facturer", () => {
    // Régression : un court-circuit posé en tête de fonction faisait bien
    // tomber le total à zéro, mais cessait de contrôler la sélection. Une
    // demande de devis devenait alors le seul endroit du site où l'on pouvait
    // envoyer n'importe quel identifiant d'option sans être refusé.
    expect(() => computePrice({ ...socle, repair: surDevis, selectedOptionIds: ["option-inventee"] })).toThrow(PricingError);
    expect(() => computePrice({ ...socle, repair: surDevis, selectedPackIds: ["pack-invente"] })).toThrow(PricingError);
  });

  it("ne confond pas « sur devis » et « offert » : un prix ferme à zéro reste une commande", () => {
    const offert = { id: "r0", name: "Diagnostic offert", priceCents: 0, isProvisional: false };
    const r = computePrice({ ...socle, repair: offert, shipping: transport });
    expect(r.requiresQuote).toBe(false);
    expect(r.totalCents).toBe(1490); // le transport, lui, est bien dû
  });
});

describe("le parcours à prix fixe n'a pas bougé", () => {
  it("facture la prestation, l'option et le transport", () => {
    const r = computePrice({ ...socle, repair: prixFerme, selectedOptionIds: ["o1"], shipping: transport });
    expect(r.requiresQuote).toBe(false);
    expect(r.subtotalCents).toBe(4900 + 2490);
    expect(r.shippingCents).toBe(1490);
    expect(r.totalCents).toBe(4900 + 2490 + 1490);
  });

  it("garde le pli anti-doublon des packs", () => {
    const r = computePrice({ ...socle, repair: prixFerme, selectedPackIds: ["p1"], selectedOptionIds: ["o1"] });
    expect(r.lines.filter((l) => l.type === "OPTION")).toHaveLength(0);
    expect(r.totalCents).toBe(4900 + 3490);
  });
});

describe("aucune console ne part avant l'accord sur le prix", () => {
  it("connaît le statut d'entrée du parcours", () => {
    expect(ORDER_STATUSES).toContain("QUOTE_REQUESTED");
    expect(ORDER_STATUS_LABELS.QUOTE_REQUESTED).toBe("Demande de devis");
  });

  it("interdit tout saut direct de la demande vers l'attente du colis", () => {
    // C'est LA garantie du parcours : la seule sortie de QUOTE_REQUESTED est
    // l'envoi d'un devis.
    expect(canTransition("QUOTE_REQUESTED", "AWAITING_SHIPMENT")).toBe(false);
    expect(canTransition("QUOTE_REQUESTED", "PAID")).toBe(false);
    expect(canTransition("QUOTE_REQUESTED", "RECEIVED")).toBe(false);
    expect(canTransition("QUOTE_REQUESTED", "REPAIRING")).toBe(false);
  });

  it("n'autorise que l'envoi du devis, l'abandon ou l'irréparable", () => {
    const permis: OrderStatus[] = ["WAITING_CUSTOMER_APPROVAL", "UNREPAIRABLE", "CANCELLED", "DISPUTED"];
    for (const cible of ORDER_STATUSES) {
      if (cible === "QUOTE_REQUESTED") continue;
      expect(canTransition("QUOTE_REQUESTED", cible)).toBe(permis.includes(cible));
    }
  });

  it("ouvre l'envoi du colis une fois le devis accepté, et par ce chemin seulement", () => {
    expect(canTransition("WAITING_CUSTOMER_APPROVAL", "AWAITING_SHIPMENT")).toBe(true);
    expect(canTransition("WAITING_CUSTOMER_APPROVAL", "REFUSED_QUOTE")).toBe(true);
  });
});

describe("le suivi ne parle jamais de colis avant l'accord", () => {
  const libelles = (s: OrderStatus) => computeTimeline(s, true).map((e) => e.label);

  it("commence par la demande, pas par une commande", () => {
    expect(libelles("QUOTE_REQUESTED")[0]).toBe("Demande envoyée");
    expect(computeTimeline("QUOTE_REQUESTED", true)[0]?.state).toBe("current");
  });

  it("n'affiche « Colis attendu » à aucune étape du parcours de devis", () => {
    for (const s of ORDER_STATUSES) expect(libelles(s)).not.toContain("Colis attendu");
  });

  it("place « Console à envoyer » après le devis, jamais avant", () => {
    const etapes = computeTimeline("AWAITING_SHIPMENT", true);
    const envoi = etapes.findIndex((e) => e.label === "Console à envoyer");
    const devis = etapes.findIndex((e) => e.label === "Devis reçu");
    expect(devis).toBeLessThan(envoi);
    expect(etapes[envoi]?.state).toBe("current");
    expect(etapes[devis]?.state).toBe("done");
  });

  it("arrête un refus à l'étape du devis : rien n'a été envoyé, rien n'est à retourner", () => {
    const etapes = computeTimeline("REFUSED_QUOTE", true);
    expect(etapes.filter((e) => e.state === "done")).toHaveLength(2);
    expect(etapes.find((e) => e.label === "Console à envoyer")?.state).toBe("todo");
  });

  it("laisse intact le suivi d'une commande à prix fixe", () => {
    expect(computeTimeline("AWAITING_SHIPMENT").map((e) => e.label)).toContain("Colis attendu");
  });
});

describe("ce que la demande exige, et ce qu'elle refuse", () => {
  const valide = {
    modelId: "00000000-0000-4000-8000-000000000002",
    repairId: "00000000-0000-4000-8000-000000000001",
    customer: { first_name: "Camille", last_name: "Roux", email: "camille@exemple.fr" },
    description: "Plus aucune image depuis hier, le voyant reste blanc et la console chauffe.",
    accept_terms: true as const,
  };

  it("accepte une demande sans adresse ni mode d'envoi", () => {
    expect(createQuoteRequestSchema.safeParse(valide).success).toBe(true);
  });

  it("accepte « Autre problème » : la console suffit, la panne est facultative", () => {
    // La porte de sortie du parcours. Sans elle, couvrir les cas rares
    // voudrait dire rallonger le catalogue — ce qu'on vient d'arrêter.
    const { repairId: _ignore, ...sansPanne } = valide;
    const r = createQuoteRequestSchema.safeParse(sansPanne);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.repairId).toBeNull();
  });

  it("exige la console, même quand la panne est décrite librement", () => {
    const { modelId: _ignore, ...sansConsole } = valide;
    expect(createQuoteRequestSchema.safeParse(sansConsole).success).toBe(false);
  });

  it("exige une description : sans mots, le réparateur n'a rien à chiffrer", () => {
    const r = createQuoteRequestSchema.safeParse({ ...valide, description: "ça marche plus" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("20 caractères");
  });

  it("n'expose aucun champ de prix, de transport ou d'adresse", () => {
    const r = createQuoteRequestSchema.parse({ ...valide, shippingMethodId: "x", address: { line1: "12 rue" }, total_cents: 9900 });
    // Zod écarte ce qui n'est pas au schéma : rien de facturable ne peut
    // entrer par cette porte, même en forçant la requête.
    expect(r).not.toHaveProperty("shippingMethodId");
    expect(r).not.toHaveProperty("address");
    expect(r).not.toHaveProperty("total_cents");
  });

  it("refuse une demande sans acceptation des conditions", () => {
    expect(createQuoteRequestSchema.safeParse({ ...valide, accept_terms: false }).success).toBe(false);
  });
});
