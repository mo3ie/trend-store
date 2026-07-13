import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// POST — start or renew a monthly bot subscription for a page, debiting the wallet
// (same wallets.balance the ads checkout uses). Body: { pageId }.
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { pageId } = await req.json();
  if (!pageId) return NextResponse.json({ error: "pageId مطلوب" }, { status: 400 });

  // Verify the page is the user's.
  const { data: page } = await supabaseAdmin
    .from("connected_pages").select("page_id")
    .eq("user_id", user.id).eq("page_id", pageId).eq("platform", "meta").maybeSingle();
  if (!page) return NextResponse.json({ error: "الصفحة غير مرتبطة بحسابك" }, { status: 403 });

  const { data: settings } = await supabaseAdmin
    .from("bot_settings").select("monthly_price_lyd").eq("id", 1).single();
  const price = Number(settings?.monthly_price_lyd ?? 50);

  // Debit wallet.
  const { data: wallet } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  if (!wallet || Number(wallet.balance) < price) {
    return NextResponse.json({ error: "insufficient_balance", message: "رصيد المحفظة غير كافٍ" }, { status: 402 });
  }
  await supabaseAdmin.from("wallets")
    .update({ balance: Number(wallet.balance) - price, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  // Extend from the later of now / current expiry.
  const { data: existing } = await supabaseAdmin
    .from("bot_subscriptions").select("expires_at")
    .eq("user_id", user.id).eq("page_id", pageId).eq("platform", "meta").maybeSingle();
  const base = existing?.expires_at && new Date(existing.expires_at).getTime() > Date.now()
    ? new Date(existing.expires_at).getTime() : Date.now();
  const expiresAt = new Date(base + MONTH_MS).toISOString();

  const { data: sub, error } = await supabaseAdmin.from("bot_subscriptions").upsert({
    user_id:    user.id,
    page_id:    pageId,
    platform:   "meta",
    plan:       "monthly",
    status:     "active",
    price_lyd:  price,
    expires_at: expiresAt,
  }, { onConflict: "user_id,page_id,platform" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ subscription: sub });
}
