import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("user_addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { label, address_text, lat, lng, is_default } = await req.json();
  if (!address_text) return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });

  if (is_default) {
    await supabaseAdmin.from("user_addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error } = await supabaseAdmin
    .from("user_addresses")
    .insert({ user_id: user.id, label: label || "المنزل", address_text, lat, lng, is_default: !!is_default })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, label, address_text, lat, lng, is_default } = await req.json();

  if (is_default) {
    await supabaseAdmin.from("user_addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  const { data, error } = await supabaseAdmin
    .from("user_addresses")
    .update({ label, address_text, lat, lng, is_default: !!is_default })
    .eq("id", id).eq("user_id", user.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabaseAdmin
    .from("user_addresses").delete().eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
