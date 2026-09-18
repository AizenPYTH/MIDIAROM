"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { Checkbox, FormError } from "@/components/ui/form";
import { formatPrice, formatPriceDelta, formatRepairPrice } from "@/lib/utils/format";
import { useAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { PricingResult } from "@/lib/pricing/engine";
import { createOrderAction, createQuoteRequestAction, quoteSelectionAction } from "@/app/(marketing)/commande/[repairId]/actions";
import { loadModelRepairsAction, loadOfferAction } from "@/app/(marketing)/reparation/actions";
import type { FormAddress, FormConditions, FormCustomer, FormModel, FormOffer, FormPlatform, FormRepair } from "@/components/repair/repair-form-types";
import { DraftPhotoUploader, type DraftPhoto } from "@/components/customer/draft-photo-uploader";
import { listeCourte } from "@/lib/repair/selection";
import { PLATFORM_VISUALS } from "@/lib/content/platform-visuals";
import { cn } from "@/lib/utils/cn";

/**
 * Le parcours de réparation, en six étapes.
 *
 *  01 Console      → la famille (marque, ou rétro)
 *  02 Modèle       → le modèle exact du catalogue
 *  03 Problème     → la prestation, puis ce qui se passe (mots, symptômes, photos)
 *  04 Options      → ce qui s'ajoute, hors de ce que l'intervention couvre déjà
 *  05 Coordonnées  → qui vous êtes, et comment la console nous arrive
 *  06 Confirmation → le récapitulatif, les conditions, l'envoi
 *
 * **Une seule trame, à toutes les largeurs.** La version précédente en portait
 * deux — un arbre de rendu pour le téléphone, un autre pour le bureau — et
 * chaque correction devait être faite deux fois, ou n'était faite qu'une. Ici
 * la grille passe de deux colonnes à une, le résumé collé devient une barre
 * basse, et la progression de six cellules devient une ligne. Rien ne se
 * duplique.
 *
 * Ce qui ne change pas, et ne doit pas changer : les actions serveur, le
 * calcul de prix côté serveur et son `quoteVersion`, la création de commande,
 * le paiement, le suivi et le back-office. C'est une refonte d'interface.
 */
export interface RepairFormProps {
  models: FormModel[];
  /**
   * La console déjà choisie, sans le modèle.
   *
   * C'est ce que pose une tuile de l'accueil : le visiteur a dit « PlayStation »
   * en cliquant, il n'a pas à le redire. Le parcours reprend donc à la question
   * suivante — le modèle — au lieu de rouvrir celle à laquelle il vient de
   * répondre. Porte un identifiant de marque, ou « retro ».
   */
  initialPlatform?: string | null;
  initialModelId?: string | null;
  initialRepairs?: FormRepair[];
  initialRepairId?: string | null;
  initialOffer?: FormOffer | null;
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

/**
 * « Autre problème » : un choix, pas une prestation.
 *
 * Cette valeur n'est **jamais** un identifiant de `repairs` — elle ne peut donc
 * pas être confondue avec une panne du catalogue, ni voyager jusqu'à la base.
 * Le serveur reçoit `repairId: null` et comprend que c'est la description du
 * client qui fait foi.
 */
const AUTRE_PROBLEME = "autre";
const RETRO_KEY = "retro";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** Les six étapes du parcours à prix fixe, dans l'ordre. */
const ETAPES = [
  { n: "01", label: "Console", s: 1 as Step },
  { n: "02", label: "Modèle", s: 2 as Step },
  { n: "03", label: "Problème", s: 3 as Step },
  { n: "04", label: "Options", s: 4 as Step },
  { n: "05", label: "Coordonnées", s: 5 as Step },
  { n: "06", label: "Confirmation", s: 6 as Step },
] as const;

/**
 * Les cinq étapes de la demande de devis gratuite.
 *
 * Il en manque une, et c'est la démonstration du parcours : sans prix, il n'y
 * a **rien à chiffrer** — ni options à ajouter au montant, ni transport à
 * facturer. L'étape « Options » disparaît donc, et l'étape des coordonnées ne
 * demande plus d'adresse de livraison : on ne sait pas encore si la console
 * viendra, et si elle vient, ce sera après l'accord, au choix du client entre
 * le dépôt en boutique et l'envoi.
 *
 * Les numéros d'étape restent ceux du parcours complet (`s`) : une seule
 * machine, deux affichages, plutôt que deux compteurs à garder en phase.
 */
const ETAPES_DEVIS = [
  { n: "01", label: "Console", s: 1 as Step },
  { n: "02", label: "Modèle", s: 2 as Step },
  { n: "03", label: "Problème", s: 3 as Step },
  { n: "04", label: "Coordonnées", s: 5 as Step },
  { n: "05", label: "Demande", s: 6 as Step },
] as const;

/**
 * « PlayStation 4 », et non « PlayStation PlayStation 4 » : les modèles du
 * catalogue du client portent déjà le nom de la marque. On ne le préfixe que
 * lorsqu'il manque (une console rétro nommée « Mega Drive », par exemple).
 */
function modelLabel(model: FormModel | null): string {
  if (!model) return "—";
  return model.name.toLowerCase().startsWith(model.brandName.toLowerCase()) ? model.name : `${model.brandName} ${model.name}`;
}

/**
 * Les familles de l'étape 01, dérivées du catalogue.
 *
 * Le sous-titre annonce les modèles **réellement** publiés : trois noms, puis
 * le compte du reste, le nom de la famille retiré quand il préfixe déjà le
 * modèle (« Xbox Series X » → « Series X », la tuile disant déjà Xbox).
 * Annoncer « PS3 » quand l'atelier n'en répare pas envoie le client sur une
 * liste vide — c'est la raison d'être de ce calcul plutôt que d'une constante.
 */
function buildPlatforms(models: FormModel[]): FormPlatform[] {
  // Le nom court du catalogue — « PS5 », « Switch OLED » — plutôt que le nom
  // complet amputé de sa marque : « PlayStation 4 Pro » moins « PlayStation »
  // donnait « 4 Pro », qui ne se lit pas.
  const note = (noms: string[]) => {
    const tete = noms.slice(0, 3).join(" · ");
    return noms.length > 3 ? `${tete} +${noms.length - 3}` : tete;
  };

  const platforms: FormPlatform[] = [];
  for (const m of models) {
    if (m.isRetro || platforms.some((p) => p.key === m.brandId)) continue;
    const own = models.filter((x) => x.brandId === m.brandId && !x.isRetro);
    platforms.push({ key: m.brandId, label: m.brandName, note: note(own.map((x) => x.short)), visuel: m.brandSlug });
  }
  const retro = models.filter((m) => m.isRetro);
  if (retro.length) platforms.push({ key: RETRO_KEY, label: "Rétro", note: note(retro.map((m) => m.short)), visuel: RETRO_KEY });
  return platforms;
}

export function RepairForm(props: RepairFormProps) {
  const { models, conditions } = props;
  const { track, attribution } = useAnalytics();
  /**
   * Où l'on entre dans le parcours.
   *
   * Déduit de ce qui est déjà connu, et non d'un numéro passé en prop : une
   * page de modèle ouvre l'étape « Problème », une page de panne l'ouvre avec
   * la prestation déjà cochée — et laisse donc décrire la panne, ce qu'un saut
   * direct aux options escamotait.
   */
  const [step, setStep] = useState<Step>(() => (props.initialModelId || props.initialRepairId ? 3 : props.initialPlatform ? 2 : 1));
  const platforms = useMemo(() => buildPlatforms(models), [models]);
  const [platform, setPlatform] = useState<string | null>(() => {
    const initial = models.find((m) => m.id === props.initialModelId);
    if (initial) return initial.brandId;
    // Une plateforme passée par l'adresse n'est retenue que si elle existe
    // vraiment : un lien périmé rouvre le choix plutôt que d'afficher un écran
    // de modèles vide.
    if (props.initialPlatform && platforms.some((p) => p.key === props.initialPlatform)) return props.initialPlatform;
    return platforms.length === 1 ? (platforms[0]?.key ?? null) : null;
  });
  const [modelId, setModelId] = useState<string | null>(props.initialModelId ?? null);
  const [repairs, setRepairs] = useState<FormRepair[]>(props.initialRepairs ?? []);
  const [repairsLoading, setRepairsLoading] = useState(false);
  const [repairId, setRepairId] = useState<string | null>(props.initialRepairId ?? null);
  const [offer, setOffer] = useState<FormOffer | null>(props.initialOffer ?? null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [packIds, setPackIds] = useState<string[]>([]);
  /**
   * Aucun mode d'envoi par défaut, et c'est une règle de facturation.
   *
   * Le premier de la liste coûte 14,90 € : le préchoisir facturait un transport
   * que le client n'avait jamais demandé. L'étape 05 ne se valide donc qu'avec
   * un mode explicitement choisi, et le total ignore `null`. La même règle vaut
   * partout : jamais de `|| tableau[0]` sur une valeur facturée.
   */
  const [shippingId, setShippingId] = useState<string | null>(null);
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

  /**
   * La bascule entre les deux parcours, et la seule.
   *
   * `price_is_provisional` ne dit pas « prix à zéro », il dit « pas encore de
   * prix ». Une prestation dans cet état ne peut pas se commander : elle ouvre
   * une demande de devis gratuite. Le serveur refait exactement la même lecture
   * (`create-quote-request.ts`), sur la donnée de la base — ce drapeau-ci ne
   * fait qu'accorder l'écran avec elle.
   */
  const surDevis = repairId === AUTRE_PROBLEME || Boolean(repair?.priceProvisional);
  const etapes = surDevis ? ETAPES_DEVIS : ETAPES;
  const rangEtape = Math.max(0, etapes.findIndex((e) => e.s === step));
  const etapeCourante = etapes[rangEtape]!;
  const platformModels = useMemo(() => (platform === RETRO_KEY ? models.filter((m) => m.isRetro) : platform ? models.filter((m) => m.brandId === platform) : []), [models, platform]);
  /*
    ── Cinq pannes, et une porte de sortie ───────────────────────────────────

    L'atelier publie jusqu'à quatre-vingt-neuf prestations pour une console :
    c'est la bonne granularité pour saisir un dossier, c'est un mur pour
    quelqu'un dont la console ne s'allume plus.

    On en montre **cinq** — celles que le back-office met en avant pour ce
    modèle précis — et rien d'autre. Ce qui n'y figure pas ne passe pas par une
    seconde liste à parcourir, mais par « Autre problème » : le client écrit ce
    qu'il constate, joint des photos, et le réparateur lit avant de chiffrer.

    C'est le renversement qui compte. Couvrir tous les cas par des lignes de
    catalogue, c'est la liste de 1 189 entrées qu'on vient de réduire ; la
    couverture se fait par la description, pas par l'énumération.
  */
  const courtes = useMemo(() => listeCourte(repairs), [repairs]);

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

  /*
    ── Ce que chaque étape demande, et ce qui manque pour la franchir ─────────
    Une étape ne se valide que sur sa propre condition. Un tableau qui
    commençait par `true` laissait « Continuer » actif sans console choisie, et
    l'étape suivante s'ouvrait vide.
  */
  const plateforme = platforms.find((p) => p.key === platform) ?? null;
  const descriptionFaite = desc.trim().length >= MIN_DESCRIPTION || symptoms.length > 0;
  /** Sur devis, la description est obligatoire : c'est la matière du devis. */
  const descriptionLibreFaite = desc.trim().length >= MIN_DESCRIPTION;
  const identiteFaite = Boolean(customer.first_name.trim() && customer.last_name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim()));
  const adresseFaite = Boolean(address.line1.trim() && /^\d{5}$/.test(address.postal_code.trim()) && address.city.trim());
  // Une demande de devis ne livre rien : elle ne réclame pas d'adresse.
  const coordonneesFaites = identiteFaite && (surDevis || adresseFaite);

  /**
   * Ce qui manque, dit par le bouton lui-même.
   *
   * Et non par une mention posée à côté : cette mention était masquée sous
   * 1040 px, où la barre basse porte l'action. Sur tous les téléphones et
   * toutes les tablettes, le client voyait donc un « Continuer » éteint sans
   * savoir pourquoi.
   */
  const manque: (string | null)[] = [
    platform ? null : "Choisissez votre console",
    modelId ? null : "Choisissez un modèle",
    // Sur devis, la description **fait** le dossier : sans mots, le réparateur
    // n'a rien à chiffrer. Des symptômes cochés ne suffisent donc plus, et
    // l'offre (options, transport) n'est pas attendue, puisqu'il n'y en a pas.
    !repairId
      ? "Choisissez une panne"
      : surDevis
        ? descriptionLibreFaite
          ? null
          : "Décrivez la panne en quelques mots"
        : !descriptionFaite
          ? "Décrivez la panne"
          : offer
            ? null
            : "Chargement des options…",
    null,
    !coordonneesFaites ? "Complétez vos coordonnées" : surDevis || shippingId ? null : "Choisissez un mode d'envoi",
    acceptTerms ? null : "Acceptez les conditions",
  ];
  const quiManque = manque[step - 1] ?? null;
  const bloque = Boolean(quiManque);

  const QUESTIONS = ["Quelle console ?", plateforme ? `Quel ${plateforme.label} ?` : "Quel modèle ?", "Que se passe-t-il ?", "À ajouter ?", "Où vous joindre ?", surDevis ? "Vérifiez votre demande de devis" : "Vérifiez votre demande"];
  const AIDES = [
    "L'atelier ne répare que des consoles — ni téléphones, ni ordinateurs.",
    "Le modèle exact : les interventions et les pièces en dépendent.",
    "Choisissez la panne la plus proche, puis dites-nous ce que vous constatez.",
    "Facultatif. Ce qui est déjà compris dans l'intervention n'apparaît pas ici.",
    "Le devis et le suivi partent sur ces coordonnées.",
    surDevis ? "Votre demande est gratuite : vérifiez, puis envoyez." : "Rien n'est prélevé au-delà de ce montant sans votre accord écrit.",
  ];

  /** Le fil des choix déjà faits, cliquable pour y revenir. */
  const fil: { label: string; go: () => void }[] = [];
  if (plateforme) fil.push({ label: plateforme.label, go: () => setStep(1) });
  if (model) fil.push({ label: modelLabel(model), go: () => setStep(2) });
  if (repair) fil.push({ label: repair.name.length > 26 ? `${repair.name.slice(0, 24)}…` : repair.name, go: () => setStep(3) });
  else if (repairId === AUTRE_PROBLEME) fil.push({ label: "Autre problème", go: () => setStep(3) });

  const etapePrecedente = useRef<Step | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const premier = etapePrecedente.current === null;
    etapePrecedente.current = step;
    if (premier) return;
    const haut = (rootRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    window.scrollTo({ top: Math.max(0, haut - hauteurEnteteCollant()), behavior: "auto" });
  }, [step]);

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
      setStep(3);
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
      setError(null);
      /*
        « Autre problème » n'a ni offre, ni options, ni transport à charger :
        c'est une demande de devis par définition. Appeler le serveur avec une
        valeur qui n'est pas un identifiant ne donnerait qu'une erreur.
      */
      if (id === AUTRE_PROBLEME) {
        setOfferLoading(false);
        setShippingId(null);
        track(ANALYTICS_EVENTS.VIEW_REPAIR, { repair_id: AUTRE_PROBLEME, value_cents: 0, repair_name: "Autre problème" });
        return;
      }
      setOfferLoading(true);
      const picked = repairs.find((r) => r.id === id);
      track(ANALYTICS_EVENTS.VIEW_REPAIR, { repair_id: id, value_cents: picked?.priceCents ?? 0, repair_name: picked?.name ?? "" });
      loadOfferAction(id).then((res) => {
        if (res.ok) {
          setOffer(res.offer);
          // On garde le choix du client s'il existe encore dans la nouvelle
          // offre ; sinon on repart de rien plutôt que du premier tarif.
          setShippingId((current) => (current && res.offer.shippingMethods.some((m) => m.id === current) ? current : null));
        } else setError(res.error);
        setOfferLoading(false);
      });
    },
    [repairs, track],
  );

  // Prix serveur à chaque changement de sélection.
  useEffect(() => {
    if (!repairId || repairId === AUTRE_PROBLEME) return;
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

  /** Choisir une console ouvre l'étape du modèle : un clic, pas deux. */
  const pickPlatform = (key: string) => {
    setPlatform(key);
    setModelId(null);
    setRepairId(null);
    setRepairs([]);
    setOffer(null);
    setError(null);
    setStep(2);
  };

  const toggleSymptom = (t: string) => setSymptoms((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 12 ? [...prev, t] : prev));

  const next = () => {
    setError(null);
    if (quiManque) return setError(quiManque);
    if (step === 3 && !surDevis && !offer) return setError("Chargement des options en cours…");
    // On avance dans la trame du parcours courant : sur devis, l'étape des
    // options n'existe pas, donc 03 mène directement aux coordonnées.
    const suivante = etapes[rangEtape + 1];
    setStep(suivante ? suivante.s : step);
  };
  const back = () => {
    setError(null);
    const precedente = etapes[rangEtape - 1];
    setStep(precedente ? precedente.s : step);
  };

  /**
   * Envoyer une demande de devis. Gratuitement.
   *
   * Action serveur distincte, schéma distinct : rien ici ne touche au prix, au
   * transport ni au paiement. C'est le point où les deux parcours cessent
   * définitivement de se ressembler.
   */
  const submitDevis = async () => {
    setError(null);
    if (!modelId) return setError("Choisissez votre console.");
    if (!repairId) return setError("Choisissez un problème.");
    const errors: Record<string, string> = {};
    if (!customer.first_name.trim()) errors["customer.first_name"] = "Prénom requis";
    if (!customer.last_name.trim()) errors["customer.last_name"] = "Nom requis";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email.trim())) errors["customer.email"] = "E-mail invalide";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return setError("Merci de corriger les champs signalés.");
    if (desc.trim().length < MIN_DESCRIPTION) return setError("Décrivez la panne en quelques mots : c'est ce qui permet de chiffrer.");
    if (!acceptTerms) return setError("Vous devez accepter les conditions générales de vente pour continuer.");
    setSubmitting(true);
    const result = await createQuoteRequestAction({
      modelId,
      // « Autre problème » ne désigne aucune prestation : le serveur reçoit
      // `null`, et c'est la description qui portera la demande.
      repairId: repairId === AUTRE_PROBLEME ? null : repairId,
      customer: { ...customer, email: customer.email.trim(), phone: customer.phone.trim() },
      description: desc.trim(),
      console_serial_number: serial.trim(),
      console_already_opened: alreadyOpened,
      accept_terms: true,
      attribution,
      symptoms,
      photos: photos.map((p) => p.path),
    });
    if (result.ok) {
      track(ANALYTICS_EVENTS.QUOTE_REQUESTED, { repair_id: repairId, order_number: result.orderNumber });
      window.location.assign(result.trackingUrl);
      return;
    }
    setSubmitting(false);
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  };

  const submit = async () => {
    if (surDevis) return submitDevis();
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
  const sticky = props.stickyActions ?? true;

  /**
   * Le total, et son intitulé.
   *
   * Trois états, dérivés des deux colonnes de `repairs`, jamais d'un calcul
   * navigateur : sur devis, gratuit, ou le montant. **Jamais 0,00 €** pour une
   * prestation qu'on n'a pas encore chiffrée. Le chiffre lui-même vient du
   * serveur (`quoteSelectionAction`) ; on ne fait que le refléter.
   */
  /*
    Le total, et son intitulé.

    Sur devis, ce qui est annoncé n'est pas le prix de la réparation — il
    n'existe pas encore — mais ce que **la demande** coûte : rien. Écrire
    « Gratuit » sous l'intitulé « Votre demande » est exact et lève l'ambiguïté
    du tiret, qui laissait croire à un montant inconnu et donc peut-être dû.

    Hors devis, la règle d'origine tient : jamais « 0,00 € » pour une
    prestation non chiffrée.
  */
  const totalLabel = surDevis ? "Votre demande" : "Total";
  const totalText = surDevis
    ? "Gratuit"
    : !repairId || !showPrices
      ? "—"
      : total === null
        ? "calcul…"
        : total > 0
          ? formatPrice(total)
          : "Gratuit";
  const nextLabel = step === 6 ? (surDevis ? "Demander un devis gratuit" : "Envoyer la demande") : (quiManque ?? "Continuer");

  /** Les lignes du résumé : ce qui est choisi, et rien d'autre. */
  const resume: { k: string; v: string; p?: string }[] = [];
  if (plateforme) resume.push({ k: "Console", v: plateforme.label });
  if (model) resume.push({ k: "Modèle", v: modelLabel(model) });
  if (repair) resume.push({ k: "Intervention", v: repair.name, p: repairPrice(repair) });
  else if (repairId === AUTRE_PROBLEME) resume.push({ k: "Problème", v: "Décrit par vos soins", p: "Sur devis" });
  for (const o of pickedOptions) resume.push({ k: "Option", v: o.name, p: formatPriceDelta(o.priceCents) });
  if (shipping) resume.push({ k: "Envoi", v: shipping.name, p: formatPriceDelta(shipping.priceCents) });

  const barreAction = (
    <>
      <button
        type="button"
        onClick={step === 6 ? submit : next}
        /*
          Le garde-fou du dernier écran : on n'envoie pas une commande dont le
          serveur n'a pas encore rendu le prix. Il ne s'applique pas à « Autre
          problème », qui n'a rien à chiffrer par construction — sans cette
          exception, le bouton restait éteint pour toujours et la porte de
          sortie ne menait nulle part.
        */
        disabled={submitting || bloque || (step === 6 && repairId !== AUTRE_PROBLEME && (!pricing || Boolean(pricingError)))}
        aria-busy={submitting || undefined}
        data-go="1"
        className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 border-0 px-6 text-[16.5px] font-semibold text-white transition-colors disabled:cursor-not-allowed sm:w-auto sm:min-w-[240px]"
      >
        {submitting ? "Envoi…" : nextLabel}
      </button>
    </>
  );

  return (
    <div ref={rootRef} data-fiche="1" className="flex w-full min-w-0 flex-col gap-0.5" style={{ scrollMarginTop: 0 }}>
      {/* ── La progression ───────────────────────────────────────────────────
          Six cellules au-dessus de 1040 px, une seule ligne en dessous — et
          jamais plus de soixante pixels de haut. Les étapes franchies sont
          cliquables, les suivantes non : on ne saute pas une question dont la
          réponse conditionne la suivante. */}
      <ol data-etapes="1" className="m-0 hidden list-none p-0">
        {etapes.map((e, i) => {
          const etat = i < rangEtape ? "done" : i === rangEtape ? "now" : "next";
          const atteignable = i < rangEtape;
          return (
            <li key={e.n} className="min-w-0">
              <button
                type="button"
                data-etape={etat}
                disabled={!atteignable}
                onClick={() => atteignable && setStep(e.s)}
                className="flex w-full flex-col gap-[3px] bg-surface px-3.5 py-3 text-left disabled:cursor-default"
              >
                <span className="font-mono text-[10px] tracking-[0.13em]">{e.n}</span>
                <span className={cn("truncate text-[14.5px] tracking-[-0.014em]", etat === "now" ? "font-bold" : "font-medium")}>{e.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div data-etape-mini="1" className="hidden flex-col gap-[9px] bg-surface px-3.5 py-3">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[16px] font-semibold tracking-[-0.018em] text-ink">{etapeCourante.label}</span>
          <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-muted">
            Étape {etapeCourante.n} / {String(etapes.length).padStart(2, "0")}
          </span>
        </span>
        <span className="block h-0.5 bg-border">
          {/* Longhand seule : `width` pilotée par l'état, jamais un raccourci. */}
          <span data-barre-etape="1" className="block h-0.5" style={{ width: `${((rangEtape + 1) / etapes.length) * 100}%`, background: "var(--brand-gradient)" }} />
        </span>
      </div>

      {/* ── Deux colonnes, puis une ──────────────────────────────────────────
          L'étape courante à gauche, le résumé collé à droite. Sous 1040 px, une
          seule colonne : le résumé devient la barre basse, qui porte le total
          et l'action. Une seule action visible à la fois — deux boutons
          identiques superposés est le défaut que cette règle évite. */}
      <div data-coque="1" className="grid min-w-0 gap-0.5">
        <main className="min-w-0 bg-surface p-[clamp(18px,2.08vw,26px)]">
          {fil.length ? (
            <div data-rail="1" className="-mx-1 mb-4 flex items-center gap-[7px] overflow-x-auto px-1">
              {fil.map((j) => (
                <button
                  key={j.label}
                  type="button"
                  onClick={j.go}
                  className="flex-none cursor-pointer whitespace-nowrap border border-border-strong bg-surface-muted px-2.5 py-1.5 font-mono text-[10.5px] tracking-[0.04em] text-ink transition-colors hover:border-ink"
                >
                  {j.label}
                </button>
              ))}
            </div>
          ) : null}

          <div data-ecran={step} className="min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-[0.19em] text-ink-faint">
              {etapeCourante.n} — {etapeCourante.label}
            </span>
            <h2 className="m-0 mb-1 mt-2.5 text-[clamp(21px,1.76vw,22px)] font-extrabold tracking-[-0.034em] text-ink">{QUESTIONS[step - 1]}</h2>
            <p className="m-0 mb-[18px] text-[15.5px] leading-[1.5] text-ink-soft">{AIDES[step - 1]}</p>

            {/* ── 01 · la console ────────────────────────────────────────── */}
            {step === 1 ? (
              <div data-g4="1" data-familles={platforms.length} data-grille="1" className="grid gap-0.5">
                {platforms.map((pf) => (
                  <TuileFamille key={pf.key} cle={pf.visuel} label={pf.label} note={pf.note} selected={platform === pf.key} onPick={() => pickPlatform(pf.key)} />
                ))}
                {!platforms.length ? <p className="text-[15px] text-ink-muted">Aucune console publiée pour le moment.</p> : null}
              </div>
            ) : null}

            {/* ── 02 · le modèle ─────────────────────────────────────────── */}
            {step === 2 ? (
              <div className="flex flex-col" role="radiogroup" aria-label="Modèle">
                {platformModels.map((m) => (
                  <LigneChoix key={m.id} selected={modelId === m.id} label={m.name} note={platform === RETRO_KEY ? m.brandName : m.tag || m.brandName} onPick={() => pickModel(m.id)} />
                ))}
                <span aria-hidden="true" className="block border-t border-border-hairline" />
                {!platformModels.length ? <p className="mt-4 text-[15px] text-ink-faint">Aucun modèle publié pour cette console.</p> : null}
              </div>
            ) : null}

            {/* ── 03 · le problème, puis ce qu'on constate ───────────────── */}
            {step === 3 ? (
              <div>
                {repairsLoading ? <p className="text-[15px] text-ink-faint">Chargement des interventions…</p> : null}

                <div data-g3="1" data-grille="1" className="grid gap-0.5" role="radiogroup" aria-label="Problème">
                  {courtes.map((r) => (
                    <CartePanne key={r.id} selected={repairId === r.id} onPick={() => pickRepair(r.id)} label={r.name} note={r.categoryName ?? ""} price={repairPrice(r)} />
                  ))}
                  {/*
                    La porte de sortie, et non une liste de plus.

                    Elle ne sélectionne aucune prestation : elle dit « ma panne
                    n'est pas là », et c'est la description en dessous qui porte
                    alors toute l'information. Ajouter des lignes au catalogue
                    pour couvrir les cas rares, c'est reconstruire le mur qu'on
                    vient d'abattre.
                  */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={repairId === AUTRE_PROBLEME}
                    onClick={() => pickRepair(AUTRE_PROBLEME)}
                    data-autre={repairId === AUTRE_PROBLEME ? "1" : undefined}
                    className={cn(
                      "flex min-h-[86px] cursor-pointer flex-col justify-center gap-1 px-4 py-3.5 text-left transition-colors",
                      repairId === AUTRE_PROBLEME ? "bg-brand text-white" : "bg-ink-900 text-white hover:bg-ink-800",
                    )}
                  >
                    <span className="text-[16px] font-semibold tracking-[-0.02em]">Autre problème</span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.07em]" style={{ color: repairId === AUTRE_PROBLEME ? "rgba(255,255,255,0.8)" : "var(--on-dark-2)" }}>
                      Décrivez-le, on s&apos;en occupe
                    </span>
                  </button>
                </div>

                {!repairsLoading && !repairs.length ? (
                  <p className="mt-4 text-[15px] text-ink-soft">
                    Aucune intervention publiée pour ce modèle. Écrivez-nous depuis la page{" "}
                    <Link href={ROUTES.contact} className="text-accent underline">
                      contact
                    </Link>
                    .
                  </p>
                ) : null}

                {/*
                  Ce qui va se passer, dit avant plutôt que découvert après.

                  Cet encart annonçait auparavant un diagnostic facturé et une
                  console à retourner — des conséquences qui n'existent que
                  lorsqu'une réparation a été commandée et la console envoyée.
                  Sur une demande de devis, rien de tout cela n'est engagé : le
                  dire autrement, c'était faire renoncer des clients à une
                  démarche gratuite.
                */}
                {surDevis ? (
                  <div className="mt-[22px] bg-ink-900 p-[18px] text-on-dark">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.13em]" style={{ color: "var(--brand-mint)" }}>
                        Votre demande
                      </span>
                      <span className="text-[19px] font-bold tracking-[-0.03em]">Gratuite</span>
                    </span>
                    <p className="m-0 mt-2 text-[14.5px] leading-[1.5] text-on-dark-2">
                      Cette panne se chiffre après examen. Décrivez-la, joignez des photos si vous le pouvez : l&apos;atelier vous envoie un devis, et vous déciderez ensuite.
                    </p>
                    <div data-g3="1" className="mt-3.5 grid gap-0.5">
                      <IssueDevis k="Aujourd'hui" v="Vous envoyez votre demande. Rien à payer, et vous gardez votre console." />
                      <IssueDevis k="Sous 48 h" v="Vous recevez un devis détaillé : réparation, options éventuelles, total." />
                      <IssueDevis k="Ensuite" v="Vous acceptez ou refusez. Ce n'est qu'en cas d'accord que la console nous rejoint." />
                    </div>
                  </div>
                ) : null}

                {/* ── Ce que vous constatez ───────────────────────────────── */}
                <div className="mt-[26px] border-t-2 border-ink pt-[18px]">
                  <span className="mb-2 block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Ce que vous constatez</span>
                  <textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Elle s'allume puis s'éteint au bout de cinq minutes…"
                    aria-label="Décrivez la panne"
                    className="w-full resize-none border border-border-strong bg-field p-3.5 text-[16px] leading-[1.45] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
                  />
                  <span className="mb-[18px] mt-[7px] block font-mono text-[10.5px] tracking-[0.05em] text-ink-faint">
                    {MIN_DESCRIPTION - desc.trim().length > 0 && !symptoms.length
                      ? `Encore ${MIN_DESCRIPTION - desc.trim().length} caractère${MIN_DESCRIPTION - desc.trim().length > 1 ? "s" : ""}, ou cochez un symptôme`
                      : `${desc.trim().length} caractères`}
                  </span>

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
                          style={{
                            backgroundColor: on ? "var(--ink-900)" : "var(--glass)",
                            borderColor: on ? "var(--ink-900)" : "var(--stroke-strong)",
                            color: on ? "#ffffff" : "var(--text-2)",
                          }}
                        >
                          <span className="block first-letter:uppercase">{sym}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-[18px]">
                    <DraftPhotoUploader photos={photos} onChange={setPhotos} label="Joindre une photo de la panne · facultatif" phoneLabel="Prendre une photo de la panne · facultatif" />
                  </div>

                  <div className="mt-[18px] flex flex-col gap-3 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <TextInput label="Numéro de série" placeholder="Facultatif" value={serial} onChange={setSerial} maxLength={60} />
                    </div>
                    <label className="flex min-h-[52px] flex-1 items-center gap-3 border border-border-strong px-4 py-3 text-[14px] text-ink-soft">
                      <Checkbox checked={alreadyOpened} onChange={(e) => setAlreadyOpened(e.target.checked)} />
                      <span>La console a déjà été ouverte</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {/* ── 04 · les options ───────────────────────────────────────── */}
            {step === 4 ? (
              <div>
                {offerLoading ? <p className="text-[15px] text-ink-faint">Chargement des options compatibles…</p> : null}

                {offer?.includedNames.length ? (
                  <div className="mb-4 border-l-2 p-3.5" style={{ borderColor: "var(--brand-deep)", background: "rgba(11,127,99,0.06)" }}>
                    <span className="block font-mono text-[10.5px] uppercase tracking-[0.13em]" style={{ color: "var(--brand-deep)" }}>
                      Déjà compris
                    </span>
                    <span className="mt-1 block text-[14.5px] leading-[1.5] text-ink-soft">
                      {offer.includedNames.join(" · ")} — {offer.includedNames.length > 1 ? "ces gestes sont" : "ce geste est"} inclus dans l&apos;intervention et ne {offer.includedNames.length > 1 ? "sont" : "est"} donc pas proposé
                      {offer.includedNames.length > 1 ? "s" : ""} ici.
                    </span>
                  </div>
                ) : null}

                <div className="flex flex-col">
                  {offer?.packs.map((p) => (
                    <LigneCoche key={p.id} selected={packIds.includes(p.id)} onPick={() => togglePack(p.id)} label={p.name} note={p.note} price={formatPriceDelta(p.priceCents)} badge={p.isRecommended ? "Recommandé" : "Pack"} />
                  ))}
                  {offer?.options.map((o) => {
                    const inPack = optionsInPacks.has(o.id);
                    return <LigneCoche key={o.id} selected={optionIds.includes(o.id) && !inPack} disabled={inPack} onPick={() => toggleOption(o.id)} label={o.name} note={inPack ? "Inclus dans votre pack" : o.note} price={formatPriceDelta(o.priceCents)} />;
                  })}
                  <span aria-hidden="true" className="block border-t border-border-hairline" />
                </div>

                {offer && !offer.options.length && !offer.packs.length ? (
                  <p className="text-[15px] leading-[1.5] text-ink-soft">Aucune option ne s&apos;ajoute à cette intervention. Continuez.</p>
                ) : null}
              </div>
            ) : null}

            {/* ── 05 · coordonnées (et transport, hors devis) ─────────────── */}
            {step === 5 ? (
              <div>
                {!props.isLoggedIn ? (
                  <p className="m-0 mb-[18px] text-[14.5px] leading-[1.5] text-ink-soft">
                    {surDevis ? "C'est à cette adresse que votre devis sera envoyé." : "Un espace client est créé avec votre adresse pour suivre le dossier."}{" "}
                    <Link href={ROUTES.login} className="text-accent underline">
                      Déjà client ? Connectez-vous
                    </Link>
                  </p>
                ) : null}

                <div data-g2="1" className="grid gap-3">
                  <TextInput label="Prénom" autoComplete="given-name" value={customer.first_name} onChange={(v) => setCustomer({ ...customer, first_name: v })} error={fieldErrors["customer.first_name"]} />
                  <TextInput label="Nom" autoComplete="family-name" value={customer.last_name} onChange={(v) => setCustomer({ ...customer, last_name: v })} error={fieldErrors["customer.last_name"]} />
                  <TextInput label="Courriel" type="email" autoComplete="email" placeholder="vous@exemple.fr" value={customer.email} onChange={(v) => setCustomer({ ...customer, email: v })} error={fieldErrors["customer.email"]} />
                  <TextInput label="Téléphone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" value={customer.phone} onChange={(v) => setCustomer({ ...customer, phone: v })} error={fieldErrors["customer.phone"]} />
                  {/*
                    Adresse et transport : demandés seulement quand un colis
                    part. Une demande de devis ne déclenche aucun envoi — réclamer
                    ici une adresse de livraison ferait croire le contraire, et
                    c'est exactement la confusion qu'on lève.
                  */}
                  {surDevis ? null : (
                    <>
                      <TextInput label="Adresse de retour" autoComplete="address-line1" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} error={fieldErrors["address.line1"]} />
                      <TextInput label="Complément d'adresse" autoComplete="address-line2" placeholder="Facultatif" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} />
                      <TextInput label="Code postal" autoComplete="postal-code" inputMode="numeric" value={address.postal_code} onChange={(v) => setAddress({ ...address, postal_code: v })} error={fieldErrors["address.postal_code"]} />
                      <TextInput label="Ville" autoComplete="address-level2" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} error={fieldErrors["address.city"]} />
                    </>
                  )}
                </div>

                {surDevis ? (
                  <p className="m-0 mt-[22px] border-l-2 bg-surface p-3.5 text-[14.5px] leading-[1.5] text-ink-soft" style={{ borderLeftColor: "var(--brand)" }}>
                    Pas d&apos;adresse à saisir : votre console reste chez vous. Si vous acceptez le devis, vous choisirez alors de la déposer en boutique ou de nous l&apos;envoyer.
                  </p>
                ) : (
                  <>
                    <span className="mb-2.5 mt-[26px] block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Comment nous l&apos;envoyer</span>
                    <div className="flex flex-col" role="radiogroup" aria-label="Mode d'envoi">
                      {offer?.shippingMethods.map((m) => (
                        <LigneCoche key={m.id} role="radio" selected={shippingId === m.id} onPick={() => setShippingId(m.id)} label={m.name} note={m.note} price={formatPriceDelta(m.priceCents)} />
                      ))}
                      <span aria-hidden="true" className="block border-t border-border-hairline" />
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {/* ── 06 · confirmation ──────────────────────────────────────── */}
            {step === 6 ? (
              <div>
                <div className="border border-ink p-[18px]">
                  {resume.map((l, i) => (
                    <RecapLigne key={`${l.k}-${i}`} k={l.k} v={l.v} p={l.p} />
                  ))}
                  <span className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink pt-2.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{totalLabel}</span>
                    <span className="text-[24px] font-extrabold tracking-[-0.035em]" style={{ color: "var(--brand)" }}>
                      {totalText}
                    </span>
                  </span>
                </div>

                <p className="m-0 mt-3.5 text-[13.5px] leading-[1.5] text-ink-soft">
                  {surDevis
                    ? "Vous envoyez une demande de devis : rien ne vous est facturé, aucune réparation n'est commandée et votre console reste chez vous. L'atelier vous répond avec un prix détaillé, que vous serez libre d'accepter ou de refuser."
                    : "Le montant est celui du catalogue au moment de la commande. Toute intervention supplémentaire passe par un devis."}
                </p>

                <label className="mt-3.5 flex items-start gap-[11px] text-[13.5px] leading-[1.45] text-ink-soft">
                  <Checkbox checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" required />
                  <span>
                    J&apos;ai lu et j&apos;accepte les{" "}
                    <Link href={ROUTES.cgv} target="_blank" className="text-accent underline">
                      conditions générales de vente
                    </Link>
                    {conditions.cgvVersion && !conditions.cgvVersion.startsWith("draft") ? ` (version ${conditions.cgvVersion})` : ""} et la{" "}
                    <Link href={ROUTES.privacy} target="_blank" className="text-accent underline">
                      politique de confidentialité
                    </Link>
                    .
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          {props.cancelled ? (
            <div className="mt-5">
              <FormError message="Paiement annulé. Votre demande est conservée : reprenez quand vous voulez." />
            </div>
          ) : null}
          {error || pricingError ? (
            <div className="mt-5">
              <FormError message={error ?? pricingError} />
            </div>
          ) : null}

          {/* ── La sortie de l'écran ────────────────────────────────────────
              Une seule action visible à la fois : au-dessus de 1040 px elle est
              ici, en dessous elle est dans la barre basse. */}
          <div className="mt-[26px] flex flex-wrap items-center gap-3 border-t border-border pt-[18px]">
            {step > 1 ? (
              <button type="button" onClick={back} className="min-h-[50px] cursor-pointer border border-border-strong px-5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft transition-colors hover:border-ink hover:text-ink">
                ← Retour
              </button>
            ) : null}
            <span className="flex-1" />
            <span data-action-ligne="1">{barreAction}</span>
          </div>
        </main>

        {/* ── Le résumé, collé ───────────────────────────────────────────── */}
        <aside data-resume="1" className="hidden min-w-0 self-start bg-surface p-[18px]">
          <span className="block font-mono text-[10px] uppercase tracking-[0.19em] text-ink-faint">Votre demande</span>
          <div className="mt-3">
            {resume.length ? resume.map((l, i) => <RecapLigne key={`${l.k}-${i}`} k={l.k} v={l.v} p={l.p} />) : <p className="m-0 text-[14px] leading-[1.5] text-ink-faint">Rien de choisi pour l&apos;instant.</p>}
            <span className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink pt-2.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{totalLabel}</span>
              <span className="text-[21px] font-extrabold tracking-[-0.035em]" style={{ color: "var(--brand)" }}>
                {totalText}
              </span>
            </span>
          </div>
          <p className="m-0 mt-3 font-mono text-[10.5px] leading-[1.6] text-ink-faint">
            {surDevis ? "Le prix de la réparation est fixé par le devis, après diagnostic." : "Diagnostic sous 48 h · devis avant intervention · garantie 3 mois."}
          </p>
        </aside>
      </div>

      {/* ── Sous 1040 px : le total et l'action restent sous le pouce ──────
          `sticky` et non `fixed` : le clavier tactile la pousse au lieu de la
          recouvrir. */}
      {sticky ? (
        <div data-barre-basse="1" className="safe-bottom sticky bottom-0 z-10 hidden items-center gap-3 border-t border-border-strong bg-bg px-4 pt-[11px]" style={{ boxSizing: "border-box", ["--safe-pb" as string]: "14px" }}>
          <span className="flex min-w-0 flex-col">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-faint">{totalLabel}</span>
            <span className="truncate text-[18px] font-extrabold tracking-[-0.03em] text-ink">{totalText}</span>
          </span>
          <span className="min-w-0 flex-1">{barreAction}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Une ligne du récapitulatif : ce que c'est, ce que c'est, ce que ça coûte. */
function RecapLigne({ k, v, p }: { k: string; v: string; p?: string }) {
  return (
    <span className="flex items-start justify-between gap-3.5 py-[5px] text-[14px]">
      <span className="min-w-0">
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-faint">{k}</span>
        <span className="block leading-[1.35] text-ink">{v}</span>
      </span>
      {p ? <span className="whitespace-nowrap font-mono text-ink-soft">{p}</span> : null}
    </span>
  );
}

/** Une des trois issues d'un diagnostic, sur le bandeau sombre. */
function IssueDevis({ k, v }: { k: string; v: string }) {
  return (
    <span className="block p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
      <span className="block font-mono text-[9.5px] uppercase tracking-[0.13em]" style={{ color: "var(--brand-mint)" }}>
        {k}
      </span>
      <span className="mt-1 block text-[13.5px] leading-[1.4] text-on-dark-2">{v}</span>
    </span>
  );
}

/**
 * Une famille de consoles — la photo d'atelier en fond, le nom, les modèles.
 *
 * La photo reste sombre au repos et s'éclaircit à la sélection : c'est
 * l'affordance, et elle vaut mieux qu'un filet de couleur parce qu'elle
 * montre la machine. Le sous-titre vient du catalogue, jamais d'une liste
 * écrite en dur — annoncer « PS3 » quand l'atelier n'en répare pas envoie le
 * client sur une liste vide.
 */
function TuileFamille({ cle, label, note, selected, onPick }: { cle: string; label: string; note: string; selected: boolean; onPick: () => void }) {
  const visuel = PLATFORM_VISUALS[cle];
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} data-famille="1" data-on={selected ? "1" : undefined} className="relative block min-h-[132px] cursor-pointer overflow-hidden bg-ink-900 p-4 text-center text-white">
      {visuel ? <Image data-famille-img="1" src={visuel.src} alt="" fill sizes="(max-width: 520px) 50vw, 25vw" className="object-cover" /> : null}
      <span aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,17,22,0.6), rgba(15,17,22,0.92))" }} />
      <span data-famille-filet="1" aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5" style={{ background: "var(--brand-gradient)" }} />
      <span className="relative flex h-full flex-col items-center justify-end gap-1">
        <span className="text-[17px] font-bold tracking-[-0.025em]">{label}</span>
        <span className="font-mono text-[10px] uppercase leading-[1.4] tracking-[0.06em] text-on-dark-2">{note}</span>
      </span>
    </button>
  );
}

/** Une carte de panne fréquente : le nom, la famille, le prix. */
function CartePanne({ selected, onPick, label, note, price }: { selected: boolean; onPick: () => void; label: string; note: string; price: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} data-choix="1" data-on={selected ? "1" : undefined} className="flex min-h-[86px] cursor-pointer flex-col justify-between gap-2 border px-4 py-3.5 text-left">
      <span className="text-[15.5px] font-semibold leading-[1.25] tracking-[-0.018em] text-ink">{label}</span>
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.07em] text-ink-faint">{note}</span>
        <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-soft">{price}</span>
      </span>
    </button>
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
      style={{ backgroundColor: selected ? "rgba(15,94,215,0.07)" : "transparent" }}
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
      style={{ backgroundColor: selected ? "rgba(15,94,215,0.07)" : "transparent" }}
    >
      <span
        aria-hidden="true"
        className="mt-[3px] flex h-5 w-5 flex-none items-center justify-center border text-[11px] font-bold"
        style={{
          backgroundColor: selected ? "var(--brand)" : "transparent",
          borderColor: selected ? "var(--brand)" : "var(--stroke-strong)",
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

