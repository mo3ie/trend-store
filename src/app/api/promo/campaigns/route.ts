import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { priceFor, findTierOption } from "@/services/campaigns";
import { getAdsPricing, getUserTier } from "@/lib/adsPricing";

async function getUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// GET — list user's campaigns
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data });
}

// POST — create new campaign (status = pending_payment)
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const {
    pageId, pageName, postUrl, budgetUsd, durationDays, targeting, packageId,
    objective, placements, advantageAudience, specialAdCategory, targetingB,
  } = await req.json();

  const VALID_OBJECTIVES = ["engagement", "messages", "traffic", "calls", "video_views", "awareness"];
  const VALID_PLACEMENTS = ["facebook", "instagram", "messenger", "audience_network"];
  const VALID_CATEGORIES = ["HOUSING", "EMPLOYMENT", "CREDIT", "ISSUES_ELECTIONS_POLITICS"];
  const objectiveFinal = VALID_OBJECTIVES.includes(objective) ? objective : "engagement";
  const placementsFinal = Array.isArray(placements)
    ? placements.filter((p: string) => VALID_PLACEMENTS.includes(p))
    : [];
  const categoryFinal = VALID_CATEGORIES.includes(specialAdCategory) ? specialAdCategory : null;

  if (!pageId || !postUrl) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  // Verify the page belongs to this user
  const { data: page } = await supabaseAdmin
    .from("connected_pages")
    .select("id")
    .eq("user_id", user.id)
    .eq("page_id", pageId)
    .single();

  if (!page) {
    return NextResponse.json({ error: "الصفحة غير مرتبطة بحسابك" }, { status: 403 });
  }

  const tier = await getUserTier(user.id);

  // Pricing — server-trusted, never the client's numbers.
  let budgetUsdFinal: number, baseLyd: number, serviceFee: number, totalLyd: number, days: number;

  if (packageId) {
    // Fixed LYD package (regular + VIP): price comes straight from the poster table.
    const found = findTierOption(String(packageId), Number(durationDays));
    if (!found) return NextResponse.json({ error: "الباقة غير صحيحة" }, { status: 400 });
    budgetUsdFinal = found.option.budgetUsd;
    baseLyd        = found.option.priceLyd;
    serviceFee     = 0;
    totalLyd       = found.option.priceLyd;
    days           = found.option.days;
  } else {
    // Custom USD budget — VIP only.
    if (tier !== "vip") {
      return NextResponse.json({ error: "الميزانية المخصصة بالدولار متاحة لعملاء VIP فقط", code: "vip_only" }, { status: 403 });
    }
    const usd = Number(budgetUsd);
    if (!usd || usd < 1) return NextResponse.json({ error: "الحد الأدنى للميزانية 1$" }, { status: 400 });
    if (!durationDays)   return NextResponse.json({ error: "المدة مطلوبة" }, { status: 400 });
    const pricing = await getAdsPricing();
    const price = priceFor(usd, tier, pricing);
    budgetUsdFinal = price.budgetUsd;
    baseLyd        = price.baseLyd;
    serviceFee     = price.commissionLyd;
    totalLyd       = price.totalLyd;
    days           = Number(durationDays);
  }

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .insert({
      user_id:       user.id,
      page_id:       pageId,
      page_name:     pageName || null,
      post_url:      postUrl,
      budget_usd:    budgetUsdFinal,
      budget:        baseLyd,        // LYD figure shown to the user
      duration_days: days,
      service_fee:   serviceFee,
      total_price:   totalLyd,       // what the customer pays
      tier,
      status:        "pending_payment",
      targeting:     targeting || { countries: ["LY"] },
      objective:          objectiveFinal,
      placements:         placementsFinal,
      advantage_audience: advantageAudience === true,
      special_ad_category: categoryFinal,
      targeting_b:        targetingB && typeof targetingB === "object" ? targetingB : null,
      ab_test:            !!(targetingB && typeof targetingB === "object"),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
