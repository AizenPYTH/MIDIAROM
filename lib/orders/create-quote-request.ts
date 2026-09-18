import "server-only";
import type { Json } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getModelById, getRepairById } from "@/lib/repair/catalog";
import { getSetting } from "@/lib/settings";
import { addOrderEvent } from "@/lib/orders/service";
import { audit } from "@/lib/security/audit";
import { notifyOrderEvent, notifyWorkshop } from "@/lib/notifications";
import { CUSTOMER_MEDIA_BUCKET, moveDraftPhotos } from "@/lib/media/drafts";
import { CreateOrderError, resolveCustomer } from "@/lib/orders/create-order";
import type { CreateQuoteRequestInput } from "@/lib/orders/schemas";
import type { CurrentUser } from "@/lib/security/auth";

/**
 * Une demande de devis gratuite.
 *
 * Ce fichier est court, et c'est le but. Comparé à `create-order.ts`, il lui
 * manque **tout ce qui coûte** : pas de `priceSelection`, pas de mode de
 * transport, pas de ligne `payments`, pas de session de paiement, pas d'appel à
 * `confirmPayment`. Il ne peut donc rien encaisser — ce n'est pas une règle
 * qu'on applique, c'est du code qui n'existe pas.
 *
 * Le dossier naît en `QUOTE_REQUESTED`, à zéro euro, avec `is_quote_request`.
 * La machine à états (`lib/orders/status.ts`) ne connaît, depuis cet état,
 * qu'un seul chemin vers la suite : l'envoi d'un devis. Aucune console ne peut
 * être réclamée avant que le client ait accepté un prix.
 */
export interface QuoteRequestResult {
  orderId: string;
  orderNumber: string;
  trackingToken: string;
}

/**
 * Ce qu'on inscrit au dossier quand le client n'a rien trouvé dans la liste.
 *
 * Ces libellés partent dans `repair_name` et `fault_name`, qui sont `not null`
 * et servent partout d'intitulé du dossier — e-mails, suivi, back-office. Ils
 * doivent donc se lire comme une phrase, et dire au réparateur ce qu'on attend
 * de lui : lire la description.
 */
const PANNE_LIBRE = "Autre problème — à diagnostiquer";
const SYMPTOME_LIBRE = "Panne décrite par le client";

