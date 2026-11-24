import { NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { db, settlePendingAnis } from "@/lib/cards";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  await settlePendingAnis(user.id).catch(() => 0); // finish any order Anis was still processing
  const { data } = await db.from("card_orders").select("id,qty,total,status,codes,error,created_at,card_products(name,brand,face_value,image)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ orders: data || [] });
}
