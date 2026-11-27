"use client";

import { useEffect, useState } from "react";
import { saleState, type SaleSettings, type SaleState } from "@/lib/sale";

// One fetch per page load, shared by every component that asks.
let cached: Promise<SaleSettings | null> | null = null;
function loadSale(): Promise<SaleSettings | null> {
  if (!cached) {
    cached = fetch("/api/site-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d && typeof d === "object" ? (d.sale as SaleSettings) ?? null : null))
      .catch(() => null);
  }
  return cached;
}

/** The store offer + live state; re-evaluated every second while a countdown runs. */
export function useSale(): { sale: SaleSettings | null; state: SaleState } {
  const [sale, setSale] = useState<SaleSettings | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { let live = true; loadSale().then((s) => { if (live) setSale(s); }); return () => { live = false; }; }, []);

  const state = saleState(sale, now);
  const ticking = state.locked || (!!sale?.enabled && !!sale.endsAt);
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  return { sale, state };
}
