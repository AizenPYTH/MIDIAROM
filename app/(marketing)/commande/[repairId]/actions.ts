"use server";

import { z } from "zod";
import { getRepairById, getRepairOffer } from "@/lib/repair/catalog";
import { priceSelection } from "@/lib/pricing/service";
import { PricingError, type PricingResult } from "@/lib/pricing/engine";
import { createOrderAndCheckout, CreateOrderError } from "@/lib/orders/create-order";
import { createOrderSchema, selectionSchema, type CreateOrderInput } from "@/lib/orders/schemas";
import { getCurrentUser } from "@/lib/security/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestMeta } from "@/lib/security/audit";

export type QuoteState = { ok: true; pricing: PricingResult } | { ok: false; error: string };

/** Authoritative price for the current selection (called on every change). */
export async function quoteSelectionAction(input: unknown): Promise<QuoteState> {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sélection invalide" };
  const repair = await getRepairById(parsed.data.repairId);
  if (!repair) return { ok: false, error: "Réparation introuvable" };
  const offer = await getRepairOffer(repair);
  try {
    const pricing = await priceSelection(offer, parsed.data);
    return { ok: true, pricing };
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    return { ok: false, error: "Calcul du prix impossible" };
  }
}

export type CreateOrderState =
  | { ok: true; redirectUrl: string; orderNumber: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createOrderAction(input: unknown): Promise<CreateOrderState> {
  const meta = await requestMeta();
  const limit = rateLimit(`checkout:${meta.ip ?? "unknown"}`, 10, 10 * 60_000);
  if (!limit.allowed) return { ok: false, error: "Trop de tentatives. Merci de patienter quelques minutes." };

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Merci de corriger les champs signalés.", fieldErrors };
  }
  const data: CreateOrderInput = parsed.data;
  try {
    const user = await getCurrentUser();
    const result = await createOrderAndCheckout(data, user);
    return { ok: true, redirectUrl: result.redirectUrl, orderNumber: result.orderNumber };
  } catch (error) {
    if (error instanceof CreateOrderError) {
      return { ok: false, error: error.message, fieldErrors: error.field ? { [error.field]: error.message } : undefined };
    }
    if (error instanceof z.ZodError) return { ok: false, error: "Données invalides" };
    console.error("[checkout] createOrder failed", error);
    return { ok: false, error: "Une erreur est survenue. Merci de réessayer." };
  }
}
