import { NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { db, getQuiz, publicQuiz, priceItems, priceScore, memoryCards, memoryScore, weekStart } from "@/lib/games";
import { libyaDay } from "@/lib/dailyGift";
import { eligibility, signals } from "@/lib/antifraud";
import { leaderboard, finalizePastWeek } from "@/lib/gameWeek";
import { rateLimited } from "@/lib/catalog";

const LIMIT_S: Record<string, number> = { quiz: 150, price: 180, memory: 300 }; // max time per attempt

export async function GET() {
  const day = libyaDay();
  await finalizePastWeek().catch(() => {});
  const user = await getUser().catch(() => null);
  const ws = weekStart(day);
  const [{ top, all }, quiz, price, memory, { data: week }] = await Promise.all([
    leaderboard(ws), getQuiz(day), priceItems(day), memoryCards(day),
    db.from("game_weeks").select("prize_title").eq("week_start", ws).maybeSingle(),
  ]);
  let mine: Record<string, { score: number; submitted: boolean }> = {}, myRank: number | null = null, myWeek = 0, blocked: string | null = null;
  if (user) {
    const { data } = await db.from("game_scores").select("game,score,meta").eq("user_id", user.id).eq("day", day);
    mine = Object.fromEntries((data || []).map((r) => [r.game, { score: r.score, submitted: !!(r.meta as { submitted?: boolean })?.submitted }]));
    const i = all.findIndex(([id]) => id === user.id);
    if (i >= 0) { myRank = i + 1; myWeek = all[i][1]; }
    const el = await eligibility(user);
    if (!el.ok) blocked = el.reason;
  }
  const { data: last } = await db.from("game_weeks").select("week_start,prize_title,winners").not("finalized_at", "is", null).order("week_start", { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({
    day, weekStart: ws, prize: week?.prize_title || "جوائز الأسبوع من محل ترند",
    quiz: publicQuiz(quiz), price: price.map(({ id, name, image_url }) => ({ id, name, image_url })), memory: memory.map(({ k, img }) => ({ k, img })),
    leaderboard: top.map(({ user_id: _u, ...r }) => (void _u, r)), myRank, myWeek, mine, signedIn: !!user, blocked,
    lastWeek: last ? { week: last.week_start, prize: last.prize_title, winners: (last.winners as { rank: number; name: string; score: number }[]).map(({ rank, name, score }) => ({ rank, name, score })) } : null,
  });
}

// POST { action: "start"|"submit", game, payload }
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول باش تلعب" }, { status: 401 });
  if (rateLimited(`games:${user.id}`, 30, 10 * 60_000)) return NextResponse.json({ error: "استنى شوية" }, { status: 429 });
  const { action, game, payload } = await req.json().catch(() => ({}));
  if (!["quiz", "price", "memory"].includes(game)) return NextResponse.json({ error: "لعبة غير معروفة" }, { status: 400 });
  const day = libyaDay();
  const el = await eligibility(user);
  if (!el.ok) return NextResponse.json({ error: el.reason, code: el.code }, { status: 403 });
  const { deviceHash, ipHash } = signals(req);
  if (!deviceHash) return NextResponse.json({ error: "حدّث الصفحة وحاول مرة ثانية" }, { status: 400 });

  if (action === "start") {
    // one attempt per device per game per day (stops multi-account play on one phone)
    const { data: other } = await db.from("game_scores").select("user_id").eq("day", day).eq("game", game).eq("device_hash", deviceHash).neq("user_id", user.id).limit(1);
    if (other?.length) return NextResponse.json({ error: "هذا الجهاز لعب اليوم بحساب ثاني — محاولة وحدة لكل شخص" }, { status: 409 });
    const { error } = await db.from("game_scores").insert({ user_id: user.id, game, day, score: 0, meta: { phone: el.phoneHash }, device_hash: deviceHash, ip_hash: ipHash, started_at: new Date().toISOString() });
    if (error && !/duplicate/i.test(error.message)) return NextResponse.json({ error: "تعذّر البدء" }, { status: 500 });
    const { data: row } = await db.from("game_scores").select("meta").eq("user_id", user.id).eq("game", game).eq("day", day).single();
    if ((row?.meta as { submitted?: boolean })?.submitted) return NextResponse.json({ error: "لعبت هذي اللعبة اليوم — ارجع بكرة" }, { status: 409 });
    return NextResponse.json({ success: true, limit: LIMIT_S[game] });
  }

  if (action !== "submit") return NextResponse.json({ error: "bad action" }, { status: 400 });
  const { data: row } = await db.from("game_scores").select("id,meta,started_at").eq("user_id", user.id).eq("game", game).eq("day", day).maybeSingle();
  if (!row?.started_at) return NextResponse.json({ error: "ابدأ اللعبة أولاً" }, { status: 400 });
  const meta = (row.meta || {}) as Record<string, unknown>;
  if (meta.submitted) return NextResponse.json({ error: "لعبت هذي اللعبة اليوم" }, { status: 409 });
  const elapsed = (Date.now() - new Date(row.started_at).getTime()) / 1000;
  const late = elapsed > LIMIT_S[game] + 10;

  let score = 0, reveal: unknown = null, flagged: string | undefined;
  if (game === "quiz") {
    const qs = await getQuiz(day);
    const ans: number[] = Array.isArray(payload?.answers) ? payload.answers.map(Number) : [];
    const correct = qs.map((q, i) => ans[i] === q.answer);
    score = late ? 0 : correct.filter(Boolean).length * 20;
    reveal = qs.map((q, i) => ({ answer: q.answer, explain: q.explain || null, correct: correct[i] }));
  } else if (game === "price") {
    const items = await priceItems(day);
    const g = (payload?.guesses || {}) as Record<string, number>;
    const per = items.map((it) => ({ id: it.id, real: it.price, guess: Number(g[it.id]) || 0, points: priceScore(Number(g[it.id]) || 0, it.price) }));
    score = late ? 0 : per.reduce((a, x) => a + x.points, 0);
    reveal = per;
  } else {
    const moves = Math.round(Number(payload?.moves) || 0), secs = Math.round(Number(payload?.seconds) || 0);
    // The reported time can't be shorter than the real time since "start" (minus network slack).
    if (secs + 3 < elapsed - 15 || secs > elapsed + 3) flagged = "وقت غير متطابق";
    score = late || flagged ? 0 : memoryScore(moves, secs, 6);
    reveal = { moves, seconds: secs };
  }
  if (late) flagged = flagged || "انتهى الوقت";
  await db.from("game_scores").update({ score, meta: { ...meta, submitted: true, flagged, elapsed: Math.round(elapsed) } }).eq("id", row.id);
  return NextResponse.json({ success: true, score, reveal, late });
}
