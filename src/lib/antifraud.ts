import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Anti-fraud for free prizes (daily gift + games).
 *
 * One person = one chance. We tie each entry to three signals and allow only
 * one entry per signal per day:
 *   • phone   — the account must have a valid Libyan mobile on its profile
 *   • device  — a random id the browser keeps + a browser fingerprint
 *   • network — IP (/24); more than MAX_PER_IP accounts from one network a day
 *               are all excluded as a farm
 * Plus: account age ≥ MIN_AGE_DAYS, confirmed email, and a cooldown after a win.
 * Signals are stored as salted hashes only.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SALT = process.env.ANTIFRAUD_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY!.slice(-24);

export const MIN_AGE_DAYS = 3;
export const WIN_COOLDOWN_DAYS = 30;
export const MAX_PER_IP = 3;

const h = (s: string) => createHash("sha256").update(`${SALT}:${s}`).digest("hex").slice(0, 32);

/** 09XXXXXXXX / 2189XXXXXXXX / +2189… → 2189XXXXXXXX, or null when not a Libyan mobile. */
export function normalizePhone(p: string | null | undefined): string | null {
  const d = String(p || "").replace(/\D/g, "");
  const m = d.match(/^(?:00)?(?:218)?0?(9[1-6]\d{7})$/);
  return m ? `218${m[1]}` : null;
}

export function signals(req: Request) {
  const ipRaw = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim();
  const ip = ipRaw.includes(".") ? ipRaw.split(".").slice(0, 3).join(".") : ipRaw.split(":").slice(0, 4).join(":");
  const dev = (req.headers.get("x-trend-device") || "").slice(0, 200);
  return { ipHash: ip ? h(`ip:${ip}`) : null, deviceHash: dev.length >= 16 ? h(`dev:${dev}`) : null };
}

export type Eligibility = { ok: true; phoneHash: string } | { ok: false; reason: string; code: string };

export async function eligibility(user: User): Promise<Eligibility> {
  if (!user.email_confirmed_at && !user.phone_confirmed_at) return { ok: false, code: "unconfirmed", reason: "أكّد بريدك الإلكتروني أولاً" };
  const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 864e5;
  if (ageDays < MIN_AGE_DAYS) return { ok: false, code: "new", reason: `حسابك جديد — تقدر تشارك بعد ${Math.ceil(MIN_AGE_DAYS - ageDays)} يوم` };
  const { data: p } = await db.from("profiles").select("phone").eq("id", user.id).maybeSingle();
  const phone = normalizePhone(p?.phone);
  if (!phone) return { ok: false, code: "phone", reason: "أضف رقم هاتفك الليبي في «حسابي» باش تقدر تشارك" };
  return { ok: true, phoneHash: h(`ph:${phone}`) };
}

/** Did this person (account, phone or device) win anything in the cooldown window? */
export async function recentWinner(userId: string, phoneHash: string | null, deviceHash: string | null): Promise<string | null> {
  const since = new Date(Date.now() - WIN_COOLDOWN_DAYS * 864e5).toISOString().slice(0, 10);
  const { data } = await db.from("daily_draws").select("day,winner_user_id,winner_phone_hash,winner_device_hash").gte("day", since).not("winner_user_id", "is", null);
  const hit = (data || []).find((d) => d.winner_user_id === userId || (phoneHash && d.winner_phone_hash === phoneHash) || (deviceHash && d.winner_device_hash === deviceHash));
  return hit ? hit.day : null;
}
