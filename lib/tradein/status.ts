import type { Enums } from "@/types/database";

/** Libellés et règles pures des reprises (client, admin, tests). */
export type TradeInStatus = Enums<"trade_in_status">;
export type TradeInItemType = Enums<"trade_in_item_type">;
export type TradeInCondition = Enums<"trade_in_condition">;

export const TRADE_IN_STATUS_LABELS: Record<TradeInStatus, string> = {
  NEW: "Nouvelle",
  ESTIMATED: "Offre envoyée",
  ACCEPTED: "Acceptée",
  REFUSED: "Refusée",
  CLOSED: "Terminée",
};

export const TRADE_IN_STATUS_DESCRIPTIONS: Record<TradeInStatus, string> = {
  NEW: "Votre demande est en cours d'examen par l'atelier.",
  ESTIMATED: "Une offre vous a été envoyée : vous pouvez l'accepter ou la refuser.",
  ACCEPTED: "Offre acceptée. Apportez le lot au magasin : le paiement est effectué au comptoir après vérification.",
  REFUSED: "Offre refusée. Le lot reste à vous, sans frais.",
  CLOSED: "Reprise terminée.",
};

export function tradeInStatusTone(status: TradeInStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "NEW":
      return "warning";
    case "ESTIMATED":
      return "info";
    case "ACCEPTED":
      return "success";
    case "REFUSED":
      return "danger";
    case "CLOSED":
      return "neutral";
  }
}

const TRANSITIONS: Record<TradeInStatus, readonly TradeInStatus[]> = {
  NEW: ["ESTIMATED", "REFUSED", "CLOSED"],
  ESTIMATED: ["ACCEPTED", "REFUSED", "ESTIMATED", "CLOSED"],
  ACCEPTED: ["CLOSED", "REFUSED"],
  REFUSED: ["ESTIMATED", "CLOSED"],
  CLOSED: [],
};

export function canTradeInTransition(from: TradeInStatus, to: TradeInStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const TRADE_IN_ITEM_TYPE_LABELS: Record<TradeInItemType, string> = {
  CONSOLE: "Console",
  GAME: "Jeu",
  ACCESSORY: "Accessoire",
  LOT: "Lot (console + jeux…)",
};

export const TRADE_IN_CONDITION_LABELS: Record<TradeInCondition, string> = {
  LIKE_NEW: "Comme neuf",
  GOOD: "Bon état",
  FAIR: "État moyen (traces, défauts)",
  FOR_PARTS: "Pour pièces / en panne",
};

export const TRADE_IN_ACCESSORIES = ["Boîte d'origine", "Notice", "Câble d'alimentation", "Câble vidéo", "Manette(s)", "Jeux inclus", "Carte mémoire", "Accessoires divers"];

/** Étapes affichées au client sur la page de suivi. */
export const TRADE_IN_TIMELINE: { key: string; label: string; statuses: TradeInStatus[] }[] = [
  { key: "received", label: "Demande reçue", statuses: ["NEW"] },
  { key: "offer", label: "Offre envoyée", statuses: ["ESTIMATED"] },
  { key: "decision", label: "Votre décision", statuses: ["ACCEPTED", "REFUSED"] },
  { key: "closed", label: "Dépôt & paiement", statuses: ["CLOSED"] },
];
