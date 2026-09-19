import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type Product = "bot" | "ads" | "studio";

export interface ActiveSub {
  id: string;
  product: Product;
  plan_id: string | null;
  tier: string | null;
  page_scope: string | null;
  page_limit: number;
  page_ids: string[];
  starts_at: string;
  expires_at: string | null;
  price_lyd: number | null;
  features: string[];
}

// All non-expired active subscriptions for a user, with each plan's features joined in.
export async function activeSubscriptions(userId: string): Promise<ActiveSub[]> {
  const nowIso = new Date().toISOString();
  const { data: subs } = await supabaseAdmin
    .from("subscriptions").select("*")
    .eq("user_id", userId).eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  const rows = subs || [];
  if (rows.length === 0) return [];

  const planIds = [...new Set(rows.map((r) => r.plan_id).filter(Boolean))] as string[];
  const featByPlan: Record<string, string[]> = {};
  if (planIds.length) {
    const { data: plans } = await supabaseAdmin
      .from("subscription_plans").select("id,features").in("id", planIds);
    for (const p of plans || []) featByPlan[p.id] = Array.isArray(p.features) ? p.features : [];
  }
  return rows.map((r) => ({
    ...r,
    page_ids: Array.isArray(r.page_ids) ? r.page_ids : [],
    features: r.plan_id ? featByPlan[r.plan_id] || [] : [],
  })) as ActiveSub[];
}

// The top AI-Employee tier (feature "all_bots_access") unlocks every product on any page.
function hasAllAccess(subs: ActiveSub[]): boolean {
  return subs.some((s) => s.product === "studio" && s.features.includes("all_bots_access"));
}

function subCoversPage(s: ActiveSub, pageId?: string): boolean {
  if (s.page_limit >= 999) return true;          // unlimited scope
  if (!pageId) return true;                       // asking about the product generally
  return s.page_ids.includes(pageId);
}

// Does the user have an active entitlement to `product` (optionally for a specific page)?
export async function hasProduct(userId: string, product: Product, pageId?: string): Promise<boolean> {
  const subs = await activeSubscriptions(userId);
  if (hasAllAccess(subs)) return true;
  return subs.some((s) => s.product === product && subCoversPage(s, pageId));
}

// Union of feature flags the user holds for a product (all-access grants studio-vip's set).
export async function featuresFor(userId: string, product: Product, pageId?: string): Promise<Set<string>> {
  const subs = await activeSubscriptions(userId);
  const out = new Set<string>();
  for (const s of subs) {
    if (s.product === product && subCoversPage(s, pageId)) s.features.forEach((f) => out.add(f));
    if (s.product === "studio" && s.features.includes("all_bots_access")) s.features.forEach((f) => out.add(f));
  }
  return out;
}
