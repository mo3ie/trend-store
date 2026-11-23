import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { db, weekStart } from "@/lib/games";
import { libyaDay } from "@/lib/dailyGift";
import { leaderboard } from "@/lib/gameWeek";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const ws = weekStart(libyaDay());
  const { top } = await leaderboard(ws, 20);
  const ids = top.map((t) => t.user_id);
  const { data: profs } = ids.length ? await db.from("profiles").select("id,full_name,phone").in("id", ids) : { data: [] };
  const pm = new Map((profs || []).map((p) => [p.id, p]));
  const { data: weeks } = await db.from("game_weeks").select("*").order("week_start", { ascending: false }).limit(8);
  const { count: flagged } = await db.from("game_scores").select("id", { count: "exact", head: true }).gte("day", ws).not("meta->>flagged", "is", null);
  const { count: plays } = await db.from("game_scores").select("id", { count: "exact", head: true }).eq("day", libyaDay());
  const winnerIds = [...new Set((weeks || []).flatMap((w) => (w.winners as { user_id: string }[]).map((x) => x.user_id)))];
  const { data: wp } = winnerIds.length ? await db.from("profiles").select("id,full_name,phone").in("id", winnerIds) : { data: [] };
  const wpm = new Map((wp || []).map((p) => [p.id, p]));
  return NextResponse.json({
    weekStart: ws, playsToday: plays || 0, flaggedThisWeek: flagged || 0,
    leaderboard: top.map((t) => ({ ...t, phone: pm.get(t.user_id)?.phone || null, full_name: pm.get(t.user_id)?.full_name || null })),
    weeks: (weeks || []).map((w) => ({ ...w, winners: (w.winners as { user_id: string }[]).map((x) => ({ ...x, phone: wpm.get(x.user_id)?.phone || null, full_name: wpm.get(x.user_id)?.full_name || null })) })),
  });
}

// { action: "prize", week_start, prize_title } | { action: "claim", week_start, code }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await req.json().catch(() => ({}));
  if (b.action === "prize") {
    await db.from("game_weeks").upsert({ week_start: b.week_start, prize_title: String(b.prize_title || "").slice(0, 120) || "جوائز الأسبوع من محل ترند" });
    return NextResponse.json({ success: true });
  }
  if (b.action === "claim") {
    const { data: w } = await db.from("game_weeks").select("winners").eq("week_start", b.week_start).single();
    const list = (w?.winners || []) as { code: string; claimed: boolean }[];
    const i = list.findIndex((x) => x.code === String(b.code || "").trim().toUpperCase());
    if (i < 0) return NextResponse.json({ error: "الكود غير صحيح" }, { status: 404 });
    if (list[i].claimed) return NextResponse.json({ error: "استُلمت من قبل" }, { status: 409 });
    list[i].claimed = true;
    await db.from("game_weeks").update({ winners: list }).eq("week_start", b.week_start);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "unknown" }, { status: 400 });
}