export async function createQuoteRequest(input: CreateQuoteRequestInput, currentUser: CurrentUser | null): Promise<QuoteRequestResult> {
  const db = createSupabaseAdminClient();

  const model = await getModelById(input.modelId);
  if (!model || !model.is_active) throw new CreateOrderError("Cette console n'est plus prise en charge.");

  /*
    Deux entrées, un seul dossier.

    Soit le client a reconnu sa panne dans les cinq propositions, soit il ne
    l'a pas reconnue et la décrit lui-même. Le second cas ne crée **aucune**
    prestation au catalogue : `repair_id` et `fault_id` restent nuls, et c'est
    exactement ce qui signale au réparateur qu'il doit lire avant de chiffrer.
  */
  const repair = input.repairId ? await getRepairById(input.repairId) : null;
  if (input.repairId) {
    if (!repair || !repair.is_active || !repair.model.is_active) {
      throw new CreateOrderError("Cette réparation n'est plus disponible.");
    }
    if (repair.model.id !== model.id) {
      throw new CreateOrderError("Cette panne ne concerne pas la console choisie.");
    }
    /*
      Le garde-fou du parcours.

      Une prestation à prix ferme n'a rien à faire ici : son prix est connu,
      elle se commande et se paie. L'accepter reviendrait à offrir un chemin
      pour obtenir gratuitement ce qui est tarifé — précisément ce que la
      demande de devis ne doit pas devenir. La vérification est ici, côté
      serveur, sur la donnée de la base, et non sur ce que le navigateur a bien
      voulu envoyer.
    */
    if (!repair.price_is_provisional) {
      throw new CreateOrderError("Cette réparation a un prix ferme : elle se commande directement, sans devis.");
    }
  }

  const [rules, checkout] = await Promise.all([getSetting("business_rules"), getSetting("checkout")]);
  const customer = await resolveCustomer(input, currentUser);
  const email = input.customer.email.toLowerCase();

  const { data: order, error: orderError } = await db
    .from("repair_orders")
    .insert({
      customer_id: customer.id,
      status: "QUOTE_REQUESTED",
      is_quote_request: true,
      brand_id: model.brand.id,
      model_id: model.id,
      fault_id: repair?.fault.id ?? null,
      repair_id: repair?.id ?? null,
      // Ni transport ni adresse : on ne sait pas encore si la console viendra,
      // et si elle vient, le client choisira alors entre le dépôt en boutique
      // et l'envoi. `shipping_address` est `not null` en base — un objet vide
      // dit « rien de décidé », là où une fausse adresse mentirait.
      shipping_method_id: null,
      shipping_address: {} as unknown as Json,
      brand_name: model.brand.name,
      model_name: model.name,
      fault_name: repair?.fault.name ?? SYMPTOME_LIBRE,
      repair_name: repair?.name ?? PANNE_LIBRE,
      warranty_months: repair?.warranty_months ?? 0,
      customer_first_name: input.customer.first_name,
      customer_last_name: input.customer.last_name,
      customer_email: email,
      customer_phone: input.customer.phone || null,
      customer_notes: [input.description, input.console_already_opened ? "Console déjà ouverte / tentative de réparation antérieure déclarée." : null]
        .filter(Boolean)
        .join("\n\n"),
      console_serial_number: input.console_serial_number || null,
      symptoms: input.symptoms,
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_version: checkout.terms_version,
      currency: "EUR",
      subtotal_cents: 0,
      shipping_cents: 0,
      total_cents: 0,
      vat_rate_bp: rules.vat_rate_bp,
      utm_source: input.attribution?.utm_source ?? null,
      utm_medium: input.attribution?.utm_medium ?? null,
      utm_campaign: input.attribution?.utm_campaign ?? null,
      utm_term: input.attribution?.utm_term ?? null,
      utm_content: input.attribution?.utm_content ?? null,
      landing_page: input.attribution?.landing_page ?? null,
      referrer: input.attribution?.referrer ?? null,
      analytics_session_id: input.attribution?.session_id ?? null,
    })
    .select("*")
    .single();
  if (orderError || !order) {
    console.error("[devis] insert failed", orderError?.message);
    throw new CreateOrderError("L'enregistrement de votre demande a échoué. Merci de réessayer.");
  }

  /*
    La panne demandée, en ligne de dossier, à zéro euro.

    Elle n'est pas facturable et ne le deviendra jamais : quand le réparateur
    chiffrera, ses lignes arriveront en `QUOTE_ITEM` / `source = 'QUOTE'` et
    s'ajouteront au total. Celle-ci reste ce qu'elle est — la trace de ce que
    le client a demandé.
  */
  await db.from("repair_order_items").insert({
    order_id: order.id,
    item_type: "REPAIR" as const,
    source: "INITIAL" as const,
    reference_id: repair?.id ?? null,
    label: repair?.name ?? PANNE_LIBRE,
    description: "Demande de devis — montant à chiffrer par l'atelier",
    quantity: 1,
    unit_price_cents: 0,
    total_cents: 0,
    estimated_cost_cents: 0,
  });

  if (input.photos.length) {
    const paths = await moveDraftPhotos(input.photos, `${order.id}/CUSTOMER`);
    if (paths.length) {
      await db.from("order_media").insert(
        paths.map((path) => ({
          order_id: order.id,
          kind: "CUSTOMER" as const,
          bucket: CUSTOMER_MEDIA_BUCKET,
          path,
          mime_type: `image/${path.endsWith(".png") ? "png" : path.endsWith(".webp") ? "webp" : path.endsWith(".heic") ? "heic" : "jpeg"}`,
          size_bytes: 0,
          original_name: null,
          caption: "Photo envoyée avec la demande de devis",
          is_visible_to_customer: true,
          uploaded_by: customer.created ? null : customer.id,
        })),
      );
      await addOrderEvent({ orderId: order.id, type: "CUSTOMER_PHOTOS", title: `${paths.length} photo(s) jointe(s) par le client`, isPublic: true });
    }
  }

  await addOrderEvent({
    orderId: order.id,
    type: "QUOTE_REQUESTED",
    title: "Demande de devis reçue",
    description: "Votre demande est arrivée à l'atelier. Aucun règlement n'est attendu, et votre console reste chez vous jusqu'à votre accord sur le devis.",
    actorId: currentUser?.id ?? null,
  });

  await audit({
    actorId: currentUser?.id ?? customer.id,
    actorRole: currentUser?.profile.role ?? "CUSTOMER",
    action: "quote_request.created",
    resourceType: "repair_orders",
    resourceId: order.id,
    orderId: order.id,
    newValue: { repair_id: repair?.id ?? null, model_id: model.id, libre: !repair, photos: input.photos.length, total_cents: 0 },
  });

  // Le client sait que c'est parti ; l'atelier sait qu'il a du travail.
  await notifyOrderEvent(order, { type: "QUOTE_REQUEST_RECEIVED" });
  await notifyWorkshop(order, { photos: input.photos.length, description: input.description });

  return { orderId: order.id, orderNumber: order.order_number, trackingToken: order.tracking_token };
}
