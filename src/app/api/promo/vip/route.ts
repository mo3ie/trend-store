import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVipStatus } from "@/lib/adsPricing";
import { VIP_MONTHLY_LYD } from "@/services/campaigns";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function getUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// GET — the user's VIP status + wallet balance + price.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const [vip, wallet] = await Promise.all([
    getVipStatus(user.id),
    supabaseAdmin.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  return NextResponse.json({ ...vip, price: VIP_MONTHLY_LYD, balance: Number(wallet.data?.balance ?? 0) });
}

// POST — subscribe / renew VIP for a month, debiting the wallet (same wallets.balance
// the ads checkout uses). Extends from the later of now / current expiry.
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data: wallet } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  const balance = Number(wallet?.balance ?? 0);
  if (balance < VIP_MONTHLY_LYD) {
    return NextResponse.json({ error: "insufficient_balance", message: "رصيد المحفظة غير كافٍ", price: VIP_MONTHLY_LYD, balance }, { status: 402 });
  }

  // Debit wallet.
  await supabaseAdmin.from("wallets")
    .update({ balance: balance - VIP_MONTHLY_LYD, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  // Extend VIP.
  const { data: prof } = await supabaseAdmin
    .from("profiles").select("vip_until").eq("id", user.id).maybeSingle();
  const current = (prof as { vip_until?: string | null } | null)?.vip_until;
  const base = current && new Date(current).getTime() > Date.now() ? new Date(current).getTime() : Date.now();
  const until = new Date(base + MONTH_MS).toISOString();

  const { error } = await supabaseAdmin.from("profiles").update({ vip_until: until }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ vip: true, until, permanent: false, balance: balance - VIP_MONTHLY_LYD });
}
