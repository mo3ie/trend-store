import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getUser } from "@/lib/apiAuth";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUSES = ["new", "quoted", "in_progress", "ready", "delivered", "cancelled"];

// Create a maintenance request (public — customers).
export async function POST(req: NextRequest) {
  try {
    const { name, phone, device, fault, images } = await req.json();
    if (!phone || !device) {
      return NextResponse.json({ error: "رقم الهاتف ونوع الجهاز مطلوبان" }, { status: 400 });
    }
    const user = await getUser().catch(() => null);
    const { data, error } = await db.from("maintenance_requests").insert({
      user_id: user?.id ?? null,
      name: name || null,
      phone,
      device,
      fault: fault || null,
      images: Array.isArray(images) ? images.slice(0, 5) : [],
    }).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id });
  } catch {
    return NextResponse.json({ error: "خطأ في إنشاء الطلب" }, { status: 500 });
  }
}

// GET ?id=  -> single request (public tracking). No id -> admin list.
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const { data } = await db.from("maintenance_requests")
      .select("id, name, phone, device, fault, status, quote_price, technician, notes, created_at, updated_at")
      .eq("id", id).maybeSingle();
    if (!data) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    return NextResponse.json(data);
  }
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await db.from("maintenance_requests").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Update a request (admin/technician only).
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, status, quote_price, technician, notes } = await req.json();
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    updates.status = status;
  }
  if (quote_price !== undefined) updates.quote_price = quote_price === "" || quote_price === null ? null : Number(quote_price);
  if (technician !== undefined) updates.technician = technician || null;
  if (notes !== undefined) updates.notes = notes || null;

  const { error } = await db.from("maintenance_requests").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
