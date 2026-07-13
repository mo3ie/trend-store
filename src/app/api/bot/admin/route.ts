import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser, isAdmin } from "@/lib/authUser";

// GET — admin overview: every bot config with its subscription, plus totals.
export async function GET() {
  const user = await getAuthUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const [{ data: configs }, { data: subs }, { count: replies }] = await Promise.all([
    supabaseAdmin.from("bot_configs")
      .select("id, user_id, page_id, page_name, platform, enabled, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("bot_subscriptions").select("*"),
    supabaseAdmin.from("bot_reply_log")
      .select("id", { count: "exact", head: true }).eq("public_status", "sent"),
  ]);

  const subKey = (s: { user_id: string; page_id: string; platform: string }) =>
    `${s.user_id}|${s.page_id}|${s.platform}`;
  const subMap = new Map((subs || []).map((s) => [subKey(s), s]));

  const now = Date.now();
  const rows = (configs || []).map((c) => {
    const sub = subMap.get(`${c.user_id}|${c.page_id}|${c.platform}`);
    const active = !!sub && sub.status === "active" &&
      (!sub.expires_at || new Date(sub.expires_at).getTime() > now);
    return { ...c, subscription: sub ?? null, sub_active: active };
  });

  const activeSubs = rows.filter((r) => r.sub_active);
  const mrr = activeSubs.reduce((sum, r) => sum + Number(r.subscription?.price_lyd ?? 0), 0);

  return NextResponse.json({
    bots:          rows,
    total_bots:    rows.length,
    running_bots:  rows.filter((r) => r.enabled && r.sub_active).length,
    active_subs:   activeSubs.length,
    monthly_revenue_lyd: mrr,
    total_replies: replies ?? 0,
  });
}
