// Campaign business logic — fee calculations, packages, status flow

export const SERVICE_FEE_RATE = 0.20; // 20% service fee

export interface Package {
  id:          string;
  name:        string;
  budget:      number; // LYD
  durationDays: number;
  serviceFee:  number;
  total:       number;
  highlight?:  boolean;
}

export const PACKAGES: Package[] = [
  {
    id:          "starter",
    name:        "بداية",
    budget:      50,
    durationDays: 3,
    serviceFee:  10,
    total:       60,
  },
  {
    id:          "basic",
    name:        "أساسي",
    budget:      100,
    durationDays: 5,
    serviceFee:  15,
    total:       115,
    highlight:   true,
  },
  {
    id:          "pro",
    name:        "احترافي",
    budget:      200,
    durationDays: 7,
    serviceFee:  25,
    total:       225,
  },
  {
    id:          "premium",
    name:        "بريميوم",
    budget:      500,
    durationDays: 14,
    serviceFee:  50,
    total:       550,
  },
];

export function calculateFees(budgetLyd: number): {
  budget: number;
  serviceFee: number;
  total: number;
} {
  const serviceFee = Math.ceil(budgetLyd * SERVICE_FEE_RATE);
  return {
    budget:     budgetLyd,
    serviceFee,
    total:      budgetLyd + serviceFee,
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

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  pending_payment: "#f59e0b",
  paid:            "#3b82f6",
  creating:        "#8b5cf6",
  active:          "#22c55e",
  completed:       "#6b7280",
  failed:          "#ef4444",
};
