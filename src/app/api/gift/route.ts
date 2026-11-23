import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/apiAuth";
import { ensureDraw, libyaDay, drawTime, runDraw } from "@/lib/dailyGift";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET: today's gift + my status + recent results (all public data; seeds only after the draw)
export async function GET() {
  const today = libyaDay();
  await ensureDraw(today);
  // Safety net: if the cron missed, the first visitor after draw time triggers it.
  if (Date.now() >= drawTime(today).getTime()) await runDraw(today).catch(() => {});
  const user = await getUser().catch(() => null);

  const { data: draws } = await db.from("daily_draws")
    .select("day,gift_title,gift_image,seed_hash,seed,entries_count,entries_hash,winner_name,drawn_at,claimed_at,winner_user_id,claim_code")
    .order("day", { ascending: false }).limit(15);
  const { count } = await db.from("daily_draw_entries").select("id", { count: "exact", head: true }).eq("day", today);

  let entered = false;
  const myWins: { day: string; gift_title: string; claim_code: string; claimed: boolean }[] = [];
  if (user) {
    const { data: e } = await db.from("daily_draw_entries").select("id").eq("day", today).eq("user_id", user.id).maybeSingle();
    entered = !!e;
    for (const d of draws || []) if (d.winner_user_id === user.id) myWins.push({ day: d.day, gift_title: d.gift_title, claim_code: d.claim_code, claimed: !!d.claimed_at });
  }
  const pub = (draws || []).map((d) => ({
    day: d.day, gift_title: d.gift_title, gift_image: d.gift_image, seed_hash: d.seed_hash,
    seed: d.drawn_at ? d.seed : null, entries_count: d.drawn_at ? d.entries_count : null,
    entries_hash: d.drawn_at ? d.entries_hash : null, winner_name: d.winner_name, drawn: !!d.drawn_at, claimed: !!d.claimed_at,
  }));
  const todayDraw = pub.find((d) => d.day === today);
  return NextResponse.json({
    today: todayDraw ? { ...todayDraw, entries_live: count || 0, draw_at: drawTime(today).toISOString() } : null,
    history: pub.filter((d) => d.day !== today && d.drawn),
    signedIn: !!user, entered, myWins,
  });
}

// POST: enter today's draw (one per account per day)
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول باش تشارك" }, { status: 401 });
  const today = libyaDay();
  if (Date.now() >= drawTime(today).getTime()) return NextResponse.json({ error: "سحب اليوم تم — شارك بكرة من الصبح" }, { status: 409 });
  // Anti-abuse: brand-new accounts can't enter (stops mass sign-ups for the gift).
  if (Date.now() - new Date(user.created_at).getTime() < 24 * 3600_000) {
    return NextResponse.json({ error: "حسابك جديد — تقدر تشارك بعد 24 ساعة من التسجيل" }, { status: 403 });
  }
  await ensureDraw(today);
  const { error } = await db.from("daily_draw_entries").insert({ day: today, user_id: user.id });
  if (error && !/duplicate/i.test(error.message)) return NextResponse.json({ error: "تعذّرت المشاركة" }, { status: 500 });
  return NextResponse.json({ success: true });
}
