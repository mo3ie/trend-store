import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getUser(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => req.cookies.get(n)?.value, set: () => {}, remove: () => {} } }
  ).auth.getUser();
}

// Called by the success page when the Lightbox completeCallback sent the
// customer back with paid=1.
//
// That return is only the browser's word — anyone can type the URL — so it no
// longer marks the order "paid" (which books a POS sale and tells staff to
// deliver). It records "awaiting_verification" on the caller's own Moamalat
// order; only the signed server-to-server webhook (./webhook) sets "paid".
// Staff confirm the rest against the Moamalat merchant portal.
export async function POST(req: NextRequest) {
  try {
    const { data: { user } } = await getUser(req);
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId مطلوب" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("store_orders")
      .update({ payment_status: "awaiting_verification" })
      .eq("id", orderId)
      .eq("user_id", user.id)
      .eq("payment_method", "moamalat")
      .eq("payment_status", "pending");

    if (error) {
      console.error("[moamalat/confirm] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[moamalat/confirm] ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
