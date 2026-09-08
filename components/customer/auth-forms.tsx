"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/form";
import { forgotPasswordAction, loginAction, magicLinkAction, registerAction, updatePasswordAction, type AuthState } from "@/app/(auth)/actions";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "password" ? loginAction : magicLinkAction, null);
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Connexion</h1>
      <p className="mt-1 text-sm text-ink-muted">Accédez à vos dossiers de réparation.</p>
      <form action={action} className="mt-6 space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field label="E-mail" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        {mode === "password" ? (
          <Field label="Mot de passe" htmlFor="password" required>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
        ) : null}
        <FormError message={state?.error} />
        <FormSuccess message={state?.success} />
        <Button type="submit" fullWidth loading={pending}>
          {mode === "password" ? "Se connecter" : "Recevoir un lien de connexion"}
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-2 text-sm">
        <button type="button" className="text-accent hover:underline" onClick={() => setMode(mode === "password" ? "magic" : "password")}>
          {mode === "password" ? "Recevoir un lien de connexion par e-mail" : "Se connecter avec un mot de passe"}
        </button>
        <Link href={ROUTES.forgotPassword} className="text-ink-muted hover:text-ink">
          Mot de passe oublié ?
        </Link>
        <p className="text-ink-muted">
          Pas encore de compte ?{" "}
          <Link href={`${ROUTES.register}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, null);
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Créer un compte</h1>
      <p className="mt-1 text-sm text-ink-muted">Un compte est créé automatiquement lors d&apos;une commande. Vous pouvez aussi le créer dès maintenant.</p>
      <form action={action} className="mt-6 space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="first_name" required>
            <Input id="first_name" name="first_name" autoComplete="given-name" required />
          </Field>
          <Field label="Nom" htmlFor="last_name" required>
            <Input id="last_name" name="last_name" autoComplete="family-name" required />
          </Field>
        </div>
        <Field label="E-mail" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Mot de passe" htmlFor="password" required hint="8 caractères minimum">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <FormError message={state?.error} />
        <FormSuccess message={state?.success} />
        <Button type="submit" fullWidth loading={pending}>
          Créer mon compte
        </Button>
      </form>
      <p className="mt-4 text-sm text-ink-muted">
        Déjà un compte ?{" "}
        <Link href={ROUTES.login} className="text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPasswordAction, null);
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Mot de passe oublié</h1>
      <p className="mt-1 text-sm text-ink-muted">Recevez un lien pour définir un nouveau mot de passe.</p>
      <form action={action} className="mt-6 space-y-4">
        <Field label="E-mail" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <FormError message={state?.error} />
        <FormSuccess message={state?.success} />
        <Button type="submit" fullWidth loading={pending}>
          Envoyer le lien
        </Button>
      </form>
      <Link href={ROUTES.login} className="mt-4 block text-sm text-ink-muted hover:text-ink">
        ← Retour à la connexion
      </Link>
    </div>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePasswordAction, null);
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Nouveau mot de passe</h1>
      <form action={action} className="mt-6 space-y-4">
        <Field label="Mot de passe" htmlFor="password" required hint="8 caractères minimum">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirmation" htmlFor="confirm" required>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <FormError message={state?.error} />
        <Button type="submit" fullWidth loading={pending}>
          Enregistrer
        </Button>
      </form>
    </div>
  );
}
