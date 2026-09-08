"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { CHECKOUT_STEPS, ROUTES } from "@/config/site";
import { Stepper } from "@/components/ui/stepper";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { formatLeadTime, formatPrice, formatPriceDelta } from "@/lib/utils/format";
import { useAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { PricingResult } from "@/lib/pricing/engine";
import { createOrderAction, quoteSelectionAction } from "@/app/(marketing)/commande/[repairId]/actions";
import { cn } from "@/lib/utils/cn";

export interface CheckoutRepair {
  id: string;
  name: string;
  modelName: string;
  modelSlug: string;
  faultName: string;
  priceCents: number;
  includedItems: string[];
  warrantyMonths: number;
  warrantyScope: string | null;
  importantNotes: string | null;
  isDiagnosticOnly: boolean;
  leadTimeMin: number | null;
  leadTimeMax: number | null;
}
export interface CheckoutOption {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  priceCents: number;
  isRecommended: boolean;
  categoryId: string | null;
}
export interface CheckoutPack {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  priceCents: number;
  isRecommended: boolean;
  optionIds: string[];
  optionNames: string[];
}
export interface CheckoutShipping {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  includesOutbound: boolean;
  includesReturn: boolean;
  insuranceCents: number;
}
interface Customer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}
interface Address {
  line1: string;
  line2: string;
  postal_code: string;
  city: string;
}

interface Props {
  repair: CheckoutRepair;
  options: CheckoutOption[];
  packs: CheckoutPack[];
  shippingMethods: CheckoutShipping[];
  upsellTitle: string;
  upsellText: string | null;
  conditions: { refusalExplanation: string; refusalFeeCents: number; unrepairableFeeCents: number; quoteValidityDays: number; cgvVersion: string | null };
  initialCustomer: Customer | null;
  initialAddress: Address | null;
  isLoggedIn: boolean;
  cancelled: boolean;
}

const LOCAL_STEPS = ["options", "shipping", "details", "payment"] as const;
type LocalStep = (typeof LOCAL_STEPS)[number];
const GLOBAL_OFFSET = 4; // steps 1-4 are the catalogue pages

