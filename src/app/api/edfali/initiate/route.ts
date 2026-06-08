import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { doPTrans, normalizePhone } from "@/lib/adfali";

function getUser(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => req.cookies.get(n)?.value, set: () => {}, remove: () => {} } }
  ).auth.getUser();
}

// POST /api/edfali/initiate
// Body: { customerPhone, amount }
// Calls Adfali DoPTrans → sends OTP SMS to customer
// Returns: { sessionId }
export async function POST(req: NextRequest) {
  const { data: { user } } = await getUser(req);
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { customerPhone, amount } = await req.json();
  if (!customerPhone) return NextResponse.json({ error: "رقم الهاتف مطلوب" }, { status: 400 });
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

  const normalized = normalizePhone(customerPhone);
  console.log(`[edfali/initiate] phone: ${customerPhone} → normalized: ${normalized}, amount: ${amount}`);

  try {
    const sessionId = await doPTrans(customerPhone, Number(amount));
    return NextResponse.json({ sessionId });
  } catch (err: any) {
    console.error(`[edfali/initiate] error for phone ${normalized}:`, err.message);
    return NextResponse.json({ error: err.message, phone: normalized }, { status: 400 });
  }
}
