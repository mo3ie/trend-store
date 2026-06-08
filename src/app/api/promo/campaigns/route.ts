import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateFees } from "@/services/campaigns";

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

  const { pageId, pageName, postUrl, budget, durationDays, targeting } = await req.json();

  if (!pageId || !postUrl || !budget || !durationDays) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }
  if (budget < 20) {
    return NextResponse.json({ error: "الحد الأدنى للميزانية 20 د.ل" }, { status: 400 });
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

  const fees = calculateFees(Number(budget));

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .insert({
      user_id:     user.id,
      page_id:     pageId,
      page_name:   pageName || null,
      post_url:    postUrl,
      budget:      fees.budget,
      duration_days: Number(durationDays),
      service_fee: fees.serviceFee,
      total_price: fees.total,
      status:      "pending_payment",
      targeting:   targeting || { countries: ["LY"] },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
