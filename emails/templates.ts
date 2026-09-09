import { button, keyValueTable, paragraph, renderEmail, type EmailBrand, type RenderedEmail } from "@/emails/layout";
import { formatPrice } from "@/lib/utils/format";

export interface OrderEmailContext {
  brand: EmailBrand;
  firstName: string;
  orderNumber: string;
  modelName: string;
  repairName: string;
  totalCents: number;
  trackingUrl: string; // public tracking link with token
  accountUrl: string; // /compte/dossiers/[id]
}

const greet = (ctx: OrderEmailContext) => `Bonjour ${ctx.firstName},`;
const summary = (ctx: OrderEmailContext): [string, string][] => [
  ["Dossier", ctx.orderNumber],
  ["Console", ctx.modelName],
  ["Réparation", ctx.repairName],
];

export function orderConfirmed(ctx: OrderEmailContext & { hasLabel: boolean; labelUrl: string | null; packagingUrl: string; workshopAddress: string }): RenderedEmail {
  const subject = `Commande ${ctx.orderNumber} confirmée`;
  const rows: [string, string][] = [...summary(ctx), ["Montant réglé", formatPrice(ctx.totalCents)]];
  const shipping = ctx.hasLabel
    ? "Votre étiquette de transport est disponible dans votre espace client. Imprimez-la et déposez le colis au point indiqué."
    : `Expédiez la console à l'adresse suivante : ${ctx.workshopAddress}`;
  const html = [
    paragraph(greet(ctx)),
    paragraph(`Votre commande ${ctx.orderNumber} est confirmée. Voici le récapitulatif :`),
    keyValueTable(rows),
    paragraph("Prochaine étape : emballez soigneusement votre console en suivant nos instructions et glissez votre numéro de dossier dans le colis."),
    paragraph(shipping),
    button("Voir mon dossier et mes instructions", ctx.accountUrl),
    paragraph(`Instructions d'emballage : ${ctx.packagingUrl}`),
    paragraph(`Suivi public : ${ctx.trackingUrl}`),
  ].join("");
  const text = `${greet(ctx)}\n\nVotre commande ${ctx.orderNumber} est confirmée.\n${rows.map(([k, v]) => `${k} : ${v}`).join("\n")}\n\n${shipping}\n\nDossier : ${ctx.accountUrl}\nEmballage : ${ctx.packagingUrl}\nSuivi : ${ctx.trackingUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function labelAvailable(ctx: OrderEmailContext & { trackingNumber: string }): RenderedEmail {
  const subject = `Votre étiquette de transport est disponible — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph(`Votre étiquette de transport pour le dossier ${ctx.orderNumber} est prête (suivi ${ctx.trackingNumber}).`), button("Télécharger mon étiquette", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nVotre étiquette (suivi ${ctx.trackingNumber}) est disponible : ${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function packageReceived(ctx: OrderEmailContext): RenderedEmail {
  const subject = `Votre console est bien arrivée à l'atelier — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph(`Votre ${ctx.modelName} est bien arrivée à l'atelier. Nous documentons sa réception (photos, numéro de série, accessoires) puis nous passons au diagnostic.`), button("Suivre mon dossier", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nVotre ${ctx.modelName} est bien arrivée à l'atelier. Suivi : ${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function diagnosisDone(ctx: OrderEmailContext & { customerSummary: string | null }): RenderedEmail {
  const subject = `Votre diagnostic est terminé — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph("Le diagnostic de votre console est terminé."), ctx.customerSummary ? paragraph(`Conclusion : ${ctx.customerSummary}`) : "", button("Consulter le diagnostic", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nLe diagnostic est terminé.${ctx.customerSummary ? `\nConclusion : ${ctx.customerSummary}` : ""}\n\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function quoteSent(ctx: OrderEmailContext & { quoteNumber: string; quoteTitle: string; quoteAmountCents: number; quoteMessage: string | null; expiresAt: string | null; quoteUrl: string }): RenderedEmail {
  const subject = `Une intervention supplémentaire est proposée — ${ctx.orderNumber}`;
  const html = [
    paragraph(greet(ctx)),
    paragraph("Lors de l'intervention sur votre console, notre technicien a constaté un point qui mérite votre attention."),
    keyValueTable([["Devis", ctx.quoteNumber], ["Proposition", ctx.quoteTitle], ["Montant", formatPrice(ctx.quoteAmountCents)], ...(ctx.expiresAt ? [["Valable jusqu'au", ctx.expiresAt] as [string, string]] : [])]),
    ctx.quoteMessage ? paragraph(ctx.quoteMessage) : "",
    paragraph("Aucune intervention supplémentaire ne sera réalisée sans votre accord. Vous pouvez accepter ou refuser en ligne."),
    button("Voir le devis et décider", ctx.quoteUrl),
  ].join("");
  const text = `${greet(ctx)}\n\nDevis ${ctx.quoteNumber} : ${ctx.quoteTitle} — ${formatPrice(ctx.quoteAmountCents)}\n${ctx.quoteMessage ?? ""}\n\nAccepter ou refuser : ${ctx.quoteUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function quoteAccepted(ctx: OrderEmailContext & { quoteNumber: string; quoteAmountCents: number; paymentRequired: boolean; payUrl: string }): RenderedEmail {
  const subject = `Devis ${ctx.quoteNumber} accepté — ${ctx.orderNumber}`;
  const html = [
    paragraph(greet(ctx)),
    paragraph(`Vous avez accepté le devis complémentaire ${ctx.quoteNumber} de ${formatPrice(ctx.quoteAmountCents)}.`),
    ctx.paymentRequired ? paragraph("Pour lancer l'intervention, le complément doit être réglé en ligne.") : paragraph("L'intervention est programmée."),
    button(ctx.paymentRequired ? "Régler le complément" : "Voir mon dossier", ctx.paymentRequired ? ctx.payUrl : ctx.accountUrl),
  ].join("");
  const text = `${greet(ctx)}\n\nVous avez accepté le devis ${ctx.quoteNumber} (${formatPrice(ctx.quoteAmountCents)}).\n${ctx.paymentRequired ? `Règlement : ${ctx.payUrl}` : ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function quoteRefused(ctx: OrderEmailContext & { quoteNumber: string; consequence: string }): RenderedEmail {
  const subject = `Devis ${ctx.quoteNumber} refusé — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph(`Nous avons bien enregistré votre refus du devis ${ctx.quoteNumber}.`), paragraph(ctx.consequence), button("Voir mon dossier", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nRefus du devis ${ctx.quoteNumber} enregistré.\n${ctx.consequence}\n\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function repairDone(ctx: OrderEmailContext): RenderedEmail {
  const subject = `Réparation terminée, tests en cours — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph(`L'intervention sur votre ${ctx.modelName} est terminée. La console passe maintenant notre checklist de contrôle qualité avant expédition.`), button("Suivre mon dossier", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nL'intervention est terminée, contrôle qualité en cours. ${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function testsDone(ctx: OrderEmailContext): RenderedEmail {
  const subject = `Tests terminés, expédition imminente — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph("Les tests de contrôle qualité sont validés. Votre console va être emballée et expédiée."), button("Voir les résultats des tests", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nTests validés, expédition imminente. ${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function shipped(ctx: OrderEmailContext & { trackingNumber: string | null; carrierName: string | null; carrierTrackingUrl: string | null }): RenderedEmail {
  const subject = `Votre console vient d'être expédiée — ${ctx.orderNumber}`;
  const rows: [string, string][] = [];
  if (ctx.carrierName) rows.push(["Transporteur", ctx.carrierName]);
  if (ctx.trackingNumber) rows.push(["Numéro de suivi", ctx.trackingNumber]);
  const html = [paragraph(greet(ctx)), paragraph(`Votre ${ctx.modelName} est en route.`), rows.length ? keyValueTable(rows) : "", button("Suivre mon colis", ctx.carrierTrackingUrl ?? ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nVotre console est expédiée.${ctx.trackingNumber ? ` Suivi : ${ctx.trackingNumber}` : ""}\n${ctx.carrierTrackingUrl ?? ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function delivered(ctx: OrderEmailContext): RenderedEmail {
  const subject = `Votre console est livrée — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph("Votre colis est livré. Vérifiez l'état de la console à réception et contactez-nous depuis votre dossier en cas de question."), button("Voir mon dossier", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nVotre colis est livré. ${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function reviewRequest(ctx: OrderEmailContext & { reviewUrl: string }): RenderedEmail {
  const subject = `Votre avis sur la réparation de votre ${ctx.modelName}`;
  const html = [paragraph(greet(ctx)), paragraph("Votre console est de retour depuis quelques jours. Votre avis nous aide à améliorer le service et éclaire les futurs clients."), button("Laisser mon avis (2 minutes)", ctx.reviewUrl)].join("");
  const text = `${greet(ctx)}\n\nLaissez votre avis : ${ctx.reviewUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function unrepairable(ctx: OrderEmailContext & { explanation: string }): RenderedEmail {
  const subject = `Diagnostic : réparation impossible — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph("Après diagnostic, la réparation de votre console n'est malheureusement pas possible."), paragraph(ctx.explanation), button("Voir le diagnostic", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nRéparation impossible.\n${ctx.explanation}\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function customerMessage(ctx: OrderEmailContext & { message: string }): RenderedEmail {
  const subject = `Nouveau message de l'atelier — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph(ctx.message), button("Répondre depuis mon dossier", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\n${ctx.message}\n\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function savUpdate(ctx: OrderEmailContext & { status: string; message: string | null }): RenderedEmail {
  const subject = `Mise à jour de votre demande SAV — ${ctx.orderNumber}`;
  const html = [paragraph(greet(ctx)), paragraph(`Votre demande SAV est maintenant : ${ctx.status}.`), ctx.message ? paragraph(ctx.message) : "", button("Voir ma demande", ctx.accountUrl)].join("");
  const text = `${greet(ctx)}\n\nSAV : ${ctx.status}.${ctx.message ? `\n${ctx.message}` : ""}\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function accountCreated(ctx: { brand: EmailBrand; firstName: string; setPasswordUrl: string }): RenderedEmail {
  const subject = "Accédez à votre espace client";
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph("Un espace client a été créé pour suivre votre dossier de réparation. Choisissez votre mot de passe pour y accéder."), button("Définir mon mot de passe", ctx.setPasswordUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\nDéfinissez votre mot de passe : ${ctx.setPasswordUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

// ---------------------------------------------------------------------------
// Boutique
// ---------------------------------------------------------------------------
export interface ShopEmailContext {
  brand: EmailBrand;
  firstName: string;
  orderNumber: string;
  totalCents: number;
  fulfillment: "PICKUP" | "SHIPPING";
  accountUrl: string;
  lines: { label: string; quantity: number; totalCents: number }[];
}

const shopLines = (ctx: ShopEmailContext): [string, string][] => [
  ["Commande", ctx.orderNumber],
  ...ctx.lines.map((l): [string, string] => [`${l.label}${l.quantity > 1 ? ` × ${l.quantity}` : ""}`, formatPrice(l.totalCents)]),
  ["Total", formatPrice(ctx.totalCents)],
];

export function shopOrderConfirmed(ctx: ShopEmailContext & { pickupNote: string; shippingNote: string }): RenderedEmail {
  const subject = `Commande ${ctx.orderNumber} confirmée`;
  const next = ctx.fulfillment === "PICKUP" ? `Votre commande sera préparée au magasin. ${ctx.pickupNote}`.trim() : `Votre commande sera expédiée. ${ctx.shippingNote}`.trim();
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph("Merci, votre paiement est confirmé."), keyValueTable(shopLines(ctx)), paragraph(next), button("Suivre ma commande", ctx.accountUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\nVotre paiement est confirmé pour la commande ${ctx.orderNumber} (${formatPrice(ctx.totalCents)}).\n${next}\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function shopOrderReady(ctx: ShopEmailContext): RenderedEmail {
  const subject = `Commande ${ctx.orderNumber} prête au retrait`;
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph(`Votre commande ${ctx.orderNumber} est prête : vous pouvez venir la retirer au magasin aux horaires d'ouverture.`), button("Voir ma commande", ctx.accountUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\nVotre commande ${ctx.orderNumber} est prête au retrait.\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function shopOrderShipped(ctx: ShopEmailContext & { carrierName: string | null; trackingNumber: string | null; trackingUrl: string | null }): RenderedEmail {
  const subject = `Commande ${ctx.orderNumber} expédiée`;
  const tracking = ctx.trackingNumber ? `${ctx.carrierName ?? "Transporteur"} — suivi ${ctx.trackingNumber}` : "Vous recevrez le numéro de suivi dès qu'il sera disponible.";
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph(`Votre commande ${ctx.orderNumber} vient d'être expédiée. ${tracking}`), ctx.trackingUrl ? button("Suivre le colis", ctx.trackingUrl) : button("Voir ma commande", ctx.accountUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\nCommande ${ctx.orderNumber} expédiée. ${tracking}\n${ctx.trackingUrl ?? ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function shopOrderCancelled(ctx: ShopEmailContext & { reason: string | null }): RenderedEmail {
  const subject = `Commande ${ctx.orderNumber} annulée`;
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph(`Votre commande ${ctx.orderNumber} a été annulée.${ctx.reason ? ` Motif : ${ctx.reason}` : ""} Si un paiement a été effectué, il vous est remboursé.`), button("Voir ma commande", ctx.accountUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\nCommande ${ctx.orderNumber} annulée.${ctx.reason ? ` Motif : ${ctx.reason}` : ""}\n${ctx.accountUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

// ---------------------------------------------------------------------------
// Reprise
// ---------------------------------------------------------------------------
export interface TradeInEmailContext {
  brand: EmailBrand;
  firstName: string;
  requestNumber: string;
  itemTitle: string;
  trackingUrl: string;
}

export function tradeInReceived(ctx: TradeInEmailContext): RenderedEmail {
  const subject = `Demande de reprise ${ctx.requestNumber} reçue`;
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph(`Nous avons bien reçu votre demande de reprise « ${ctx.itemTitle} ». L'atelier l'examine et vous envoie une offre par e-mail.`), button("Suivre ma demande", ctx.trackingUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\nDemande de reprise ${ctx.requestNumber} reçue : ${ctx.itemTitle}.\n${ctx.trackingUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function tradeInOffer(ctx: TradeInEmailContext & { offerCents: number; offerNote: string | null; expiresAt: string | null }): RenderedEmail {
  const subject = `Notre offre pour votre reprise ${ctx.requestNumber}`;
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph(`Pour « ${ctx.itemTitle} », nous vous proposons ${formatPrice(ctx.offerCents)}${ctx.expiresAt ? ` (offre valable jusqu'au ${ctx.expiresAt})` : ""}.`), ctx.offerNote ? paragraph(ctx.offerNote) : "", paragraph("Vous pouvez accepter ou refuser en ligne. Le paiement se fait au comptoir lors du dépôt du lot."), button("Répondre à l'offre", ctx.trackingUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\nOffre pour ${ctx.itemTitle} : ${formatPrice(ctx.offerCents)}.${ctx.offerNote ? `\n${ctx.offerNote}` : ""}\n${ctx.trackingUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}

export function tradeInDecision(ctx: TradeInEmailContext & { accepted: boolean; offerCents: number | null }): RenderedEmail {
  const subject = ctx.accepted ? `Reprise ${ctx.requestNumber} acceptée` : `Reprise ${ctx.requestNumber} refusée`;
  const body = ctx.accepted
    ? `Votre accord est enregistré${ctx.offerCents ? ` pour ${formatPrice(ctx.offerCents)}` : ""}. Apportez le lot au magasin : le paiement est effectué au comptoir après vérification.`
    : "Votre refus est enregistré. Le lot reste à vous, sans frais.";
  const html = [paragraph(`Bonjour ${ctx.firstName},`), paragraph(body), button("Voir ma demande", ctx.trackingUrl)].join("");
  const text = `Bonjour ${ctx.firstName},\n\n${body}\n${ctx.trackingUrl}`;
  return renderEmail(ctx.brand, subject, html, text);
}
