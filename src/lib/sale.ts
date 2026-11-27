/**
 * «الجمعة البيضاء» — a store-wide offer, configured in /admin/appearance and stored
 * in store_settings.data.sale. Prices stay manual (products.price + products.old_price);
 * this only drives the banner and the "buying opens at …" lock.
 *
 * The lock is enforced on the server in POST /api/orders (the only route that creates a
 * store order); the UI just explains it.
 */
export type SaleSettings = {
  enabled?: boolean;
  title?: string;        // e.g. «الجمعة البيضاء»
  subtitle?: string;     // e.g. «تخفيضات على كل الأجهزة»
  upTo?: number;         // headline percentage, e.g. 50
  opensAt?: string;      // ISO — ordering is blocked until this moment
  endsAt?: string;       // ISO — optional; banner disappears after it
  limitOne?: boolean;    // one piece per customer of each DISCOUNTED product while the offer is on
};

export type SaleState = {
  on: boolean;           // banner should show
  locked: boolean;       // ordering is blocked right now
  opensAt: number | null;
  msLeft: number;        // until opensAt (0 when open)
};

export function saleState(sale: SaleSettings | null | undefined, now = Date.now()): SaleState {
  const off: SaleState = { on: false, locked: false, opensAt: null, msLeft: 0 };
  if (!sale?.enabled) return off;
  const ends = sale.endsAt ? Date.parse(sale.endsAt) : NaN;
  if (Number.isFinite(ends) && now >= ends) return off;
  const opens = sale.opensAt ? Date.parse(sale.opensAt) : NaN;
  if (!Number.isFinite(opens)) return { on: true, locked: false, opensAt: null, msLeft: 0 };
  const msLeft = Math.max(0, opens - now);
  return { on: true, locked: msLeft > 0, opensAt: opens, msLeft };
}

/** Percent off when old_price is a real "before" price (higher than price), else 0. */
export function discountPct(price: number, oldPrice?: number | null): number {
  const p = Number(price), o = Number(oldPrice);
  if (!(o > 0) || !(p >= 0) || o <= p) return 0;
  return Math.round(((o - p) / o) * 100);
}

/** "04:12:09" (or "1 يوم 04:12:09") for a countdown. */
export function fmtCountdown(ms: number, ar = true): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const hms = [h, m, x].map((v) => String(v).padStart(2, "0")).join(":");
  return d > 0 ? `${d} ${ar ? "يوم" : "d"} ${hms}` : hms;
}

/** "4:00 م" in Libya time for an ISO moment. */
export function fmtLibyaTime(ms: number, ar = true): string {
  try {
    return new Intl.DateTimeFormat(ar ? "ar-LY" : "en-GB", { timeZone: "Africa/Tripoli", hour: "numeric", minute: "2-digit", hour12: ar }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString();
  }
}

export const SALE_LOCK_MESSAGE = (opensAt: number) =>
  `الشراء يبدأ الساعة ${fmtLibyaTime(opensAt)} بتوقيت ليبيا — يمكنك تجهيز سلتك الآن.`;
