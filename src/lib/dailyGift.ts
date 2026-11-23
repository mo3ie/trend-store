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

export async function runDraw(day: string) {
  await ensureDraw(day);
  const { data: draw } = await db.from("daily_draws").select("*").eq("day", day).single();
  if (!draw || draw.drawn_at) return { day, skipped: "already drawn" };
  const { data: entries } = await db.from("daily_draw_entries").select("id,user_id").eq("day", day).order("id");
  const list = entries || [];
  const { hash } = entriesDigest(list, day);
  if (!list.length) {
    await db.from("daily_draws").update({ drawn_at: new Date().toISOString(), entries_count: 0, entries_hash: hash }).eq("day", day).is("drawn_at", null);
    return { day, winner: null };
  }
  const idx = pickIndex(draw.seed, hash, list.length);
  const winner = list[idx];
  const { data: prof } = await db.from("profiles").select("full_name").eq("id", winner.user_id).maybeSingle();
  const code = claimCode();
  const { data: upd } = await db.from("daily_draws").update({
    drawn_at: new Date().toISOString(), entries_count: list.length, entries_hash: hash,
    winner_user_id: winner.user_id, winner_name: maskName(prof?.full_name), claim_code: code,
  }).eq("day", day).is("drawn_at", null).select("day");
  if (!upd?.length) return { day, skipped: "raced" };
  await db.from("notifications").insert({
    user_id: winner.user_id, type: "gift",
    title: "🎁 مبروك! فزت بهدية اليوم",
    body: `فزت بـ «${draw.gift_title}». كود الاستلام: ${code} — اعرضه في المحل أو تواصل معنا لاستلام هديتك.`,
    link: "/gift",
  });
  return { day, winner: winner.user_id, entries: list.length };
}
