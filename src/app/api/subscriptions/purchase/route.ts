import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// POST { planId, page_ids?: string[] } — buy a subscription with the wallet.
// Price is taken from the plan row (server-side, never the client). One purchase
// creates one subscription row + one invoice (subscription_payments). Products stay
// separate: a purchase only ever grants THIS product for the chosen page(s).
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json();
  const planId = String(body.planId || "");
  const pageIds: string[] = Array.isArray(body.page_ids) ? body.page_ids.map(String).filter(Boolean) : [];
  if (!planId) return NextResponse.json({ error: "planId مطلوب" }, { status: 400 });

  const { data: plan } = await supabaseAdmin
    .from("subscription_plans").select("*").eq("id", planId).maybeSingle();
  if (!plan || !plan.active) return NextResponse.json({ error: "الباقة غير متاحة" }, { status: 404 });

  const price = Number(plan.price_lyd);
  const limit = Number(plan.page_limit);

  // Page selection: single/triple must name their pages (and own them); unlimited ignores.
  let pages: string[] = [];
  if (limit < 999) {
    if (pageIds.length === 0) return NextResponse.json({ error: "اختر الصفحة", code: "pages_required", need: limit }, { status: 400 });
    if (pageIds.length > limit) return NextResponse.json({ error: `الباقة تسمح بـ ${limit} صفحة كحد أقصى`, code: "too_many_pages" }, { status: 400 });
    // Ownership: meta pages live in connected_pages; other platforms in bot_configs.
    for (const pid of pageIds) {
      const inPages = await supabaseAdmin.from("connected_pages").select("page_id").eq("user_id", user.id).eq("page_id", pid).maybeSingle();
      const inBots  = inPages.data ? null : await supabaseAdmin.from("bot_configs").select("page_id").eq("user_id", user.id).eq("page_id", pid).maybeSingle();
      if (!inPages.data && !inBots?.data) return NextResponse.json({ error: "إحدى الصفحات غير مرتبطة بحسابك", code: "page_not_owned" }, { status: 403 });
    }
    pages = pageIds;
  }

  // Debit wallet.
  const { data: wallet } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  const balance = Number(wallet?.balance ?? 0);
  if (balance < price) {
    return NextResponse.json({ error: "insufficient_balance", message: "رصيد المحفظة غير كافٍ", balance, price }, { status: 402 });
  }
  const newBalance = balance - price;
  await supabaseAdmin.from("wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  const now = Date.now();
  const expiresAt = new Date(now + Number(plan.months) * 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sub, error } = await supabaseAdmin.from("subscriptions").insert({
    user_id:    user.id,
    product:    plan.product,
    plan_id:    plan.id,
    tier:       plan.tier,
    page_scope: plan.page_scope,
    page_limit: limit,
    page_ids:   pages,
    starts_at:  new Date(now).toISOString(),
    expires_at: expiresAt,
    status:     "active",
    price_lyd:  price,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: invoice } = await supabaseAdmin.from("subscription_payments").insert({
    user_id:         user.id,
    subscription_id: sub.id,
    product:         plan.product,
    plan_id:         plan.id,
    amount_lyd:      price,
    provider:        "wallet",
    status:          "success",
  }).select().single();

  return NextResponse.json({ subscription: sub, invoice, balance: newBalance });
}
