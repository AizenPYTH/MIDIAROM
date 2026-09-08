import type { Enums } from "@/types/database";

export type OrderStatus = Enums<"order_status">;
export type UserRole = Enums<"user_role">;

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT_TO_WORKSHOP",
  "RECEIVED",
  "RECEPTION_CHECK",
  "DIAGNOSIS",
  "WAITING_CUSTOMER_APPROVAL",
  "APPROVED",
  "REPAIRING",
  "QUALITY_CONTROL",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUSED_QUOTE",
  "UNREPAIRABLE",
  "RETURN_REQUIRED",
  "SAV",
  "DISPUTED",
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Brouillon",
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payé",
  AWAITING_SHIPMENT: "Colis attendu",
  IN_TRANSIT_TO_WORKSHOP: "En transit vers l'atelier",
  RECEIVED: "Colis reçu",
  RECEPTION_CHECK: "Contrôle de réception",
  DIAGNOSIS: "Diagnostic en cours",
  WAITING_CUSTOMER_APPROVAL: "En attente de votre accord",
  APPROVED: "Accord reçu",
  REPAIRING: "En réparation",
  QUALITY_CONTROL: "Contrôle qualité",
  READY_TO_SHIP: "Prêt à expédier",
  SHIPPED: "Expédié",
  DELIVERED: "Livré",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  REFUSED_QUOTE: "Devis refusé",
  UNREPAIRABLE: "Irréparable",
  RETURN_REQUIRED: "Retour nécessaire",
  SAV: "SAV en cours",
  DISPUTED: "Litige",
};

export const ORDER_STATUS_DESCRIPTIONS: Partial<Record<OrderStatus, string>> = {
  PENDING_PAYMENT: "Votre commande est enregistrée mais le paiement n'a pas encore été confirmé.",
  AWAITING_SHIPMENT: "Nous attendons votre console. Suivez les instructions d'emballage et d'envoi.",
  IN_TRANSIT_TO_WORKSHOP: "Votre colis est en route vers l'atelier.",
  RECEIVED: "Votre console est bien arrivée à l'atelier.",
  RECEPTION_CHECK: "Nous documentons l'état de la console et du colis (photos, numéro de série, accessoires).",
  DIAGNOSIS: "Un technicien analyse votre console.",
  WAITING_CUSTOMER_APPROVAL: "Un devis complémentaire attend votre décision.",
  APPROVED: "Votre accord est enregistré. La réparation va commencer.",
  REPAIRING: "L'intervention est en cours.",
  QUALITY_CONTROL: "La console passe la checklist de tests.",
  READY_TO_SHIP: "La console est prête et va être expédiée.",
  SHIPPED: "Votre console est en route vers vous.",
  DELIVERED: "Votre colis a été livré.",
  COMPLETED: "Le dossier est clos. Merci pour votre confiance.",
  REFUSED_QUOTE: "Vous avez refusé le devis. Nous préparons le retour de la console selon les conditions en vigueur.",
  UNREPAIRABLE: "La réparation n'est pas possible. Nous vous avons contacté pour la suite.",
};

/** Statuses considered "closed" (no further workshop action). */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ["COMPLETED", "CANCELLED"];

