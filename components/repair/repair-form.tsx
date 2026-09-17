"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { Checkbox, FormError } from "@/components/ui/form";
import { formatPrice, formatPriceDelta, formatRepairPrice } from "@/lib/utils/format";
import { useAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { PricingResult } from "@/lib/pricing/engine";
import { createOrderAction, quoteSelectionAction } from "@/app/(marketing)/commande/[repairId]/actions";
import { loadModelRepairsAction, loadOfferAction } from "@/app/(marketing)/reparation/actions";
import type { FormAddress, FormConditions, FormCustomer, FormModel, FormOffer, FormPlatform, FormRepair } from "@/components/repair/repair-form-types";
import { DraftPhotoUploader, type DraftPhoto } from "@/components/customer/draft-photo-uploader";
import { ProgressRing } from "@/components/marketing/motion";
import { MQ_TELEPHONE, useMobile } from "@/components/marketing/use-mobile";
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
  /**
   * Barre d'action collée en bas de l'écran au téléphone. À laisser active sur
   * les pages dont la fiche est le contenu ; à couper là où elle n'est qu'une
   * section parmi d'autres (l'accueil), où elle entrerait en concurrence avec
   * la barre d'onglets basse.
   */
  stickyActions?: boolean;
  /**
   * Combien de consoles le catalogue prend en charge.
   *
   * Au téléphone, la grille « Toutes les consoles prises en charge » quitte le
   * bas de la page — elle y reposait, après coup, la question de l'écran 1 — et
   * devient une ligne au bas du premier écran. Le nombre vient du catalogue :
   * l'écrire en dur, c'est promettre un chiffre qui vieillit.
   */
  catalogueCount?: number;
}

const SYMPTOMS = ["ne s'allume plus", "surchauffe", "pas d'image", "bruit anormal", "ne charge plus", "dégât liquide"];

/**
 * Au téléphone (écrans M3 / M4 du handoff mobile), les étapes 1 et 2 se lisent
 * sur fond encre — on est dans l'univers réparation, et la carte se fond dans
 * la section sombre qui l'accueille — puis les étapes 3 et 4 repassent sur
 * papier, plus confortable pour saisir du texte et une photo.
 *
 * Au-delà de `sm`, la carte reste papier à toutes les étapes : c'est le handoff
 * de bureau, inchangé. Chaque classe sombre est donc systématiquement suivie de
 * son pendant `sm:`. Le piège, signalé par le handoff, est le texte des lignes
 * sélectionnées : leur fond clair impose de repasser en encre foncée.
 */
const MIN_DESCRIPTION = 20;
const RETRO_KEY = "retro";

type Step = 1 | 2 | 3 | 4;

/**
 * « PlayStation 4 », et non « PlayStation PlayStation 4 » : les modèles du
 * catalogue du client portent déjà le nom de la marque. On ne le préfixe que
 * lorsqu'il manque (une console rétro nommée « Mega Drive », par exemple).
 */
