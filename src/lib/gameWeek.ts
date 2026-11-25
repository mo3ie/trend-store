import { randomBytes } from "crypto";
import { db, weekStart } from "@/lib/games";
import { libyaDay } from "@/lib/dailyGift";
import { maskName } from "@/lib/dailyGift";
import { notifyUser } from "@/lib/notify";

const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from(randomBytes(8), (x) => CODE[x % CODE.length]).join("");

export async function leaderboard(ws: string, limit = 10) {
  const end = new Date(`${ws}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 7);
  const { data } = await db.from("game_scores").select("user_id,score,meta").gte("day", ws).lt("day", end.toISOString().slice(0, 10));
  const sum = new Map<string, number>();
  for (const r of data || []) if ((r.meta as { submitted?: boolean })?.submitted && !(r.meta as { flagged?: string })?.flagged) sum.set(r.user_id, (sum.get(r.user_id) || 0) + r.score);
  const ranked = [...sum.entries()].sort((a, b) => b[1] - a[1]);
  const ids = ranked.slice(0, limit).map(([id]) => id);
  const { data: profs } = ids.length ? await db.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
  const pm = new Map((profs || []).map((p) => [p.id, p.full_name]));
  return { all: ranked, top: ranked.slice(0, limit).map(([id, s], i) => ({ rank: i + 1, user_id: id, name: maskName(pm.get(id)), score: s })) };
}

/** Freezes last week's top 3 (once), gives each a claim code and a notification. */
export async function finalizePastWeek() {
  const ws = weekStart(libyaDay(-7));
  const { data: w } = await db.from("game_weeks").select("*").eq("week_start", ws).maybeSingle();
  if (w?.finalized_at) return;
  if (!w) await db.from("game_weeks").insert({ week_start: ws }).select("week_start").maybeSingle();
  const { top } = await leaderboard(ws, 3);
  const winners = top.map((t) => ({ ...t, code: code(), claimed: false }));
  const { data: upd } = await db.from("game_weeks").update({ winners, finalized_at: new Date().toISOString() }).eq("week_start", ws).is("finalized_at", null).select("prize_title");
  if (!upd?.length) return;
  for (const x of winners) await notifyUser(x.user_id, { type: "games", important: true, link: "/games",
    title: `🏆 مبروك! المركز ${x.rank} في تحديات الأسبوع`, body: `${upd[0].prize_title} — كود الاستلام: ${x.code}. اعرضه في المحل مع هويتك.` });
}
