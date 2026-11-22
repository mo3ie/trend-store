import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(auth.slice(7));
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

// Payment states an admin may set on a store order. "awaiting_verification"
// is what a Moamalat return records until someone checks the merchant portal
// (or the signed webhook confirms it); the admin resolves it to paid/failed.
// Setting "paid" fires the POS trigger that books the sale — exactly as an
// electronic payment would.
const PAYMENT_STATES = ["pending", "awaiting_verification", "paid", "failed", "refunded"];

// PATCH — update order status and/or payment status (admin only)
// body: { table: "store" | "shein", id: string, status?: string, payment_status?: string }
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { table, id, status, payment_status } = await req.json();
  if (!id || (!status && !payment_status)) {
    return NextResponse.json({ error: "id و status أو payment_status مطلوبة" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (status) updates.status = status;
  if (payment_status) {
    if (table === "shein" || !PAYMENT_STATES.includes(payment_status)) {
      return NextResponse.json({ error: "حالة دفع غير صالحة" }, { status: 400 });
    }
    updates.payment_status = payment_status;
  }

  const tableName = table === "shein" ? "orders" : "store_orders";
  const { error } = await supabaseAdmin.from(tableName).update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