function modelLabel(model: FormModel | null): string {
  if (!model) return "—";
  return model.name.toLowerCase().startsWith(model.brandName.toLowerCase()) ? model.name : `${model.brandName} ${model.name}`;
}

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
  /**
   * L'étape 1 se lit en deux écrans au téléphone : la marque, puis le modèle.
   *
   * Un seul écran posait deux questions — et faisait défiler pour voir la
   * réponse à la seconde apparaître sous la première. L'étape reste **une**
   * pour la validation, les actions serveur et le desktop : seul l'affichage se
   * scinde, et `phase` dit lequel des deux écrans est à l'image.
   */
  const [phase, setPhase] = useState<"marque" | "modele">(() => (props.initialModelId ? "modele" : "marque"));
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

  /**
   * La même liste, à plat.
   *
   * Au téléphone, pas d'accordéon : l'accordéon existait pour absorber quarante
   * pannes, et c'est la recherche qui règle ce cas — sans demander au pouce
   * d'ouvrir et de refermer des boîtes. L'ordre des catégories est conservé,
   * il porte le sens du catalogue ; seules les cloisons disparaissent.
   */
  const repairsPlates = useMemo(() => repairGroups.flatMap((g) => g.items), [repairGroups]);

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

  // Le libellé du catalogue, mot pour mot : « Nécessite un devis », « Gratuit »
  // ou le montant. Aucun 0,00 € ne passe pour un prix qui n'a pas été arbitré.
  const repairPrice = (r: FormRepair) => formatRepairPrice(r.priceCents, r.priceProvisional || !showPrices);

  /**
   * Pannes fréquentes du modèle d'abord, puis les symptômes génériques non
   * couverts.
   *
   * Le dédoublonnage se fait sur une clé en minuscules, mais le libellé garde
   * la casse du catalogue : « Port HDMI », « Lecteur Blu-ray ». Les mettre
   * eux-mêmes en minuscules affichait « port hdmi » et « lecteur blu-ray »
   * au client, et écrivait cela dans le dossier que l'atelier relit.
   */
  const symptomChoices = useMemo(() => {
    const clefs = new Set<string>();
    const specific: string[] = [];
    for (const issue of model?.commonIssues ?? []) {
      const clef = issue.toLowerCase();
      if (clefs.has(clef)) continue;
      clefs.add(clef);
      specific.push(issue);
    }
    return [...specific, ...SYMPTOMS.filter((generic) => ![...clefs].some((i) => i.includes(generic)))];
  }, [model]);

  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    // Au téléphone, c'est l'effet de changement d'écran qui remonte, et lui
    // seul : il déduit l'en-tête collant, ce que `scrollIntoView` ignore.
    // Les deux enchaînés donnaient un saut visible.
    if (window.matchMedia(MQ_TELEPHONE).matches) return;
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) rootRef.current?.scrollIntoView({ block: "start" });
  };

  /*
    ── La trame du téléphone ──────────────────────────────────────────────────
    Cinq écrans, une question par écran : la marque, le modèle, l'intervention,
    la panne, l'envoi. Le desktop en garde quatre et ne change pas d'un pixel —
    c'est le même état, le même modèle de données, les mêmes actions serveur et
    la même validation ; seul l'affichage se scinde.

    `phone` bascule après l'hydratation (repli serveur : desktop). La fiche est
    un composant client interactif : elle n'a rien à rendre d'utile avant.
  */
  const phone = useMobile(MQ_TELEPHONE);
  const ECRANS = 5;
  const ecran = step === 1 ? (phase === "marque" ? 1 : 2) : step + 1;
  const NOMS_ECRAN = ["Votre console", "Le modèle", "L'intervention", "La panne", "L'envoi"];
  const plateforme = platforms.find((p) => p.key === platform) ?? null;
  const QUESTIONS = ["Quelle console ?", plateforme ? `Quel ${plateforme.label} ?` : "Quel modèle ?", "Que faut-il réparer ?", "Que se passe-t-il ?", "Où la renvoyer ?"];
  const AIDES = [
    "L'atelier ne répare que des consoles — ni téléphones, ni ordinateurs.",
    "Les interventions et les prix dépendent du modèle exact.",
    "Une intervention principale. Les options viennent après, s'il y en a.",
    "Quelques mots suffisent, ou cochez ce que vous constatez. Cela oriente le diagnostic.",
    "Vous ne payez rien de plus que l'estimation avant d'avoir reçu le devis.",
  ];

  /**
   * Le fil des choix déjà faits — une ligne, toujours au même endroit.
   *
   * Il remplace les récapitulatifs répétés d'étape en étape : le contexte est
   * permanent au lieu d'être réaffirmé. Chaque jeton ramène à son écran.
   */
  const fil: { label: string; go: () => void }[] = [];
  if (model) fil.push({ label: modelLabel(model), go: () => { setStep(1); setPhase("modele"); } });
  else if (plateforme) fil.push({ label: plateforme.label, go: () => { setStep(1); setPhase("marque"); } });
  if (repair) fil.push({ label: repair.name.length > 26 ? `${repair.name.slice(0, 24)}…` : repair.name, go: () => setStep(2) });

  /**
   * Le bouton ne ment pas : il est inactif tant que l'écran attend sa réponse,
   * et son libellé dit laquelle. Un bouton actif qui répond « choisissez
   * d'abord… » fait faire un aller-retour pour rien.
   */
  const bloque =
    (step === 1 && phase === "marque" && !platform) ||
    (step === 1 && phase === "modele" && !modelId) ||
    (step === 2 && !repairId) ||
    (step === 3 && desc.trim().length < MIN_DESCRIPTION && !symptoms.length);

  /**
   * Remise en haut à chaque changement d'écran, **après** le rendu.
   *
   * Dans un effet et non dans le gestionnaire de clic : le nouvel écran doit
   * déjà être en place, sinon on remonte l'ancien. `scrollIntoView` est écarté
   * — il déplace aussi les conteneurs défilants intermédiaires.
   *
   * Pas au montage. Sur `/reparation/[model]`, la fiche n'ouvre pas la page :
   * la console, sa photo et la liste de ses interventions la précèdent, et
   * remonter dessus à l'arrivée escamotait sans un mot ce que le visiteur
   * venu de la recherche était précisément venu lire. `phone` bascule après
   * l'hydratation, donc le premier passage utile est celui qui compte.
   */
  const ecranPrecedent = useRef<number | null>(null);
  useEffect(() => {
    if (!phone || typeof window === "undefined") return;
    const premier = ecranPrecedent.current === null;
    ecranPrecedent.current = ecran;
    if (premier) return;
    const haut = (rootRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    window.scrollTo({ top: Math.max(0, haut - hauteurEnteteCollant()), behavior: "auto" });
  }, [ecran, phone]);

  // Étape 1 → charge les prestations du modèle.
  const pickModel = useCallback(
    (id: string) => {
      // La ligne du modèle porte un chevron : elle avance. `phase` retombe sur
      // « modele » pour que le retour depuis l'intervention y ramène.
      setPhase("modele");
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
      // Au téléphone, la marque et le modèle sont deux écrans : « continuer »
      // depuis le premier ouvre le second au lieu de sauter à l'intervention.
      if (phone && phase === "marque") return setPhase("modele");
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
    if (phone) {
      // Le retour suit les cinq écrans du téléphone, pas les quatre étapes :
      // depuis l'intervention on revient au modèle, pas à la marque.
      if (step === 1) setPhase("marque");
      else {
        if (step === 2) setPhase("modele");
        setStep((s) => (s - 1) as Step);
      }
      return;
    }
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
  const nextLabel = step === 4 ? "Envoyer la demande" : "Continuer";
  // Le bouton principal porte le total en cours au téléphone : c'est le chiffre
  // que le client cherche, et il n'a pas la barre supérieure sous les yeux.
  // Rien à afficher tant que la prestation est « sur devis ».
  const runningTotal = showPrices && total !== null && step < 4 && !repair?.priceProvisional ? formatPrice(total) : null;
  const sticky = props.stickyActions ?? true;

  /** Estimation courante, affichée en permanence en haut du panneau. */
  const estimate = !repairId ? "à définir" : repair?.priceProvisional ? "après diagnostic" : total !== null && showPrices ? formatPrice(total) : "calcul…";

  const stepTitle = step === 1 ? "Quel appareil ?" : step === 2 ? (model?.name ?? "Quelle intervention ?") : step === 3 ? "Que se passe-t-il ?" : "Où la renvoyer ?";

  /*
    ══ La trame du téléphone ══════════════════════════════════════════════════
    Cinq écrans, une question par écran. Rien de ce qui suit n'atteint le
    bureau : `phone` est faux côté serveur et au-delà de 640 px, et la fiche de
    bureau, plus bas, est inchangée.
  */
  if (phone) {
    const question = QUESTIONS[ecran - 1] ?? "";
    const aide = AIDES[ecran - 1] ?? "";
    const libelleBouton =
      step === 4
        ? "Envoyer la demande"
        : ecran === 1 && !platform
          ? "Choisissez votre console"
          : ecran === 2 && !modelId
            ? "Choisissez votre modèle"
            : step === 2 && !repairId
              ? "Choisissez une intervention"
              : step === 3 && bloque
                ? "Décrivez la panne"
                : "Continuer";
    const restants = MIN_DESCRIPTION - desc.trim().length;

    return (
      <div ref={rootRef} className="flex w-full flex-col bg-bg text-ink" style={{ scrollMarginTop: 0 }}>
        {/* ── En-tête : une progression, pas un décor ──────────────────────────
            Une barre de 2 px et le numéro d'étape remplacent l'anneau, le titre
            d'étape en 33 px et le bloc « Estimation ». Trois objets pour dire
            une chose ; le chiffre vit désormais sur le bouton, là où le pouce
            est déjà. */}
        <div className="flex items-center gap-3 bg-ink px-4 pb-3.5 pt-[13px] text-on-dark">
          <button
            type="button"
            onClick={back}
            disabled={ecran === 1}
            aria-label="Revenir à l'écran précédent"
            className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center border text-[17px] leading-none disabled:opacity-30"
            style={{ borderColor: "rgba(255,255,255,0.16)" }}
          >
            ←
          </button>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.13em] text-on-dark-2">
              Étape {ecran} sur {ECRANS} · {NOMS_ECRAN[ecran - 1]}
            </span>
            <span className="mt-[7px] block h-0.5" style={{ backgroundColor: "rgba(255,255,255,0.16)" }}>
              {/* Longhand seule : `width` pilotée par l'état, jamais un raccourci. */}
              <span data-barre-etape="1" className="block h-0.5 bg-red" style={{ width: `${(ecran / ECRANS) * 100}%` }} />
            </span>
          </span>
          <Link href={ROUTES.howItWorks} className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-on-dark-2">
            Aide
          </Link>
        </div>

        {/* ── Le fil des choix ────────────────────────────────────────────────
            Le contexte est permanent au lieu d'être réaffirmé à chaque étape :
            ce fil remplace le récapitulatif qui doublait l'écran « panne ». */}
        {fil.length ? (
          <div data-rail="1" className="flex items-center gap-[7px] overflow-x-auto border-b border-border-hairline bg-surface-muted px-4 py-[9px]">
            {fil.map((j) => (
              <button
                key={j.label}
                type="button"
                onClick={j.go}
                className="flex-none cursor-pointer whitespace-nowrap border border-border-strong bg-surface px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.04em] text-ink"
              >
                {j.label}
              </button>
            ))}
          </div>
        ) : null}

        <div data-ecran={ecran} className="px-4 pb-[18px] pt-5">
          <h1 className="m-0 mb-1 text-[27px] font-extrabold leading-[1.04] tracking-[-0.036em]">{question}</h1>
          <p className="m-0 mb-[18px] text-[14.5px] leading-[1.5] text-ink-soft">{aide}</p>

          {props.cancelled && step === 2 ? (
            <p className="mb-4 border border-warning bg-warning-soft px-3.5 py-2.5 text-[13.5px] text-warning">Votre paiement n&apos;a pas été finalisé. Vous pouvez reprendre votre demande ci-dessous.</p>
          ) : null}

          {/* ── 1 · la marque ─────────────────────────────────────────────── */}
          {ecran === 1 ? (
            <div className="flex flex-col" role="radiogroup" aria-label="Plateforme">
              {platforms.map((p) => (
                <LigneChoix
                  key={p.key}
                  selected={platform === p.key}
                  label={p.label}
                  note={p.note}
                  onPick={() => {
                    setPlatform(p.key);
                    setModelId(null);
                    setError(null);
                    setPhase("modele");
                  }}
                />
              ))}
              <span aria-hidden="true" className="block border-t border-border-hairline" />
              {!models.length ? <p className="mt-4 text-[15px] text-ink-faint">Aucune console publiée pour le moment.</p> : null}

              {/* Le catalogue complet n'est plus une section sous la fiche :
                  c'est une ligne, ici, et elle ouvre la grille restée masquée. */}
              {props.catalogueCount ? (
                <a href="#catalogue" className="mt-[22px] flex min-h-[48px] items-center justify-between gap-3 border-t border-border-hairline pt-[15px]">
                  <span className="text-[14.5px] text-ink-soft">Voir les {props.catalogueCount} consoles prises en charge</span>
                  <span aria-hidden="true" className="text-[15px] text-ink-faint">
                    →
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}

          {/* ── 2 · le modèle ─────────────────────────────────────────────── */}
          {ecran === 2 ? (
            <div className="flex flex-col" role="radiogroup" aria-label="Modèle">
              {platformModels.map((m) => (
                <LigneChoix key={m.id} selected={modelId === m.id} label={m.name} note={platform === RETRO_KEY ? m.brandName : m.tag || m.brandName} onPick={() => pickModel(m.id)} />
              ))}
              <span aria-hidden="true" className="block border-t border-border-hairline" />
              {!platformModels.length ? <p className="mt-4 text-[15px] text-ink-faint">Aucun modèle publié pour cette plateforme.</p> : null}
            </div>
          ) : null}

          {/* ── 3 · l'intervention ────────────────────────────────────────────
              La recherche d'abord, une liste plate ensuite. L'accordéon
              existait pour absorber quarante pannes ; c'est la recherche qui
              règle ce cas, et sans demander au pouce d'ouvrir des boîtes. */}
          {ecran === 3 ? (
            <div>
              <span className="mb-3 flex items-center gap-2.5 border border-border-strong bg-surface-muted px-3 py-3">
                <span aria-hidden="true" className="font-mono text-[12px] text-ink-faint">
                  ⌕
                </span>
                <input
                  value={repairQuery}
                  onChange={(e) => setRepairQuery(e.target.value)}
                  placeholder="HDMI, charge, écran…"
                  aria-label="Rechercher une panne"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
                />
              </span>

              {repairsLoading ? <p className="text-[15px] text-ink-faint">Chargement des interventions…</p> : null}

              <div className="flex flex-col" role="radiogroup" aria-label="Prestation">
                {repairsPlates.map((r) => (
                  <LigneCoche
                    key={r.id}
                    role="radio"
                    selected={repairId === r.id}
                    onPick={() => pickRepair(r.id)}
                    label={r.name}
                    note={[r.categoryName, r.note].filter(Boolean).join(" · ")}
                    price={repairPrice(r)}
                  />
                ))}
                <span aria-hidden="true" className="block border-t border-border-hairline" />
              </div>

              {searching && !repairsPlates.length ? (
                <p className="mt-4 text-[15px] leading-[1.5] text-ink-soft">Aucune panne ne correspond. Continuez : vous la décrirez à l&apos;écran suivant, le diagnostic tranchera.</p>
              ) : null}
              {!repairsLoading && !repairs.length ? (
                <p className="mt-4 text-[15px] text-ink-soft">
                  Aucune intervention publiée pour ce modèle. Écrivez-nous depuis la page{" "}
                  <Link href={ROUTES.contact} className="text-sale underline">
                    contact
                  </Link>
                  .
                </p>
              ) : null}

              {/* Les options n'ont de sens qu'une fois l'intervention choisie :
                  avant, elles doublent la longueur de l'écran pour rien. */}
              {repairId && offer && (offer.packs.length || offer.options.length) ? (
                <div className="mt-[22px] border-t-2 border-ink pt-4">
                  <span className="mb-0.5 block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">À ajouter — facultatif</span>
                  <div className="flex flex-col">
                    {offer.packs.map((p) => (
                      <LigneCoche key={p.id} selected={packIds.includes(p.id)} onPick={() => togglePack(p.id)} label={p.name} note={p.note} price={formatPriceDelta(p.priceCents)} badge={p.isRecommended ? "Recommandé" : "Pack"} />
                    ))}
                    {offer.options.map((o) => {
                      const inPack = optionsInPacks.has(o.id);
                      return (
                        <LigneCoche
                          key={o.id}
                          selected={optionIds.includes(o.id) && !inPack}
                          disabled={inPack}
                          onPick={() => toggleOption(o.id)}
                          label={o.name}
                          note={inPack ? "Inclus dans votre pack" : o.note}
                          price={formatPriceDelta(o.priceCents)}
                        />
                      );
                    })}
                    <span aria-hidden="true" className="block border-t border-border-hairline" />
                  </div>
                </div>
              ) : null}
              {repairId && offerLoading ? <p className="mt-4 font-mono text-[11.5px] text-ink-faint">Chargement des options compatibles…</p> : null}
              {pricing?.warnings.length ? <p className="mt-3 text-[13px] text-ink-faint">{pricing.warnings.join(" ")}</p> : null}
            </div>
          ) : null}

          {/* ── 4 · la panne ──────────────────────────────────────────────── */}
          {ecran === 4 ? (
            <div>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={2000}
                aria-label="Description du problème"
                placeholder="Elle s'allume puis s'éteint au bout de cinq minutes…"
                className="min-h-[118px] w-full resize-none border border-border-strong bg-surface-muted p-[15px] text-[17px] leading-[1.4] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
                style={{ boxSizing: "border-box" }}
              />
              {/* Un compteur qui dit ce qui reste à faire, et la porte de
                  sortie dans la même phrase : vingt caractères **ou** un
                  symptôme — c'est la règle de validation, mot pour mot. */}
              <span className="mb-[18px] mt-[7px] block font-mono text-[10.5px] tracking-[0.05em] text-ink-faint">
                {restants > 0 && !symptoms.length ? `Encore ${restants} caractère${restants > 1 ? "s" : ""}, ou cochez un symptôme` : `${desc.trim().length} caractères`}
              </span>

              <span className="mb-2.5 block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Ou cochez ce que vous constatez</span>
              <div className="flex flex-wrap gap-[7px]" role="group" aria-label="Symptômes">
                {symptomChoices.map((sym) => {
                  const on = symptoms.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSymptom(sym)}
                      className="flex min-h-[44px] cursor-pointer items-center whitespace-nowrap border px-3.5 text-[14.5px]"
                      /* Longhands seuls : un raccourci piloté par l'état
                         s'applique avec un rendu de retard, et la puce cochée
                         apparaît en blanc sur blanc. */
                      style={{
                        backgroundColor: on ? "var(--ink-900)" : "var(--glass)",
                        borderColor: on ? "var(--ink-900)" : "var(--stroke-strong)",
                        color: on ? "#ffffff" : "var(--text-2)",
                      }}
                    >
                      {/* Les pannes fréquentes du modèle sont mises en
                          minuscules pour être dédoublonnées avec les symptômes
                          génériques : « port hdmi » s'affichait tel quel sous un
                          titre en 27 px. On rehausse la première lettre au
                          rendu, sans toucher à la donnée comparée. La règle vit
                          sur ce `span` et non sur le bouton : `::first-letter`
                          ne s'applique pas à une boîte `flex`. */}
                      <span className="block first-letter:uppercase">{sym}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-[18px]">
                <DraftPhotoUploader photos={photos} onChange={setPhotos} label="Joindre une photo de la panne · facultatif" phoneLabel="Prendre une photo de la panne · facultatif" />
              </div>

              <div className="mt-[18px] flex flex-col gap-3">
                <TextInput label="Numéro de série" placeholder="Facultatif" value={serial} onChange={setSerial} maxLength={60} />
                <label className="flex min-h-[52px] items-center gap-3 border border-border-strong px-4 py-3 text-[14px] text-ink-soft">
                  <Checkbox checked={alreadyOpened} onChange={(e) => setAlreadyOpened(e.target.checked)} />
                  Console déjà ouverte ou réparée
                </label>
              </div>
            </div>
          ) : null}

          {/* ── 5 · l'envoi ───────────────────────────────────────────────── */}
          {ecran === 5 ? (
            <div>
              {!props.isLoggedIn ? (
                <p className="mb-3 text-[14px] text-ink-soft">
                  Un espace client est créé avec votre adresse pour suivre le dossier.{" "}
                  <Link href={`${ROUTES.login}?next=${encodeURIComponent(repairId ? `${ROUTES.checkout}/${repairId}` : ROUTES.repair)}`} className="text-sale underline">
                    Déjà client ? Connectez-vous
                  </Link>
                </p>
              ) : null}
              <div className="flex flex-col gap-[11px]">
                <TextInput label="Prénom" autoComplete="given-name" value={customer.first_name} onChange={(v) => setCustomer({ ...customer, first_name: v })} error={fieldErrors["customer.first_name"]} />
                <TextInput label="Nom" autoComplete="family-name" value={customer.last_name} onChange={(v) => setCustomer({ ...customer, last_name: v })} error={fieldErrors["customer.last_name"]} />
                <TextInput label="Courriel" type="email" autoComplete="email" placeholder="vous@exemple.fr" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} error={fieldErrors["customer.email"]} readOnly={props.isLoggedIn} />
                <TextInput label="Téléphone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} error={fieldErrors["customer.phone"]} />
                <TextInput label="Adresse de retour" autoComplete="address-line1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} error={fieldErrors["address.line1"]} />
                <TextInput label="Complément d'adresse" placeholder="Facultatif" autoComplete="address-line2" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} />
                <TextInput label="Code postal" autoComplete="postal-code" inputMode="numeric" placeholder="13006" value={address.postal_code} onChange={(v) => setAddress({ ...address, postal_code: v })} error={fieldErrors["address.postal_code"]} />
                <TextInput label="Ville" autoComplete="address-level2" placeholder="Marseille" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} error={fieldErrors["address.city"]} />
              </div>

              <span className="mb-2.5 mt-5 block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Comment nous l&apos;envoyer</span>
              <div className="flex flex-col" role="radiogroup" aria-label="Mode d'envoi">
                {(offer?.shippingMethods ?? []).map((m) => (
                  <LigneCoche key={m.id} role="radio" selected={shippingId === m.id} onPick={() => setShippingId(m.id)} label={m.name} note={m.note} price={m.priceCents === 0 ? "sans frais" : formatPrice(m.priceCents)} />
                ))}
                <span aria-hidden="true" className="block border-t border-border-hairline" />
              </div>

              {/* Le récapitulatif en dernier, et non répété plus haut. */}
              <div className="mt-5 border border-ink p-4">
                <span className="mb-[11px] block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Récapitulatif</span>
                <RecapMobile k="Console" v={modelLabel(model)} />
                <RecapMobile k="Intervention" v={repair?.name ?? "—"} />
                <RecapMobile k="Options" v={pickedOptions.length ? pickedOptions.map((o) => o.name).join(", ") : "aucune"} />
                {symptoms.length ? <RecapMobile k="Symptômes" v={symptoms.join(", ")} /> : null}
                {photos.length ? <RecapMobile k="Photos" v={`${photos.length} jointe${photos.length > 1 ? "s" : ""}`} /> : null}
                <RecapMobile k="Envoi" v={shipping ? `${shipping.name} — ${shipping.priceCents === 0 ? "sans frais" : formatPrice(shipping.priceCents)}` : "—"} />
                <span className="mt-[9px] flex items-baseline justify-between gap-3.5 border-t border-border-hairline pt-[11px]">
                  <span className="text-[15px] font-semibold">Estimation</span>
                  <span className="text-[20px] font-bold tracking-[-0.03em] text-red">{estimate}</span>
                </span>
                {pricing ? <RecapMobile k="dont TVA" v={formatPrice(pricing.vatCents)} /> : null}
              </div>

              <p className="mt-3.5 text-[13px] leading-[1.5] text-ink-faint">
                {repair?.priceProvisional ? "Le tarif de cette intervention est communiqué après diagnostic : vous ne réglez aujourd'hui que le transport. " : repair?.isDiagnosticOnly ? "Diagnostic puis devis. " : ""}
                Estimation indicative. Le devis définitif vous est adressé après diagnostic (valable {conditions.quoteValidityDays} jours) ; en cas de refus, la console vous est retournée, seul le port reste dû. {conditions.refusalExplanation}
                {conditions.refusalFeeCents > 0 ? ` Frais applicables : ${formatPrice(conditions.refusalFeeCents)}.` : ""}
              </p>

              <label className="mt-3.5 flex items-start gap-[11px] text-[13.5px] leading-[1.45] text-ink-soft">
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
            <div className="mt-5">
              <FormError message={error ?? pricingError} />
            </div>
          ) : null}
        </div>

        {/* ── La barre d'action — le seul endroit où vit l'estimation ─────────
            `sticky` et non `fixed` : le clavier tactile la pousse au lieu de la
            recouvrir. Un seul bouton : le « Retour » séparé est devenu la
            flèche de l'en-tête. */}
        <div className="safe-bottom sticky bottom-0 z-10 mt-auto border-t border-border-strong bg-bg px-4 pt-[11px]" style={{ boxSizing: "border-box", ["--safe-pb" as string]: "14px" }}>
          <button
            type="button"
            onClick={step === 4 ? submit : next}
            disabled={submitting || bloque || (step === 4 && (!pricing || Boolean(pricingError)))}
            aria-busy={submitting || undefined}
            className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 border-0 text-[16.5px] font-semibold text-white disabled:cursor-not-allowed"
            style={{ boxSizing: "border-box", backgroundColor: bloque || submitting ? "#b9b9c0" : "var(--red)" }}
          >
            {submitting ? (
              "Envoi…"
            ) : (
              <>
                <span>{libelleBouton}</span>
                {runningTotal ? <span className="font-mono font-normal opacity-90">· {runningTotal}</span> : null}
              </>
            )}
          </button>
          <span className="mt-[9px] block text-center font-mono text-[10px] uppercase tracking-[0.09em] text-ink-faint">
            {step === 4 ? "Paiement sécurisé à l'étape suivante" : "Diagnostic sous 48 h · devis avant intervention · garantie 3 mois"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("glass rounded-[32px] p-5 sm:p-9", props.wide && "w-full")} style={{ scrollMarginTop: 96 }}>
      {/* Barre supérieure : anneau de progression, étape en cours, et à droite
          l'estimation — le chiffre que le client suit d'un bout à l'autre. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-border pb-6">
        <ProgressRing step={step} total={4} size={64} />
        <div className="min-w-0 flex-1">
          <span className="mono-label text-ink-muted">Devis en ligne</span>
          <h3 className="mt-2 font-display text-[clamp(24px,2.5vw,33px)] font-bold leading-[1.02] tracking-[-0.035em] text-ink">{stepTitle}</h3>
        </div>
        {/*
          L'estimation, à droite du titre — sur écran large seulement.
          Insécable et large de cent cinquante pixels, elle ne laissait que
          cinquante-neuf pixels au titre de l'étape sur un téléphone : « Quel
          appareil ? » débordait de son cadre. Le chiffre n'est pas perdu pour
          autant, le bouton principal le porte déjà sous `lg` (voir
          `runningTotal`) — c'est même là qu'on le regarde, le haut du panneau
          étant hors de l'écran au moment de valider.
        */}
        <div className="hidden text-right lg:block">
          <span className="mono-label text-ink-muted">Estimation</span>
          <p className="mt-2 whitespace-nowrap font-mono text-[19px] text-sale">{estimate}</p>
        </div>
      </div>

      {props.cancelled && step === 2 ? (
        <p className="mt-6 rounded-[20px] border border-warning bg-warning-soft px-4 py-3 text-[13.5px] text-warning">Votre paiement n&apos;a pas été finalisé. Vous pouvez reprendre votre demande ci-dessous.</p>
      ) : null}

      {step === 1 ? (
        <div className="mt-7 flex flex-col gap-4">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-muted">1. La plateforme, 2. le modèle exact — les interventions dépendent du modèle</span>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(185px,1fr))]" role="radiogroup" aria-label="Plateforme">
            {platforms.map((p) => (
              <DeviceCard key={p.key} selected={platform === p.key} onPick={() => { setPlatform(p.key); setModelId(null); setError(null); }} label={p.label} note={p.note} />
            ))}
          </div>
          {platform ? (
            <>
              <span className="mt-2 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-muted">Modèle exact</span>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(185px,1fr))]" role="radiogroup" aria-label="Modèle">
                {platformModels.map((m) => (
                  <DeviceCard key={m.id} selected={modelId === m.id} onPick={() => pickModel(m.id)} label={m.name} note={platform === RETRO_KEY ? m.brandName : m.tag || m.brandName} />
                ))}
              </div>
              {!platformModels.length ? <p className="text-[15px] text-ink-muted">Aucun modèle publié pour cette plateforme.</p> : null}
            </>
          ) : null}
          {!models.length ? <p className="text-[15px] text-ink-muted">Aucune console publiée pour le moment.</p> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-7 flex flex-col gap-4">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-muted">Une intervention principale, puis les options compatibles</span>
          {repairsLoading ? <p className="text-[15px] text-ink-muted">Chargement des interventions…</p> : null}
          {!repairsLoading && !repairs.length ? (
            <p className="text-[15px] text-ink-muted">
              Aucune intervention publiée pour ce modèle. Écrivez-nous depuis la page{" "}
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
              className="w-full rounded-[14px] border border-border-strong bg-field px-4 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:text-[15px]"
            />
          ) : null}
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Prestation">
            {repairGroups.map((group, index) => {
              const open = isCategoryOpen(group.name, index);
              const panelId = `prestations-${index}`;
              return (
                <div key={group.name} className="overflow-hidden rounded-[20px] border border-border">
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.name)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 bg-surface-muted px-4 py-3.5 text-left transition-colors hover:bg-surface-strong"
                  >
                    <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink">{group.name}</span>
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
            {searching && !repairGroups.length ? <p className="text-[15px] text-ink-muted">Aucune panne ne correspond. Décrivez le problème à l&apos;étape suivante.</p> : null}
          </div>
          {repairId ? (
            <>
              {offerLoading ? <p className="font-mono text-[11.5px] text-ink-muted">Chargement des options compatibles…</p> : null}
              {offer && (offer.packs.length || offer.options.length) ? (
                <>
                  <span className="mt-2 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-muted">Options d&apos;entretien — plusieurs choix possibles</span>
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
              {offer && !offer.packs.length && !offer.options.length ? <p className="font-mono text-[11.5px] text-ink-muted">Aucune option supplémentaire compatible avec cette intervention.</p> : null}
              {pricing?.warnings.length ? <p className="text-[13px] text-ink-faint">{pricing.warnings.join(" ")}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-7 flex flex-col gap-4">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={2000}
            aria-label="Description du problème"
            placeholder="Elle s'allume puis s'éteint au bout de cinq minutes…"
            className="min-h-[124px] w-full resize-none rounded-[20px] border border-border-strong bg-field p-5 font-display text-[18px] leading-[1.35] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none sm:min-h-[150px] sm:text-[22px]"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Symptômes">
            {symptomChoices.map((sym) => {
              const on = symptoms.includes(sym);
              return (
                <button
                  key={sym}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSymptom(sym)}
                  className={cn(
                    "chip border transition-colors duration-300",
                    on ? "border-sale bg-sale text-[var(--color-on-accent)]" : "border-border-strong text-ink-soft hover:border-sale hover:bg-sale hover:text-[var(--color-on-accent)]",
                  )}
                >
                  {sym}
                </button>
              );
            })}
          </div>
          <DraftPhotoUploader photos={photos} onChange={setPhotos} label="Joindre une photo de la panne · facultatif" phoneLabel="Prendre une photo de la panne" />

          {/* Récapitulatif compact : au téléphone, le client n'a pas la barre
              supérieure sous les yeux quand il est descendu dans l'étape. */}
          <div className="rounded-[20px] border border-sale/40 bg-sale/[0.06] p-4 sm:hidden">
            <span className="mono-label text-ink-muted">Votre demande</span>
            <dl className="mt-3 flex flex-col gap-2 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Appareil</dt>
                <dd className="text-right font-medium text-ink">{modelLabel(model)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Intervention</dt>
                <dd className="text-right font-medium text-ink">{repair?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Estimation</dt>
                <dd className="whitespace-nowrap text-right font-mono text-sale">{estimate}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <TextInput label="Numéro de série" placeholder="Facultatif" value={serial} onChange={setSerial} maxLength={60} />
            <label className="flex min-h-[52px] items-center gap-3 self-end rounded-[14px] border border-border-strong px-4 py-3 text-[14px] text-ink-soft">
              <Checkbox checked={alreadyOpened} onChange={(e) => setAlreadyOpened(e.target.checked)} />
              Console déjà ouverte ou réparée
            </label>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-7 flex flex-col gap-4">
          {!props.isLoggedIn ? (
            <p className="text-[14px] text-ink-muted">
              Un espace client est créé avec votre adresse pour suivre le dossier.{" "}
              <Link href={`${ROUTES.login}?next=${encodeURIComponent(repairId ? `${ROUTES.checkout}/${repairId}` : ROUTES.repair)}`} className="text-sale underline">
                Déjà client ? Connectez-vous
              </Link>
            </p>
          ) : null}
          {/* Libellés permanents au-dessus des champs : jamais un placeholder
              seul en guise d'étiquette — il disparaît à la première frappe. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput label="Prénom" autoComplete="given-name" value={customer.first_name} onChange={(v) => setCustomer({ ...customer, first_name: v })} error={fieldErrors["customer.first_name"]} />
            <TextInput label="Nom" autoComplete="family-name" value={customer.last_name} onChange={(v) => setCustomer({ ...customer, last_name: v })} error={fieldErrors["customer.last_name"]} />
            <TextInput label="Téléphone" type="tel" autoComplete="tel" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} error={fieldErrors["customer.phone"]} />
            <TextInput label="Courriel" type="email" autoComplete="email" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} error={fieldErrors["customer.email"]} readOnly={props.isLoggedIn} />
            <TextInput label="Adresse de retour" autoComplete="address-line1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} error={fieldErrors["address.line1"]} className="sm:col-span-2" />
            <TextInput label="Complément d'adresse" placeholder="Facultatif" autoComplete="address-line2" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} className="sm:col-span-2" />
            <TextInput label="Code postal" autoComplete="postal-code" inputMode="numeric" value={address.postal_code} onChange={(v) => setAddress({ ...address, postal_code: v })} error={fieldErrors["address.postal_code"]} />
            <TextInput label="Ville" autoComplete="address-level2" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} error={fieldErrors["address.city"]} />
          </div>
          <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="Mode d'envoi">
            {(offer?.shippingMethods ?? []).map((m) => (
              <OptionRow key={m.id} selected={shippingId === m.id} onPick={() => setShippingId(m.id)} label={m.name} note={m.note} price={m.priceCents === 0 ? "sans frais" : formatPrice(m.priceCents)} role="radio" />
            ))}
          </div>
          <div className="mt-2 rounded-[24px] border border-sale/40 bg-sale/[0.06] p-5">
            <span className="mono-label text-ink-muted">Récapitulatif</span>
            <div className="mt-4 flex flex-col gap-2.5 text-[15px]">
              <RecapLine k="Appareil" v={modelLabel(model)} />
              <RecapLine k="Intervention" v={repair?.name ?? "—"} />
              {symptoms.length ? <RecapLine k="Symptômes" v={symptoms.join(", ")} muted /> : null}
              {photos.length ? <RecapLine k="Photos" v={`${photos.length} jointe${photos.length > 1 ? "s" : ""}`} muted /> : null}
              <RecapLine k="Options" v={pickedOptions.length ? pickedOptions.map((o) => o.name).join(", ") : "aucune"} />
              <RecapLine k="Envoi" v={shipping ? `${shipping.name} — ${shipping.priceCents === 0 ? "sans frais" : formatPrice(shipping.priceCents)}` : "—"} />
              <RecapLine k="Estimation" v={repair?.priceProvisional ? "après diagnostic" : total !== null ? formatPrice(total) : "calcul…"} strong />
              {pricing ? <RecapLine k="dont TVA" v={formatPrice(pricing.vatCents)} muted /> : null}
            </div>
          </div>
          <p className="text-[13.5px] leading-[1.5] text-ink-muted">
            {repair?.priceProvisional ? "Le tarif de cette intervention est communiqué après diagnostic : vous ne réglez aujourd'hui que le transport. " : repair?.isDiagnosticOnly ? "Diagnostic puis devis. " : ""}
            Estimation indicative. Le devis définitif vous est adressé après diagnostic (valable {conditions.quoteValidityDays} jours) ; en cas de refus, la console vous est retournée, seul le port reste dû. {conditions.refusalExplanation}
            {conditions.refusalFeeCents > 0 ? ` Frais applicables : ${formatPrice(conditions.refusalFeeCents)}.` : ""}
          </p>
          <label className="flex items-start gap-3 text-[13.5px] text-ink-muted">
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
        <div className="mt-5">
          <FormError message={error ?? pricingError} />
        </div>
      ) : null}

      {/* Barre d'action. Collée en bas au téléphone — `sticky` et non `fixed`,
          le clavier tactile la pousse au lieu de la recouvrir. */}
      <div
        className={cn(
          "safe-bottom -mx-5 mt-8 border-t border-border px-5 pt-4 sm:static sm:mx-0 sm:border-0 sm:px-0 sm:pb-0 sm:pt-8",
          sticky && "sticky bottom-0 z-10 backdrop-blur-[14px] max-sm:bg-[rgba(7,6,10,0.82)]",
        )}
        style={{ "--safe-pb": "16px" } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 1 || submitting}
            className="cursor-pointer rounded-full border border-border-strong bg-transparent px-6 py-[15px] font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-soft transition-colors duration-300 hover:border-ink hover:text-ink disabled:opacity-40"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={step === 4 ? submit : next}
            disabled={submitting || (step === 4 && (!pricing || Boolean(pricingError)))}
            aria-busy={submitting || undefined}
            className="btn-gradient flex-1 cursor-pointer rounded-full px-6 py-[17px] text-[16px] font-semibold disabled:opacity-60"
          >
            {submitting ? (
              "Envoi…"
            ) : (
              <>
                {nextLabel}
                {runningTotal ? <span className="lg:hidden"> · {runningTotal}</span> : null}
              </>
            )}
          </button>
        </div>
        {step === 4 ? <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">Paiement sécurisé à l&apos;étape suivante · prix vérifié par nos serveurs</p> : null}
      </div>
    </div>
  );
}

/**
 * Ce que l'en-tête du site recouvre en haut de la fenêtre, en pixels.
 *
 * L'en-tête est collant et haut de deux lignes au téléphone — logo et panier,
 * puis la recherche. Remonter exactement sur le haut de la fiche posait donc le
 * bandeau d'étape et la question **dessous** : l'écran s'ouvrait sur sa
 * troisième ligne, sans qu'on voie ni « Étape 2 sur 5 » ni « Quel modèle ? ».
 * On s'arrête juste en dessous.
 *
 * La hauteur est mesurée et non écrite : elle dépend de la longueur du nom du
 * magasin, de la police chargée ou non, et du bandeau utilitaire. `position`
 * est vérifiée parce qu'au-delà de 640 px l'en-tête peut cesser de coller.
 */
function hauteurEnteteCollant(): number {
  const entete = document.querySelector<HTMLElement>("[data-entete-site]");
  if (!entete || getComputedStyle(entete).position !== "sticky") return 0;
  return Math.round(entete.getBoundingClientRect().height);
}

/**
 * Une ligne de choix — écrans « marque » et « modèle » du téléphone.
 *
 * Une ligne, pas une carte. La grille `minmax(185px)` du bureau donne une
 * colonne unique sur 390 px : autant de cartes de 96 px qu'il y a de modèles,
 * soit cinq cents pixels de défilement pour cinq mots. Une ligne de 60 px en
 * montre six d'un coup d'œil. Le chevron dit qu'elle mène quelque part : la
 * toucher avance.
 */
function LigneChoix({ selected, onPick, label, note }: { selected: boolean; onPick: () => void; label: string; note: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className="flex min-h-[60px] w-full cursor-pointer items-center gap-[13px] border-0 border-t border-border-hairline px-0.5 py-4 text-left"
      style={{ backgroundColor: selected ? "rgba(216,31,38,0.07)" : "transparent" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] font-semibold tracking-[-0.022em] text-ink">{label}</span>
        {note ? <span className="mt-[3px] block font-mono text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">{note}</span> : null}
      </span>
      <span aria-hidden="true" className="text-[15px] text-ink-faint">
        →
      </span>
    </button>
  );
}

/**
 * Une ligne cochable — interventions, options, transport.
 *
 * Pastille **carrée** de 20 px : au téléphone, la charte v9 ne porte aucun
 * rayon, et une pastille ronde au milieu de lignes à angles nets se remarque
 * pour de mauvaises raisons. Toucher la ligne choisit ; elle ne fait pas
 * avancer — c'est le bouton du bas qui avance, une fois le choix fait.
 */
function LigneCoche({
  selected,
  disabled,
  onPick,
  label,
  note,
  price,
  badge,
  role = "checkbox",
}: {
  selected: boolean;
  disabled?: boolean;
  onPick: () => void;
  label: string;
  note: string;
  price: string;
  badge?: string;
  role?: "checkbox" | "radio";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onPick}
      className="flex min-h-[60px] w-full cursor-pointer items-start gap-3 border-0 border-t border-border-hairline px-0.5 py-[15px] text-left disabled:cursor-not-allowed disabled:opacity-60"
      style={{ backgroundColor: selected ? "rgba(216,31,38,0.07)" : "transparent" }}
    >
      <span
        aria-hidden="true"
        className="mt-[3px] flex h-5 w-5 flex-none items-center justify-center border text-[11px] font-bold"
        style={{
          backgroundColor: selected ? "var(--red)" : "transparent",
          borderColor: selected ? "var(--red)" : "var(--stroke-strong)",
          color: selected ? "#ffffff" : "transparent",
        }}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16.5px] font-semibold leading-[1.25] tracking-[-0.018em] text-ink">
          {label}
          {badge ? <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">{badge}</span> : null}
        </span>
        {note ? <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.05em] text-ink-faint">{note}</span> : null}
      </span>
      <span className="flex-none whitespace-nowrap text-[17px] font-bold tracking-[-0.028em] text-ink">{price}</span>
    </button>
  );
}

/** Une ligne du récapitulatif de l'écran d'envoi. */
function RecapMobile({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex justify-between gap-3.5 py-[5px] text-[14.5px]">
      <span className="text-ink-faint">{k}</span>
      <span className="text-right font-mono text-ink">{v}</span>
    </span>
  );
}

/**
 * Carte d'appareil (étape 1) : nom en display, précision en mono. Au survol
 * elle se soulève et son filet passe au cyan ; sélectionnée, elle se remplit
 * d'un cyan translucide.
 */
function DeviceCard({ selected, onPick, label, note }: { selected: boolean; onPick: () => void; label: string; note: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={cn(
        "flex min-h-[96px] cursor-pointer flex-col justify-center gap-1.5 rounded-[20px] border p-5 text-left transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1.5 hover:border-cyan",
        selected ? "border-cyan bg-accent-soft" : "border-border-strong bg-transparent",
      )}
    >
      <span className="font-display text-[19px] font-bold leading-[1.1] tracking-[-0.025em] text-ink">{label}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">{note}</span>
    </button>
  );
}

/**
 * Ligne d'intervention ou d'option : pastille ronde, libellé, note, prix à
 * droite. Au survol, la ligne glisse de 6 px et son filet passe au lime ;
 * sélectionnée, la pastille se remplit d'un ✓.
 */
function OptionRow({ selected, disabled, onPick, label, note, price, badge, role = "checkbox" }: { selected: boolean; disabled?: boolean; onPick: () => void; label: string; note: string; price: string; badge?: string; role?: "checkbox" | "radio" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onPick}
      className={cn(
        "flex w-full cursor-pointer items-start gap-4 rounded-[20px] border p-4 text-left transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:translate-x-1.5 hover:border-sale disabled:cursor-not-allowed disabled:opacity-60 sm:items-center sm:p-5",
        selected ? "border-sale bg-sale/[0.1]" : "border-border-strong bg-transparent",
      )}
    >
      <span
        className={cn(
          "mt-[3px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border text-[12px] font-bold sm:mt-0",
          selected ? "border-sale bg-sale text-[var(--color-on-accent)]" : "border-border-strong bg-transparent text-transparent",
        )}
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-[16px] font-semibold leading-[1.2] text-ink sm:text-[18px]">
          {label}
          {badge ? <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-[0.12em] text-cyan">{badge}</span> : null}
        </span>
        {note ? <span className="text-[14px] leading-[1.4] text-ink-muted">{note}</span> : null}
      </span>
      <span className="flex-none whitespace-nowrap font-mono text-[16px] text-sale sm:text-[18px]">{price}</span>
    </button>
  );
}

/** Champ à libellé permanent : l'étiquette reste au-dessus, en mono majuscules. */
function TextInput({
  value,
  onChange,
  error,
  className,
  label,
  ...rest
}: { value: string; onChange: (v: string) => void; error?: string; className?: string; label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <span className={cn("flex flex-col gap-2", className)}>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={Boolean(error)}
        className={cn(
          "w-full rounded-[14px] border bg-field px-4 py-3 text-[16px] text-ink placeholder:text-ink-muted read-only:opacity-70 focus:border-accent focus:outline-none sm:text-[15px]",
          error ? "border-danger" : "border-border-strong",
        )}
      />
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function RecapLine({ k, v, muted, strong }: { k: string; v: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", muted && "text-[13px]")}>
      <span className="text-ink-muted">{k}</span>
      <span className={cn("text-right font-mono", strong ? "text-[17px] text-sale" : "text-ink")}>{v}</span>
    </div>
  );
}