export function CheckoutFlow(props: Props) {
  const { repair, options, packs, shippingMethods } = props;
  const { track, attribution } = useAnalytics();
  const [step, setStep] = useState<LocalStep>("options");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [shippingId, setShippingId] = useState<string | null>(shippingMethods[0]?.id ?? null);
  const [customer, setCustomer] = useState<Customer>(props.initialCustomer ?? { first_name: "", last_name: "", email: "", phone: "" });
  const [address, setAddress] = useState<Address>(props.initialAddress ?? { line1: "", line2: "", postal_code: "", city: "" });
  const [notes, setNotes] = useState("");
  const [serial, setSerial] = useState("");
  const [alreadyOpened, setAlreadyOpened] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const quoteVersion = useRef(0);

  const stepIndex = LOCAL_STEPS.indexOf(step);
  const startTracked = useRef(false);
  useEffect(() => {
    if (!attribution || startTracked.current) return;
    startTracked.current = true;
    track(ANALYTICS_EVENTS.START_CHECKOUT, { repair_id: repair.id, value_cents: repair.priceCents });
  }, [attribution, track, repair.id, repair.priceCents]);

  // Authoritative server-side pricing whenever the selection changes.
  useEffect(() => {
    const version = ++quoteVersion.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await quoteSelectionAction({ repairId: repair.id, optionIds: selectedOptions, packIds: selectedPacks, shippingMethodId: shippingId });
        if (version !== quoteVersion.current) return;
        if (result.ok) {
          setPricing(result.pricing);
          setPricingError(null);
        } else {
          setPricingError(result.error);
        }
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [repair.id, selectedOptions, selectedPacks, shippingId]);

  const optionsInSelectedPacks = useMemo(() => {
    const set = new Set<string>();
    for (const p of packs) if (selectedPacks.includes(p.id)) p.optionIds.forEach((id) => set.add(id));
    return set;
  }, [packs, selectedPacks]);

  const toggleOption = useCallback(
    (id: string) => {
      setSelectedOptions((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        const option = options.find((o) => o.id === id);
        track(prev.includes(id) ? ANALYTICS_EVENTS.REMOVE_OPTION : ANALYTICS_EVENTS.ADD_OPTION, { option_id: id, option_name: option?.name ?? "", value_cents: option?.priceCents ?? 0, repair_id: repair.id });
        return next;
      });
    },
    [options, track, repair.id],
  );

  const togglePack = useCallback(
    (id: string) => {
      setSelectedPacks((prev) => {
        const already = prev.includes(id);
        const pack = packs.find((p) => p.id === id);
        track(already ? ANALYTICS_EVENTS.REMOVE_PACK : ANALYTICS_EVENTS.SELECT_PACK, { pack_id: id, pack_name: pack?.name ?? "", value_cents: pack?.priceCents ?? 0, repair_id: repair.id });
        if (already) return prev.filter((x) => x !== id);
        // Packs sharing an option are mutually exclusive: replace overlapping ones.
        const overlapping = prev.filter((pid) => {
          const other = packs.find((p) => p.id === pid);
          return other?.optionIds.some((oid) => pack?.optionIds.includes(oid));
        });
        return [...prev.filter((pid) => !overlapping.includes(pid)), id];
      });
    },
    [packs, track, repair.id],
  );

  const goNext = () => {
    setSubmitError(null);
    if (step === "options") setStep("shipping");
    else if (step === "shipping") {
      if (!shippingId) {
        setSubmitError("Choisissez une formule de transport.");
        return;
      }
      const method = shippingMethods.find((m) => m.id === shippingId);
      track(ANALYTICS_EVENTS.SELECT_SHIPPING, { shipping_id: shippingId, shipping_name: method?.name ?? "", value_cents: method?.priceCents ?? 0 });
      setStep("details");
    } else if (step === "details") {
      const errors: Record<string, string> = {};
      if (!customer.first_name.trim()) errors["customer.first_name"] = "Prénom requis";
      if (!customer.last_name.trim()) errors["customer.last_name"] = "Nom requis";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) errors["customer.email"] = "E-mail invalide";
      if (!address.line1.trim()) errors["address.line1"] = "Adresse requise";
      if (!/^\d{5}$/.test(address.postal_code.trim())) errors["address.postal_code"] = "Code postal à 5 chiffres";
      if (!address.city.trim()) errors["address.city"] = "Ville requise";
      setFieldErrors(errors);
      if (Object.keys(errors).length) {
        setSubmitError("Merci de corriger les champs signalés.");
        return;
      }
      setStep("payment");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setSubmitError(null);
    if (stepIndex > 0) setStep(LOCAL_STEPS[stepIndex - 1]!);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!acceptTerms) {
      setSubmitError("Vous devez accepter les conditions générales de vente pour continuer.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await createOrderAction({
      selection: { repairId: repair.id, optionIds: selectedOptions, packIds: selectedPacks, shippingMethodId: shippingId },
      customer: { ...customer, email: customer.email.trim(), phone: customer.phone.trim() },
      address: { ...address, country_code: "FR" },
      customer_notes: notes,
      console_serial_number: serial,
      console_already_opened: alreadyOpened,
      accept_terms: true,
      attribution,
    });
    if (result.ok) {
      track(ANALYTICS_EVENTS.START_PAYMENT, { repair_id: repair.id, value_cents: pricing?.totalCents ?? 0, order_number: result.orderNumber });
      window.location.assign(result.redirectUrl);
      return;
    }
    setSubmitting(false);
    setSubmitError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
    if (result.fieldErrors && Object.keys(result.fieldErrors).some((k) => k.startsWith("customer") || k.startsWith("address"))) setStep("details");
  };

  const total = pricing?.totalCents ?? repair.priceCents;
  const recommendedPacks = packs.filter((p) => p.isRecommended);
  const otherPacks = packs.filter((p) => !p.isRecommended);
  const recommendedOptions = options.filter((o) => o.isRecommended);
  const otherOptions = options.filter((o) => !o.isRecommended);

  return (
    <div>
      <Stepper steps={CHECKOUT_STEPS} current={GLOBAL_OFFSET + stepIndex} className="mb-8" />
      {props.cancelled ? (
        <Alert tone="warning" className="mb-6" title="Paiement annulé">
          Votre paiement n&apos;a pas été finalisé. Vous pouvez reprendre votre commande ci-dessous.
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {/* Step 5: options */}
          {step === "options" ? (
            <section aria-labelledby="step-options">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Étape 5 sur 8 · Options</p>
              <h1 id="step-options" className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {props.upsellTitle}
              </h1>
              <p className="mt-2 text-ink-soft">{props.upsellText ?? "La console est déjà ouverte : c'est le moment idéal pour un entretien. Ces options sont facultatives."}</p>

              {!options.length && !packs.length ? (
                <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface p-6 text-sm text-ink-muted">
                  Aucune option supplémentaire n&apos;est compatible avec cette réparation. Vous pouvez continuer.
                </div>
              ) : null}

              {recommendedPacks.length || otherPacks.length ? (
                <div className="mt-6">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Packs d&apos;entretien</h2>
                  <ul className="grid gap-3">
                    {[...recommendedPacks, ...otherPacks].map((pack) => (
                      <SelectableCard
                        key={pack.id}
                        selected={selectedPacks.includes(pack.id)}
                        onToggle={() => togglePack(pack.id)}
                        title={pack.name}
                        badge={pack.isRecommended ? "Recommandé" : undefined}
                        price={formatPriceDelta(pack.priceCents)}
                        description={pack.shortDescription}
                        details={`Comprend : ${pack.optionNames.join(", ")}`}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}

              {recommendedOptions.length || otherOptions.length ? (
                <div className="mt-8">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Options à l&apos;unité</h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {[...recommendedOptions, ...otherOptions].map((option) => {
                      const inPack = optionsInSelectedPacks.has(option.id);
                      return (
                        <SelectableCard
                          key={option.id}
                          selected={selectedOptions.includes(option.id) && !inPack}
                          disabled={inPack}
                          onToggle={() => toggleOption(option.id)}
                          title={option.name}
                          badge={inPack ? "Inclus dans votre pack" : option.isRecommended ? "Recommandé" : undefined}
                          price={formatPriceDelta(option.priceCents)}
                          description={option.shortDescription}
                        />
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {pricing?.warnings.length ? (
                <Alert tone="info" className="mt-4">
                  {pricing.warnings.join(" ")}
                </Alert>
              ) : null}

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <ButtonLink href={`${ROUTES.repair}/${repair.modelSlug}`} variant="ghost">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Changer de panne
                </ButtonLink>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {selectedOptions.length || selectedPacks.length ? null : (
                    <Button variant="outline" onClick={goNext}>
                      Continuer sans option
                    </Button>
                  )}
                  <Button variant="accent" onClick={goNext}>
                    Continuer <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {/* Step 6: shipping */}
          {step === "shipping" ? (
            <section aria-labelledby="step-shipping">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Étape 6 sur 8 · Transport</p>
              <h1 id="step-shipping" className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Comment souhaitez-vous envoyer votre console ?
              </h1>
              <ul className="mt-6 grid gap-3" role="radiogroup" aria-label="Formule de transport">
                {shippingMethods.map((m) => (
                  <li key={m.id}>
                    <label className={cn("flex cursor-pointer gap-4 rounded-lg border bg-surface p-4 transition-colors", shippingId === m.id ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-border-strong")}>
                      <input type="radio" name="shipping" value={m.id} checked={shippingId === m.id} onChange={() => setShippingId(m.id)} className="mt-1 accent-[var(--color-accent)]" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-ink">{m.name}</span>
                          <span className="shrink-0 font-semibold text-primary">{m.priceCents === 0 ? "Gratuit" : formatPrice(m.priceCents)}</span>
                        </span>
                        {m.description ? <span className="mt-1 block text-sm text-ink-soft">{m.description}</span> : null}
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {m.includesOutbound ? <Badge tone="info">Étiquette aller fournie</Badge> : null}
                          {m.includesReturn ? <Badge tone="info">Retour inclus</Badge> : null}
                          {m.insuranceCents > 0 ? <Badge tone="success">Assuré jusqu&apos;à {formatPrice(m.insuranceCents)}</Badge> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-muted">
                Les instructions d&apos;emballage vous seront envoyées après paiement.{" "}
                <Link href={ROUTES.packaging} className="text-accent underline" target="_blank">
                  Les consulter dès maintenant
                </Link>
              </p>
              <FormError message={submitError} />
              <NavButtons onBack={goBack} onNext={goNext} />
            </section>
          ) : null}

          {/* Step 7: details */}
          {step === "details" ? (
            <section aria-labelledby="step-details">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Étape 7 sur 8 · Coordonnées</p>
              <h1 id="step-details" className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Vos coordonnées
              </h1>
              {!props.isLoggedIn ? (
                <p className="mt-2 text-sm text-ink-soft">
                  Un espace client sera créé avec votre e-mail pour suivre le dossier.{" "}
                  <Link href={`${ROUTES.login}?next=${encodeURIComponent(`${ROUTES.checkout}/${repair.id}`)}`} className="text-accent underline">
                    Déjà client ? Connectez-vous
                  </Link>
                </p>
              ) : null}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Prénom" htmlFor="first_name" required error={fieldErrors["customer.first_name"]}>
                  <Input id="first_name" autoComplete="given-name" value={customer.first_name} onChange={(e) => setCustomer({ ...customer, first_name: e.target.value })} aria-invalid={Boolean(fieldErrors["customer.first_name"])} />
                </Field>
                <Field label="Nom" htmlFor="last_name" required error={fieldErrors["customer.last_name"]}>
                  <Input id="last_name" autoComplete="family-name" value={customer.last_name} onChange={(e) => setCustomer({ ...customer, last_name: e.target.value })} aria-invalid={Boolean(fieldErrors["customer.last_name"])} />
                </Field>
                <Field label="E-mail" htmlFor="email" required error={fieldErrors["customer.email"]} hint="Vos notifications de suivi seront envoyées à cette adresse.">
                  <Input id="email" type="email" autoComplete="email" inputMode="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} aria-invalid={Boolean(fieldErrors["customer.email"])} readOnly={props.isLoggedIn} />
                </Field>
                <Field label="Téléphone" htmlFor="phone" error={fieldErrors["customer.phone"]} hint="Utile en cas de question urgente sur votre console.">
                  <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} aria-invalid={Boolean(fieldErrors["customer.phone"])} />
                </Field>
              </div>
              <h2 className="mt-8 text-lg font-semibold text-ink">Adresse de retour</h2>
              <p className="text-sm text-ink-muted">La console vous sera renvoyée à cette adresse (France uniquement).</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Adresse" htmlFor="line1" required className="sm:col-span-2" error={fieldErrors["address.line1"]}>
                  <Input id="line1" autoComplete="address-line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} aria-invalid={Boolean(fieldErrors["address.line1"])} />
                </Field>
                <Field label="Complément d'adresse" htmlFor="line2" className="sm:col-span-2">
                  <Input id="line2" autoComplete="address-line2" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
                </Field>
                <Field label="Code postal" htmlFor="postal_code" required error={fieldErrors["address.postal_code"]}>
                  <Input id="postal_code" autoComplete="postal-code" inputMode="numeric" value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} aria-invalid={Boolean(fieldErrors["address.postal_code"])} />
                </Field>
                <Field label="Ville" htmlFor="city" required error={fieldErrors["address.city"]}>
                  <Input id="city" autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} aria-invalid={Boolean(fieldErrors["address.city"])} />
                </Field>
              </div>
              <h2 className="mt-8 text-lg font-semibold text-ink">À propos de votre console</h2>
              <div className="mt-4 grid gap-4">
                <Field label="Décrivez les symptômes" htmlFor="notes" hint="Quand la panne survient-elle ? Depuis quand ? Avez-vous déjà tenté quelque chose ?">
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
                </Field>
                <Field label="Numéro de série (facultatif)" htmlFor="serial" hint="Sous la console ou dans les paramètres système. Il sera vérifié à réception.">
                  <Input id="serial" value={serial} onChange={(e) => setSerial(e.target.value)} maxLength={60} />
                </Field>
                <label className="flex items-start gap-3 text-sm text-ink-soft">
                  <Checkbox checked={alreadyOpened} onChange={(e) => setAlreadyOpened(e.target.checked)} className="mt-0.5" />
                  La console a déjà été ouverte ou a subi une tentative de réparation.
                </label>
              </div>
              <FormError message={submitError} />
              <NavButtons onBack={goBack} onNext={goNext} nextLabel="Vérifier ma commande" />
            </section>
          ) : null}

          {/* Step 8: payment / summary */}
          {step === "payment" ? (
            <section aria-labelledby="step-payment">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Étape 8 sur 8 · Paiement</p>
              <h1 id="step-payment" className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Vérifiez et payez
              </h1>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SummaryBox title="Console et panne" onEdit={() => setStep("options")} editLabel="Modifier les options">
                  <p className="font-medium text-ink">{repair.modelName}</p>
                  <p className="text-ink-soft">{repair.faultName}</p>
                  <p className="mt-1 text-ink-soft">{repair.name}</p>
                </SummaryBox>
                <SummaryBox title="Transport" onEdit={() => setStep("shipping")}>
                  <p className="font-medium text-ink">{shippingMethods.find((m) => m.id === shippingId)?.name}</p>
                  <p className="text-ink-soft">{shippingMethods.find((m) => m.id === shippingId)?.description}</p>
                </SummaryBox>
                <SummaryBox title="Coordonnées" onEdit={() => setStep("details")}>
                  <p className="font-medium text-ink">
                    {customer.first_name} {customer.last_name}
                  </p>
                  <p className="text-ink-soft">{customer.email}</p>
                  {customer.phone ? <p className="text-ink-soft">{customer.phone}</p> : null}
                </SummaryBox>
                <SummaryBox title="Adresse de retour" onEdit={() => setStep("details")}>
                  <p className="text-ink">{address.line1}</p>
                  {address.line2 ? <p className="text-ink">{address.line2}</p> : null}
                  <p className="text-ink">
                    {address.postal_code} {address.city}
                  </p>
                </SummaryBox>
              </div>

              <div className="mt-6 rounded-lg border border-border bg-surface p-5">
                <h2 className="font-semibold text-ink">Prestations, garantie et conditions</h2>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                  {repair.includedItems.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Délai indicatif</dt>
                    <dd className="text-ink">{formatLeadTime(repair.leadTimeMin, repair.leadTimeMax)} (hors transport)</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Garantie</dt>
                    <dd className="text-ink">{repair.warrantyMonths > 0 ? `${repair.warrantyMonths} mois sur l'intervention` : "Selon la réparation issue du diagnostic"}</dd>
                  </div>
                </dl>
                {repair.warrantyScope ? <p className="mt-2 text-xs text-ink-muted">{repair.warrantyScope}</p> : null}
                <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-ink-soft">
                  <p>
                    <span className="font-medium text-ink">Devis complémentaire :</span> si une autre intervention est nécessaire, vous recevez un devis (valable {props.conditions.quoteValidityDays} jours). Rien n&apos;est réalisé sans votre accord.
                  </p>
                  <p>
                    <span className="font-medium text-ink">Refus de devis :</span> {props.conditions.refusalExplanation}
                    {props.conditions.refusalFeeCents > 0 ? ` Frais applicables : ${formatPrice(props.conditions.refusalFeeCents)}.` : " Aucun frais supplémentaire."}
                  </p>
                  <p>
                    <span className="font-medium text-ink">Console irréparable :</span>{" "}
                    {props.conditions.unrepairableFeeCents > 0 ? `frais de ${formatPrice(props.conditions.unrepairableFeeCents)} (diagnostic et retour).` : "aucun frais supplémentaire, la console vous est retournée."}
                  </p>
                  {repair.importantNotes ? <p>{repair.importantNotes}</p> : null}
                </div>
              </div>

              <label className="mt-6 flex items-start gap-3 text-sm text-ink-soft">
                <Checkbox checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" required />
                <span>
                  J&apos;ai lu et j&apos;accepte les{" "}
                  <Link href={ROUTES.cgv} target="_blank" className="text-accent underline">
                    conditions générales de vente
                  </Link>
                  {props.conditions.cgvVersion ? ` (version ${props.conditions.cgvVersion})` : ""} et la{" "}
                  <Link href={ROUTES.privacy} target="_blank" className="text-accent underline">
                    politique de confidentialité
                  </Link>
                  .
                </span>
              </label>
              <div className="mt-4">
                <FormError message={submitError} />
              </div>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button variant="ghost" onClick={goBack} disabled={submitting}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour
                </Button>
                <Button variant="accent" size="lg" onClick={submit} loading={submitting} disabled={!pricing || Boolean(pricingError)}>
                  <Lock className="h-4 w-4" aria-hidden="true" /> Payer {formatPrice(total)}
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        {/* Order summary */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="font-semibold text-ink">Votre réparation</h2>
            <OrderSummary repair={repair} pricing={pricing} loading={isPending} error={pricingError} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky total */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">Total TTC{isPending ? " · calcul…" : ""}</p>
            <p className="text-lg font-bold text-primary">{formatPrice(total)}</p>
          </div>
          {step === "payment" ? (
            <Button variant="accent" onClick={submit} loading={submitting} disabled={!pricing || Boolean(pricingError)}>
              Passer au paiement
            </Button>
          ) : (
            <Button variant="accent" onClick={goNext}>
              Continuer <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectableCard({
  selected,
  disabled,
  onToggle,
  title,
  badge,
  price,
  description,
  details,
}: {
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
  title: string;
  badge?: string;
  price: string;
  description: string | null;
  details?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          "flex w-full gap-3 rounded-lg border bg-surface p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          selected ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-border-strong",
        )}
      >
        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border", selected ? "border-accent bg-accent text-white" : "border-border-strong bg-surface")} aria-hidden="true">
          {selected ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="font-semibold text-ink">{title}</span>
            <span className="shrink-0 font-semibold text-primary">{price}</span>
          </span>
          {badge ? (
            <Badge tone={badge === "Recommandé" ? "success" : "neutral"} className="mt-1">
              {badge}
            </Badge>
          ) : null}
          {description ? <span className="mt-1 block text-sm text-ink-soft">{description}</span> : null}
          {details ? <span className="mt-1 block text-xs text-ink-muted">{details}</span> : null}
        </span>
      </button>
    </li>
  );
}

function NavButtons({ onBack, onNext, nextLabel = "Continuer" }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour
      </Button>
      <Button variant="accent" onClick={onNext}>
        {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function SummaryBox({ title, children, onEdit, editLabel = "Modifier" }: { title: string; children: React.ReactNode; onEdit: () => void; editLabel?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</p>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-accent hover:underline">
          {editLabel}
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function OrderSummary({ repair, pricing, loading, error }: { repair: { name: string; priceCents: number }; pricing: PricingResult | null; loading: boolean; error: string | null }) {
  const lines = pricing?.lines ?? [{ type: "REPAIR" as const, referenceId: "", label: repair.name, quantity: 1, unitPriceCents: repair.priceCents, totalCents: repair.priceCents, estimatedCostCents: 0 }];
  return (
    <div className={cn("mt-3", loading && "opacity-70")} aria-live="polite">
      <ul className="divide-y divide-border text-sm">
        {lines.map((line) => (
          <li key={`${line.type}-${line.referenceId}`} className="flex items-start justify-between gap-3 py-2">
            <span>
              <span className={cn("block", line.type === "REPAIR" ? "font-medium text-ink" : "text-ink-soft")}>{line.label}</span>
              {line.includes?.length ? <span className="block text-xs text-ink-muted">{line.includes.join(" · ")}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums text-ink">{line.type === "REPAIR" ? formatPrice(line.totalCents) : formatPriceDelta(line.totalCents)}</span>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
        <span className="font-semibold text-ink">Total TTC</span>
        <span className="text-xl font-bold text-primary">{formatPrice(pricing?.totalCents ?? repair.priceCents)}</span>
      </div>
      {pricing ? (
        <p className="mt-1 text-xs text-ink-muted">
          dont TVA {formatPrice(pricing.vatCents)}
          {pricing.packSavingsCents > 0 ? ` · vous économisez ${formatPrice(pricing.packSavingsCents)} grâce au pack` : ""}
        </p>
      ) : null}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Paiement sécurisé · prix calculé et vérifié par nos serveurs
      </p>
    </div>
  );
}
