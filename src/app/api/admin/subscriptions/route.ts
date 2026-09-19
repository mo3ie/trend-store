import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser, isAdmin } from "@/lib/authUser";

// Admin-only management of the subscription plan catalog (prices + features + active).
// GET  → every plan, ordered for the price panel.
// PATCH { id, price_lyd?, active?, features? } → edit one plan.

export async function GET() {
  const user = await getAuthUser();
  if (!user || !(await isAdmin(user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("*")
    .order("product", { ascending: true })
    .order("sort", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data || [] });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !(await isAdmin(user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.price_lyd !== undefined) {
    const p = Number(body.price_lyd);
    if (!Number.isFinite(p) || p < 0) return NextResponse.json({ error: "سعر غير صالح" }, { status: 400 });
    patch.price_lyd = p;
  }
  if (typeof body.active === "boolean") patch.active = body.active;
  if (Array.isArray(body.features)) patch.features = body.features;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "لا تغييرات" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("subscription_plans").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "الباقة غير موجودة" }, { status: 404 });
  return NextResponse.json({ plan: data });
}
