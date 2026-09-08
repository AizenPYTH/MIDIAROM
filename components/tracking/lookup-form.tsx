"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { lookupOrderAction, type TrackingState } from "@/app/(marketing)/suivi/actions";

export function TrackingLookupForm() {
  const [state, action, pending] = useActionState<TrackingState, FormData>(lookupOrderAction, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Numéro de dossier" htmlFor="order_number" required hint="Format REP-000152, indiqué dans votre e-mail de confirmation.">
        <Input id="order_number" name="order_number" placeholder="REP-000152" autoComplete="off" required className="font-mono uppercase" />
      </Field>
      <Field label="E-mail de la commande" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormError message={state?.error} />
      <Button type="submit" fullWidth loading={pending}>
        Voir l&apos;avancement
      </Button>
      <p className="text-center text-sm text-ink-muted">
        <Link href={ROUTES.login} className="text-accent hover:underline">
          Se connecter à mon espace client
        </Link>
      </p>
    </form>
  );
}
