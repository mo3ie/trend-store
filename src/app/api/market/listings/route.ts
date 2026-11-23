import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { db, settings, CONDITIONS } from "@/lib/market";

// GET: public browse of active listings (?q ?category ?condition ?min ?max ?sort=new|cheap|expensive ?mine=1)
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("mine")) {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
    const { data } = await db.from("market_listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    return NextResponse.json({ listings: data || [] });
  }
  let q = db.from("market_listings").select("id,title,category,brand,model,storage,condition,battery_health,price,images,city,diag_report_id,created_at,status")
    .in("status", ["active", "reserved"]).limit(120);
  const text = (p.get("q") || "").trim().replace(/[%,()]/g, " ");
  if (text) q = q.or(`title.ilike.%${text}%,brand.ilike.%${text}%,model.ilike.%${text}%`);
  if (p.get("category")) q = q.eq("category", p.get("category")!);
  if (p.get("condition") && CONDITIONS[p.get("condition")!]) q = q.eq("condition", p.get("condition")!);
  if (Number(p.get("min")) > 0) q = q.gte("price", Number(p.get("min")));
  if (Number(p.get("max")) > 0) q = q.lte("price", Number(p.get("max")));
  const sort = p.get("sort");
  q = sort === "cheap" ? q.order("price") : sort === "expensive" ? q.order("price", { ascending: false }) : q.order("created_at", { ascending: false });
  const { data } = await q;
  return NextResponse.json({ listings: data || [] });
}

// POST: create a listing (goes to admin review first)
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول باش تبيع" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const s = await settings();
  const title = String(b.title || "").trim().slice(0, 100);
  const price = Math.round(Number(b.price));
  const images = (Array.isArray(b.images) ? b.images : []).filter((u: unknown) => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 8);
  if (title.length < 3) return NextResponse.json({ error: "اكتب اسم الجهاز" }, { status: 400 });
  if (!(price >= s.min_price)) return NextResponse.json({ error: `أقل سعر ${s.min_price} د.ل` }, { status: 400 });
  if (!CONDITIONS[b.condition]) return NextResponse.json({ error: "اختر حالة الجهاز" }, { status: 400 });
  if (images.length < 2) return NextResponse.json({ error: "ارفع صورتين على الأقل للجهاز" }, { status: 400 });
  const { count } = await db.from("market_listings").select("id", { count: "exact", head: true }).eq("seller_id", user.id).in("status", ["pending", "active"]);
  if ((count || 0) >= 10) return NextResponse.json({ error: "عندك 10 إعلانات نشطة — احذف واحد قبل ما تضيف" }, { status: 429 });
  const bh = Number(b.battery_health);
  const { data, error } = await db.from("market_listings").insert({
    seller_id: user.id, title, price, images, condition: b.condition,
    category: String(b.category || "هواتف").slice(0, 40), brand: String(b.brand || "").slice(0, 40) || null, model: String(b.model || "").slice(0, 60) || null,
    storage: String(b.storage || "").slice(0, 20) || null, color: String(b.color || "").slice(0, 30) || null,
    battery_health: bh >= 1 && bh <= 100 ? Math.round(bh) : null, description: String(b.description || "").slice(0, 2000) || null,
    city: String(b.city || "").slice(0, 40) || null, diag_report_id: /^[0-9a-f-]{36}$/i.test(b.diag_report_id || "") ? b.diag_report_id : null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}

