import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getUser } from "@/lib/apiAuth";
import * as yusor from "@/lib/yusor";
import * as masarafi from "@/lib/masarafi";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PROVIDERS = { yusor, masarafi } as const;

// POST /api/wallet/bank-topup  { provider: "yusor"|"masarafi", amount, identityCard }
// Opens a bank sale session (the bank texts the customer an OTP) for a wallet
// top-up. The session token is stored on the pending wallet transaction, so the
// confirm step charges exactly this amount — never one sent by the browser.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const { provider, amount, identityCard } = await req.json().catch(() => ({}));
  if (provider !== "yusor" && provider !== "masarafi") return NextResponse.json({ error: "طريقة دفع غير معروفة" }, { status: 400 });
  const amt = Math.round(parseFloat(amount));
  if (!amt || amt < 10) return NextResponse.json({ error: "الحد الأدنى للشحن 10 د.ل" }, { status: 400 });
  if (amt > 20000) return NextResponse.json({ error: "الحد الأقصى للشحن 20000 د.ل" }, { status: 400 });
  const card = String(identityCard || "").replace(/\D/g, "");
  if (card.length < 9) return NextResponse.json({ error: "رقم البطاقة يجب أن يكون 9 أرقام على الأقل" }, { status: 400 });

  const { data: tx, error: txErr } = await db.from("wallet_transactions").insert({
    user_id: user.id, amount: amt, type: "credit", method: provider, status: "pending",
    note: `شحن محفظة عبر ${provider === "yusor" ? "يسر باي" : "مصرفي باي"}`,
  }).select("id").single();
  if (txErr || !tx) return NextResponse.json({ error: txErr?.message || "تعذّر إنشاء العملية" }, { status: 500 });

  try {
    const api = PROVIDERS[provider as keyof typeof PROVIDERS];
    const { token: signinToken } = await api.signin();
    const transactionId = randomUUID();
    const { token, validTo } = await api.openSession(signinToken, { amount: amt, identityCard: card, transactionId });
    await db.from("wallet_transactions").update({ reference: JSON.stringify({ token, transactionId, validTo }) }).eq("id", tx.id);
    return NextResponse.json({ success: true, txId: tx.id });
  } catch (err) {
    await db.from("wallet_transactions").update({ status: "failed" }).eq("id", tx.id);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
