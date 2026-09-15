import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setCampaignStatus } from "@/services/meta";

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

// GET — single campaign
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ campaign: data });
}

// POST — owner pauses / resumes their own campaign on Meta. Body: { action: "pause" | "resume" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { action } = await req.json();
  if (action !== "pause" && action !== "resume") return NextResponse.json({ error: "action غير صحيح" }, { status: 400 });

  const { data: camp } = await supabaseAdmin
    .from("ad_campaigns").select("id, external_campaign_id, status, continuous, daily_price_lyd")
    .eq("id", id).eq("user_id", user.id).single();
  if (!camp) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (!camp.external_campaign_id) return NextResponse.json({ error: "الحملة لم تُنشأ على فيسبوك بعد" }, { status: 400 });

  // Resuming a continuous campaign requires enough wallet balance for the next day.
  if (action === "resume" && camp.continuous) {
    const price = Number(camp.daily_price_lyd) || 0;
    const { data: wallet } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    if (Number(wallet?.balance ?? 0) < price) {
      return NextResponse.json({ error: "insufficient_balance", message: `رصيد المحفظة غير كافٍ لاستئناف الحملة (${price} د.ل/يوم)` }, { status: 402 });
    }
  }

  try {
    await setCampaignStatus(camp.external_campaign_id, action === "pause" ? "PAUSED" : "ACTIVE");
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Meta error" }, { status: 500 });
  }

  // Optimistic local status; the next sync reconciles with Meta's effective_status.
  const newStatus = action === "pause" ? "paused" : "active";
  const update: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
  // On resume of a continuous campaign, restart the daily-charge clock (the debit
  // cron will charge the wallet from tomorrow) and clear the pause message.
  if (action === "resume" && camp.continuous) { update.next_charge_at = new Date(Date.now() + 86400000).toISOString(); update.error_message = null; }
  const { data } = await supabaseAdmin
    .from("ad_campaigns").update(update)
    .eq("id", id).eq("user_id", user.id).select().single();
  return NextResponse.json({ campaign: data });
}

// PATCH — admin: update status / external IDs
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Only admin via Bearer token
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const token = auth.slice(7);
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const allowed = ["status", "external_campaign_id", "external_adset_id", "external_ad_id", "error_message"];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
