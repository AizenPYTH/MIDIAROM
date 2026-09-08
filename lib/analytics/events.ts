/** Canonical analytics event names (internal analytics + GA4/Ads mapping). */
export const ANALYTICS_EVENTS = {
  PAGE_VIEW: "page_view",
  VIEW_REPAIR: "view_repair",
  SELECT_REPAIR: "select_repair",
  START_CHECKOUT: "start_checkout",
  VIEW_OPTION: "view_option",
  ADD_OPTION: "add_option",
  REMOVE_OPTION: "remove_option",
  SELECT_PACK: "select_pack",
  REMOVE_PACK: "remove_pack",
  SELECT_SHIPPING: "select_shipping",
  START_PAYMENT: "start_payment",
  PURCHASE: "purchase",
  QUOTE_SENT: "quote_sent",
  QUOTE_ACCEPTED: "quote_accepted",
  QUOTE_REFUSED: "quote_refused",
  QUOTE_PAID: "quote_paid",
  REVIEW_SUBMITTED: "review_submitted",
  TRACKING_LOOKUP: "tracking_lookup",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const ANALYTICS_EVENT_NAMES = Object.values(ANALYTICS_EVENTS) as AnalyticsEventName[];

export interface AttributionData {
  session_id: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

export const ATTRIBUTION_STORAGE_KEY = "cr_attribution_v1";
export const CONSENT_STORAGE_KEY = "cr_consent_v1";
