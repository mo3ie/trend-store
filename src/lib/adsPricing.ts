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

export async function getUserTier(userId: string): Promise<Tier> {
  const { data } = await supabaseAdmin
    .from("profiles").select("tier").eq("id", userId).maybeSingle();
  return (data as { tier?: string } | null)?.tier === "vip" ? "vip" : "regular";
}
