"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { normalizeCart, type CartLine } from "@/lib/shop/status";

/**
 * Panier côté navigateur : identifiants + quantités uniquement, conservés dans
 * localStorage. Les prix, le stock et les totaux sont toujours recalculés par le
 * serveur (page panier et création de commande).
 */
const STORAGE_KEY = "mediarom_cart_v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeCart(parsed.filter((l): l is CartLine => typeof l === "object" && l !== null && typeof (l as CartLine).productId === "string"));
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // stockage indisponible (navigation privée) : le panier reste en mémoire
  }
}

// Store externe minuscule : une seule lecture du stockage, snapshot stable,
// mises à jour idempotentes (React peut ré-invoquer les updaters en dev).
const EMPTY: CartLine[] = [];
let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = (): CartLine[] => (cache ??= read());
const getServerSnapshot = (): CartLine[] => EMPTY;
const setCart = (next: (prev: CartLine[]) => CartLine[]) => {
  cache = normalizeCart(next(getSnapshot()));
  write(cache);
  for (const listener of listeners) listener();
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Le serveur rend un panier vide ; le client relit le stockage une fois monté.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      add: (productId, quantity = 1) => setCart((prev) => [...prev, { productId, quantity }]),
      setQuantity: (productId, quantity) => setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0)),
      remove: (productId) => setCart((prev) => prev.filter((l) => l.productId !== productId)),
      clear: () => setCart(() => []),
    }),
    [lines, ready],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
