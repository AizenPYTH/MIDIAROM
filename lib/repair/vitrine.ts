import "server-only";
import { cache } from "react";
import { ROUTES } from "@/config/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveBrands, getActiveModels } from "@/lib/repair/catalog";

/**
 * Ce que l'accueil dit de la réparation — pris dans le catalogue, jamais écrit
 * en dur.
 *
 * L'accueil annonçait jusqu'ici quatre familles de consoles et six
 * interventions avec leurs prix (« 45 € », « 79 € », « dès 39 € »), tous
 * inventés, et des modèles que l'atelier ne référence pas — PS2, Xbox 360,
 * Mega Drive. Le catalogue réel compte 1 189 prestations dont quatorze
 * seulement portent un prix : annoncer les autres à un tarif choisi dans le
 * vide, c'est promettre ce qu'on ne tiendra pas, et c'est aussi ce que la
 * charte du parcours interdit à l'étape 2 (« Nécessite un devis » plutôt que
 * « 0,00 € »). L'accueil suit désormais la même règle.
 *
 * Tout ici se déduit donc de `console_models` et de `repairs` :
 *   * les familles, leurs modèles et leur nombre ;
 *   * les interventions mises en avant, et sur combien de consoles ;
 *   * un prix **seulement** là où l'atelier en a arbitré un.
 */

export interface FamilleVitrine {
  /** Clé du visuel (`lib/content/assets.ts`) : playstation, switch, xbox, retro. */
  cle: string;
  label: string;
  /** Les modèles réellement pris en charge, dans l'ordre du catalogue. */
  modeles: string[];
  /** Où mène la tuile : le parcours, la console déjà choisie. */
  href: string;
  /** Le plus bas prix ferme de la famille, s'il en existe un. */
  prixMinCents: number | null;
}

export interface PanneVitrine {
  nom: string;
  /** Les familles concernées : « PlayStation · Xbox ». */
  familles: string[];
  /** Sur combien de consoles l'atelier la traite. */
  consoles: number;
  /** Le plus bas prix ferme constaté, s'il en existe un. Sinon : sur devis. */
  prixMinCents: number | null;
}

/**
 * Le nom de l'image d'une marque.
 *
 * Ce n'est pas une règle métier, c'est un nom de fichier : les visuels de
 * `public/images/home` s'appellent `playstation.png`, `switch.png`… Une marque
 * ouverte demain sans visuel n'est pas perdue — `HomeVisual` pose alors sa
 * plaque au nom de la console, ce qu'il fait déjà partout ailleurs.
 */
const VISUEL_PAR_MARQUE: Record<string, string> = { playstation: "playstation", xbox: "xbox", nintendo: "switch", sega: "retro" };

const min = (valeurs: number[]): number | null => (valeurs.length ? Math.min(...valeurs) : null);

/**
 * Les familles de consoles réparées, et les pannes mises en avant.
 *
 * Une famille = une marque, moins ses consoles rétro, qui se regroupent à part
 * — c'est exactement le regroupement de l'étape 1 du parcours, pour que
 * l'accueil et la fiche ne racontent pas deux histoires différentes. Une
 * famille sans modèle publié ne s'affiche pas : mieux vaut trois tuiles vraies
 * que quatre dont une mène au vide.
 */
export const getVitrineReparation = cache(async (): Promise<{ familles: FamilleVitrine[]; pannes: PanneVitrine[] }> => {
  const db = createSupabaseAdminClient();
  const [brands, models, { data: prestations }] = await Promise.all([
    getActiveBrands(),
    getActiveModels(),
    db.from("repairs").select("name, model_id, price_cents, price_is_provisional, is_featured, featured_order, fault:faults(name)").eq("is_active", true),
  ]);

  const actives = (prestations ?? []).filter((r) => r.fault);
  // Un prix ne compte que s'il a été arbitré : `price_is_provisional` marque
  // les 1 175 lignes importées sans tarif, qui valent 0 en base et « sur
  // devis » à l'écran. Les additionner donnerait « dès 0 € ».
  const prixFermeParModele = new Map<string, number[]>();
  for (const r of actives) {
    if (r.price_is_provisional || r.price_cents <= 0) continue;
    prixFermeParModele.set(r.model_id, [...(prixFermeParModele.get(r.model_id) ?? []), r.price_cents]);
  }

  const marqueParModele = new Map(models.map((m) => [m.id, m.brand_id]));
  const familles: FamilleVitrine[] = [];
  for (const b of brands) {
    const siens = models.filter((m) => m.brand_id === b.id && !m.is_retro);
    if (!siens.length) continue;
    familles.push({
      cle: VISUEL_PAR_MARQUE[b.slug] ?? b.slug,
      label: b.name,
      modeles: siens.map((m) => m.short_name || m.name),
      href: `${ROUTES.repair}?console=${b.slug}`,
      prixMinCents: min(siens.flatMap((m) => prixFermeParModele.get(m.id) ?? [])),
    });
  }
  const retro = models.filter((m) => m.is_retro);
  if (retro.length) {
    familles.push({
      cle: "retro",
      label: "Rétro",
      modeles: retro.map((m) => m.short_name || m.name),
      href: `${ROUTES.repair}?console=retro`,
      prixMinCents: min(retro.flatMap((m) => prixFermeParModele.get(m.id) ?? [])),
    });
  }

  // Les pannes de la vitrine sont celles que le back-office met en avant,
  // regroupées par nom de panne : « Aucun signal HDMI » vaut pour quatorze
  // consoles, elle n'a pas à s'écrire quatorze fois.
  const labelMarque = new Map(brands.map((b) => [b.id, b.name]));
  const regroupees = new Map<string, { rang: number; modeles: Set<string>; marques: Set<string>; prix: number[] }>();
  for (const r of actives) {
    if (!r.is_featured) continue;
    const nom = (r.fault as { name: string }).name;
    const g = regroupees.get(nom) ?? { rang: r.featured_order ?? 99, modeles: new Set<string>(), marques: new Set<string>(), prix: [] };
    g.rang = Math.min(g.rang, r.featured_order ?? 99);
    g.modeles.add(r.model_id);
    const marque = marqueParModele.get(r.model_id);
    if (marque && labelMarque.has(marque)) g.marques.add(labelMarque.get(marque)!);
    if (!r.price_is_provisional && r.price_cents > 0) g.prix.push(r.price_cents);
    regroupees.set(nom, g);
  }

  const pannes: PanneVitrine[] = [...regroupees.entries()]
    .map(([nom, g]) => ({ nom, familles: [...g.marques], consoles: g.modeles.size, prixMinCents: min(g.prix) }))
    // Les plus largement traitées d'abord : c'est ce qui répond le mieux à
    // « est-ce que vous réparez ma panne ? ».
    .sort((a, b) => b.consoles - a.consoles || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, 6);

  return { familles, pannes };
});
