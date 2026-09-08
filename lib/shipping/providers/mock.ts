import type {
  CreateLabelInput,
  CreateLabelResult,
  RateQuote,
  ShippingProvider,
  TrackingResult,
} from "@/lib/shipping/types";

/**
 * DEVELOPMENT ONLY. Produces fake tracking numbers and a minimal PDF so the
 * whole workflow (label → tracking → delivery) can be exercised without a
 * carrier account. Refused in production by lib/shipping/index.ts.
 */
function minimalLabelPdf(lines: string[]): Uint8Array {
  const text = lines.map((l, i) => `BT /F1 12 Tf 40 ${780 - i * 18} Td (${l.replace(/[()\\]/g, " ")}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${o.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export class MockShippingProvider implements ShippingProvider {
  readonly code = "mock";
  readonly displayName = "Transporteur de démonstration (DEV)";

  async createLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
    const trackingNumber = `MOCK${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
    return {
      providerShipmentId: `mock_${crypto.randomUUID()}`,
      trackingNumber,
      trackingUrl: null,
      carrierName: this.displayName,
      serviceCode: input.serviceCode ?? "mock_standard",
      labelPdf: minimalLabelPdf([
        "ETIQUETTE DE DEMONSTRATION - NE PAS UTILISER",
        `Dossier : ${input.orderNumber}`,
        `Suivi : ${trackingNumber}`,
        "",
        "Destinataire :",
        input.to.name,
        input.to.line1,
        input.to.line2 ?? "",
        `${input.to.postal_code} ${input.to.city}`,
        "",
        "Expediteur :",
        input.from.name,
        `${input.from.postal_code} ${input.from.city}`,
      ]),
      costCents: 0,
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    return { trackingNumber, status: "IN_TRANSIT", events: [] };
  }

  async getRates(): Promise<RateQuote[]> {
    return [{ serviceCode: "mock_standard", serviceName: "Standard (DEV)", priceCents: 0, estimatedDays: 2 }];
  }

  async cancelLabel(): Promise<void> {
    return;
  }
}
