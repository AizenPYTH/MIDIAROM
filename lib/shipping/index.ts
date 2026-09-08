import "server-only";
import { getServerEnv } from "@/lib/env";
import type { ShippingProvider } from "@/lib/shipping/types";
import { MockShippingProvider } from "@/lib/shipping/providers/mock";

const registry: Record<string, () => ShippingProvider> = {
  mock: () => new MockShippingProvider(),
  // TODO(integration): register real carriers here, e.g.
  // colissimo: () => new ColissimoProvider(getServerEnv().SHIPPING_PROVIDER_API_KEY),
};

/** Resolves a provider by code (shipping_methods.provider_code) or the env default. */
export function getShippingProvider(code?: string | null): ShippingProvider {
  const env = getServerEnv();
  const resolved = code && code !== "none" ? code : env.SHIPPING_PROVIDER;
  const factory = registry[resolved];
  if (!factory) throw new Error(`Unknown shipping provider "${resolved}"`);
  if (resolved === "mock" && env.NODE_ENV === "production") {
    throw new Error("The mock shipping provider cannot be used in production");
  }
  return factory();
}

export function hasShippingProvider(code: string | null | undefined): boolean {
  return Boolean(code && code !== "none" && registry[code]);
}
