"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, FormError, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { formatPrice } from "@/lib/utils/format";
import { decideByTokenAction, type DecisionState } from "@/app/(marketing)/devis/[token]/actions";

/**
 * Deux boutons, et un champ qui n'apparaît qu'au refus.
 *
 * Le motif est demandé **après** le choix, pas avant : présenté d'emblée, il
 * fait hésiter avant même d'avoir décidé. Il reste facultatif — un refus sans
 * explication est un refus valable, et bloquer l'envoi sur un champ vide
 * transformerait une question utile en obstacle.
 */
export function DecisionForm({ token, amountCents }: { token: string; amountCents: number }) {
  const [state, action, pending] = useActionState<DecisionState | null, FormData>(decideByTokenAction, null);
  const [intention, setIntention] = useState<"ACCEPTED" | "REFUSED" | null>(null);

  if (state?.ok) {
    return state.accepted ? (
      <Alert tone="success" title="Devis accepté">
        Votre accord est enregistré. Vous recevez par e-mail les instructions pour déposer votre console en boutique ou nous l&apos;envoyer. Rien ne vous est facturé aujourd&apos;hui.
      </Alert>
    ) : (
      <Alert tone="info" title="Devis refusé">
        Votre refus est enregistré. Aucun frais ne vous est facturé et votre console reste chez vous. Nous restons à votre disposition si vous changez d&apos;avis.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {/*
        La décision vient du bouton qui soumet, et de lui seul.

        Un `<input type="hidden" name="decision">` traînait ici « pour la
        forme ». Comme `FormData.get()` rend la **première** valeur d'un nom,
        c'était la chaîne vide du champ caché qui arrivait au serveur, jamais
        celle du bouton : l'action répondait « Décision invalide » et aucun
        devis ne pouvait être ni accepté ni refusé. L'état React ci-dessous ne
        sert qu'à afficher le champ de motif.
      */}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" name="decision" value="ACCEPTED" variant="accent" loading={pending} onClick={() => setIntention("ACCEPTED")} className="flex-1">
          Accepter le devis — {formatPrice(amountCents)}
        </Button>
        <Button type="button" variant="outline" onClick={() => setIntention("REFUSED")} className="flex-1">
          Refuser le devis
        </Button>
      </div>

      {intention === "REFUSED" ? (
        <div className="space-y-3 border border-border-strong bg-surface p-4">
          <label htmlFor="comment" className="block text-sm font-medium text-ink">
            Pourquoi refusez-vous ce devis ? <span className="font-normal text-ink-muted">(facultatif)</span>
          </label>
          <Textarea id="comment" name="comment" rows={3} maxLength={1000} placeholder="Trop cher, j&apos;ai trouvé ailleurs, je vais racheter une console…" />
          <p className="text-xs text-ink-muted">Votre réponse nous aide à ajuster nos tarifs. Elle n&apos;est lue que par l&apos;atelier.</p>
          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <Checkbox name="confirm" required className="mt-0.5" />
            <span>Je confirme refuser ce devis de {formatPrice(amountCents)}.</span>
          </label>
          <Button type="submit" name="decision" value="REFUSED" variant="outline" loading={pending}>
            Confirmer mon refus
          </Button>
        </div>
      ) : (
        <label className="flex items-start gap-3 text-sm text-ink-soft">
          <Checkbox name="confirm" required className="mt-0.5" />
          <span>
            Je confirme ma décision concernant ce devis de <span className="font-semibold text-ink">{formatPrice(amountCents)}</span>. Elle est enregistrée et horodatée.
          </span>
        </label>
      )}

      <FormError message={state && !state.ok ? state.error : null} />
    </form>
  );
}
