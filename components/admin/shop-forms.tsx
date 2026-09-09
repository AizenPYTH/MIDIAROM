"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/form";
import { allowedShopTransitions, shopStatusLabel, type ShopFulfillment, type ShopOrderStatus } from "@/lib/shop/status";
import { shopOrderNoteAction, shopOrderStatusAction, shopOrderTrackingAction, stockAdjustAction, tradeInNoteAction, tradeInOfferAction } from "@/app/admin/actions/shop";
import type { ActionResult } from "@/app/admin/actions/orders";

function useRefresh(state: ActionResult | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
}

function Feedback({ state }: { state: ActionResult | null }) {
  return (
    <>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? (state.message ?? null) : null} />
    </>
  );
}

/** Changement de statut d'une commande boutique (avec suivi colis pour l'expédition). */
export function ShopStatusForm({ orderId, current, fulfillment, carrier, tracking, trackingUrl }: { orderId: string; current: ShopOrderStatus; fulfillment: ShopFulfillment; carrier: string | null; tracking: string | null; trackingUrl: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(shopOrderStatusAction, null);
  useRefresh(state);
  const targets = allowedShopTransitions(current);
  if (!targets.length) return <p className="text-[13.5px] text-ink-muted">Aucune transition disponible depuis ce statut.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Nouveau statut" htmlFor="shop_status">
        <Select id="shop_status" name="status" defaultValue={targets[0]}>
          {targets.map((t) => (
            <option key={t} value={t}>
              {shopStatusLabel(t, fulfillment)}
            </option>
          ))}
        </Select>
      </Field>
      {fulfillment === "SHIPPING" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Transporteur" htmlFor="carrier_name">
            <Input id="carrier_name" name="carrier_name" defaultValue={carrier ?? ""} placeholder="Colissimo" />
          </Field>
          <Field label="N° de suivi" htmlFor="tracking_number">
            <Input id="tracking_number" name="tracking_number" defaultValue={tracking ?? ""} className="font-mono" />
          </Field>
          <Field label="URL de suivi" htmlFor="tracking_url">
            <Input id="tracking_url" name="tracking_url" defaultValue={trackingUrl ?? ""} />
          </Field>
        </div>
      ) : null}
      <Field label="Note (motif d'annulation, message interne…)" htmlFor="shop_note">
        <Input id="shop_note" name="note" maxLength={300} />
      </Field>
      <Feedback state={state} />
      <Button type="submit" size="sm" loading={pending}>
        Changer le statut
      </Button>
    </form>
  );
}

export function ShopTrackingForm({ orderId, carrier, tracking, trackingUrl }: { orderId: string; carrier: string | null; tracking: string | null; trackingUrl: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(shopOrderTrackingAction, null);
  useRefresh(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Transporteur" htmlFor="t_carrier">
        <Input id="t_carrier" name="carrier_name" defaultValue={carrier ?? ""} />
      </Field>
      <Field label="N° de suivi" htmlFor="t_number">
        <Input id="t_number" name="tracking_number" defaultValue={tracking ?? ""} className="font-mono" />
      </Field>
      <Field label="URL de suivi" htmlFor="t_url">
        <Input id="t_url" name="tracking_url" defaultValue={trackingUrl ?? ""} />
      </Field>
      <div className="sm:col-span-3">
        <Feedback state={state} />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" size="sm" variant="outline" loading={pending}>
          Enregistrer le suivi
        </Button>
      </div>
    </form>
  );
}

export function ShopNoteForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(shopOrderNoteAction, null);
  useRefresh(state);
  return (
    <form action={action} className="flex flex-col gap-2" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="order_id" value={orderId} />
      <Textarea name="body" required minLength={2} placeholder="Note interne (préparation, appel client, litige…)" aria-label="Note" className="min-h-[70px]" />
      <Feedback state={state} />
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        Ajouter la note
      </Button>
    </form>
  );
}

/** Ajustement manuel du stock (+N / -N). */
export function StockAdjustForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(stockAdjustAction, null);
  useRefresh(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" key={state?.ok ? "done" : "draft"}>
      <input type="hidden" name="product_id" value={productId} />
      <Field label="Variation" htmlFor="delta" className="w-28">
        <Input id="delta" name="delta" placeholder="+3 / -1" inputMode="numeric" required className="font-mono" />
      </Field>
      <Field label="Motif" htmlFor="reason" className="w-44">
        <Select id="reason" name="reason" defaultValue="RECEIVED">
          <option value="RECEIVED">Réception / arrivage</option>
          <option value="ADJUSTMENT">Inventaire</option>
          <option value="DAMAGED">Casse / perte</option>
          <option value="COUNTER_SALE">Vente au comptoir</option>
          <option value="TRADE_IN">Reprise entrée en stock</option>
        </Select>
      </Field>
      <Field label="Note" htmlFor="stock_note" className="min-w-[200px] flex-1">
        <Input id="stock_note" name="note" maxLength={200} />
      </Field>
      <Button type="submit" size="sm" loading={pending}>
        Appliquer
      </Button>
      <div className="basis-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Offre de reprise : montant, validité, note ; e-mail envoyé au client. */
export function TradeInOfferForm({ requestId, currentOffer, currentNote }: { requestId: string; currentOffer: number | null; currentNote: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(tradeInOfferAction, null);
  useRefresh(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="request_id" value={requestId} />
      <Field label="Offre atelier (€)" htmlFor="offer" required>
        <Input id="offer" name="offer" defaultValue={currentOffer !== null ? (currentOffer / 100).toFixed(2) : ""} inputMode="decimal" required className="font-mono" />
      </Field>
      <Field label="Validité (jours)" htmlFor="validity_days">
        <Input id="validity_days" name="validity_days" defaultValue="14" inputMode="numeric" />
      </Field>
      <Field label="Message au client (facultatif)" htmlFor="offer_note" className="sm:col-span-2">
        <Textarea id="offer_note" name="note" defaultValue={currentNote ?? ""} placeholder="Ex. : offre sous réserve de vérification du lecteur au comptoir." className="min-h-[70px]" />
      </Field>
      <div className="sm:col-span-2">
        <Feedback state={state} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={pending}>
          {currentOffer !== null ? "Renvoyer une offre" : "Proposer"}
        </Button>
      </div>
    </form>
  );
}

export function TradeInNoteForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(tradeInNoteAction, null);
  useRefresh(state);
  return (
    <form action={action} className="flex flex-col gap-2" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="request_id" value={requestId} />
      <Textarea name="body" required minLength={2} placeholder="Note interne (état constaté, cote, pièces manquantes…)" aria-label="Note" className="min-h-[70px]" />
      <Feedback state={state} />
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        Ajouter la note
      </Button>
    </form>
  );
}
