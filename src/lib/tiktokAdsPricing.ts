import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { priceFor, type AdsPricing, type Tier, type PriceBreakdown } from "@/services/campaigns";
import { hasProduct } from "@/lib/entitlements";
import { MIN_DAILY_USD, minTotalUsd } from "@/services/tiktokAdsCampaigns";

/**
 * TikTok ads pricing — the same USD-budget → LYD-price arithmetic as Facebook, with
 * its own rate, commission and package table.
 *
 * It is a separate module rather than a flag on `adsPricing.ts` for one hard reason:
 * **TikTok's minimum spend is a platform floor, not a pricing choice.** TikTok
 * rejects any ad group under USD 20 per day, so a lifetime budget must be at least
 * 20 × days. Facebook's cheapest package is USD 5 for three days. Those two worlds
 * cannot share one package table — reusing Facebook's would hand the customer a
 * 65 LYD campaign that TikTok refuses to create after they have already paid.
 *
 * So the default packages here are GENERATED from the floor: every option is a legal
 * TikTok budget by construction, and the admin can still override the whole table
 * from `store_settings.data.tiktokAdsPricing`.
 */

export interface TikTokAdOption {
  days: number;
  priceLyd: number;
  /** Internal TikTok spend. Always ≥ MIN_DAILY_USD × days. */
  budgetUsd: number;
  viewsMin: number;
  viewsMax: number;
}

export interface TikTokAdPackage {
  id: "first" | "second" | "third";
  name: string;
  nameEn: string;
  level: 1 | 2 | 3;
  options: TikTokAdOption[];
}

export interface TikTokAdsPricing extends AdsPricing {
  packagesTt: TikTokAdPackage[];
  /** Mirrors the platform floor so the create screen can state it without an API call. */
  minDailyUsd: number;
}

const DURATIONS = [3, 5, 7, 10, 15, 20];

/**
 * How much each tier spends per day, as a multiple of the floor. Tier 1 sits exactly
 * on the minimum — anything less is not a cheaper campaign, it is no campaign.
 */
const TIER_MULTIPLIER: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.75, 3: 3 };

/** Views per USD in Libya, by tier — the wider the budget, the better the rate scales. */
const VIEWS_PER_USD: Record<1 | 2 | 3, [number, number]> = {
  1: [900, 2200], 2: [1100, 2600], 3: [1300, 3200],
};

/**
 * Builds a tier's options from the floor and the LYD rate, so prices and budgets can
 * never drift apart and no option is ever below what TikTok will accept.
 */
function buildPackage(
  id: TikTokAdPackage["id"], name: string, nameEn: string, level: 1 | 2 | 3, rate: number,
): TikTokAdPackage {
  const [vMin, vMax] = VIEWS_PER_USD[level];
  return {
    id, name, nameEn, level,
    options: DURATIONS.map((days) => {
      const budgetUsd = Math.ceil(minTotalUsd(days) * TIER_MULTIPLIER[level]);
      return {
        days,
        budgetUsd,
        // Rounded to the nearest 5 LYD: a price list reads as a price list, not as arithmetic.
        priceLyd: Math.ceil((budgetUsd * rate) / 5) * 5,
        viewsMin: Math.round((budgetUsd * vMin) / 1000) * 1000,
        viewsMax: Math.round((budgetUsd * vMax) / 1000) * 1000,
      };
    }),
  };
}

export function defaultTikTokPackages(rate: number): TikTokAdPackage[] {
  return [
    buildPackage("first",  "الأولى",  "First",  1, rate),
    buildPackage("second", "الثانية", "Second", 2, rate),
    buildPackage("third",  "الثالثة", "Third",  3, rate),
  ];
}

export const DEFAULT_TIKTOK_RATE = 12;
export const DEFAULT_TIKTOK_VIP_RATE = 9;

/**
 * Admin-editable TikTok pricing from `store_settings.data.tiktokAdsPricing`, with
 * every missing key defaulted. Reads the TikTok key only — it never falls back to the
 * Facebook pricing, whose budgets are below TikTok's floor.
 */
export async function getTikTokAdsPricing(): Promise<TikTokAdsPricing> {
  const { data } = await supabaseAdmin
    .from("store_settings").select("data").eq("id", 1).maybeSingle();
  const stored = (data?.data as { tiktokAdsPricing?: Partial<TikTokAdsPricing> } | null)?.tiktokAdsPricing;

  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
  const regularRate = num(stored?.regularRate, DEFAULT_TIKTOK_RATE);
  const vipRate     = num(stored?.vipRate,     DEFAULT_TIKTOK_VIP_RATE);

  return {
    vipRate,
    regularRate,
    vipCommission:     num(stored?.vipCommission, 0),
    regularCommission: num(stored?.regularCommission, 0),
    packages:          [],  // the USD package list is a Facebook-only concept
    minDailyUsd:       MIN_DAILY_USD,
    packagesTt: Array.isArray(stored?.packagesTt) && stored!.packagesTt!.length
      ? stored!.packagesTt!
      : defaultTikTokPackages(regularRate),
  };
}

/** Server-trusted lookup of a (packageId, days) selection. Never trust a client price. */
export function findTikTokOption(
  pricing: TikTokAdsPricing, packageId: string, days: number,
): { pkg: TikTokAdPackage; option: TikTokAdOption } | null {
  const pkg = pricing.packagesTt.find((p) => p.id === packageId);
  if (!pkg) return null;
  const option = pkg.options.find((o) => o.days === Number(days));
  return option ? { pkg, option } : null;
}

/**
 * The advertiser's TikTok tier.
 *
 * Gated on the `tiktok_ads` product, NOT on `ads`: a Facebook ads subscription buys
 * Facebook campaigns, and the two are priced and sold separately. There is
 * deliberately no legacy `profiles.tier` fallback here — TikTok ads are new, so no
 * existing customer can have grandfathered access to lose.
 */
export async function getTikTokUserTier(userId: string): Promise<Tier> {
  const vip = await hasProduct(userId, "tiktok_ads").catch(() => false);
  return vip ? "vip" : "regular";
}

export function tiktokPriceFor(budgetUsd: number, tier: Tier, pricing: TikTokAdsPricing): PriceBreakdown {
  return priceFor(budgetUsd, tier, pricing);
}

export { MIN_DAILY_USD, minTotalUsd };
