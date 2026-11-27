import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

export const maxDuration = 10;

/**
 * POST /api/track — a batch of activity events from components/ActivityTracker.
 * { sid, ref?, events: [{ k: "view"|"click"|"event", p, l?, t?, d?, at? }] }
 *
 * The user comes from the session cookie, never from the body. Only page paths,
 * view duration and the visible text of pressed buttons/links arrive here — the
 * tracker never reads input values. Admin screens are not recorded.
 */
function deviceOf(ua: string): string {
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return "iPhone";
  if (/android/.test(s)) return "Android";
  if (/windows/.test(s)) return "Windows";
  if (/mac os|macintosh/.test(s)) return "Mac";
  if (/linux/.test(s)) return "Linux";
  return "أخرى";
}
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp/i;
const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  if (BOT.test(ua)) return new NextResponse(null, { status: 204 });

  let body: { sid?: unknown; ref?: unknown; events?: unknown } | null = null;
  try { body = JSON.parse(await req.text()); } catch { /* sendBeacon sends text/plain */ }
  const sid = clip(body?.sid, 64);
  const list = Array.isArray(body?.events) ? (body!.events as Record<string, unknown>[]).slice(0, 60) : [];
  if (!sid || !/^[a-z0-9-]{8,64}$/i.test(sid) || !list.length) return new NextResponse(null, { status: 204 });

  const user = await getAuthUser().catch(() => null);
  const device = deviceOf(ua);
  const ref = clip(body?.ref, 120);
  const now = Date.now();

  const rows = list.flatMap((e, i) => {
    const kind = e?.k === "view" || e?.k === "click" || e?.k === "event" ? e.k : null;
    const path = clip(e?.p, 300);
    if (!kind || !path || !path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return [];
    const at = Number(e?.at);
    const ts = Number.isFinite(at) && at > now - 6 * 3600_000 && at <= now + 60_000 ? at : now;
    const d = Number(e?.d);
    return [{
      sid, user_id: user?.id ?? null, kind, path,
      label: clip(e?.l, 80), target: clip(e?.t, 300),
      dur_ms: (kind === "view" || kind === "event") && Number.isFinite(d) && d > 0 ? Math.min(Math.round(d), 6 * 3600_000) : null,
      device, ref: i === 0 ? ref : null,
      created_at: new Date(ts).toISOString(),
    }];
  });
  if (rows.length) await supabaseAdmin.from("site_events").insert(rows);

  // Light housekeeping: keep ~6 months.
  if (Math.random() < 0.002) {
    await supabaseAdmin.from("site_events").delete().lt("created_at", new Date(now - 183 * 86400_000).toISOString());
  }
  return new NextResponse(null, { status: 204 });
}
