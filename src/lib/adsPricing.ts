import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mergeAdsPricing, type AdsPricing, type Tier } from "@/services/campaigns";
import { hasProduct } from "@/lib/entitlements";

// Loads admin-editable ads pricing from store_settings.data.adsPricing,
// falling back to defaults for any missing key.
export async function getAdsPricing(): Promise<AdsPricing> {
  const { data } = await supabaseAdmin
    .from("store_settings").select("data").eq("id", 1).maybeSingle();
  const stored = (data?.data as { adsPricing?: Partial<AdsPricing> } | null)?.adsPricing;
  return mergeAdsPricing(stored);
}

// VIP is granted by the NEW subscription system (an active ads subscription, or the
// top AI-Employee tier's all-access) — the single source of truth (entitlements v2).
// The LEGACY grant (profiles.tier='vip' / profiles.vip_until) is kept as an OR-fallback
// so no existing VIP loses access and we can compare/roll back (rollback = drop the v2 term).
async function legacyVip(userId: string): Promise<{ vip: boolean; until: string | null; permanent: boolean }> {
  const { data } = await supabaseAdmin
    .from("profiles").select("tier, vip_until").eq("id", userId).maybeSingle();
  const row = data as { tier?: string; vip_until?: string | null } | null;
  const permanent = row?.tier === "vip";
  const active = !!row?.vip_until && new Date(row.vip_until!).getTime() > Date.now();
  return { vip: permanent || active, until: row?.vip_until ?? null, permanent };
}

export async function getUserTier(userId: string): Promise<Tier> {
  const [v2, legacy] = await Promise.all([
    hasProduct(userId, "ads").catch(() => false),
    legacyVip(userId),
  ]);
  return v2 || legacy.vip ? "vip" : "regular";
}

// Returns VIP status + expiry for display (v2 subscription OR legacy).
export async function getVipStatus(userId: string): Promise<{ vip: boolean; until: string | null; permanent: boolean }> {
  const [v2, legacy] = await Promise.all([
    hasProduct(userId, "ads").catch(() => false),
    legacyVip(userId),
  ]);
  return { vip: v2 || legacy.vip, until: legacy.until, permanent: legacy.permanent };
}
