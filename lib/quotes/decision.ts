import "server-only";
import type { Tables } from "@/types/database";
import { getOrderById } from "@/lib/orders/service";
import { notifyOrderEvent, notifyWorkshopDecision } from "@/lib/notifications";
import { consequenceForOutcome } from "@/lib/quotes/rules";
import { getBusinessRules } from "@/lib/settings";
import { trackServerEvent } from "@/lib/analytics/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

type Quote = Tables<"supplementary_quotes">;

/**
 * Ce qui suit une décision, quelle que soit la porte par laquelle elle est
 * entrée.
 *
 * Deux chemins mènent ici — l'espace client et le lien à jeton reçu par
 * e-mail — et ils doivent produire exactement les mêmes effets : mêmes
 * e-mails, mêmes événements, même alerte à l'atelier. La décision elle-même
 * (les écritures, le verrou, le changement de statut) est déjà commune, dans
 * `apply_quote_decision` côté base ; ce module est son pendant applicatif.
 *
 * Il ne décide de rien et ne change aucun statut : le statut est déjà posé par
 * la fonction SQL quand on arrive ici. Il notifie, et c'est tout.
 */
export async function afterQuoteDecision(quote: Quote, accepted: boolean, userId: string | null): Promise<void> {
  const order = await getOrderById(quote.order_id);

  if (accepted) {
    /*
      La console n'a jamais quitté le domicile du client : c'est maintenant, et
      seulement maintenant, qu'on lui demande de nous l'envoyer. L'e-mail porte
      donc les instructions de dépôt et d'envoi, là où un devis complémentaire
      — sur un dossier dont la console est déjà à l'atelier — se contente de
      confirmer l'accord.
    */
    const consoleAEnvoyer = order.is_quote_request && !order.received_at;
    await notifyOrderEvent(order, consoleAEnvoyer ? { type: "QUOTE_ACCEPTED_SEND_CONSOLE", quote } : { type: "QUOTE_ACCEPTED", quote });
    await trackServerEvent({ event: ANALYTICS_EVENTS.QUOTE_ACCEPTED, orderId: order.id, repairId: order.repair_id, userId, valueCents: quote.total_cents });
  } else {
    const rules = await getBusinessRules();
    const consequence = consequenceForOutcome("QUOTE_REFUSED", rules, false);
    /*
      Trois situations, trois phrases — et une seule est vraie à la fois.

      Sur une demande de devis, rien n'a été engagé : pas de frais, pas de
      console à retourner, pas de diagnostic dû. Reprendre ici le texte du
      refus classique (« la console vous est retournée, les frais de diagnostic
      s'appliquent ») annoncerait une facture à quelqu'un qui n'a rien payé et
      rien envoyé.
    */
    const explication = order.is_quote_request && !order.received_at
      ? "Votre refus est enregistré. Aucun frais ne vous est facturé et votre console reste chez vous. Nous restons à votre disposition si vous changez d'avis."
      : quote.is_required_for_repair
        ? consequence.explanation
        : "La réparation initialement commandée se poursuit normalement.";
    await notifyOrderEvent(order, { type: "QUOTE_REFUSED", quote, consequence: explication });
    await trackServerEvent({ event: ANALYTICS_EVENTS.QUOTE_REFUSED, orderId: order.id, repairId: order.repair_id, userId, valueCents: quote.total_cents });
  }

  // L'atelier doit savoir, dans les deux cas : un accord lance une réception à
  // préparer, un refus libère un créneau.
  await notifyWorkshopDecision(order, quote, accepted);
}
