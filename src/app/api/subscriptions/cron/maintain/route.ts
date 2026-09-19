import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { REMINDER_DAYS, notify, productLabel, renewSubscription } from "@/lib/subscriptionBilling";

/**
 * Daily subscription maintenance (Vercel cron, 07:00 UTC).
 *
 * Two passes:
 *   1. Terms that have run out — auto-renew them if the user asked for it and the
 *      wallet covers it, otherwise mark them `expired`.
 *   2. Terms running out soon — one reminder per 7 / 3 / 1-day bucket.
 *
 * Entitlement checks already ignore a past `expires_at` (see lib/entitlements), so
 * this job never *grants* access it shouldn't — it materialises the status so the
 * user, the admin dashboard and the reminders all agree.
 */
export async function GET(req: NextRequest) {
  // FAIL CLOSED: a missing CRON_SECRET must never leave this endpoint open.
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return new NextResponse("Cron secret not configured", { status: 503 });
  if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const nowIso = new Date().toISOString();
  let renewed = 0, expired = 0, reminded = 0;

  // ---- Pass 1: expired terms -------------------------------------------------
  const { data: due } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, product, tier, auto_renew")
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lte("expires_at", nowIso)
    .limit(500);

  for (const s of due || []) {
    const label = productLabel(s.product);

    if (s.auto_renew) {
      const r = await renewSubscription(s.id);
      if (r.ok) {
        renewed++;
        await notify(s.user_id, "تم تجديد اشتراكك",
          `تم تجديد اشتراك ${label} تلقائياً وخُصم ${r.charged.toLocaleString()} د.ل من محفظتك.`, "success");
        continue;
      }
      // Auto-renew failed (empty wallet or a plan that was pulled) — expire and say why.
      await supabaseAdmin.from("subscriptions")
        .update({ status: "expired" }).eq("id", s.id);
      expired++;
      await notify(s.user_id, "تعذّر التجديد التلقائي",
        `انتهى اشتراك ${label}: ${r.message}. اشحن محفظتك وجدّد الاشتراك للاستمرار.`, "warning");
      continue;
    }

    await supabaseAdmin.from("subscriptions").update({ status: "expired" }).eq("id", s.id);
    expired++;
    await notify(s.user_id, "انتهى اشتراكك",
      `انتهت صلاحية اشتراك ${label}. جدّد الآن لاستعادة المزايا.`, "warning");
  }

  // ---- Pass 2: near-expiry reminders ----------------------------------------
  const horizon = new Date(Date.now() + REMINDER_DAYS[0] * 86400000).toISOString();
  const { data: soon } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, product, expires_at, auto_renew, reminder_stage")
    .eq("status", "active")
    .not("expires_at", "is", null)
    .gt("expires_at", nowIso)
    .lte("expires_at", horizon)
    .limit(500);

  for (const s of soon || []) {
    const daysLeft = Math.max(1, Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / 86400000));
    // The tightest bucket this row currently falls into (5 days left → the 7-day bucket).
    const bucket = REMINDER_DAYS.filter((d) => daysLeft <= d).pop();
    if (bucket === undefined) continue;
    if (bucket >= (s.reminder_stage ?? 99)) continue;   // already warned at this bucket or tighter

    const label = productLabel(s.product);
    await notify(s.user_id, `اشتراكك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`,
      s.auto_renew
        ? `سيتم تجديد اشتراك ${label} تلقائياً عند الانتهاء — تأكد أن رصيد محفظتك يكفي.`
        : `اشتراك ${label} على وشك الانتهاء. جدّده الآن حتى لا تتوقف المزايا.`,
      daysLeft <= 1 ? "warning" : "info");
    await supabaseAdmin.from("subscriptions").update({ reminder_stage: bucket }).eq("id", s.id);
    reminded++;
  }

  return NextResponse.json({ ok: true, due: (due || []).length, renewed, expired, reminded });
}
