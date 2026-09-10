"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { FormError } from "@/components/ui/form";
import { DraftPhotoUploader, type DraftPhoto } from "@/components/customer/draft-photo-uploader";
import { createTradeInAction } from "@/app/(marketing)/reprise/actions";
import { TRADE_IN_ACCESSORIES, TRADE_IN_CONDITION_LABELS, TRADE_IN_ITEM_TYPE_LABELS, type TradeInCondition, type TradeInItemType } from "@/lib/tradein/status";
import type { FormCustomer, FormModel } from "@/components/repair/repair-form-types";
import { cn } from "@/lib/utils/cn";

interface Props {
  platforms: string[];
  models: FormModel[];
  initialCustomer: FormCustomer | null;
  isLoggedIn: boolean;
}

/** Formulaire de reprise (carte papier du handoff) : lot, état, accessoires, photos, coordonnées. */
export function TradeInForm(props: Props) {
  const [itemType, setItemType] = useState<TradeInItemType>("CONSOLE");
  const [platform, setPlatform] = useState("");
  const [modelId, setModelId] = useState("");
  const [title, setTitle] = useState("");
  const [condition, setCondition] = useState<TradeInCondition>("GOOD");
  const [accessories, setAccessories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [customer, setCustomer] = useState<FormCustomer>(props.initialCustomer ?? { first_name: "", last_name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const wanted = platform.trim().toLowerCase();
  const modelsForPlatform = props.models.filter((m) => !wanted || m.brandName.toLowerCase() === wanted || m.name.toLowerCase() === wanted || m.name.toLowerCase().startsWith(wanted));

  const submit = async () => {
    setError(null);
    const errors: Record<string, string> = {};
    if (!platform.trim()) errors.platform = "Plateforme requise";
    if (title.trim().length < 3) errors.item_title = "Décrivez le lot en quelques mots";
    if (!customer.first_name.trim()) errors["customer.first_name"] = "Prénom requis";
    if (!customer.last_name.trim()) errors["customer.last_name"] = "Nom requis";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) errors["customer.email"] = "E-mail invalide";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return setError("Merci de corriger les champs signalés.");
    setSubmitting(true);
    const result = await createTradeInAction({
      item_type: itemType,
      platform: platform.trim(),
      model_id: modelId || null,
      item_title: title.trim(),
      condition,
      accessories,
      description: description.trim(),
      photos: photos.map((p) => p.path),
      customer: { ...customer, email: customer.email.trim(), phone: customer.phone.trim() },
    });
    if (result.ok) {
      window.location.assign(result.redirectUrl);
      return;
    }
    setSubmitting(false);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  };

  return (
    <div className="bg-paper p-[26px] text-ink-900">
      <strong className="font-mono text-[12px] uppercase tracking-[0.08em]">Demande de reprise</strong>
      <h3 className="mt-4 text-[22px] font-extrabold tracking-[-0.01em]">Que souhaitez-vous vendre ?</h3>
      <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
        {(Object.keys(TRADE_IN_ITEM_TYPE_LABELS) as TradeInItemType[]).map((t) => (
          <button key={t} type="button" onClick={() => setItemType(t)} aria-pressed={itemType === t} className={cn("cursor-pointer border p-[13px] text-left text-[15px] font-semibold transition-colors hover:border-accent", itemType === t ? "border-ink-900 bg-ink-900 text-paper" : "border-[rgba(20,18,15,0.22)]")}>
            {TRADE_IN_ITEM_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <span className="flex flex-col gap-1">
          <input list="trade-in-platforms" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Plateforme (PS5, Switch, Mega Drive…)" aria-label="Plateforme" aria-invalid={Boolean(fieldErrors.platform)} className={cn("w-full border bg-white p-3 text-[16px] text-ink-900 sm:text-[15px] placeholder:text-ink-muted focus:border-accent focus:outline-none", fieldErrors.platform ? "border-danger" : "border-[rgba(20,18,15,0.22)]")} />
          <datalist id="trade-in-platforms">
            {props.platforms.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          {fieldErrors.platform ? <span className="text-xs font-medium text-danger">{fieldErrors.platform}</span> : null}
        </span>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)} aria-label="Modèle" className="border border-[rgba(20,18,15,0.22)] bg-white p-3 text-[16px] text-ink-900 sm:text-[15px]">
          <option value="">Modèle (facultatif)</option>
          {modelsForPlatform.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="flex flex-col gap-1 [grid-column:1/-1]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Intitulé du lot — ex. : PS3 Fat + 14 jeux" aria-label="Intitulé du lot" aria-invalid={Boolean(fieldErrors.item_title)} className={cn("w-full border bg-white p-3 text-[16px] text-ink-900 sm:text-[15px] placeholder:text-ink-muted focus:border-accent focus:outline-none", fieldErrors.item_title ? "border-danger" : "border-[rgba(20,18,15,0.22)]")} />
          {fieldErrors.item_title ? <span className="text-xs font-medium text-danger">{fieldErrors.item_title}</span> : null}
        </span>
      </div>

      <h3 className="mt-6 text-[22px] font-extrabold tracking-[-0.01em]">État et accessoires</h3>
      <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="État">
        {(Object.keys(TRADE_IN_CONDITION_LABELS) as TradeInCondition[]).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={condition === c} onClick={() => setCondition(c)} className={cn("flex cursor-pointer items-center gap-3 border border-[rgba(20,18,15,0.22)] p-[13px_14px] text-left transition-colors hover:border-accent", condition === c ? "bg-[var(--selection)]" : "bg-transparent")}>
            <span className={cn("h-4 w-4 flex-none border border-ink-900", condition === c ? "bg-accent" : "bg-white")} aria-hidden="true" />
            <span className="text-[15px] font-semibold">{TRADE_IN_CONDITION_LABELS[c]}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {TRADE_IN_ACCESSORIES.map((a) => {
          const on = accessories.includes(a);
          return (
            <button key={a} type="button" aria-pressed={on} onClick={() => setAccessories((prev) => (on ? prev.filter((x) => x !== a) : [...prev, a]))} className={cn("cursor-pointer whitespace-nowrap border px-[11px] py-[13px] font-mono text-[11.5px] uppercase tracking-[0.05em] hover:border-accent sm:py-2", on ? "border-ink-900 bg-ink-900 text-paper" : "border-dashed border-[rgba(20,18,15,0.3)] bg-paper-alt text-ink-900")}>
              {on ? "✓ " : "+ "}
              {a}
            </button>
          );
        })}
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Précisions : défauts, jeux inclus, historique, rayures, pièces manquantes…" aria-label="Description" className="mt-3 min-h-[110px] w-full resize-y border border-[rgba(20,18,15,0.22)] bg-white p-[13px] text-[16px] leading-normal text-ink-900 sm:text-[15px] placeholder:text-ink-muted focus:border-accent focus:outline-none" />
      <div className="mt-3">
        <DraftPhotoUploader photos={photos} onChange={setPhotos} label="déposez des photos du lot" />
      </div>

      <h3 className="mt-6 text-[22px] font-extrabold tracking-[-0.01em]">Vos coordonnées</h3>
      {!props.isLoggedIn ? (
        <p className="mt-1 text-[13px] text-ink-faint">
          Vous recevrez notre offre par e-mail, avec un lien pour l&apos;accepter ou la refuser.{" "}
          <Link href={`${ROUTES.login}?next=${encodeURIComponent(ROUTES.tradeIn)}`} className="text-sale underline">
            Déjà client ? Connectez-vous
          </Link>
        </p>
      ) : null}
      <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <Field placeholder="Prénom" autoComplete="given-name" value={customer.first_name} onChange={(v) => setCustomer({ ...customer, first_name: v })} error={fieldErrors["customer.first_name"]} />
        <Field placeholder="Nom" autoComplete="family-name" value={customer.last_name} onChange={(v) => setCustomer({ ...customer, last_name: v })} error={fieldErrors["customer.last_name"]} />
        <Field placeholder="Téléphone" type="tel" autoComplete="tel" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} error={fieldErrors["customer.phone"]} />
        <Field placeholder="E-mail" type="email" autoComplete="email" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} error={fieldErrors["customer.email"]} readOnly={props.isLoggedIn} />
      </div>
      <p className="mt-3 text-[13px] leading-[1.45] text-ink-faint">Estimation indicative après examen des photos ; l&apos;offre définitive est confirmée au comptoir lors du dépôt du lot, après vérification. Paiement au comptoir le jour même.</p>
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
      <button type="button" onClick={submit} disabled={submitting} className="mt-5 w-full cursor-pointer bg-ink-900 px-4 py-[14px] font-mono text-[12.5px] uppercase tracking-[0.06em] text-paper hover:bg-sale disabled:opacity-60">
        {submitting ? "Envoi…" : "Estimer mon lot"}
      </button>
    </div>
  );
}

function Field({ value, onChange, error, className, ...rest }: { value: string; onChange: (v: string) => void; error?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <span className={cn("flex flex-col gap-1", className)}>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} aria-label={rest.placeholder} aria-invalid={Boolean(error)} className={cn("w-full border bg-white p-3 text-[16px] text-ink-900 sm:text-[15px] placeholder:text-ink-muted focus:border-accent focus:outline-none read-only:bg-paper-alt", error ? "border-danger" : "border-[rgba(20,18,15,0.22)]")} />
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
