import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";

/**
 * Deep (USB) iPhone scan from Trend POS → AI analysis → saved certificate.
 * Auth: shared key in `x-deep-key` (env DEEP_SCAN_KEY), set in the POS settings.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function keyOk(k: string | null) {
  const want = (process.env.DEEP_SCAN_KEY || "").trim();
  if (!want || !k) return false;
  const a = Buffer.from(k), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const SYSTEM = `أنت فني آيفون خبير في محل ترند (ليبيا). عندك نتائج فحص عميق بالكابل (قراءة مباشرة من الجهاز):
صحة البطارية ودوراتها، التخزين، وسجلات أعطال النظام (kernel panics) وأسبابها، وملاحظات الفني.
اكتب تقرير شهادة فحص بالعربي. اعتمد على البيانات فقط.
- البطارية أقل من 80% = تحتاج تبديل. 80-84% = ملاحظة.
- panics متكررة في آخر 30 يوم = مشكلة؛ فسّر السبب من نص الـ panic إن أمكن (مثلاً: missing sensor / thermalmonitord / watchdog / AppleSPU = غالباً قطعة أو كابل فلكس أو بطارية).
- التخزين ممتلئ (أقل من 5GB فاضي) = بطء.
- خطوات حل برمجية أولاً، ثم هل يحتاج صيانة.
أرجع JSON فقط:
{"score":0-100,"summary":"...","issues":[{"title":"...","severity":"low|medium|high","cause":"...","fixes":["..."],"needsRepair":false}],"tips":["..."],"products":[]}`;

export async function POST(req: NextRequest) {
  if (!keyOk(req.headers.get("x-deep-key"))) return NextResponse.json({ error: "مفتاح الربط غير صحيح" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const scan = body?.scan;
  if (!scan?.device) return NextResponse.json({ error: "بيانات الفحص ناقصة" }, { status: 400 });

  // Optional paid voucher bought on the site → the certificate goes to that customer's account.
  let voucher: { id: string; user_id: string } | null = null;
  const vcode = String(body.voucher || "").trim().toUpperCase();
  if (vcode) {
    const { data: v } = await db.from("deep_scan_vouchers").select("id,user_id,status").eq("code", vcode).maybeSingle();
    if (!v) return NextResponse.json({ error: "كود الفحص غير صحيح" }, { status: 404 });
    if (v.status !== "paid") return NextResponse.json({ error: "كود الفحص مستعمل من قبل" }, { status: 409 });
    voucher = v;
  }

  let report: Record<string, unknown> = {
    score: 0, summary: "", issues: [], tips: [], products: [],
  };
  if (hasAI()) {
    try {
      const raw = await aiComplete({ system: SYSTEM, user: JSON.stringify({ scan, technician_notes: body.notes || null }).slice(0, 8000) + "\nJSON فقط.", maxTokens: 1800, temperature: 0.2 });
      report = { ...report, ...parseJsonReply<Record<string, unknown>>(raw) };
    } catch { /* fall back to a data-only certificate */ }
  }
  const h = Number(scan.battery?.healthPct);
  if (!report.summary) report.summary = `فحص عميق: ${scan.device.model || "iPhone"} · iOS ${scan.device.ios || "-"} · البطارية ${isFinite(h) ? h + "%" : "غير معروفة"} · أعطال آخر 30 يوم: ${scan.panics?.last30d ?? 0}`;
  if (!report.score) report.score = Math.max(0, Math.min(100, (isFinite(h) ? h : 90) - (Number(scan.panics?.last30d) || 0) * 5));
  report.deep = true;

  const { data, error } = await db.from("device_reports").insert({
    user_id: voucher?.user_id || null,
    device: { platform: "ios", os: "iOS", osVersion: scan.device.ios, model: scan.device.model, deep: true },
    results: { deep: scan, customer: body.customer || null, notes: body.notes || null },
    score: Math.round(Number(report.score) || 0), ai_report: JSON.stringify(report),
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message || "تعذّر الحفظ" }, { status: 500 });
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.trendstore-ly.com";
  if (voucher) {
    await db.from("deep_scan_vouchers").update({ status: "used", report_id: data.id, used_at: new Date().toISOString() }).eq("id", voucher.id).eq("status", "paid");
    await db.from("notifications").insert({ user_id: voucher.user_id, type: "diagnose", title: "🔬 شهادة الفحص العميق جاهزة", body: `تقييم جهازك: ${Math.round(Number(report.score) || 0)}/100`, link: `/diagnose/r/${data.id}` });
  }
  return NextResponse.json({ id: data.id, url: `${base}/diagnose/r/${data.id}`, score: Math.round(Number(report.score) || 0) });
}
