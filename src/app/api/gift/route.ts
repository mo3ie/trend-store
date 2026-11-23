import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/apiAuth";
import { ensureDraw, libyaDay, drawTime, runDraw } from "@/lib/dailyGift";
import { eligibility, recentWinner, signals, MAX_PER_IP } from "@/lib/antifraud";
import { getQuiz } from "@/lib/games";
import { rateLimited } from "@/lib/catalog";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET: today's gift + entry question + my status + recent results
export async function GET() {
  const today = libyaDay();
  await ensureDraw(today);
  if (Date.now() >= drawTime(today).getTime()) await runDraw(today).catch(() => {});
  const user = await getUser().catch(() => null);

  const { data: draws } = await db.from("daily_draws")
    .select("day,gift_title,gift_image,seed_hash,seed,entries_count,entries_hash,winner_name,drawn_at,claimed_at,winner_user_id,claim_code,redraws,disqualified")
    .order("day", { ascending: false }).limit(15);
  const { count } = await db.from("daily_draw_entries").select("id", { count: "exact", head: true }).eq("day", today);
  const q1 = (await getQuiz(today))[0];

  let entered = false, blocked: string | null = null;
  const myWins: { day: string; gift_title: string; claim_code: string; claimed: boolean }[] = [];
  if (user) {
    const { data: e } = await db.from("daily_draw_entries").select("id").eq("day", today).eq("user_id", user.id).maybeSingle();
    entered = !!e;
    const el = await eligibility(user);
    if (!el.ok) blocked = el.reason;
    else { const w = await recentWinner(user.id, el.phoneHash, null); if (w) blocked = `فزت يوم ${w} — تقدر تشارك مرة ثانية بعد 30 يوم من فوزك`; }
    for (const d of draws || []) if (d.winner_user_id === user.id && d.claim_code) myWins.push({ day: d.day, gift_title: d.gift_title, claim_code: d.claim_code, claimed: !!d.claimed_at });
  }
  const pub = (draws || []).map((d) => ({
    day: d.day, gift_title: d.gift_title, gift_image: d.gift_image, seed_hash: d.seed_hash,
    seed: d.drawn_at ? d.seed : null, entries_count: d.drawn_at ? d.entries_count : null,
    entries_hash: d.drawn_at ? d.entries_hash : null, winner_name: d.winner_name, drawn: !!d.drawn_at, claimed: !!d.claimed_at,
    redraws: d.redraws || 0, disqualified: (Array.isArray(d.disqualified) ? d.disqualified : []).map((x: { entry?: number }) => x.entry),
  }));
  const todayDraw = pub.find((d) => d.day === today);
  return NextResponse.json({
    today: todayDraw ? { ...todayDraw, entries_live: count || 0, draw_at: drawTime(today).toISOString(), question: q1 ? { q: q1.q, options: q1.options } : null } : null,
    history: pub.filter((d) => d.day !== today && d.drawn),
    signedIn: !!user, entered, blocked, myWins,
  });
}

// POST { answer } — enter today's draw. Requires the right answer to today's question.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول باش تشارك" }, { status: 401 });
  if (rateLimited(`gift:${user.id}`, 6, 60 * 60_000)) return NextResponse.json({ error: "محاولات كثيرة — جرّب بعد شوية" }, { status: 429 });
  const today = libyaDay();
  if (Date.now() >= drawTime(today).getTime()) return NextResponse.json({ error: "سحب اليوم تم — شارك بكرة من الصبح" }, { status: 409 });

  const el = await eligibility(user);
  if (!el.ok) return NextResponse.json({ error: el.reason, code: el.code }, { status: 403 });
  const { ipHash, deviceHash } = signals(req);
  if (!deviceHash) return NextResponse.json({ error: "حدّث الصفحة وحاول مرة ثانية" }, { status: 400 });
  const won = await recentWinner(user.id, el.phoneHash, deviceHash);
  if (won) return NextResponse.json({ error: `فزت يوم ${won} — المشاركة ترجع بعد 30 يوم من فوزك` }, { status: 403 });

  const { answer } = await req.json().catch(() => ({}));
  const q1 = (await getQuiz(today))[0];
  if (q1 && Number(answer) !== q1.answer) return NextResponse.json({ error: "الإجابة غلط — ركّز وجرب مرة ثانية 😉", code: "wrong" }, { status: 400 });

  const [{ count: sameDev }, { count: sameIp }] = await Promise.all([
    db.from("daily_draw_entries").select("id", { count: "exact", head: true }).eq("day", today).eq("device_hash", deviceHash),
    ipHash ? db.from("daily_draw_entries").select("id", { count: "exact", head: true }).eq("day", today).eq("ip_hash", ipHash) : Promise.resolve({ count: 0 }),
  ]);
  if ((sameDev || 0) > 0) return NextResponse.json({ error: "تمت المشاركة من هذا الجهاز اليوم — مشاركة وحدة لكل شخص" }, { status: 409 });
  if ((sameIp || 0) >= MAX_PER_IP) return NextResponse.json({ error: "عدد المشاركات من هذه الشبكة وصل الحد اليوم" }, { status: 409 });

  await ensureDraw(today);
  const { error } = await db.from("daily_draw_entries").insert({ day: today, user_id: user.id, device_hash: deviceHash, ip_hash: ipHash, phone_hash: el.phoneHash });
  if (error) {
    if (/dde_day_phone/.test(error.message)) return NextResponse.json({ error: "رقم الهاتف هذا شارك اليوم من حساب ثاني" }, { status: 409 });
    if (!/duplicate/i.test(error.message)) return NextResponse.json({ error: "تعذّرت المشاركة" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
