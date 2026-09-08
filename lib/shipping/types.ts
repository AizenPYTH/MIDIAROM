/**
 * Carrier abstraction. The platform never depends on a single carrier:
 * implement this interface (Colissimo, Boxtal, Sendcloud, UPS…) and register
 * it in lib/shipping/index.ts.
 */
export interface ShippingAddress {
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  postal_code: string;
  city: string;
  country_code: string;
  phone?: string | null;
  email?: string | null;
}

export interface ParcelSpec {
  weightGrams: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  declaredValueCents?: number;
  insured?: boolean;
}

export interface CreateLabelInput {
  orderNumber: string;
  from: ShippingAddress;
  to: ShippingAddress;
  parcel: ParcelSpec;
  serviceCode?: string | null;
  reference?: string;
}

export interface CreateLabelResult {
  providerShipmentId: string;
  trackingNumber: string;
  trackingUrl: string | null;
  carrierName: string;
  serviceCode: string | null;
  /** PDF bytes of the label, when the carrier returns one. */
  labelPdf: Uint8Array | null;
  costCents: number;
}

export interface TrackingEvent {
  status: "PENDING" | "LABEL_CREATED" | "IN_TRANSIT" | "DELIVERED" | "EXCEPTION" | "CANCELLED";
  description: string;
  location?: string | null;
  occurredAt: Date;
  raw?: unknown;
}

export interface TrackingResult {
  trackingNumber: string;
  status: TrackingEvent["status"];
  events: TrackingEvent[];
}

export interface RateQuote {
  serviceCode: string;
  serviceName: string;
  priceCents: number;
  estimatedDays?: number;
}

export interface ShippingProvider {
  readonly code: string;
  readonly displayName: string;
  createLabel(input: CreateLabelInput): Promise<CreateLabelResult>;
  getTracking(trackingNumber: string): Promise<TrackingResult>;
  getRates(input: Omit<CreateLabelInput, "orderNumber">): Promise<RateQuote[]>;
  cancelLabel(providerShipmentId: string): Promise<void>;
}
