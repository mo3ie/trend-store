import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { analyzeDeep } from "@/lib/deepReport";
import { notifyUser } from "@/lib/notify";

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

  const report = await analyzeDeep({ scan, technician_notes: body.notes || null }, "usb");

  const { data, error } = await db.from("device_reports").insert({
    user_id: voucher?.user_id || null,
    device: { platform: "ios", os: "iOS", osVersion: scan.device.ios, model: scan.device.model, deep: true, source: "usb" },
    results: { deep: scan, customer: body.customer || null, notes: body.notes || null },
    score: Math.round(Number(report.score) || 0), ai_report: JSON.stringify(report),
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message || "تعذّر الحفظ" }, { status: 500 });
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.trendstore-ly.com";
  if (voucher) {
    await db.from("deep_scan_vouchers").update({ status: "used", report_id: data.id, used_at: new Date().toISOString() }).eq("id", voucher.id).eq("status", "paid");
    await notifyUser(voucher.user_id, { type: "diagnose", important: true, title: "🔬 شهادة الفحص العميق جاهزة", body: `تقييم جهازك: ${Math.round(Number(report.score) || 0)}/100`, link: `/diagnose/r/${data.id}` });
  }
  return NextResponse.json({ id: data.id, url: `${base}/diagnose/r/${data.id}`, score: Math.round(Number(report.score) || 0) });
}
