"use server";

import { z } from "zod";
import { getRepairById, getRepairOffer, getRepairsForModel } from "@/lib/repair/catalog";
import { toFormOffer, toFormRepair } from "@/lib/repair/form-data";
import type { FormOffer, FormRepair } from "@/components/repair/repair-form-types";

/** Prestations publiées pour un modèle (étape 2 de la fiche de réparation). */
export async function loadModelRepairsAction(input: unknown): Promise<{ ok: true; repairs: FormRepair[] } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(input);
  if (!parsed.success) return { ok: false, error: "Modèle invalide" };
  const repairs = await getRepairsForModel(parsed.data);
  return { ok: true, repairs: repairs.map(toFormRepair) };
}

/** Options, packs et transports compatibles avec une prestation (calculés côté serveur). */
export async function loadOfferAction(input: unknown): Promise<{ ok: true; offer: FormOffer } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(input);
  if (!parsed.success) return { ok: false, error: "Prestation invalide" };
  const repair = await getRepairById(parsed.data);
  if (!repair || !repair.is_active) return { ok: false, error: "Prestation introuvable" };
  return { ok: true, offer: toFormOffer(await getRepairOffer(repair)) };
}
