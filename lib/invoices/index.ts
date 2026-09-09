import "server-only";
import type { Tables } from "@/types/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Invoices — current state of the implementation (see docs/PAYMENTS.md):
 *
 *   IMPLEMENTED   : an `invoices` row is created for every confirmed payment
 *                   (initial order, quote supplement) and every refund
 *                   (credit note), with a sequential number F-YYYY-NNNNNN,
 *                   the frozen line items and the VAT amount.
 *   NOT IMPLEMENTED: PDF generation and accounting export. `document_path`
 *                   (private "documents" bucket) and `external_ref` are the
 *                   integration points: a renderer or the accounting tool's
 *                   sync job writes the PDF / reference there, and the
 *                   customer download link appears automatically.
 *
 * Nothing in the UI claims a PDF exists while `document_path` is null.
 */
export type Invoice = Tables<"invoices">;

export const INVOICE_TYPE_LABELS: Record<Invoice["invoice_type"], string> = {
  INITIAL: "Facture",
  SUPPLEMENTARY: "Facture complémentaire",
  CREDIT_NOTE: "Avoir",
};

/** Signed download URL when a PDF has been attached to the invoice, otherwise null. */
export async function getInvoiceDocumentUrl(invoice: Pick<Invoice, "document_path">, expiresInSeconds = 600): Promise<string | null> {
  if (!invoice.document_path) return null;
  const { data, error } = await createSupabaseAdminClient().storage.from("documents").createSignedUrl(invoice.document_path, expiresInSeconds);
  if (error) {
    console.error("[invoices] signed url failed", error.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Attaches an externally generated PDF (or accounting reference) to an
 * invoice. To be called by the future renderer / accounting sync.
 */
export async function attachInvoiceDocument(invoiceId: string, input: { documentPath?: string | null; externalRef?: string | null }): Promise<void> {
  const { error } = await createSupabaseAdminClient()
    .from("invoices")
    .update({ ...(input.documentPath !== undefined ? { document_path: input.documentPath } : {}), ...(input.externalRef !== undefined ? { external_ref: input.externalRef } : {}) })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
}
