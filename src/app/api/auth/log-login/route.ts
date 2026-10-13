import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

export const maxDuration = 15;

/** Minutes within which a repeat SIGNED_IN for the same user is the same visit. */
const DEDUPE_MINUTES = 10;

/**
 * POST — record that someone signed in.
 *
 * The identity is taken from the session cookie, never from the body, so a
 * caller cannot forge a login as somebody else.
 *
 * Supabase fires `SIGNED_IN` on session restore as well as on a real sign-in —
 * every reopened tab would otherwise look like a fresh login and the statistics
 * would be fiction. So a second event for the same user inside a short window is
 * treated as the same visit and dropped.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  // Not an error worth surfacing: this is fire-and-forget from the client.
  if (!user) return NextResponse.json({ ok: false }, { status: 200 });

  const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("login_events").select("id")
    .eq("user_id", user.id).gte("created_at", since)
    .limit(1).maybeSingle();
  if (recent) return NextResponse.json({ ok: true, deduped: true });

  // Behind Vercel the socket address is the edge, so the real client address is
  // the first hop in x-forwarded-for.
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || null;

  let app = "store";
  try { app = (await req.json())?.app || "store"; } catch { /* body is optional */ }

  await supabaseAdmin.from("login_events").insert({
    user_id: user.id,
    email: user.email ?? null,
    ip,
    user_agent: (req.headers.get("user-agent") || "").slice(0, 400) || null,
    app: String(app).slice(0, 40),
  });

  return NextResponse.json({ ok: true });
}
