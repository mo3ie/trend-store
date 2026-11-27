"use client";

import { useState, useEffect, useCallback } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  old_price?: number | null; // "before" price during an offer (display only)
  image_url?: string;
  quantity: number;
  stock: number;
  variants?: Record<string, string>;
  cartKey: string;
};

const STORAGE_KEY = "trend_cart";

function makeCartKey(id: string, variants?: Record<string, string>): string {
  if (!variants || Object.keys(variants).length === 0) return id;
  const sorted = Object.keys(variants).sort().reduce<Record<string, string>>((acc, k) => {
    acc[k] = variants[k];
    return acc;
  }, {});
  return `${id}_${JSON.stringify(sorted)}`;
}

function announce() { if (typeof window !== "undefined") setTimeout(() => window.dispatchEvent(new Event("trend:cart")), 0); }

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // backfill cartKey for old items that don't have it
    return raw.map((i: any) => ({ ...i, cartKey: i.cartKey || makeCartKey(i.id, i.variants) }));
  } catch {
    return [];
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  // Every component has its own copy (header badge, bottom nav, cart page…); a write by
  // one tells the others to re-read, so badges never show a stale count.
  useEffect(() => {
    setItems(readStorage());
    const sync = () => setItems(readStorage());
    window.addEventListener("trend:cart", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("trend:cart", sync); window.removeEventListener("storage", sync); };
  }, []);

  function save(next: CartItem[]) {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); announce();
  }

  const addItem = useCallback((item: Omit<CartItem, "quantity" | "cartKey">) => {
    setItems((prev) => {
      const key = makeCartKey(item.id, item.variants);
      const existing = prev.find((i) => i.cartKey === key);
      const next = existing
        ? prev.map((i) =>
            i.cartKey === key
              ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
              : i
          )
        : [...prev, { ...item, quantity: 1, cartKey: key }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); announce();
      return next;
    });
    // Sound + cart-icon bump in the TREND Glass layer (components/UiFx).
    try { window.dispatchEvent(new Event("trend:add")); } catch {}
  }, []);

  // accepts both cartKey and id for backwards compatibility
  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.cartKey !== key && i.id !== key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); announce();
      return next;
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => {
      const next = quantity <= 0
        ? prev.filter((i) => i.cartKey !== key && i.id !== key)
        : prev.map((i) =>
            (i.cartKey === key || i.id === key)
              ? { ...i, quantity: Math.min(quantity, i.stock) }
              : i
          );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); announce();
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY); announce();
  }, []);

  // Re-read current prices from the server (prices change by hand, e.g. on offer day).
  // Display only — the order route always prices from the database anyway.
  const refreshPrices = useCallback(async () => {
    const ids = [...new Set(readStorage().map((i) => i.id))];
    if (!ids.length) return;
    const fresh = new Map<string, { price: number; old_price: number | null; name: string }>();
    await Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(`/api/products/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.price != null) fresh.set(id, { price: Number(d.price), old_price: d.old_price != null ? Number(d.old_price) : null, name: d.name });
      } catch { /* keep the stored line */ }
    }));
    if (!fresh.size) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        const f = fresh.get(i.id);
        if (!f || (f.price === i.price && (f.old_price ?? null) === (i.old_price ?? null))) return i;
        changed = true;
        return { ...i, price: f.price, old_price: f.old_price, name: f.name || i.name };
      });
      if (!changed) return prev;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); announce();
      return next;
    });
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, total, count, refreshPrices };
}
