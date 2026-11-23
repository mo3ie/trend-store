import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/apiAuth";
import { creditWallet, debitWallet } from "@/lib/wallet";

/**
 * Paid deep USB scan (in the shop, via Trend POS). The customer buys a voucher
 * here (5 LYD from the wallet); the technician enters its code in POS and the
 * certificate lands in the customer's account.
 */
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const DEEP_SCAN_PRICE = Number(process.env.DEEP_SCAN_PRICE || 5);
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => "DS-" + Array.from(randomBytes(6), (x) => ALPH[x % ALPH.length]).join("");

export async function GET() {
  const user = await getUser().catch(() => null);
  if (!user) return NextResponse.json({ price: DEEP_SCAN_PRICE, signedIn: false, vouchers: [], reports: [] });
  const [{ data: vouchers }, { data: reports }] = await Promise.all([
    db.from("deep_scan_vouchers").select("code,status,created_at,used_at,report_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("device_reports").select("id,score,created_at,device").eq("user_id", user.id).eq("device->>deep", "true").order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({ price: DEEP_SCAN_PRICE, signedIn: true, vouchers: vouchers || [], reports: reports || [] });
}

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول" }, { status: 401 });
  const { count } = await db.from("deep_scan_vouchers").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "paid");
  if ((count || 0) >= 5) return NextResponse.json({ error: "عندك 5 أكواد غير مستعملة — استعملهم أولاً" }, { status: 409 });
  const bal = await debitWallet(user.id, DEEP_SCAN_PRICE);
  if (bal === null) return NextResponse.json({ error: "رصيد المحفظة غير كافي", code: "INSUFFICIENT" }, { status: 402 });
  const code = newCode();
  const { error } = await db.from("deep_scan_vouchers").insert({ user_id: user.id, code, amount: DEEP_SCAN_PRICE });
  if (error) { await creditWallet(user.id, DEEP_SCAN_PRICE); return NextResponse.json({ error: "تعذّر إصدار الكود — رجعنا المبلغ" }, { status: 500 }); }
  await db.from("wallet_transactions").insert({ user_id: user.id, amount: DEEP_SCAN_PRICE, type: "debit", method: "deep_scan", status: "completed", note: `فحص عميق للآيفون — ${code}` });
  return NextResponse.json({ success: true, code, balance: bal });
}
