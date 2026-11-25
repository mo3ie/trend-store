import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/apiAuth";
import { creditWallet } from "@/lib/wallet";
import * as yusor from "@/lib/yusor";
import * as masarafi from "@/lib/masarafi";
import { notifyUser, NOTICES } from "@/lib/notify";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// POST /api/wallet/bank-confirm  { txId, otp }
// Completes the Yusor / Masarafi session with the customer's OTP and credits the wallet once.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { txId, otp } = await req.json().catch(() => ({}));
  if (!txId || !otp) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const { data: tx } = await db.from("wallet_transactions")
    .select("id, user_id, amount, status, method, reference")
    .eq("id", txId).eq("user_id", user.id).eq("status", "pending").single();
  if (!tx) return NextResponse.json({ error: "العملية غير موجودة أو مكتملة بالفعل" }, { status: 404 });
  if (tx.method !== "yusor" && tx.method !== "masarafi") return NextResponse.json({ error: "عملية غير صالحة" }, { status: 400 });

  let s: { token?: string; validTo?: string } = {};
  try { s = JSON.parse(tx.reference || "{}"); } catch {}
  if (!s.token) return NextResponse.json({ error: "لم تبدأ عملية الدفع لهذه العملية" }, { status: 400 });
  if (s.validTo && new Date(s.validTo) < new Date()) return NextResponse.json({ error: "انتهت صلاحية الجلسة، أعد المحاولة" }, { status: 400 });

  try {
    await (tx.method === "yusor" ? yusor : masarafi).completeSession(s.token, String(otp).trim());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  // Conditional on still pending → two confirms racing cannot credit twice.
  const { data: done } = await db.from("wallet_transactions").update({ status: "completed", reference: null })
    .eq("id", tx.id).eq("status", "pending").select("id");
  if (!done?.length) return NextResponse.json({ error: "العملية مكتملة بالفعل" }, { status: 409 });
  const newBalance = await creditWallet(user.id, tx.amount);
  await notifyUser(user.id, NOTICES.walletTopup(Number(tx.amount), newBalance));
  return NextResponse.json({ success: true, newBalance });
}
