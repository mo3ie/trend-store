import { createHash, createHmac, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * «هدية اليوم» — a daily gift drawn automatically, with no one choosing the
 * winner, and provably fair:
 *
 *  1. Each day gets a secret random seed. Only sha256(seed) is published
 *     (the commitment) while entries are open, so nobody — including us — can
 *     change the seed after seeing who entered.
 *  2. Customers enter once per day (signed-in account older than 24h).
 *  3. At draw time the ordered entry list is hashed, and the winner is
 *     HMAC-SHA256(seed, entriesHash) mod N. Then the seed is revealed.
 *  4. Anyone can recompute it on /gift. The winner gets a claim code (in their
 *     account + a notification); the shop verifies that code to hand the gift.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const DRAW_HOUR_LIBYA = 21; // 9 PM Libya time (UTC+2)

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Calendar day in Libya (UTC+2, no DST). */
export function libyaDay(offsetDays = 0): string {
  const d = new Date(Date.now() + 2 * 3600_000 + offsetDays * 864e5);
  return d.toISOString().slice(0, 10);
}

/** UTC instant of the draw for a Libya day. */
export function drawTime(day: string): Date {
  return new Date(`${day}T${String(DRAW_HOUR_LIBYA - 2).padStart(2, "0")}:00:00Z`);
}

export async function ensureDraw(day: string) {
  const { data } = await db.from("daily_draws").select("day").eq("day", day).maybeSingle();
  if (data) return;
  const seed = randomBytes(32).toString("hex");
  const { data: plan } = await db.from("daily_gift_plan").select("gift_title,gift_image").eq("day", day).maybeSingle();
  await db.from("daily_draws").insert({
    day, seed, seed_hash: sha256(seed),
    ...(plan ? { gift_title: plan.gift_title, gift_image: plan.gift_image } : {}),
  }).select("day").maybeSingle(); // a parallel insert losing the race is fine (PK)
}

/** Public entry token: lets people check the list without exposing user ids. */
export const entryTag = (userId: string, day: string) => sha256(`${day}:${userId}`).slice(0, 10);

export function maskName(full: string | null | undefined): string {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "زبون ترند";
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : `${parts[0].slice(0, 2)}***`;
}

/** Winner index — the exact formula published on /gift. */
export function pickIndex(seed: string, entriesHash: string, n: number): number {
  const h = createHmac("sha256", seed).update(entriesHash).digest("hex");
  return Number(BigInt("0x" + h) % BigInt(n));
}

export function entriesDigest(entries: { id: number; user_id: string }[], day: string) {
  const list = entries.map((e) => `${e.id}:${entryTag(e.user_id, day)}`).join("\n");
  return { list, hash: sha256(list) };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function claimCode(): string {
  const b = randomBytes(8);
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join("");
}

type Entry = { id: number; user_id: string; device_hash: string | null; ip_hash: string | null; phone_hash: string | null; excluded: string | null };

/**
 * Anti-fraud pass run at draw time (results stored on each entry):
 *  • more than MAX_PER_IP entries from one network → all excluded (account farm)
 *  • same phone or same device twice → only the first entry counts
 *  • won within the cooldown window (by account, phone or device) → excluded
 */
async function screen(day: string, entries: Entry[]) {
  const { MAX_PER_IP, WIN_COOLDOWN_DAYS } = await import("@/lib/antifraud");
  const since = new Date(Date.now() - WIN_COOLDOWN_DAYS * 864e5).toISOString().slice(0, 10);
  const { data: wins } = await db.from("daily_draws").select("winner_user_id,winner_phone_hash,winner_device_hash").gte("day", since).lt("day", day).not("winner_user_id", "is", null);
  const wonUsers = new Set((wins || []).map((w) => w.winner_user_id)), wonPhones = new Set((wins || []).map((w) => w.winner_phone_hash).filter(Boolean)), wonDevs = new Set((wins || []).map((w) => w.winner_device_hash).filter(Boolean));
  const perIp = new Map<string, number>();
  for (const e of entries) if (e.ip_hash) perIp.set(e.ip_hash, (perIp.get(e.ip_hash) || 0) + 1);
  const seenPhone = new Set<string>(), seenDev = new Set<string>();
  const updates: { id: number; excluded: string }[] = [];
  for (const e of entries) {
    if (e.excluded) continue;
    let why = "";
    if (e.ip_hash && (perIp.get(e.ip_hash) || 0) > MAX_PER_IP) why = "حسابات كثيرة من نفس الشبكة";
    else if (e.phone_hash && seenPhone.has(e.phone_hash)) why = "رقم هاتف مكرر";
    else if (e.device_hash && seenDev.has(e.device_hash)) why = "جهاز مكرر";
    else if (wonUsers.has(e.user_id) || (e.phone_hash && wonPhones.has(e.phone_hash)) || (e.device_hash && wonDevs.has(e.device_hash))) why = "فاز خلال آخر 30 يوم";
    if (e.phone_hash) seenPhone.add(e.phone_hash);
    if (e.device_hash) seenDev.add(e.device_hash);
    if (why) { e.excluded = why; updates.push({ id: e.id, excluded: why }); }
  }
  for (const u of updates) await db.from("daily_draw_entries").update({ excluded: u.excluded }).eq("id", u.id);
  return entries.filter((e) => !e.excluded);
}

async function crown(day: string, giftTitle: string, winner: Entry, extra: Record<string, unknown>) {
  const { data: prof } = await db.from("profiles").select("full_name").eq("id", winner.user_id).maybeSingle();
  const code = claimCode();
  const { data: upd } = await db.from("daily_draws").update({
    ...extra, winner_user_id: winner.user_id, winner_name: maskName(prof?.full_name), claim_code: code,
    winner_phone_hash: winner.phone_hash, winner_device_hash: winner.device_hash, claimed_at: null,
  }).eq("day", day).select("day");
  if (!upd?.length) return null;
  await db.from("notifications").insert({
    user_id: winner.user_id, type: "gift", title: "🎁 مبروك! فزت بهدية اليوم",
    body: `فزت بـ «${giftTitle}». كود الاستلام: ${code} — اعرضه في المحل مع بطاقة هويتك ورقم هاتفك المسجّل.`, link: "/gift",
  });
  return code;
}

export async function runDraw(day: string) {
  await ensureDraw(day);
  const { data: draw } = await db.from("daily_draws").select("*").eq("day", day).single();
  if (!draw || draw.drawn_at) return { day, skipped: "already drawn" };
  // claim the draw first so two triggers can't both run it
  const { data: lock } = await db.from("daily_draws").update({ drawn_at: new Date().toISOString() }).eq("day", day).is("drawn_at", null).select("day");
  if (!lock?.length) return { day, skipped: "raced" };
  const { data: all } = await db.from("daily_draw_entries").select("id,user_id,device_hash,ip_hash,phone_hash,excluded").eq("day", day).order("id");
  const eligible = await screen(day, (all || []) as Entry[]);
  const { hash } = entriesDigest(eligible, day);
  if (!eligible.length) {
    await db.from("daily_draws").update({ entries_count: 0, entries_hash: hash }).eq("day", day);
    return { day, winner: null, excluded: (all || []).length };
  }
  const winner = eligible[pickIndex(draw.seed, hash, eligible.length)];
  await crown(day, draw.gift_title, winner, { entries_count: eligible.length, entries_hash: hash });
  return { day, winner: winner.user_id, entries: eligible.length, excluded: (all || []).length - eligible.length };
}

/**
 * Admin disqualifies the winner (fraud found / didn't meet the rules) → a new
 * winner is drawn the same verifiable way: candidates = published list minus
 * disqualified entries, index = HMAC(seed, entriesHash + ":r" + n) mod count.
 */
export async function redraw(day: string, reason: string) {
  const { data: draw } = await db.from("daily_draws").select("*").eq("day", day).single();
  if (!draw?.drawn_at || !draw.winner_user_id) throw new Error("لا يوجد فائز لإعادة السحب");
  if (draw.claimed_at) throw new Error("الهدية استُلمت بالفعل");
  const { data: rows } = await db.from("daily_draw_entries").select("id,user_id,device_hash,ip_hash,phone_hash,excluded").eq("day", day).order("id");
  const published = ((rows || []) as Entry[]).filter((e) => !e.excluded || e.excluded.startsWith("استبعاد بعد الفوز"));
  const cur = published.find((e) => e.user_id === draw.winner_user_id && !e.excluded);
  if (cur) await db.from("daily_draw_entries").update({ excluded: `استبعاد بعد الفوز: ${reason.slice(0, 80)}` }).eq("id", cur.id);
  const dq = [...(Array.isArray(draw.disqualified) ? draw.disqualified : []), { entry: cur?.id, reason: reason.slice(0, 120) }];
  const dqIds = new Set(dq.map((x: { entry?: number }) => x.entry));
  const candidates = published.filter((e) => !dqIds.has(e.id));
  const n = (draw.redraws || 0) + 1;
  if (!candidates.length) {
    await db.from("daily_draws").update({ redraws: n, disqualified: dq, winner_user_id: null, winner_name: null, claim_code: null }).eq("day", day);
    return { winner: null };
  }
  const idx = pickIndex(draw.seed, `${draw.entries_hash}:r${n}`, candidates.length);
  await crown(day, draw.gift_title, candidates[idx], { redraws: n, disqualified: dq });
  return { winner: candidates[idx].user_id };
}
