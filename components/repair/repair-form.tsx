"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { Checkbox, FormError } from "@/components/ui/form";
import { formatPrice, formatPriceDelta } from "@/lib/utils/format";
import { useAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { PricingResult } from "@/lib/pricing/engine";
import { createOrderAction, quoteSelectionAction } from "@/app/(marketing)/commande/[repairId]/actions";
import { loadModelRepairsAction, loadOfferAction } from "@/app/(marketing)/reparation/actions";
import type { FormAddress, FormConditions, FormCustomer, FormModel, FormOffer, FormPlatform, FormRepair } from "@/components/repair/repair-form-types";
import { DraftPhotoUploader, type DraftPhoto } from "@/components/customer/draft-photo-uploader";
import { cn } from "@/lib/utils/cn";

/**
 * « Fiche de réparation » du handoff : carte papier en 4 étapes.
 *  1. Quel appareil ?            → plateforme (marque / rétro) puis modèle exact du catalogue
 *  2. Quelle prestation ?        → prestations liées au modèle exact + options / packs compatibles
 *  3. Décrivez le problème       → description libre + symptômes multiples + photos (+ n° de série)
 *  4. Envoi et coordonnées       → coordonnées, transport, récapitulatif, CGV
 * Le prix est calculé et vérifié par le serveur à chaque changement ; la
 * commande est créée côté serveur puis redirigée vers le paiement.
 */
export interface RepairFormProps {
  models: FormModel[];
  initialModelId?: string | null;
  initialRepairs?: FormRepair[];
  initialRepairId?: string | null;
  initialOffer?: FormOffer | null;
  initialStep?: 1 | 2 | 3 | 4;
  conditions: FormConditions;
  initialCustomer: FormCustomer | null;
  initialAddress: FormAddress | null;
  isLoggedIn: boolean;
  cancelled?: boolean;
  showPrices?: boolean;
  /** Lorsque true, la fiche occupe toute la largeur (page /reparation). */
  wide?: boolean;
}

const SYMPTOMS = ["ne s'allume plus", "surchauffe", "pas d'image", "bruit anormal", "ne charge plus", "dégât liquide"];
const MIN_DESCRIPTION = 20;
const RETRO_KEY = "retro";

type Step = 1 | 2 | 3 | 4;

/** Plateformes de l'étape 1, dérivées du catalogue (marques actives + regroupement rétro). */
function buildPlatforms(models: FormModel[]): FormPlatform[] {
  const platforms: FormPlatform[] = [];
  for (const m of models) {
    if (platforms.some((p) => p.key === m.brandId)) continue;
    const own = models.filter((x) => x.brandId === m.brandId);
    const first = own[0]?.name ?? "";
    const last = own[own.length - 1]?.name ?? "";
    platforms.push({ key: m.brandId, label: m.brandName, note: own.length > 1 ? `${first} → ${last}` : first });
  }
  const retro = models.filter((m) => m.isRetro);
  if (retro.length) platforms.push({ key: RETRO_KEY, label: "Rétro", note: `${retro.length} consoles anciennes` });
  return platforms;
}

export function RepairForm(props: RepairFormProps) {
  const { models, conditions } = props;
  const { track, attribution } = useAnalytics();
  const [step, setStep] = useState<Step>(props.initialStep ?? (props.initialRepairId ? 2 : props.initialModelId ? 2 : 1));
  const platforms = useMemo(() => buildPlatforms(models), [models]);
  const [platform, setPlatform] = useState<string | null>(() => {
    const initial = models.find((m) => m.id === props.initialModelId);
    return initial ? initial.brandId : platforms.length === 1 ? (platforms[0]?.key ?? null) : null;
  });
  const [modelId, setModelId] = useState<string | null>(props.initialModelId ?? null);
  const [repairs, setRepairs] = useState<FormRepair[]>(props.initialRepairs ?? []);
  const [repairsLoading, setRepairsLoading] = useState(false);
  const [repairId, setRepairId] = useState<string | null>(props.initialRepairId ?? null);
  const [repairQuery, setRepairQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<string[] | null>(null);
  const [offer, setOffer] = useState<FormOffer | null>(props.initialOffer ?? null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [packIds, setPackIds] = useState<string[]>([]);
  const [shippingId, setShippingId] = useState<string | null>(props.initialOffer?.shippingMethods[0]?.id ?? null);
  const [desc, setDesc] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [serial, setSerial] = useState("");
  const [alreadyOpened, setAlreadyOpened] = useState(false);
  const [customer, setCustomer] = useState<FormCustomer>(props.initialCustomer ?? { first_name: "", last_name: "", email: "", phone: "" });
  const [address, setAddress] = useState<FormAddress>(props.initialAddress ?? { line1: "", line2: "", postal_code: "", city: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const quoteVersion = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const model = models.find((m) => m.id === modelId) ?? null;
  const repair = repairs.find((r) => r.id === repairId) ?? null;
  const showPrices = props.showPrices ?? true;
  const platformModels = useMemo(() => (platform === RETRO_KEY ? models.filter((m) => m.isRetro) : platform ? models.filter((m) => m.brandId === platform) : []), [models, platform]);
  // Le catalogue client est organisé par catégorie (« Image & HDMI », « Charge &
  // USB-C »…). Une console peut compter plusieurs dizaines de pannes : on les
  // regroupe et on propose une recherche plutôt qu'une liste à plat.
  const repairGroups = useMemo(() => {
    const needle = repairQuery.trim().toLowerCase();
    const matching = needle ? repairs.filter((r) => `${r.name} ${r.note} ${r.categoryName ?? ""}`.toLowerCase().includes(needle)) : repairs;
    const groups = new Map<string, { name: string; order: number; items: FormRepair[] }>();
    for (const r of matching) {
      const name = r.categoryName ?? "Autres prestations";
      const g = groups.get(name) ?? { name, order: r.categoryOrder, items: [] };
      g.items.push(r);
      groups.set(name, g);
    }
    return [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [repairs, repairQuery]);

  const searching = repairQuery.trim().length > 0;
  const isCategoryOpen = (name: string, index: number) => {
    if (searching) return true;
    if (openCategories) return openCategories.includes(name);
    // Par défaut : tout ouvert quand la liste est courte, sinon la première catégorie
    // et celle qui contient la prestation déjà choisie.
    if (repairs.length <= 14) return true;
    return index === 0 || repairs.find((r) => r.id === repairId)?.categoryName === name;
  };
  const toggleCategory = (name: string) =>
    setOpenCategories((prev) => {
      const base = prev ?? repairGroups.filter((g, i) => isCategoryOpen(g.name, i)).map((g) => g.name);
      return base.includes(name) ? base.filter((n) => n !== name) : [...base, name];
    });

  const repairPrice = (r: FormRepair) => (r.priceProvisional || !showPrices ? "sur devis" : formatPrice(r.priceCents));

  // Pannes fréquentes du modèle d'abord, puis les symptômes génériques non couverts.
  const symptomChoices = useMemo(() => {
    const specific = [...new Set((model?.commonIssues ?? []).map((i) => i.toLowerCase()))];
    return [...specific, ...SYMPTOMS.filter((generic) => !specific.some((i) => i.includes(generic)))];
  }, [model]);

  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ block: "start" });
  };

  // Étape 1 → charge les prestations du modèle.
  const pickModel = useCallback(
    (id: string) => {
      setModelId(id);
      setRepairId(null);
      setOffer(null);
      setOptionIds([]);
      setPackIds([]);
      setPricing(null);
      setError(null);
      setRepairsLoading(true);
      setStep(2);
      loadModelRepairsAction(id).then((res) => {
        setRepairs(res.ok ? res.repairs : []);
        if (!res.ok) setError(res.error);
        setRepairsLoading(false);
      });
    },
    [],
  );

  // Étape 2 → charge options / packs / transports compatibles avec la prestation.
  const pickRepair = useCallback(
    (id: string) => {
      setRepairId(id);
      setOptionIds([]);
      setPackIds([]);
      setOffer(null);
      setOfferLoading(true);
      setError(null);
      const picked = repairs.find((r) => r.id === id);
      track(ANALYTICS_EVENTS.VIEW_REPAIR, { repair_id: id, value_cents: picked?.priceCents ?? 0, repair_name: picked?.name ?? "" });
      loadOfferAction(id).then((res) => {
        if (res.ok) {
          setOffer(res.offer);
          setShippingId((current) => (current && res.offer.shippingMethods.some((m) => m.id === current) ? current : (res.offer.shippingMethods[0]?.id ?? null)));
        } else setError(res.error);
        setOfferLoading(false);
      });
    },
    [repairs, track],
  );

  // Prix serveur à chaque changement de sélection.
  useEffect(() => {
    if (!repairId) return;
    const version = ++quoteVersion.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await quoteSelectionAction({ repairId, optionIds, packIds, shippingMethodId: shippingId });
        if (version !== quoteVersion.current) return;
        if (result.ok) {
          setPricing(result.pricing);
          setPricingError(null);
        } else setPricingError(result.error);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [repairId, optionIds, packIds, shippingId]);

  const startTracked = useRef(false);
  useEffect(() => {
    if (!attribution || !repairId || startTracked.current) return;
    startTracked.current = true;
    track(ANALYTICS_EVENTS.START_CHECKOUT, { repair_id: repairId, value_cents: repair?.priceCents ?? 0 });
  }, [attribution, repairId, repair?.priceCents, track]);

  const optionsInPacks = useMemo(() => {
    const set = new Set<string>();
    for (const p of offer?.packs ?? []) if (packIds.includes(p.id)) p.optionIds.forEach((id) => set.add(id));
    return set;
  }, [offer, packIds]);

  const toggleOption = (id: string) => {
    setOptionIds((prev) => {
      const option = offer?.options.find((o) => o.id === id);
      track(prev.includes(id) ? ANALYTICS_EVENTS.REMOVE_OPTION : ANALYTICS_EVENTS.ADD_OPTION, { option_id: id, option_name: option?.name ?? "", value_cents: option?.priceCents ?? 0, repair_id: repairId ?? "" });
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };
  const togglePack = (id: string) => {
    setPackIds((prev) => {
      const pack = offer?.packs.find((p) => p.id === id);
      const already = prev.includes(id);
      track(already ? ANALYTICS_EVENTS.REMOVE_PACK : ANALYTICS_EVENTS.SELECT_PACK, { pack_id: id, pack_name: pack?.name ?? "", value_cents: pack?.priceCents ?? 0, repair_id: repairId ?? "" });
      if (already) return prev.filter((x) => x !== id);
      const overlapping = prev.filter((pid) => offer?.packs.find((p) => p.id === pid)?.optionIds.some((oid) => pack?.optionIds.includes(oid)));
      return [...prev.filter((pid) => !overlapping.includes(pid)), id];
    });
  };

  const toggleSymptom = (t: string) => setSymptoms((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 12 ? [...prev, t] : prev));

  const next = () => {
    setError(null);
    if (step === 1) {
      if (!platform) return setError("Choisissez d'abord votre plateforme.");
      if (!modelId) return setError("Choisissez le modèle exact de votre console.");
      setStep(2);
    } else if (step === 2) {
      if (!repairId) return setError("Choisissez une prestation.");
      if (!offer) return setError("Chargement des options en cours…");
      setStep(3);
    } else if (step === 3) {
      if (desc.trim().length < MIN_DESCRIPTION && !symptoms.length) return setError(`Décrivez le problème en quelques mots (au moins ${MIN_DESCRIPTION} caractères) ou cochez au moins un symptôme : cela aide le diagnostic.`);
      setStep(4);
    }
    scrollToTop();
  };
  const back = () => {
    setError(null);
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
    scrollToTop();
  };

  const submit = async () => {
    setError(null);
    if (!repairId || !shippingId) return setError("Choisissez un mode d'envoi.");
    const errors: Record<string, string> = {};
    if (!customer.first_name.trim()) errors["customer.first_name"] = "Prénom requis";
    if (!customer.last_name.trim()) errors["customer.last_name"] = "Nom requis";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) errors["customer.email"] = "E-mail invalide";
    if (!address.line1.trim()) errors["address.line1"] = "Adresse requise";
    if (!/^\d{5}$/.test(address.postal_code.trim())) errors["address.postal_code"] = "Code postal à 5 chiffres";
    if (!address.city.trim()) errors["address.city"] = "Ville requise";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return setError("Merci de corriger les champs signalés.");
    if (!acceptTerms) return setError("Vous devez accepter les conditions générales de vente pour continuer.");
    setSubmitting(true);
    const method = offer?.shippingMethods.find((m) => m.id === shippingId);
    track(ANALYTICS_EVENTS.SELECT_SHIPPING, { shipping_id: shippingId, shipping_name: method?.name ?? "", value_cents: method?.priceCents ?? 0 });
    const result = await createOrderAction({
      selection: { repairId, optionIds, packIds, shippingMethodId: shippingId },
      customer: { ...customer, email: customer.email.trim(), phone: customer.phone.trim() },
      address: { ...address, country_code: "FR" },
      customer_notes: desc.trim(),
      console_serial_number: serial.trim(),
      console_already_opened: alreadyOpened,
      accept_terms: true,
      attribution,
      symptoms,
      photos: photos.map((p) => p.path),
    });
    if (result.ok) {
      track(ANALYTICS_EVENTS.START_PAYMENT, { repair_id: repairId, value_cents: pricing?.totalCents ?? 0, order_number: result.orderNumber });
      window.location.assign(result.redirectUrl);
      return;
    }
    setSubmitting(false);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  };

  const total = pricing?.totalCents ?? null;
  const shipping = offer?.shippingMethods.find((m) => m.id === shippingId) ?? null;
  const pickedOptions = [...(offer?.packs.filter((p) => packIds.includes(p.id)) ?? []), ...(offer?.options.filter((o) => optionIds.includes(o.id) && !optionsInPacks.has(o.id)) ?? [])];
  const nextLabel = step === 4 ? "Envoyer ma demande" : "Continuer";

  return (
    <div ref={rootRef} className={cn("bg-paper p-[26px] text-ink-900", props.wide && "w-full")} style={{ scrollMarginTop: 96 }}>
      <div className="flex items-baseline justify-between gap-3">
        <strong className="font-mono text-[12px] uppercase tracking-[0.08em]">Fiche de réparation</strong>
        <span className="font-mono text-[12px] text-ink-muted">Étape {step} / 4</span>
      </div>
      <div className="mb-[22px] mt-3 h-[3px] bg-[rgba(20,18,15,0.12)]" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step}>
        <div className="h-[3px] bg-accent" style={{ width: `${(step / 4) * 100}%` }} />
      </div>

      {props.cancelled && step === 2 ? (
        <p className="mb-4 border border-warning bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning">Votre paiement n&apos;a pas été finalisé. Vous pouvez reprendre votre demande ci-dessous.</p>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-3.5">
          <h3 className="text-[22px] font-extrabold tracking-[-0.01em]">Quel appareil ?</h3>
          <span className="font-mono text-[11.5px] text-ink-muted">1. La plateforme, 2. le modèle exact — les prestations dépendent du modèle</span>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]" role="radiogroup" aria-label="Plateforme">
            {platforms.map((p) => {
              const selected = platform === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setPlatform(p.key);
                    setModelId(null);
                    setError(null);
                  }}
                  className={cn("flex cursor-pointer flex-col gap-1 border p-[13px] text-left transition-colors hover:border-accent", selected ? "border-ink-900 bg-ink-900 text-paper" : "border-[rgba(20,18,15,0.22)] bg-transparent text-ink-900")}
                >
                  <span className="text-[15px] font-semibold">{p.label}</span>
                  <span className="font-mono text-[11px] opacity-70">{p.note}</span>
                </button>
              );
            })}
          </div>
          {platform ? (
            <>
              <span className="mt-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Modèle exact</span>
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]" role="radiogroup" aria-label="Modèle">
                {platformModels.map((m) => {
                  const selected = modelId === m.id;
                  return (
                    <button key={m.id} type="button" role="radio" aria-checked={selected} onClick={() => pickModel(m.id)} className={cn("flex cursor-pointer flex-col gap-1 border p-[13px] text-left transition-colors hover:border-accent", selected ? "border-accent bg-[var(--selection)] text-ink-900" : "border-[rgba(20,18,15,0.22)] bg-transparent text-ink-900")}>
                      <span className="text-[15px] font-semibold">{m.name}</span>
                      <span className="font-mono text-[11px] opacity-70">{platform === RETRO_KEY ? m.brandName : m.tag || m.brandName}</span>
                    </button>
                  );
                })}
              </div>
              {!platformModels.length ? <p className="text-sm text-ink-muted">Aucun modèle publié pour cette plateforme.</p> : null}
            </>
          ) : null}
          {!models.length ? <p className="text-sm text-ink-muted">Aucune console publiée pour le moment.</p> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3.5">
          <h3 className="text-[22px] font-extrabold tracking-[-0.01em]">{model?.name ?? "Appareil"} — quelle prestation ?</h3>
          <span className="font-mono text-[11.5px] text-ink-muted">Une prestation principale, puis les options d&apos;entretien compatibles</span>
          {repairsLoading ? <p className="text-sm text-ink-muted">Chargement des prestations…</p> : null}
          {!repairsLoading && !repairs.length ? (
            <p className="text-sm text-ink-muted">
              Aucune prestation publiée pour ce modèle. Écrivez-nous depuis la page{" "}
              <Link href={ROUTES.contact} className="text-sale underline">
                contact
              </Link>
              .
            </p>
          ) : null}
          {repairs.length > 14 ? (
            <input
              value={repairQuery}
              onChange={(e) => setRepairQuery(e.target.value)}
              placeholder={`Rechercher parmi ${repairs.length} pannes (HDMI, charge, écran…)`}
              aria-label="Rechercher une panne"
              className="w-full border border-[rgba(20,18,15,0.22)] bg-white p-3 text-[15px] text-ink-900 placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          ) : null}
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Prestation">
            {repairGroups.map((group, index) => {
              const open = isCategoryOpen(group.name, index);
              const panelId = `prestations-${index}`;
              return (
                <div key={group.name} className="border border-[rgba(20,18,15,0.16)]">
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.name)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 bg-paper-alt px-[13px] py-2.5 text-left"
                  >
                    <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-900">{group.name}</span>
                    <span className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
                      {group.items.length}
                      <span aria-hidden="true">{open ? "−" : "+"}</span>
                    </span>
                  </button>
                  {open ? (
                    <div id={panelId} className="flex flex-col gap-2 p-2">
                      {group.items.map((r) => (
                        <OptionRow key={r.id} selected={repairId === r.id} onPick={() => pickRepair(r.id)} label={r.name} note={r.note} price={repairPrice(r)} role="radio" />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {searching && !repairGroups.length ? <p className="text-sm text-ink-muted">Aucune panne ne correspond. Choisissez « Autre panne » ou décrivez le problème à l&apos;étape suivante.</p> : null}
          </div>
          {repairId ? (
            <>
              {offerLoading ? <p className="font-mono text-[11.5px] text-ink-muted">Chargement des options compatibles…</p> : null}
              {offer && (offer.packs.length || offer.options.length) ? (
                <>
                  <span className="mt-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Options d&apos;entretien — plusieurs choix possibles</span>
                  <div className="flex flex-col gap-2">
                    {offer.packs.map((p) => (
                      <OptionRow key={p.id} selected={packIds.includes(p.id)} onPick={() => togglePack(p.id)} label={p.name} note={p.note} price={formatPriceDelta(p.priceCents)} badge={p.isRecommended ? "Recommandé" : "Pack"} />
                    ))}
                    {offer.options.map((o) => {
                      const inPack = optionsInPacks.has(o.id);
                      return <OptionRow key={o.id} selected={optionIds.includes(o.id) && !inPack} disabled={inPack} onPick={() => toggleOption(o.id)} label={o.name} note={inPack ? "Inclus dans votre pack" : o.note} price={formatPriceDelta(o.priceCents)} badge={o.isRecommended ? "Recommandé" : undefined} />;
                    })}
                  </div>
                </>
              ) : null}
              {offer && !offer.packs.length && !offer.options.length ? <p className="font-mono text-[11.5px] text-ink-muted">Aucune option supplémentaire compatible avec cette prestation.</p> : null}
              {pricing?.warnings.length ? <p className="text-[13px] text-ink-faint">{pricing.warnings.join(" ")}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-3.5">
          <h3 className="text-[22px] font-extrabold tracking-[-0.01em]">Décrivez le problème</h3>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={2000}
            aria-label="Description du problème"
            placeholder="Ex. : la console s'allume mais s'éteint après 5 minutes, ventilateur très bruyant depuis 2 semaines. Déjà nettoyée l'an dernier."
            className="min-h-[130px] w-full resize-y border border-[rgba(20,18,15,0.22)] bg-white p-[13px] text-[15px] leading-normal text-ink-900 placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
          <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Symptômes — plusieurs choix possibles</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Symptômes">
            {symptomChoices.map((sym) => {
              const on = symptoms.includes(sym);
              return (
                <button key={sym} type="button" aria-pressed={on} onClick={() => toggleSymptom(sym)} className={cn("whitespace-nowrap border px-[11px] py-2 font-mono text-[11.5px] uppercase tracking-[0.05em] transition-colors hover:border-accent", on ? "border-accent bg-accent text-white" : "border-dashed border-[rgba(20,18,15,0.3)] bg-paper-alt text-ink-900")}>
                  {on ? "✓" : "+"} {sym}
                </button>
              );
            })}
          </div>
          <DraftPhotoUploader photos={photos} onChange={setPhotos} label="déposez photos de la panne" />
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <input value={serial} onChange={(e) => setSerial(e.target.value)} maxLength={60} placeholder="Numéro de série (facultatif)" aria-label="Numéro de série" className="border border-[rgba(20,18,15,0.22)] bg-white p-3 text-[15px] text-ink-900 placeholder:text-ink-muted focus:border-accent focus:outline-none" />
            <label className="flex items-center gap-3 border border-[rgba(20,18,15,0.22)] px-3 py-2 text-[13px] text-ink-faint">
              <Checkbox checked={alreadyOpened} onChange={(e) => setAlreadyOpened(e.target.checked)} />
              Console déjà ouverte ou réparée
            </label>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="flex flex-col gap-3.5">
          <h3 className="text-[22px] font-extrabold tracking-[-0.01em]">Envoi et coordonnées</h3>
          {!props.isLoggedIn ? (
            <p className="text-[13px] text-ink-faint">
              Un espace client est créé avec votre e-mail pour suivre le dossier.{" "}
              <Link href={`${ROUTES.login}?next=${encodeURIComponent(repairId ? `${ROUTES.checkout}/${repairId}` : ROUTES.repair)}`} className="text-sale underline">
                Déjà client ? Connectez-vous
              </Link>
            </p>
          ) : null}
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            <TextInput placeholder="Prénom" autoComplete="given-name" value={customer.first_name} onChange={(v) => setCustomer({ ...customer, first_name: v })} error={fieldErrors["customer.first_name"]} />
            <TextInput placeholder="Nom" autoComplete="family-name" value={customer.last_name} onChange={(v) => setCustomer({ ...customer, last_name: v })} error={fieldErrors["customer.last_name"]} />
            <TextInput placeholder="Téléphone" type="tel" autoComplete="tel" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} error={fieldErrors["customer.phone"]} />
            <TextInput placeholder="E-mail" type="email" autoComplete="email" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} error={fieldErrors["customer.email"]} readOnly={props.isLoggedIn} />
            <TextInput placeholder="Adresse de retour" autoComplete="address-line1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} error={fieldErrors["address.line1"]} className="[grid-column:1/-1]" />
            <TextInput placeholder="Complément d'adresse (facultatif)" autoComplete="address-line2" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} className="[grid-column:1/-1]" />
            <TextInput placeholder="Code postal" autoComplete="postal-code" inputMode="numeric" value={address.postal_code} onChange={(v) => setAddress({ ...address, postal_code: v })} error={fieldErrors["address.postal_code"]} />
            <TextInput placeholder="Ville" autoComplete="address-level2" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} error={fieldErrors["address.city"]} />
          </div>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Mode d'envoi">
            {(offer?.shippingMethods ?? []).map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={shippingId === m.id} onClick={() => setShippingId(m.id)} className={cn("flex cursor-pointer items-center justify-between gap-3 border border-[rgba(20,18,15,0.22)] p-[13px_14px] text-left transition-colors hover:border-accent", shippingId === m.id ? "bg-[var(--selection)]" : "bg-transparent")}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{m.name}</span>
                  <span className="text-[13px] text-ink-faint">{m.note}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono text-[14px]">{m.priceCents === 0 ? "0 €" : formatPrice(m.priceCents)}</span>
              </button>
            ))}
          </div>
          <div className="bg-ink-900 p-4 text-paper">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-muted">Récapitulatif</span>
            <div className="mt-[11px] flex flex-col gap-[7px] text-[14.5px]">
              <RecapLine k="Appareil" v={model ? `${model.brandName} ${model.name}` : "—"} />
              <RecapLine k="Prestation" v={repair?.name ?? "—"} />
              {symptoms.length ? <RecapLine k="Symptômes" v={symptoms.join(", ")} muted /> : null}
              {photos.length ? <RecapLine k="Photos" v={`${photos.length} jointe${photos.length > 1 ? "s" : ""}`} muted /> : null}
              <RecapLine k="Options" v={pickedOptions.length ? pickedOptions.map((o) => o.name).join(", ") : "aucune"} />
              <RecapLine k="Envoi" v={shipping ? `${shipping.name} — ${formatPrice(shipping.priceCents)}` : "—"} />
              <RecapLine k="Total TTC" v={repair?.priceProvisional ? "sur devis après diagnostic" : total !== null ? formatPrice(total) : "calcul…"} />
              {pricing ? <RecapLine k="dont TVA" v={formatPrice(pricing.vatCents)} muted /> : null}
            </div>
          </div>
          <span className="text-[13px] leading-[1.45] text-ink-faint">
            {repair?.priceProvisional ? "Le tarif de cette prestation est communiqué après diagnostic : vous ne réglez aujourd'hui que le transport. " : repair?.isDiagnosticOnly ? "Diagnostic puis devis. " : ""}
            Si une autre intervention est nécessaire, vous recevez un devis complémentaire (valable {conditions.quoteValidityDays} jours) ; rien n&apos;est réalisé sans votre accord. Refus du devis : {conditions.refusalExplanation}
            {conditions.refusalFeeCents > 0 ? ` Frais applicables : ${formatPrice(conditions.refusalFeeCents)}.` : " Aucun frais supplémentaire."}
          </span>
          <label className="flex items-start gap-3 text-[13px] text-ink-faint">
            <Checkbox checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" required />
            <span>
              J&apos;ai lu et j&apos;accepte les{" "}
              <Link href={ROUTES.cgv} target="_blank" className="text-sale underline">
                conditions générales de vente
              </Link>
              {conditions.cgvVersion && !conditions.cgvVersion.startsWith("draft") ? ` (version ${conditions.cgvVersion})` : ""} et la{" "}
              <Link href={ROUTES.privacy} target="_blank" className="text-sale underline">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
        </div>
      ) : null}

      {error || pricingError ? (
        <div className="mt-4">
          <FormError message={error ?? pricingError} />
        </div>
      ) : null}

      <div className="mt-[22px] flex items-center gap-2">
        <button type="button" onClick={back} disabled={step === 1 || submitting} className="cursor-pointer border border-[rgba(20,18,15,0.25)] bg-transparent px-4 py-[13px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink-900 disabled:opacity-40">
          Retour
        </button>
        <button
          type="button"
          onClick={step === 4 ? submit : next}
          disabled={submitting || (step === 4 && (!pricing || Boolean(pricingError)))}
          aria-busy={submitting || undefined}
          className="flex-1 cursor-pointer bg-accent px-4 py-[14px] font-mono text-[12.5px] uppercase tracking-[0.06em] text-white transition-colors hover:bg-ink-900 disabled:opacity-60"
        >
          {submitting ? "Envoi…" : nextLabel}
        </button>
      </div>
      {step === 4 ? <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">Paiement sécurisé à l&apos;étape suivante · prix vérifié par nos serveurs</p> : null}
    </div>
  );
}

function OptionRow({ selected, disabled, onPick, label, note, price, badge, role = "checkbox" }: { selected: boolean; disabled?: boolean; onPick: () => void; label: string; note: string; price: string; badge?: string; role?: "checkbox" | "radio" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onPick}
      className={cn("flex cursor-pointer items-center gap-3 border border-[rgba(20,18,15,0.22)] p-[13px_14px] text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60", selected ? "bg-[var(--selection)]" : "bg-transparent")}
    >
      <span className={cn("h-4 w-4 flex-none border border-ink-900", selected ? "bg-accent" : "bg-white")} aria-hidden="true" />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">
          {label}
          {badge ? <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-[0.06em] text-accent">{badge}</span> : null}
        </span>
        {note ? <span className="text-[13px] text-ink-faint">{note}</span> : null}
      </span>
      <span className="flex-none whitespace-nowrap font-mono text-[14px]">{price}</span>
    </button>
  );
}

function TextInput({ value, onChange, error, className, ...rest }: { value: string; onChange: (v: string) => void; error?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <span className={cn("flex flex-col gap-1", className)}>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={rest.placeholder}
        aria-invalid={Boolean(error)}
        className={cn("w-full border bg-white p-3 text-[15px] text-ink-900 placeholder:text-ink-muted focus:border-accent focus:outline-none read-only:bg-paper-alt", error ? "border-danger" : "border-[rgba(20,18,15,0.22)]")}
      />
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function RecapLine({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3.5", muted && "text-[12.5px]")}>
      <span className="text-[#c4bdae]">{k}</span>
      <span className="text-right font-mono">{v}</span>
    </div>
  );
}
