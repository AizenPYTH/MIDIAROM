import type { Enums } from "@/types/database";

export type OrderStatus = Enums<"order_status">;
export type UserRole = Enums<"user_role">;

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "DRAFT",
  "QUOTE_REQUESTED",
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
  QUOTE_REQUESTED: "Demande de devis",
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
  QUOTE_REQUESTED: "Votre demande est arrivée à l'atelier. Un technicien l'examine et vous envoie un devis — c'est gratuit et sans engagement. Gardez votre console chez vous pour l'instant.",
  PENDING_PAYMENT: "Votre commande est enregistrée mais le paiement n'a pas encore été confirmé.",
  AWAITING_SHIPMENT: "Nous attendons votre console. Suivez les instructions d'emballage et d'envoi.",
  IN_TRANSIT_TO_WORKSHOP: "Votre colis est en route vers l'atelier.",
  RECEIVED: "Votre console est bien arrivée à l'atelier.",
  RECEPTION_CHECK: "Nous documentons l'état de la console et du colis (photos, numéro de série, accessoires).",
  DIAGNOSIS: "Un technicien analyse votre console.",
  WAITING_CUSTOMER_APPROVAL: "Votre devis est prêt : il attend votre décision.",
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
  /*
    Une demande de devis gratuite. Elle ne peut aller QUE vers l'envoi du devis
    — ou vers l'abandon. Aucun chemin ne mène d'ici à AWAITING_SHIPMENT : c'est
    ce qui garantit qu'une console ne part jamais avant que son prix soit
    accepté. Le seul passage possible traverse WAITING_CUSTOMER_APPROVAL.
  */
  QUOTE_REQUESTED: ["WAITING_CUSTOMER_APPROVAL", "UNREPAIRABLE", "CANCELLED", "DISPUTED"],
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["AWAITING_SHIPMENT", "CANCELLED"],
  AWAITING_SHIPMENT: ["IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "CANCELLED"],
  IN_TRANSIT_TO_WORKSHOP: ["RECEIVED", "CANCELLED", "DISPUTED"],
  RECEIVED: ["RECEPTION_CHECK", "DIAGNOSIS", "RETURN_REQUIRED", "DISPUTED"],
  RECEPTION_CHECK: ["DIAGNOSIS", "RETURN_REQUIRED", "DISPUTED"],
  DIAGNOSIS: ["WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "UNREPAIRABLE", "RETURN_REQUIRED", "DISPUTED"],
  /*
    `AWAITING_SHIPMENT` est nouveau ici, et il n'est atteignable que par ce
    chemin : le client vient d'accepter un devis sur un dossier dont la console
    n'a jamais quitté son domicile. C'est le moment — le seul — où « colis
    attendu » a un sens pour une demande de devis.
  */
  WAITING_CUSTOMER_APPROVAL: ["APPROVED", "AWAITING_SHIPMENT", "REFUSED_QUOTE", "REPAIRING", "UNREPAIRABLE", "CANCELLED", "DISPUTED"],
  APPROVED: ["REPAIRING", "WAITING_CUSTOMER_APPROVAL", "UNREPAIRABLE", "DISPUTED"],
  REPAIRING: ["QUALITY_CONTROL", "WAITING_CUSTOMER_APPROVAL", "UNREPAIRABLE", "DISPUTED"],
  QUALITY_CONTROL: ["READY_TO_SHIP", "REPAIRING", "DISPUTED"],
  READY_TO_SHIP: ["SHIPPED", "QUALITY_CONTROL", "DISPUTED"],
  SHIPPED: ["DELIVERED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "SAV", "DISPUTED"],
  COMPLETED: ["SAV", "DISPUTED"],
  CANCELLED: [],
  REFUSED_QUOTE: ["READY_TO_SHIP", "RETURN_REQUIRED", "APPROVED", "AWAITING_SHIPMENT", "DISPUTED"],
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

/**
 * Le suivi d'une **demande de devis gratuite**.
 *
 * Il ne peut pas être celui d'une commande. Une commande commence par un
 * paiement et enchaîne aussitôt sur « colis attendu » ; une demande de devis
 * commence par une attente à l'atelier, et la console ne bouge qu'après
 * l'accord du client. Afficher « Colis attendu » à quelqu'un qui n'a rien
 * commandé, et qui ne connaît pas encore le prix, est la confusion que ce
 * parcours existe pour lever.
 */
export const QUOTE_TIMELINE_STEPS: readonly { key: string; label: string; statuses: readonly OrderStatus[] }[] = [
  { key: "request", label: "Demande envoyée", statuses: ["QUOTE_REQUESTED", "DRAFT"] },
  { key: "quote", label: "Devis reçu", statuses: ["WAITING_CUSTOMER_APPROVAL"] },
  { key: "awaiting", label: "Console à envoyer", statuses: ["APPROVED", "PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP"] },
  { key: "received", label: "Console reçue", statuses: ["RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS"] },
  { key: "repair", label: "Réparation", statuses: ["REPAIRING"] },
  { key: "tests", label: "Tests", statuses: ["QUALITY_CONTROL", "READY_TO_SHIP"] },
  { key: "shipping", label: "Retour", statuses: ["SHIPPED", "DELIVERED", "COMPLETED"] },
];

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

/**
 * Étapes de suivi « atelier » (cahier des charges) : Reçu → Diagnostic → Devis envoyé →
 * En attente client → En atelier → Réparé → Expédié → Terminé. Chaque étape est liée au
 * statut cible réel utilisé par le back-office.
 */
export const WORKSHOP_STEPS: readonly { key: string; label: string; status: OrderStatus; statuses: readonly OrderStatus[] }[] = [
  { key: "received", label: "Reçu", status: "RECEIVED", statuses: ["RECEIVED", "RECEPTION_CHECK"] },
  { key: "diagnosis", label: "Diagnostic", status: "DIAGNOSIS", statuses: ["DIAGNOSIS"] },
  { key: "quote", label: "Devis envoyé", status: "WAITING_CUSTOMER_APPROVAL", statuses: ["WAITING_CUSTOMER_APPROVAL"] },
  { key: "approved", label: "En attente client", status: "APPROVED", statuses: ["APPROVED"] },
  { key: "workshop", label: "En atelier", status: "REPAIRING", statuses: ["REPAIRING", "QUALITY_CONTROL"] },
  { key: "repaired", label: "Réparé", status: "READY_TO_SHIP", statuses: ["READY_TO_SHIP"] },
  { key: "shipped", label: "Expédié", status: "SHIPPED", statuses: ["SHIPPED", "DELIVERED"] },
  { key: "completed", label: "Terminé", status: "COMPLETED", statuses: ["COMPLETED"] },
];

/** Index de la dernière étape atelier atteinte (-1 avant réception). */
export function workshopStepIndex(status: OrderStatus): number {
  const order: OrderStatus[] = ["RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "QUALITY_CONTROL", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED"];
  const pos = order.indexOf(status);
  if (pos === -1) return ["REFUSED_QUOTE", "UNREPAIRABLE", "RETURN_REQUIRED", "SAV", "DISPUTED"].includes(status) ? 1 : -1;
  return WORKSHOP_STEPS.reduce((acc, step, i) => (step.statuses.some((st) => order.indexOf(st) <= pos) ? i : acc), -1);
}

/** Étapes atelier avec leur état (suivi public, espace client, back-office). */
export function computeWorkshopTimeline(status: OrderStatus): { key: string; label: string; state: TimelineState }[] {
  const index = workshopStepIndex(status);
  const exceptional = ["REFUSED_QUOTE", "UNREPAIRABLE", "RETURN_REQUIRED", "SAV", "DISPUTED", "CANCELLED", "REFUNDED"].includes(status);
  return WORKSHOP_STEPS.map((step, i) => ({
    key: step.key,
    label: step.label,
    state: i < index || (i === index && (status === "COMPLETED" || exceptional)) ? "done" : i === index ? "current" : "todo",
  }));
}

const STATUS_ORDER: OrderStatus[] = [
  "DRAFT", "QUOTE_REQUESTED", "PENDING_PAYMENT", "PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK",
  "DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "QUALITY_CONTROL", "READY_TO_SHIP", "SHIPPED",
  "DELIVERED", "COMPLETED",
];

export type TimelineState = "done" | "current" | "todo";

/**
 * Computes done/current/todo for each timeline step given the current status.
 *
 * `isQuoteRequest` choisit la trame : celle d'une commande, ou celle d'une
 * demande de devis. Le paramètre est optionnel et vaut `false` — les dossiers
 * historiques, et tous les appels écrits avant ce parcours, gardent le suivi
 * qu'ils avaient.
 */
export function computeTimeline(status: OrderStatus, isQuoteRequest = false): { key: string; label: string; state: TimelineState }[] {
  const steps = isQuoteRequest ? QUOTE_TIMELINE_STEPS : TIMELINE_STEPS;
  const exceptional = !STATUS_ORDER.includes(status);
  const currentIndex = steps.findIndex((s) => s.statuses.includes(status));
  return steps.map((step, index) => {
    if (exceptional) {
      // For exceptional states, mark the steps before diagnosis as done if we got that far.
      // Un devis refusé sur une demande gratuite s'arrête à l'étape « devis
      // reçu » : rien n'a été envoyé, rien n'est à retourner.
      const arretExceptionnel = ["REFUSED_QUOTE", "UNREPAIRABLE", "RETURN_REQUIRED", "SAV", "DISPUTED"].includes(status);
      const reached = arretExceptionnel ? (isQuoteRequest ? 2 : 3) : 0;
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
