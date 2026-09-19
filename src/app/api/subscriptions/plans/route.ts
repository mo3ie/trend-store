import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Public catalog of ACTIVE plans, for the purchase UI. Optional ?product=bot|ads|studio.
export async function GET(req: Request) {
  const product = new URL(req.url).searchParams.get("product");
  let q = supabaseAdmin
    .from("subscription_plans")
    .select("id,product,tier,page_scope,page_limit,duration,months,price_lyd,features,sort")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (product) q = q.eq("product", product);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data || [] });
}
