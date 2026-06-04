"use client";

import { useState, useEffect, useCallback } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
  stock: number;
};

const STORAGE_KEY = "trend_cart";

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
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

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const next = existing
        ? prev.map((i) =>
            i.id === item.id
              ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
              : i
          )
        : [...prev, { ...item, quantity: 1 }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => {
      const next = quantity <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => i.id === id ? { ...i, quantity: Math.min(quantity, i.stock) } : i);
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
