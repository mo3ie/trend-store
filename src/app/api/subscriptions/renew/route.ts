import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { notify, productLabel, renewSubscription } from "@/lib/subscriptionBilling";

// POST { subscriptionId } — renew now, from the wallet. Works on an active
// subscription (extends it) and on an expired one (reactivates it). Ownership is
// enforced by passing userId into the shared helper.
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const subscriptionId = String(body.subscriptionId || "");
  if (!subscriptionId) return NextResponse.json({ error: "subscriptionId مطلوب" }, { status: 400 });

  const r = await renewSubscription(subscriptionId, { userId: user.id });
  if (!r.ok) {
    const status = r.code === "insufficient_balance" ? 402 : r.code === "not_found" ? 404 : 409;
    return NextResponse.json({ error: r.code, message: r.message, price: r.price, balance: r.balance }, { status });
  }
  return NextResponse.json({ subscription: r.subscription, charged: r.charged, balance: r.balance });
}

// PATCH { subscriptionId, auto_renew } — turn automatic renewal on or off.
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const subscriptionId = String(body.subscriptionId || "");
  const autoRenew = Boolean(body.auto_renew);
  if (!subscriptionId) return NextResponse.json({ error: "subscriptionId مطلوب" }, { status: 400 });

  const { data: sub, error } = await supabaseAdmin.from("subscriptions")
    .update({ auto_renew: autoRenew, cancelled_at: autoRenew ? null : new Date().toISOString() })
    .eq("id", subscriptionId).eq("user_id", user.id)
    .select().single();
  if (error || !sub) return NextResponse.json({ error: "الاشتراك غير موجود" }, { status: 404 });

  await notify(user.id,
    autoRenew ? "تم تفعيل التجديد التلقائي" : "تم إيقاف التجديد التلقائي",
    autoRenew
      ? `سيتم تجديد اشتراك ${productLabel(sub.product)} تلقائياً من محفظتك عند انتهاء المدة.`
      : `لن يتم تجديد اشتراك ${productLabel(sub.product)} تلقائياً. سيظل فعّالاً حتى نهاية المدة الحالية.`);

  return NextResponse.json({ subscription: sub });
}
