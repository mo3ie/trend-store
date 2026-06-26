// Campaign business logic — USD-denominated pricing with admin-editable rates.
//
// The ad spend is fundamentally in USD (that's what Meta charges). Customers
// pay in LYD: total = budgetUsd × rate × (1 + commission%). Two tiers each
// have their own admin-editable rate + commission:
//   - vip      → vipRate (≈ real FX), usually 0 commission
//   - regular  → regularRate (higher), optional commission
// All numbers below are DEFAULTS; the admin overrides them via store_settings.

export type Tier = "vip" | "regular";

export interface AdPackage {
  id:       string;
  name:     string;   // Arabic
  nameEn:   string;
  usd:      number;   // ad budget in USD
  days:     number;
  reach:    string;   // estimated reach (Arabic) — تقديري
  reachEn:  string;
  highlight?: boolean;
}

export const DEFAULT_PACKAGES: AdPackage[] = [
  { id: "starter", name: "بداية",   nameEn: "Starter", usd: 5,  days: 3,  reach: "٥–١٠ آلاف",   reachEn: "5–10k"   },
  { id: "basic",   name: "أساسي",   nameEn: "Basic",   usd: 10, days: 5,  reach: "١٢–٢٠ ألف",   reachEn: "12–20k", highlight: true },
  { id: "pro",     name: "احترافي", nameEn: "Pro",     usd: 25, days: 7,  reach: "٣٠–٥٥ ألف",   reachEn: "30–55k"  },
  { id: "premium", name: "بريميوم", nameEn: "Premium", usd: 50, days: 14, reach: "٧٠–١٢٠ ألف",  reachEn: "70–120k" },
];

export interface AdsPricing {
  vipRate:           number; // LYD per 1 USD (VIP / merchants)
  regularRate:       number; // LYD per 1 USD (regular — higher)
  vipCommission:     number; // percent, can be 0
  regularCommission: number; // percent, can be 0
  packages:          AdPackage[];
}

export const DEFAULT_ADS_PRICING: AdsPricing = {
  vipRate:           8,
  regularRate:       12,
  vipCommission:     0,
  regularCommission: 0,
  packages:          DEFAULT_PACKAGES,
};

// Merge stored (partial) admin settings over the defaults so missing keys
// never break pricing.
export function mergeAdsPricing(stored?: Partial<AdsPricing> | null): AdsPricing {
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
  return {
    vipRate:           num(stored?.vipRate,           DEFAULT_ADS_PRICING.vipRate),
    regularRate:       num(stored?.regularRate,       DEFAULT_ADS_PRICING.regularRate),
    vipCommission:     num(stored?.vipCommission,     DEFAULT_ADS_PRICING.vipCommission),
    regularCommission: num(stored?.regularCommission, DEFAULT_ADS_PRICING.regularCommission),
    packages:          Array.isArray(stored?.packages) && stored!.packages!.length
      ? stored!.packages!
      : DEFAULT_PACKAGES,
  };
}

export interface PriceBreakdown {
  budgetUsd:     number;
  rate:          number; // LYD per USD for this tier
  commissionPct: number;
  baseLyd:       number; // usd × rate (rounded up)
  commissionLyd: number;
  totalLyd:      number; // base + commission
}

export function priceFor(budgetUsd: number, tier: Tier, pricing: AdsPricing): PriceBreakdown {
  const rate          = tier === "vip" ? pricing.vipRate : pricing.regularRate;
  const commissionPct = tier === "vip" ? pricing.vipCommission : pricing.regularCommission;
  const baseLyd       = Math.ceil(budgetUsd * rate);
  const commissionLyd = Math.ceil(baseLyd * commissionPct / 100);
  return {
    budgetUsd,
    rate,
    commissionPct,
    baseLyd,
    commissionLyd,
    totalLyd: baseLyd + commissionLyd,
  };
}

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  pending_payment: "انتظار الدفع",
  paid:            "مدفوع",
  creating:        "جارٍ الإنشاء",
  active:          "نشط",
  completed:       "منتهي",
  failed:          "فشل",
};

export const CAMPAIGN_STATUS_LABELS_EN: Record<string, string> = {
  pending_payment: "Pending payment",
  paid:            "Paid",
  creating:        "Creating",
  active:          "Active",
  completed:       "Completed",
  failed:          "Failed",
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  pending_payment: "#f59e0b",
  paid:            "#3b82f6",
  creating:        "#8b5cf6",
  active:          "#22c55e",
  completed:       "#6b7280",
  failed:          "#ef4444",
};
