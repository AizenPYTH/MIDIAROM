"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { useCart } from "@/components/shop/cart-provider";
import { Checkbox, FormError } from "@/components/ui/form";
import { createShopOrderAction, priceCartAction, type PriceCartState } from "@/app/(marketing)/panier/actions";
import { useAnalytics } from "@/lib/analytics/client";
import { formatPrice } from "@/lib/utils/format";
import type { FormAddress, FormCustomer } from "@/components/repair/repair-form-types";
import { cn } from "@/lib/utils/cn";

interface Props {
  initialCustomer: FormCustomer | null;
  initialAddress: FormAddress | null;
  isLoggedIn: boolean;
  cgvVersion: string | null;
  cancelled: boolean;
}

/** Commande boutique : mode de retrait, coordonnées, récapitulatif encre, CGV, paiement. */
export function ShopCheckoutForm(props: Props) {
  const cart = useCart();
  const { attribution } = useAnalytics();
  const [chosenFulfillment, setFulfillment] = useState<"PICKUP" | "SHIPPING" | null>(null);
  const [customer, setCustomer] = useState<FormCustomer>(props.initialCustomer ?? { first_name: "", last_name: "", email: "", phone: "" });
  const [address, setAddress] = useState<FormAddress>(props.initialAddress ?? { line1: "", line2: "", postal_code: "", city: "" });
  const [notes, setNotes] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [state, setState] = useState<PriceCartState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  // Mode par défaut : retrait si proposé, sinon envoi ; le choix explicite du client prime.
  const fulfillment: "PICKUP" | "SHIPPING" = chosenFulfillment ?? (state?.ok && !state.pickupEnabled && state.shippingEnabled ? "SHIPPING" : "PICKUP");

  useEffect(() => {
    if (!cart.ready) return;
    startTransition(async () => setState(await priceCartAction({ lines: cart.lines, fulfillment })));
  }, [cart.lines, cart.ready, fulfillment]);

  const submit = async () => {
    setError(null);
    const errors: Record<string, string> = {};
    if (!customer.first_name.trim()) errors["customer.first_name"] = "Prénom requis";
    if (!customer.last_name.trim()) errors["customer.last_name"] = "Nom requis";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) errors["customer.email"] = "E-mail invalide";
    if (fulfillment === "SHIPPING") {
      if (!address.line1.trim()) errors["address.line1"] = "Adresse requise";
      if (!/^\d{5}$/.test(address.postal_code.trim())) errors["address.postal_code"] = "Code postal à 5 chiffres";
      if (!address.city.trim()) errors["address.city"] = "Ville requise";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return setError("Merci de corriger les champs signalés.");
    if (!acceptTerms) return setError("Vous devez accepter les conditions générales de vente pour continuer.");
    setSubmitting(true);
    const result = await createShopOrderAction({
      lines: cart.lines,
      fulfillment,
      customer: { ...customer, email: customer.email.trim(), phone: customer.phone.trim() },
      address: fulfillment === "SHIPPING" ? { ...address, country_code: "FR" } : null,
      customer_notes: notes.trim(),
      accept_terms: true,
      attribution,
    });
    if (result.ok) {
      cart.clear();
      window.location.assign(result.redirectUrl);
      return;
    }
    setSubmitting(false);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  };

  if (!cart.ready || !state) return <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-muted">Chargement…</p>;
  if (!state.ok) return <FormError message={state.error} />;
  if (!state.lines.length) {
    return (
      <div className="border border-dashed border-border-strong bg-surface-muted px-6 py-8">
        <p className="text-[15.5px] font-semibold text-ink">Votre panier est vide.</p>
        <Link href={ROUTES.shop} className="mt-4 inline-block bg-ink-900 px-[22px] py-3.5 text-[15px] font-semibold text-paper hover:bg-sale">
          Voir la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
      <div className="bg-paper p-[26px] text-ink-900">
        <strong className="font-mono text-[12px] uppercase tracking-[0.08em]">Commande boutique</strong>
        {props.cancelled ? <p className="mt-3 border border-warning bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning">Le paiement n&apos;a pas été finalisé. Vous pouvez reprendre votre commande.</p> : null}
        <h3 className="mt-4 text-[22px] font-extrabold tracking-[-0.01em]">Retrait ou envoi</h3>
        <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Mode de retrait">
          {state.pickupEnabled ? <FulfillmentRow selected={fulfillment === "PICKUP"} onPick={() => setFulfillment("PICKUP")} label="Retrait au magasin" note={state.pickupNote || "Sans rendez-vous, aux horaires d'ouverture."} price="0 €" /> : null}
          {state.shippingEnabled ? <FulfillmentRow selected={fulfillment === "SHIPPING"} onPick={() => setFulfillment("SHIPPING")} label="Envoi à domicile" note={state.shippingNote || "Colis suivi."} price={state.freeShippingReached ? "offert" : formatPrice(state.shippingFeeCents)} /> : null}
        </div>

        <h3 className="mt-6 text-[22px] font-extrabold tracking-[-0.01em]">Coordonnées</h3>
        {!props.isLoggedIn ? (
          <p className="mt-1 text-[13px] text-ink-faint">
            Un espace client est créé avec votre e-mail pour suivre la commande.{" "}
            <Link href={`${ROUTES.login}?next=${encodeURIComponent(ROUTES.shopCheckout)}`} className="text-sale underline">
              Déjà client ? Connectez-vous
            </Link>
          </p>
        ) : null}
        <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          <Field placeholder="Prénom" autoComplete="given-name" value={customer.first_name} onChange={(v) => setCustomer({ ...customer, first_name: v })} error={fieldErrors["customer.first_name"]} />
          <Field placeholder="Nom" autoComplete="family-name" value={customer.last_name} onChange={(v) => setCustomer({ ...customer, last_name: v })} error={fieldErrors["customer.last_name"]} />
          <Field placeholder="Téléphone" type="tel" autoComplete="tel" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} error={fieldErrors["customer.phone"]} />
          <Field placeholder="E-mail" type="email" autoComplete="email" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} error={fieldErrors["customer.email"]} readOnly={props.isLoggedIn} />
          {fulfillment === "SHIPPING" ? (
            <>
              <Field placeholder="Adresse de livraison" autoComplete="address-line1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} error={fieldErrors["address.line1"]} className="[grid-column:1/-1]" />
              <Field placeholder="Complément d'adresse (facultatif)" autoComplete="address-line2" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} className="[grid-column:1/-1]" />
              <Field placeholder="Code postal" autoComplete="postal-code" inputMode="numeric" value={address.postal_code} onChange={(v) => setAddress({ ...address, postal_code: v })} error={fieldErrors["address.postal_code"]} />
              <Field placeholder="Ville" autoComplete="address-level2" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} error={fieldErrors["address.city"]} />
            </>
          ) : null}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Remarque pour le magasin (facultatif)" aria-label="Remarque" className="[grid-column:1/-1] min-h-[70px] border border-[rgba(20,18,15,0.22)] bg-white p-3 text-[15px] text-ink-900 placeholder:text-ink-muted focus:border-accent focus:outline-none" />
        </div>
        <label className="mt-4 flex items-start gap-3 text-[13px] text-ink-faint">
          <Checkbox checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" required />
          <span>
            J&apos;ai lu et j&apos;accepte les{" "}
            <Link href={ROUTES.cgv} target="_blank" className="text-sale underline">
              conditions générales de vente
            </Link>
            {props.cgvVersion && !props.cgvVersion.startsWith("draft") ? ` (version ${props.cgvVersion})` : ""}.
          </span>
        </label>
        {error ? (
          <div className="mt-4">
            <FormError message={error} />
          </div>
        ) : null}
        <button type="button" onClick={submit} disabled={submitting} className="mt-5 w-full cursor-pointer bg-sale px-4 py-[14px] font-mono text-[12.5px] uppercase tracking-[0.06em] text-white hover:bg-ink-900 disabled:opacity-60">
          {submitting ? "Redirection…" : `Payer ${formatPrice(state.totalCents)}`}
        </button>
        <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">Paiement sécurisé · prix et stock vérifiés par nos serveurs</p>
      </div>

      <aside className="bg-ink-900 p-4 text-paper">
        <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Récapitulatif</span>
        <div className="mt-[11px] flex flex-col gap-[7px] text-[14.5px]">
          {state.lines.map((l) => (
            <div key={l.productId} className="flex justify-between gap-3.5">
              <span className="text-[#c4bdae]">
                {l.label}
                {l.quantity > 1 ? ` × ${l.quantity}` : ""}
              </span>
              <span className="whitespace-nowrap font-mono">{formatPrice(l.totalCents)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3.5 border-t border-ink-700 pt-2">
            <span className="text-[#c4bdae]">{fulfillment === "PICKUP" ? "Retrait au magasin" : "Envoi"}</span>
            <span className="font-mono">{state.shippingCents ? formatPrice(state.shippingCents) : fulfillment === "SHIPPING" ? "offert" : "0 €"}</span>
          </div>
          <div className="flex justify-between gap-3.5 text-[16px] font-semibold">
            <span>Total TTC</span>
            <span className="font-mono">{formatPrice(state.totalCents)}</span>
          </div>
          <div className="flex justify-between gap-3.5 text-[12.5px]">
            <span className="text-[#c4bdae]">dont TVA</span>
            <span className="font-mono">{formatPrice(state.vatCents)}</span>
          </div>
        </div>
        <Link href={ROUTES.cart} className="mt-4 inline-block font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted hover:text-paper">
          ← Modifier le panier
        </Link>
      </aside>
    </div>
  );
}

function FulfillmentRow({ selected, onPick, label, note, price }: { selected: boolean; onPick: () => void; label: string; note: string; price: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} className={cn("flex cursor-pointer items-center justify-between gap-3 border border-[rgba(20,18,15,0.22)] p-[13px_14px] text-left transition-colors hover:border-accent", selected ? "bg-[var(--selection)]" : "bg-transparent")}>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-[13px] text-ink-faint">{note}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap font-mono text-[14px]">{price}</span>
    </button>
  );
}

function Field({ value, onChange, error, className, ...rest }: { value: string; onChange: (v: string) => void; error?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <span className={cn("flex flex-col gap-1", className)}>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} aria-label={rest.placeholder} aria-invalid={Boolean(error)} className={cn("w-full border bg-white p-3 text-[15px] text-ink-900 placeholder:text-ink-muted focus:border-accent focus:outline-none read-only:bg-paper-alt", error ? "border-danger" : "border-[rgba(20,18,15,0.22)]")} />
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
