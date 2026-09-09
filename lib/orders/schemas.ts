import { z } from "zod";

export const addressSchema = z.object({
  line1: z.string().trim().min(3, "Adresse requise").max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Code postal français à 5 chiffres"),
  city: z.string().trim().min(1, "Ville requise").max(80),
  country_code: z.literal("FR").default("FR"),
});

export const customerSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(60),
  last_name: z.string().trim().min(1, "Nom requis").max(60),
  email: z.string().trim().email("E-mail invalide").max(160),
  phone: z
    .string()
    .trim()
    .regex(/^(\+33|0)[1-9](?:[ .-]?\d{2}){4}$/, "Numéro de téléphone français invalide")
    .or(z.literal(""))
    .optional(),
});

export const selectionSchema = z.object({
  repairId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).max(20).default([]),
  packIds: z.array(z.string().uuid()).max(5).default([]),
  shippingMethodId: z.string().uuid().nullable().default(null),
});

export const attributionSchema = z
  .object({
    session_id: z.string().max(64).nullable().optional(),
    landing_page: z.string().max(512).nullable().optional(),
    referrer: z.string().max(1024).nullable().optional(),
    utm_source: z.string().max(128).nullable().optional(),
    utm_medium: z.string().max(128).nullable().optional(),
    utm_campaign: z.string().max(256).nullable().optional(),
    utm_term: z.string().max(256).nullable().optional(),
    utm_content: z.string().max(256).nullable().optional(),
  })
  .nullable()
  .optional();

export const createOrderSchema = z.object({
  selection: selectionSchema.extend({ shippingMethodId: z.string().uuid() }),
  customer: customerSchema,
  address: addressSchema,
  customer_notes: z.string().trim().max(2000).optional().or(z.literal("")),
  console_serial_number: z.string().trim().max(60).optional().or(z.literal("")),
  console_already_opened: z.boolean().default(false),
  symptoms: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  photos: z.array(z.string().max(200)).max(6).default([]),
  accept_terms: z.literal(true, { message: "Vous devez accepter les conditions générales" }),
  attribution: attributionSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type SelectionInput = z.infer<typeof selectionSchema>;

/** Commande boutique : lignes (identifiants + quantités), retrait ou envoi, coordonnées. */
export const shopOrderSchema = z.object({
  lines: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1, "Panier vide").max(30),
  fulfillment: z.enum(["PICKUP", "SHIPPING"]),
  customer: customerSchema,
  address: addressSchema.nullable(),
  customer_notes: z.string().trim().max(1000).optional().or(z.literal("")),
  accept_terms: z.literal(true, { message: "Vous devez accepter les conditions générales" }),
  attribution: attributionSchema,
});
export type ShopOrderInput = z.infer<typeof shopOrderSchema>;
