import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getSupabaseUser(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseUser(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("store_orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseUser(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const body = await req.json();
    const { items, total, address, phone, note, notes, address_text, payment_method } = body;

    if (!items?.length || !total) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("store_orders").insert({
      user_id: user.id,
      items,
      total,
      address: address || address_text || null,
      address_text: address_text || address || null,
      phone: phone || null,
      notes: notes || note || null,
      payment_method: payment_method || null,
      payment_status: "pending",
      status: "pending",
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "خطأ في إنشاء الطلب" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseUser(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  try {
    const { id, payment_status, dpay_session_id, status } = await req.json();
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (payment_status !== undefined) updates.payment_status = payment_status;
    if (dpay_session_id !== undefined) updates.dpay_session_id = dpay_session_id;
    if (status !== undefined) updates.status = status;

    const { error } = await supabaseAdmin
      .from("store_orders")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطأ في تحديث الطلب" }, { status: 500 });
  }
}
