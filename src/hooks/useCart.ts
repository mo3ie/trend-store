"use client";

import { useState, useEffect, useCallback } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
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

  useEffect(() => {
    setItems(readStorage());
  }, []);

  function save(next: CartItem[]) {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // accepts both cartKey and id for backwards compatibility
  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.cartKey !== key && i.id !== key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, total, count };
}
