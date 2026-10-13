import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser, isAdmin } from "@/lib/authUser";

export const maxDuration = 45;

/** Coarse device label from a user-agent — enough to answer "phone or desktop". */
function deviceOf(ua: string | null): string {
  const s = (ua || "").toLowerCase();
  if (!s) return "غير معروف";
  if (/iphone|ipad|ipod/.test(s)) return "iPhone / iPad";
  if (/android/.test(s)) return "Android";
  if (/windows/.test(s)) return "Windows";
  if (/mac os|macintosh/.test(s)) return "Mac";
  if (/linux/.test(s)) return "Linux";
  return "أخرى";
}

/**
 * GET ?days=&limit= — who signed in, when, and from what.
 *
 * Reads `login_events`, which only starts filling from the day this shipped.
 * The screen says so rather than presenting an empty chart as "no activity" —
 * an owner who reads a blank week as a dead store would be misled by our own
 * missing history.
 */
export async function GET(req: NextRequest) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  if (!(await isAdmin(me.id))) {
    return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") || 30)));
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 100)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [{ data: events }, { data: window }, { data: firstRow }] = await Promise.all([
    supabaseAdmin.from("login_events")
      .select("id, user_id, email, ip, user_agent, app, created_at")
      .order("created_at", { ascending: false }).limit(limit),
    supabaseAdmin.from("login_events")
      .select("user_id, created_at, user_agent, app")
      .gte("created_at", since).limit(20000),
    supabaseAdmin.from("login_events")
      .select("created_at").order("created_at", { ascending: true }).limit(1),
  ]);

  // Names, so the list reads as people rather than uuids.
  const ids = [...new Set((events || []).map((e) => e.user_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, full_name, email, role").in("id", ids);
    for (const p of profiles || []) names.set(p.id, p.full_name || p.email || "مستخدم");
  }
  const roles = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, role").in("id", ids);
    for (const p of profiles || []) if (p.role) roles.set(p.id, p.role);
  }

  const rows = (events || []).map((e) => ({
    id: e.id,
    userId: e.user_id,
    name: e.user_id ? names.get(e.user_id) || "مستخدم محذوف" : "—",
    role: e.user_id ? roles.get(e.user_id) ?? null : null,
    email: e.email,
    ip: e.ip,
    device: deviceOf(e.user_agent),
    app: e.app,
    at: e.created_at,
  }));

  // Per-day counts, zero-filled, so a quiet day is a gap in the line rather
  // than a missing point that silently shortens the chart.
  const byDay = new Map<string, { logins: number; users: Set<string> }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(d, { logins: 0, users: new Set() });
  }
  const devices = new Map<string, number>();
  const apps = new Map<string, number>();
  for (const e of window || []) {
    const d = String(e.created_at).slice(0, 10);
    const slot = byDay.get(d);
    if (slot) { slot.logins++; if (e.user_id) slot.users.add(e.user_id); }
    const dev = deviceOf(e.user_agent);
    devices.set(dev, (devices.get(dev) ?? 0) + 1);
    apps.set(e.app || "store", (apps.get(e.app || "store") ?? 0) + 1);
  }

  const dayAgo = Date.now() - 86_400_000;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const all = window || [];

  return NextResponse.json({
    rows,
    stats: {
      today: all.filter((e) => new Date(e.created_at).getTime() >= dayAgo).length,
      activeToday: new Set(all.filter((e) => new Date(e.created_at).getTime() >= dayAgo).map((e) => e.user_id)).size,
      week: all.filter((e) => new Date(e.created_at).getTime() >= weekAgo).length,
      activeWeek: new Set(all.filter((e) => new Date(e.created_at).getTime() >= weekAgo).map((e) => e.user_id)).size,
      windowTotal: all.length,
      activeWindow: new Set(all.map((e) => e.user_id)).size,
    },
    series: [...byDay.entries()].map(([date, v]) => ({ date, logins: v.logins, users: v.users.size })),
    devices: [...devices.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    apps: [...apps.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    days,
    // When logging began, so the screen can say "since …" instead of implying
    // the store had no visitors before that date.
    since: firstRow?.[0]?.created_at ?? null,
  });
}
