import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/apiAuth";
import { libyaDay } from "@/lib/dailyGift";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data: plan } = await db.from("daily_gift_plan").select("*").gte("day", libyaDay()).order("day").limit(30);
  const { data: draws } = await db.from("daily_draws").select("day,gift_title,entries_count,winner_user_id,winner_name,claim_code,drawn_at,claimed_at").order("day", { ascending: false }).limit(30);
  const ids = [...new Set((draws || []).map((d) => d.winner_user_id).filter(Boolean))];
  const { data: profs } = ids.length ? await db.from("profiles").select("id,full_name,phone,email").in("id", ids) : { data: [] };
  const pm = new Map((profs || []).map((p) => [p.id, p]));
  return NextResponse.json({
    plan: plan || [],
    draws: (draws || []).map((d) => ({ ...d, winner: d.winner_user_id ? pm.get(d.winner_user_id) || null : null })),
  });
}

// { action: "plan", day, gift_title, gift_image? } | { action: "unplan", day } | { action: "claim", code }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const b = await req.json().catch(() => ({}));
  if (b.action === "plan") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.day || "") || !String(b.gift_title || "").trim()) return NextResponse.json({ error: "اليوم واسم الهدية مطلوبين" }, { status: 400 });
    await db.from("daily_gift_plan").upsert({ day: b.day, gift_title: String(b.gift_title).slice(0, 120), gift_image: b.gift_image || null });
    // If that day's draw row already exists and isn't drawn yet, update its gift too.
    await db.from("daily_draws").update({ gift_title: String(b.gift_title).slice(0, 120), gift_image: b.gift_image || null }).eq("day", b.day).is("drawn_at", null);
    return NextResponse.json({ success: true });
  }
  if (b.action === "unplan") {
    await db.from("daily_gift_plan").delete().eq("day", b.day);
    return NextResponse.json({ success: true });
  }
  if (b.action === "claim") {
    const code = String(b.code || "").trim().toUpperCase();
    const { data: d } = await db.from("daily_draws").select("day,gift_title,winner_user_id,claimed_at").eq("claim_code", code).maybeSingle();
    if (!d) return NextResponse.json({ error: "الكود غير صحيح" }, { status: 404 });
    if (d.claimed_at) return NextResponse.json({ error: "هذا الكود استُلمت هديته من قبل", claimed_at: d.claimed_at }, { status: 409 });
    const { data: p } = await db.from("profiles").select("full_name,phone,email").eq("id", d.winner_user_id).maybeSingle();
    if (b.confirm) {
      await db.from("daily_draws").update({ claimed_at: new Date().toISOString(), claimed_by: auth.userId }).eq("day", d.day).is("claimed_at", null);
      return NextResponse.json({ success: true, claimed: true, day: d.day, gift_title: d.gift_title, winner: p });
    }
    return NextResponse.json({ success: true, claimed: false, day: d.day, gift_title: d.gift_title, winner: p });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
