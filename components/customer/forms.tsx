"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormSuccess, Input, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/app/(account)/compte/actions";
import { cancelOrderAction, changePasswordAction, decideQuoteAction, deleteAccountAction, openSavAction, saveAddressAction, savReplyAction, sendMessageAction, submitReviewAction, updateProfileAction } from "@/app/(account)/compte/actions";
import { formatPrice } from "@/lib/utils/format";

function useRefreshOnSuccess(state: ActionResult | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
}

export function MessageForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(sendMessageAction, null);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-3" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Votre message à l'atelier" htmlFor="body">
        <Textarea id="body" name="body" required minLength={2} maxLength={4000} placeholder="Une question, une précision sur la panne…" />
      </Field>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? state.message : null} />
      <Button type="submit" size="sm" loading={pending}>
        Envoyer
      </Button>
    </form>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(cancelOrderAction, null);
  useRefreshOnSuccess(state);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Confirmer l'annulation de cette commande ?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="order_id" value={orderId} />
      <FormError message={state && !state.ok ? state.error : null} />
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        Annuler ma commande
      </Button>
    </form>
  );
}

export function QuoteDecisionForm({ quoteId, amountCents, requiresPayment }: { quoteId: string; amountCents: number; requiresPayment: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(decideQuoteAction, null);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="quote_id" value={quoteId} />
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <Checkbox name="confirm" required className="mt-0.5" />
        <span>
          Je confirme ma décision concernant ce devis de <span className="font-semibold text-ink">{formatPrice(amountCents)}</span>. Elle sera enregistrée et horodatée.
          {requiresPayment ? " En cas d'acceptation, je serai redirigé vers le paiement du complément." : ""}
        </span>
      </label>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? state.message : null} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" name="decision" value="ACCEPTED" variant="accent" loading={pending}>
          Accepter le devis {formatPrice(amountCents)}
        </Button>
        <Button type="submit" name="decision" value="REFUSED" variant="outline" loading={pending}>
          Refuser le devis
        </Button>
      </div>
    </form>
  );
}

export function ProfileForm({ profile }: { profile: { first_name: string | null; last_name: string | null; phone: string | null; marketing_opt_in: boolean } }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateProfileAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="first_name" required>
          <Input id="first_name" name="first_name" defaultValue={profile.first_name ?? ""} required />
        </Field>
        <Field label="Nom" htmlFor="last_name" required>
          <Input id="last_name" name="last_name" defaultValue={profile.last_name ?? ""} required />
        </Field>
      </div>
      <Field label="Téléphone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <Checkbox name="marketing_opt_in" defaultChecked={profile.marketing_opt_in} /> Recevoir occasionnellement des conseils d&apos;entretien et offres
      </label>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? state.message : null} />
      <Button type="submit" loading={pending}>
        Enregistrer
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nouveau mot de passe" htmlFor="password" hint="8 caractères minimum">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirmation" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? state.message : null} />
      <Button type="submit" variant="outline" loading={pending}>
        Modifier le mot de passe
      </Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(deleteAccountAction, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Tapez SUPPRIMER pour confirmer" htmlFor="confirm_delete">
        <Input id="confirm_delete" name="confirm" autoComplete="off" />
      </Field>
      <FormError message={state && !state.ok ? state.error : null} />
      <Button type="submit" variant="danger" size="sm" loading={pending}>
        Supprimer mon compte
      </Button>
    </form>
  );
}

export function AddressForm({ address, onDone }: { address?: { id: string; label: string | null; first_name: string; last_name: string; line1: string; line2: string | null; postal_code: string; city: string; phone: string | null; is_default: boolean }; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveAddressAction, null);
  useRefreshOnSuccess(state);
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <Field label="Libellé (ex : Domicile)" htmlFor="label">
        <Input id="label" name="label" defaultValue={address?.label ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="a_first_name" required>
          <Input id="a_first_name" name="first_name" defaultValue={address?.first_name ?? ""} required />
        </Field>
        <Field label="Nom" htmlFor="a_last_name" required>
          <Input id="a_last_name" name="last_name" defaultValue={address?.last_name ?? ""} required />
        </Field>
      </div>
      <Field label="Adresse" htmlFor="a_line1" required>
        <Input id="a_line1" name="line1" defaultValue={address?.line1 ?? ""} required />
      </Field>
      <Field label="Complément" htmlFor="a_line2">
        <Input id="a_line2" name="line2" defaultValue={address?.line2 ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code postal" htmlFor="a_postal_code" required>
          <Input id="a_postal_code" name="postal_code" inputMode="numeric" defaultValue={address?.postal_code ?? ""} required />
        </Field>
        <Field label="Ville" htmlFor="a_city" required>
          <Input id="a_city" name="city" defaultValue={address?.city ?? ""} required />
        </Field>
      </div>
      <Field label="Téléphone" htmlFor="a_phone">
        <Input id="a_phone" name="phone" type="tel" defaultValue={address?.phone ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <Checkbox name="is_default" defaultChecked={address?.is_default ?? false} /> Adresse par défaut
      </label>
      <FormError message={state && !state.ok ? state.error : null} />
      <Button type="submit" loading={pending}>
        Enregistrer l&apos;adresse
      </Button>
    </form>
  );
}

export function SavForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(openSavAction, null);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Objet" htmlFor="subject" required>
        <Input id="subject" name="subject" required maxLength={120} placeholder="Ex : la panne est réapparue" />
      </Field>
      <Field label="Description du problème" htmlFor="description" required hint="Quand le problème est-il apparu ? Dans quelles conditions ?">
        <Textarea id="description" name="description" required minLength={10} maxLength={4000} />
      </Field>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? state.message : null} />
      <Button type="submit" loading={pending}>
        Ouvrir la demande SAV
      </Button>
    </form>
  );
}

export function SavReplyForm({ savId, orderId }: { savId: string; orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(savReplyAction, null);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="space-y-3" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="sav_id" value={savId} />
      <input type="hidden" name="order_id" value={orderId} />
      <Textarea name="body" required minLength={2} maxLength={4000} placeholder="Votre réponse…" aria-label="Votre réponse" />
      <FormError message={state && !state.ok ? state.error : null} />
      <Button type="submit" size="sm" loading={pending}>
        Répondre
      </Button>
    </form>
  );
}

export function ReviewForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitReviewAction, null);
  if (state?.ok) return <FormSuccess message={state.message} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Votre note</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="rating" value={n} required className="sr-only" />
              <span className="text-lg" aria-hidden="true">★</span>
              {n}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Titre (facultatif)" htmlFor="title">
        <Input id="title" name="title" maxLength={120} />
      </Field>
      <Field label="Votre avis" htmlFor="body" required>
        <Textarea id="body" name="body" required minLength={10} maxLength={2000} />
      </Field>
      <Field label="Nom affiché (facultatif)" htmlFor="display_name" hint="Ex : Camille D. Laissez vide pour rester anonyme.">
        <Input id="display_name" name="display_name" maxLength={60} />
      </Field>
      <FormError message={state && !state.ok ? state.error : null} />
      <Button type="submit" loading={pending}>
        Publier mon avis
      </Button>
    </form>
  );
}
