import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

/**
 * Les cinq registres de l'écran de travail.
 *
 * La base connaît vingt-trois statuts ; le réparateur en lit cinq. Le
 * regroupement se fait donc ici, une seule fois, et c'est lui qui décide à la
 * fois du traitement visuel et de l'action proposée sur la ligne.
 *
 * Le handoff est explicite là-dessus : **l'état détermine à lui seul son
 * apparence et son action**, et le statut brut ne doit jamais remonter tel quel
 * jusqu'au rendu. Une ligne qui affiche « Devis envoyé » et propose « Ouvrir »
 * serait un écran qu'on relit au lieu de le balayer.
 *
 * ── Pourquoi « À chiffrer » ouvre la série ──────────────────────────────────
 *
 * `QUOTE_REQUESTED` n'appartenait à aucun registre. Conséquence : une demande
 * de devis gratuite n'apparaissait ni sur cet écran, ni dans la file de
 * l'atelier — elle n'existait que sous « Tous les dossiers », au fond d'un
 * sous-menu. C'est-à-dire que le seul dossier où quelqu'un attend une réponse
 * **sans avoir rien payé** était le seul que l'atelier ne voyait pas.
 *
 * Il passe donc en tête : la console est encore chez le client, rien n'est
 * encaissé, et tout le reste du parcours dépend de ce chiffrage.
 */
export type Registre = "devis" | "diag" | "attente" | "atelier" | "prete";

export const REGISTRES: Record<Registre, { label: string; action: string; note: string; statuses: OrderStatus[] }> = {
  // Devis demandé, rien encaissé, console encore chez le client : la balle est
  // dans le camp de l'atelier, et personne d'autre ne la lui renverra.
  devis: {
    label: "À chiffrer",
    action: "Chiffrer",
    note: "devis demandés, console chez le client",
    statuses: ["QUOTE_REQUESTED"],
  },
  // Reçue, pas encore diagnostiquée : c'est à l'atelier de jouer.
  diag: {
    label: "À diagnostiquer",
    action: "Diagnostiquer",
    note: "reçues, pas encore ouvertes",
    statuses: ["PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS"],
  },
  // Devis parti : la balle est chez le client. Le seul registre en rouge.
  attente: {
    label: "Devis en attente",
    action: "Relancer",
    note: "réponse du client",
    statuses: ["WAITING_CUSTOMER_APPROVAL"],
  },
  atelier: {
    label: "En réparation",
    action: "Ouvrir",
    note: "à l'atelier",
    statuses: ["APPROVED", "REPAIRING", "QUALITY_CONTROL"],
  },
  prete: {
    label: "Prête à expédier",
    action: "Expédier",
    note: "colis à préparer",
    statuses: ["READY_TO_SHIP"],
  },
};

/** L'ordre des onglets et des compteurs, tel que le handoff les pose. */
export const ORDRE: Registre[] = ["devis", "diag", "attente", "atelier", "prete"];

/** Tous les statuts qui comptent comme « en cours ». */
export const EN_COURS: OrderStatus[] = ORDRE.flatMap((r) => REGISTRES[r].statuses);

/** À quel registre appartient un statut. Null s'il n'est plus en cours. */
export function registreOf(status: OrderStatus): Registre | null {
  return ORDRE.find((r) => REGISTRES[r].statuses.includes(status)) ?? null;
}

/**
 * Depuis combien de jours pleins.
 *
 * Sert à dire « devis envoyé il y a 4 jours » sans arrondir vers le haut : un
 * devis parti ce matin n'est pas « en retard depuis un jour ».
 */
export function joursDepuis(iso: string | null, maintenant = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((maintenant - t) / 86_400_000));
}

/** « il y a 4 jours », « hier », « aujourd'hui ». */
export function depuis(jours: number | null): string {
  if (jours === null) return "";
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  return `il y a ${jours} jours`;
}
