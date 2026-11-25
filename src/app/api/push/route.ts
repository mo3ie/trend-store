import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { pushPublicKey, pushToUser } from "@/lib/notify";

/**
 * Phone notifications for the signed-in customer.
 *   GET            → { key } VAPID public key (served at runtime, no rebuild needed)
 *   POST {subscription}        → save/refresh this device
 *   POST {test:true}           → send a test notice to my devices
 *   DELETE {endpoint}          → forget this device
 */
export async function GET() {
  return NextResponse.json({ key: pushPublicKey() || null });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body?.test) {
    const r = await pushToUser(user.id, { title: "🔔 الإشعارات شغّالة", body: "هكي توصلك أخبار طلباتك ومحفظتك وكل شي في ترند.", link: "/", tag: "test" });
    return NextResponse.json(r);
  }

  const s = body?.subscription;
  const endpoint = String(s?.endpoint || "");
  const p256dh = String(s?.keys?.p256dh || ""), auth = String(s?.keys?.auth || "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) {
    return NextResponse.json({ error: "اشتراك غير صالح" }, { status: 400 });
  }
  // One row per device endpoint; re-subscribing (or a different account on the same phone) re-points it.
  const { error } = await db.from("store_push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth, user_agent: (req.headers.get("user-agent") || "").slice(0, 200) },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: "تعذّر الحفظ" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: true });
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) await db.from("store_push_subscriptions").delete().eq("endpoint", String(endpoint)).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
