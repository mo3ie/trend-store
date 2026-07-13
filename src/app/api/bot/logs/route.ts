import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

// GET — recent reply-log entries for a config + summary stats. ?configId=&limit=
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const configId = req.nextUrl.searchParams.get("configId");
  if (!configId) return NextResponse.json({ error: "configId مطلوب" }, { status: 400 });

  const { data: config } = await supabaseAdmin
    .from("bot_configs").select("id").eq("id", configId).eq("user_id", user.id).maybeSingle();
  if (!config) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 300);
  const { data: logs } = await supabaseAdmin
    .from("bot_reply_log").select("*").eq("config_id", configId)
    .order("created_at", { ascending: false }).limit(limit);

  const rows = logs || [];
  const stats = {
    total:        rows.length,
    public_sent:  rows.filter((r) => r.public_status === "sent").length,
    private_sent: rows.filter((r) => r.private_status === "sent").length,
    matched:      rows.filter((r) => r.matched_rule_id).length,
    failed:       rows.filter((r) => r.public_status === "failed" || r.private_status === "failed").length,
  };
  return NextResponse.json({ logs: rows, stats });
}
