"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_EVENTS,
  ATTRIBUTION_STORAGE_KEY,
  CONSENT_STORAGE_KEY,
  type AnalyticsEventName,
  type AttributionData,
} from "@/lib/analytics/events";

/**
 * First-party analytics (always on, no personal data, no cookies) + optional
 * Google tags (GA4 / Ads) loaded only after consent.
 */
type Props = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsContextValue {
  track: (event: AnalyticsEventName, props?: Props & { value_cents?: number; order_id?: string; repair_id?: string }) => void;
  attribution: AttributionData | null;
  consent: "unknown" | "granted" | "denied";
  setConsent: (value: "granted" | "denied") => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readAttribution(): AttributionData {
  try {
    const stored = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as AttributionData;
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams(window.location.search);
  const data: AttributionData = {
    session_id: crypto.randomUUID(),
    landing_page: window.location.pathname,
    referrer: document.referrer || null,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_term: params.get("utm_term"),
    utm_content: params.get("utm_content"),
  };
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  return data;
}

export function AnalyticsProvider({ children, gaId, adsId }: { children: ReactNode; gaId?: string; adsId?: string }) {
  const pathname = usePathname();
  const [attribution, setAttribution] = useState<AttributionData | null>(null);
  const [consent, setConsentState] = useState<"unknown" | "granted" | "denied">("unknown");
  const gtagLoaded = useRef(false);

  useEffect(() => {
    setAttribution(readAttribution());
    try {
      const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored === "granted" || stored === "denied") setConsentState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  // Load Google tags only with consent.
  useEffect(() => {
    if (consent !== "granted" || gtagLoaded.current) return;
    const id = gaId || adsId;
    if (!id) return;
    gtagLoaded.current = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    if (gaId) window.gtag("config", gaId, { anonymize_ip: true });
    if (adsId) window.gtag("config", adsId);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }, [consent, gaId, adsId]);

  const track = useCallback<AnalyticsContextValue["track"]>(
    (event, props = {}) => {
      const attr = attribution ?? readAttribution();
      const payload = {
        event_name: event,
        session_id: attr.session_id,
        path: window.location.pathname,
        referrer: attr.referrer,
        landing_page: attr.landing_page,
        utm_source: attr.utm_source,
        utm_medium: attr.utm_medium,
        utm_campaign: attr.utm_campaign,
        utm_term: attr.utm_term,
        utm_content: attr.utm_content,
        value_cents: props.value_cents ?? null,
        order_id: props.order_id ?? null,
        repair_id: props.repair_id ?? null,
        properties: props,
      };
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/analytics", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
      if (window.gtag && consent === "granted") {
        window.gtag("event", event, { ...props, value: props.value_cents ? props.value_cents / 100 : undefined, currency: "EUR" });
      }
    },
    [attribution, consent],
  );

  // Page views
  useEffect(() => {
    if (!attribution) return;
    track(ANALYTICS_EVENTS.PAGE_VIEW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, attribution?.session_id]);

  const setConsent = useCallback((value: "granted" | "denied") => {
    setConsentState(value);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ track, attribution, consent, setConsent }), [track, attribution, consent, setConsent]);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsContextValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    return { track: () => undefined, attribution: null, consent: "unknown", setConsent: () => undefined };
  }
  return ctx;
}

/** Fire an event once on mount (e.g. view_repair on a repair page). */
export function TrackOnMount({ event, props }: { event: AnalyticsEventName; props?: Props & { value_cents?: number; repair_id?: string } }) {
  const { track, attribution } = useAnalytics();
  const fired = useRef(false);
  useEffect(() => {
    if (!attribution || fired.current) return;
    fired.current = true;
    track(event, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attribution]);
  return null;
}
