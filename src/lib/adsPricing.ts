import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mergeAdsPricing, type AdsPricing, type Tier } from "@/services/campaigns";

// Loads admin-editable ads pricing from store_settings.data.adsPricing,
// falling back to defaults for any missing key.
export async function getAdsPricing(): Promise<AdsPricing> {
  const { data } = await supabaseAdmin
    .from("store_settings").select("data").eq("id", 1).maybeSingle();
  const stored = (data?.data as { adsPricing?: Partial<AdsPricing> } | null)?.adsPricing;
  return mergeAdsPricing(stored);
}

// VIP is granted two ways: an admin-set permanent tier='vip', OR an active paid
// monthly subscription (profiles.vip_until in the future).
export async function getUserTier(userId: string): Promise<Tier> {
  const { data } = await supabaseAdmin
    .from("profiles").select("tier, vip_until").eq("id", userId).maybeSingle();
  const row = data as { tier?: string; vip_until?: string | null } | null;
  if (row?.tier === "vip") return "vip";
  if (row?.vip_until && new Date(row.vip_until).getTime() > Date.now()) return "vip";
  return "regular";
}

// Returns VIP status + expiry for display.
export async function getVipStatus(userId: string): Promise<{ vip: boolean; until: string | null; permanent: boolean }> {
  const { data } = await supabaseAdmin
    .from("profiles").select("tier, vip_until").eq("id", userId).maybeSingle();
  const row = data as { tier?: string; vip_until?: string | null } | null;
  const permanent = row?.tier === "vip";
  const active = !!row?.vip_until && new Date(row.vip_until!).getTime() > Date.now();
  return { vip: permanent || active, until: row?.vip_until ?? null, permanent };
}
