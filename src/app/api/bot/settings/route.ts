import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser, isAdmin } from "@/lib/authUser";

// GET — public bot pricing (monthly price, trial days).
export async function GET() {
  const { data } = await supabaseAdmin
    .from("bot_settings").select("monthly_price_lyd, trial_days").eq("id", 1).single();
  return NextResponse.json({
    monthly_price_lyd: Number(data?.monthly_price_lyd ?? 50),
    trial_days:        Number(data?.trial_days ?? 0),
  });
}

// PATCH — admin edits pricing. Body: { monthly_price_lyd?, trial_days? }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !(await isAdmin(user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const body = await req.json();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (Number.isFinite(body.monthly_price_lyd)) patch.monthly_price_lyd = body.monthly_price_lyd;
  if (Number.isFinite(body.trial_days)) patch.trial_days = body.trial_days;

  const { data, error } = await supabaseAdmin
    .from("bot_settings").update(patch).eq("id", 1).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
