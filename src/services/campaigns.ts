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

// ── Fixed LYD packages (the "باقات الإعلانات الممولة" poster) ──────────────────
// Regular accounts pick ONE of these — priced in LYD, no USD ever shown. Each
// option carries an INTERNAL usd budget (what we actually spend on Meta); the
// customer only ever sees priceLyd + the views range. VIP accounts bypass all
// of this and set a free USD budget/duration (see priceFor).
export interface AdTierOption {
  days:     number;
  priceLyd: number;
  viewsMin: number;
  viewsMax: number;
  budgetUsd: number; // internal Meta spend (≈ priceLyd / 13)
}
export interface AdTierPackage {
  id:     "first" | "second" | "third";
  name:   string;   // Arabic
  nameEn: string;
  level:  1 | 2 | 3;
  options: AdTierOption[];
}

export const AD_TIER_PACKAGES: AdTierPackage[] = [
  { id: "first", name: "الأولى", nameEn: "First", level: 1, options: [
    { days: 3,  priceLyd: 65,  viewsMin: 1000,  viewsMax: 3500,  budgetUsd: 5  },
    { days: 5,  priceLyd: 95,  viewsMin: 7000,  viewsMax: 17000, budgetUsd: 7  },
    { days: 7,  priceLyd: 115, viewsMin: 8500,  viewsMax: 25000, budgetUsd: 9  },
    { days: 10, priceLyd: 145, viewsMin: 12000, viewsMax: 35000, budgetUsd: 11 },
    { days: 15, priceLyd: 195, viewsMin: 18000, viewsMax: 50000, budgetUsd: 15 },
    { days: 20, priceLyd: 290, viewsMin: 25000, viewsMax: 70000, budgetUsd: 22 },
  ]},
  { id: "second", name: "الثانية", nameEn: "Second", level: 2, options: [
    { days: 3,  priceLyd: 100, viewsMin: 3000,  viewsMax: 7000,   budgetUsd: 8  },
    { days: 5,  priceLyd: 145, viewsMin: 15000, viewsMax: 35000,  budgetUsd: 11 },
    { days: 7,  priceLyd: 190, viewsMin: 20000, viewsMax: 50000,  budgetUsd: 15 },
    { days: 10, priceLyd: 290, viewsMin: 25000, viewsMax: 70000,  budgetUsd: 22 },
    { days: 15, priceLyd: 450, viewsMin: 40000, viewsMax: 100000, budgetUsd: 35 },
    { days: 20, priceLyd: 590, viewsMin: 50000, viewsMax: 150000, budgetUsd: 45 },
  ]},
  { id: "third", name: "الثالثة", nameEn: "Third", level: 3, options: [
    { days: 3,  priceLyd: 195,  viewsMin: 15000,  viewsMax: 20000,  budgetUsd: 15 },
    { days: 5,  priceLyd: 350,  viewsMin: 35000,  viewsMax: 100000, budgetUsd: 27 },
    { days: 7,  priceLyd: 490,  viewsMin: 45000,  viewsMax: 125000, budgetUsd: 38 },
    { days: 10, priceLyd: 750,  viewsMin: 50000,  viewsMax: 175000, budgetUsd: 58 },
    { days: 15, priceLyd: 990,  viewsMin: 80000,  viewsMax: 150000, budgetUsd: 76 },
    { days: 20, priceLyd: 1200, viewsMin: 120000, viewsMax: 350000, budgetUsd: 92 },
  ]},
];

// Server-trusted lookup: resolve a (packageId, days) selection to its fixed option.
export function findTierOption(packageId: string, days: number): { pkg: AdTierPackage; option: AdTierOption } | null {
  const pkg = AD_TIER_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return null;
  const option = pkg.options.find((o) => o.days === Number(days));
  return option ? { pkg, option } : null;
}

// Monthly VIP subscription price (LYD). VIP unlocks free USD budgets, no packages.
export const VIP_MONTHLY_LYD = 50;

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
  in_review:       "قيد المراجعة",
  active:          "نشط",
  paused:          "متوقف",
  rejected:        "مرفوض",
  issues:          "بها مشكلة",
  completed:       "منتهي",
  failed:          "فشل",
};

export const CAMPAIGN_STATUS_LABELS_EN: Record<string, string> = {
  pending_payment: "Pending payment",
  paid:            "Paid",
  creating:        "Creating",
  in_review:       "In review",
  active:          "Active",
  paused:          "Paused",
  rejected:        "Rejected",
  issues:          "Has issues",
  completed:       "Completed",
  failed:          "Failed",
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  pending_payment: "#f59e0b",
  paid:            "#3b82f6",
  creating:        "#8b5cf6",
  in_review:       "#3b82f6",
  active:          "#22c55e",
  paused:          "#9aa4b2",
  rejected:        "#ef4444",
  issues:          "#f59e0b",
  completed:       "#6b7280",
  failed:          "#ef4444",
};