/** Statuses where the customer can still cancel by themselves. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = ["PENDING_PAYMENT", "PAID", "AWAITING_SHIPMENT"];

/**
 * Allowed transitions. Anything not listed is refused by `canTransition`.
 * Exceptional states (CANCELLED, DISPUTED, RETURN_REQUIRED) are reachable from
 * most active states by an admin.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["AWAITING_SHIPMENT", "CANCELLED"],
  AWAITING_SHIPMENT: ["IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "CANCELLED"],
  IN_TRANSIT_TO_WORKSHOP: ["RECEIVED", "CANCELLED", "DISPUTED"],
  RECEIVED: ["RECEPTION_CHECK", "DIAGNOSIS", "RETURN_REQUIRED", "DISPUTED"],
  RECEPTION_CHECK: ["DIAGNOSIS", "RETURN_REQUIRED", "DISPUTED"],
  DIAGNOSIS: ["WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "UNREPAIRABLE", "RETURN_REQUIRED", "DISPUTED"],
  WAITING_CUSTOMER_APPROVAL: ["APPROVED", "REFUSED_QUOTE", "REPAIRING", "UNREPAIRABLE", "CANCELLED", "DISPUTED"],
  APPROVED: ["REPAIRING", "WAITING_CUSTOMER_APPROVAL", "UNREPAIRABLE", "DISPUTED"],
  REPAIRING: ["QUALITY_CONTROL", "WAITING_CUSTOMER_APPROVAL", "UNREPAIRABLE", "DISPUTED"],
  QUALITY_CONTROL: ["READY_TO_SHIP", "REPAIRING", "DISPUTED"],
  READY_TO_SHIP: ["SHIPPED", "QUALITY_CONTROL", "DISPUTED"],
  SHIPPED: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "SAV", "DISPUTED"],
  COMPLETED: ["SAV", "DISPUTED"],
  CANCELLED: [],
  REFUSED_QUOTE: ["READY_TO_SHIP", "RETURN_REQUIRED", "APPROVED", "DISPUTED"],
  UNREPAIRABLE: ["READY_TO_SHIP", "RETURN_REQUIRED", "DISPUTED"],
  RETURN_REQUIRED: ["READY_TO_SHIP", "SHIPPED", "DISPUTED"],
  SAV: ["RECEIVED", "REPAIRING", "COMPLETED", "DISPUTED"],
  DISPUTED: ["COMPLETED", "CANCELLED", "READY_TO_SHIP", "REPAIRING"],
};

/** Transitions that only an admin can perform (not a technician). */
const ADMIN_ONLY_TARGETS: readonly OrderStatus[] = ["CANCELLED", "DISPUTED", "PAID", "COMPLETED"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === "TECHNICIAN" || role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Can the given role move an order from → to? */
export function canRoleTransition(role: UserRole, from: OrderStatus, to: OrderStatus): boolean {
  if (!canTransition(from, to)) return false;
  if (isAdminRole(role)) return true;
  if (role === "TECHNICIAN") return !ADMIN_ONLY_TARGETS.includes(to);
  return false;
}

/** Customer-facing timeline steps (happy path). */
export const TIMELINE_STEPS: readonly { key: string; label: string; statuses: readonly OrderStatus[] }[] = [
  { key: "order", label: "Commande", statuses: ["PAID", "PENDING_PAYMENT"] },
  { key: "awaiting", label: "Colis attendu", statuses: ["AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"] },
  { key: "received", label: "Colis reçu", statuses: ["RECEIVED", "RECEPTION_CHECK"] },
  { key: "diagnosis", label: "Diagnostic", statuses: ["DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL", "APPROVED"] },
  { key: "repair", label: "Réparation", statuses: ["REPAIRING"] },
  { key: "tests", label: "Tests", statuses: ["QUALITY_CONTROL", "READY_TO_SHIP"] },
  { key: "shipping", label: "Expédition", statuses: ["SHIPPED"] },
  { key: "return", label: "Retour", statuses: ["DELIVERED", "COMPLETED"] },
];

const STATUS_ORDER: OrderStatus[] = [
  "DRAFT", "PENDING_PAYMENT", "PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK",
  "DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "QUALITY_CONTROL", "READY_TO_SHIP", "SHIPPED",
  "DELIVERED", "COMPLETED",
];

export type TimelineState = "done" | "current" | "todo";

/** Computes done/current/todo for each timeline step given the current status. */
export function computeTimeline(status: OrderStatus): { key: string; label: string; state: TimelineState }[] {
  const exceptional = !STATUS_ORDER.includes(status);
  const currentIndex = TIMELINE_STEPS.findIndex((s) => s.statuses.includes(status));
  return TIMELINE_STEPS.map((step, index) => {
    if (exceptional) {
      // For exceptional states, mark the steps before diagnosis as done if we got that far.
      const reached = ["REFUSED_QUOTE", "UNREPAIRABLE", "RETURN_REQUIRED", "SAV", "DISPUTED"].includes(status) ? 3 : 0;
      return { key: step.key, label: step.label, state: index < reached ? "done" : "todo" };
    }
    if (index < currentIndex) return { key: step.key, label: step.label, state: "done" };
    if (index === currentIndex) {
      return { key: step.key, label: step.label, state: status === "COMPLETED" ? "done" : "current" };
    }
    return { key: step.key, label: step.label, state: "todo" };
  });
}

export function statusTone(status: OrderStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED":
    case "PAID":
    case "APPROVED":
      return "success";
    case "WAITING_CUSTOMER_APPROVAL":
    case "PENDING_PAYMENT":
    case "RETURN_REQUIRED":
    case "SAV":
      return "warning";
    case "CANCELLED":
    case "REFUSED_QUOTE":
    case "UNREPAIRABLE":
    case "DISPUTED":
      return "danger";
    case "DRAFT":
      return "neutral";
    default:
      return "info";
  }
}

export type SavStatus = Enums<"sav_status">;
export const SAV_STATUS_LABELS: Record<SavStatus, string> = {
  NEW: "Nouvelle",
  IN_ANALYSIS: "En analyse",
  ANSWERED: "Réponse apportée",
  RETURN_REQUESTED: "Retour demandé",
  CLOSED: "Terminée",
};

export type QuoteStatus = Enums<"quote_status">;
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé au client",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
  CANCELLED: "Annulé",
};

export type DiagnosticOutcomeValue = Enums<"diagnostic_outcome">;
export const DIAGNOSTIC_OUTCOME_LABELS: Record<DiagnosticOutcomeValue, string> = {
  REPAIRABLE: "Réparable",
  UNREPAIRABLE: "Irréparable",
  NOT_ECONOMICAL: "Réparation non rentable",
  NO_FAULT_FOUND: "Aucune panne constatée",
  FURTHER_DIAGNOSIS_NEEDED: "Diagnostic complémentaire nécessaire",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: "Client",
  TECHNICIAN: "Technicien",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Super administrateur",
};
