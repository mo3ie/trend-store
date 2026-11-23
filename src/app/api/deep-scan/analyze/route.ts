import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/apiAuth";
import { analyzeDeep } from "@/lib/deepReport";
import { rateLimited } from "@/lib/catalog";

/**
 * Deep scan from the customer's own iPhone: the browser has already parsed the
 * Analytics files into a summary (raw logs never uploaded). Consumes one paid
 * voucher, adds the optional browser hardware test, and issues the certificate.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const n = (v: unknown, lo: number, hi: number) => { const x = Number(v); return isFinite(x) && x >= lo && x <= hi ? Math.round(x) : undefined; };
const s = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول" }, { status: 401 });
  if (rateLimited(`deepan:${user.id}`, 6, 60 * 60_000)) return NextResponse.json({ error: "محاولات كثيرة" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const a = body.analytics || {};

  // Sanitize everything that came from the browser.
  const analytics = {
    files: n(a.files, 0, 5000) ?? 0,
    device: { productType: s(a.device?.productType, 20), model: s(a.device?.model, 40), ios: s(a.device?.ios, 12) },
    battery: { healthPct: n(a.battery?.healthPct, 30, 100), cycles: n(a.battery?.cycles, 0, 5000), designMah: n(a.battery?.designMah, 500, 10000), fullMah: n(a.battery?.fullMah, 300, 10000) },
    panics: { total: n(a.panics?.total, 0, 10000) ?? 0, last30d: n(a.panics?.last30d, 0, 10000) ?? 0, reasons: (Array.isArray(a.panics?.reasons) ? a.panics.reasons : []).slice(0, 5).map((x: unknown) => s(x, 140)).filter(Boolean) },
    appCrashes: { total: n(a.appCrashes?.total, 0, 100000) ?? 0, top: (Array.isArray(a.appCrashes?.top) ? a.appCrashes.top : []).slice(0, 6).map((x: { app?: unknown; count?: unknown }) => ({ app: s(x.app, 40), count: n(x.count, 0, 100000) ?? 0 })) },
    jetsam: n(a.jetsam, 0, 100000) ?? 0,
    period: { from: s(a.period?.from, 10), to: s(a.period?.to, 10) },
  };
  const useful = analytics.battery.healthPct !== undefined || analytics.battery.cycles !== undefined || analytics.panics.total > 0 || analytics.appCrashes.total > 0 || analytics.jetsam > 0;

  // Optional browser hardware test done just before (must be this user's, < 24h old).
  let quick: Record<string, unknown> | null = null;
  if (/^[0-9a-f-]{36}$/i.test(body.quickReportId || "")) {
    const { data: q } = await db.from("device_reports").select("results,created_at,user_id,device").eq("id", body.quickReportId).maybeSingle();
    if (q && (!q.user_id || q.user_id === user.id) && Date.now() - new Date(q.created_at).getTime() < 864e5) quick = { results: (q.results as { results?: unknown })?.results || q.results, device: q.device };
  }
  if (!useful && !quick) return NextResponse.json({ error: "الملفات ما فيهاش بيانات كافية — جرّب ملف «Analytics» أحدث أو فعّل مشاركة التحليلات وارجع بعد يومين. ما خصمنا شي من كودك.", code: "NO_DATA" }, { status: 422 });

  const { data: v } = await db.from("deep_scan_vouchers").select("id,code").eq("user_id", user.id).eq("status", "paid").order("created_at").limit(1).maybeSingle();
  if (!v) return NextResponse.json({ error: "ما عندكش كود فحص مدفوع", code: "NO_VOUCHER" }, { status: 402 });

  const scan = {
    device: { model: analytics.device.model, ios: analytics.device.ios },
    battery: analytics.battery, storage: {},
    panics: analytics.panics, appCrashes: analytics.appCrashes, jetsam: analytics.jetsam,
    warnings: [], scannedAt: new Date().toISOString(), period: analytics.period, files: analytics.files,
  };
  const report = await analyzeDeep({ analytics: scan, browser_hardware_test: quick, answers: body.answers || null }, "analytics");

  const { data, error } = await db.from("device_reports").insert({
    user_id: user.id,
    device: { platform: "ios", os: "iOS", osVersion: analytics.device.ios, model: analytics.device.model || (quick?.device as { model?: string })?.model, deep: true, source: "analytics" },
    results: { deep: scan, quick, source: "analytics" },
    score: report.score, ai_report: JSON.stringify(report),
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "تعذّر حفظ الشهادة" }, { status: 500 });
  await db.from("deep_scan_vouchers").update({ status: "used", report_id: data.id, used_at: new Date().toISOString() }).eq("id", v.id).eq("status", "paid");
  return NextResponse.json({ success: true, id: data.id, score: report.score });
}
