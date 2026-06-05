import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest } from "next/server";

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: employees } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("role", "employee");

  const ids = (employees || []).map((e: any) => e.id);
  let permsData: any[] = [];
  if (ids.length > 0) {
    const { data } = await supabaseAdmin
      .from("employee_permissions")
      .select("*")
      .in("user_id", ids);
    permsData = data || [];
  }

  const result = (employees || []).map((emp: any) => ({
    ...emp,
    permissions: permsData.find((p: any) => p.user_id === emp.id) || null,
  }));

  return Response.json({ data: result });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { email, full_name, password } = await req.json();
  if (!email || !full_name || !password) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError) return Response.json({ error: createError.message }, { status: 400 });

  await supabaseAdmin.from("profiles").upsert({
    id: newUser.user.id,
    full_name,
    role: "employee",
  });

  await supabaseAdmin.from("employee_permissions").insert({
    user_id: newUser.user.id,
    shein_view_orders: true,
    shein_change_status: true,
    shein_delete_orders: false,
    shein_set_shipping: true,
    shein_edit_exchange_rate: false,
    store_view_orders: true,
    store_manage_products: false,
    store_view_customers: false,
  });

  return Response.json({ success: true, id: newUser.user.id });
}
