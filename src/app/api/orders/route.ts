import { createClient } from "@supabase/supabase-js";
import { saleState, SALE_LOCK_MESSAGE, type SaleSettings } from "@/lib/sale";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { notifyUser, NOTICES } from "@/lib/notify";

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
    const { items, address, note, notes, address_text, payment_method } = body;

    if (!Array.isArray(items) || !items.length || items.length > 100) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    // Offer day («الجمعة البيضاء»): ordering opens at the configured time. This is the only
    // route that creates a store order, so every payment method is held back here.
    const { data: st } = await supabaseAdmin.from("store_settings").select("data").eq("id", 1).maybeSingle();
    const saleCfg = (st?.data as { sale?: SaleSettings } | null)?.sale;
    const sale = saleState(saleCfg);
    if (sale.locked && sale.opensAt) {
      return NextResponse.json({ error: SALE_LOCK_MESSAGE(sale.opensAt), opensAt: new Date(sale.opensAt).toISOString() }, { status: 423 });
    }

    // Price every line from the products table. The browser's prices and total
    // are never trusted: every payment route charges this stored total, so a
    // total typed into the request would otherwise be the amount charged.
    const ids = [...new Set(items.map((i: { id?: unknown }) => String(i?.id ?? "")))];
    const { data: prods, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, price, old_price, image_url")
      .in("id", ids);
    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });
    const byId = new Map((prods ?? []).map((p) => [String(p.id), p]));

    const lines: Record<string, unknown>[] = [];
    let sum = 0;
    for (const it of items) {
      const p = byId.get(String(it?.id ?? ""));
      if (!p) return NextResponse.json({ error: "أحد المنتجات لم يعد متوفراً، حدّث السلة" }, { status: 400 });
      const qty = Math.floor(Number(it.quantity));
      if (!(qty >= 1 && qty <= 999)) return NextResponse.json({ error: "كمية غير صحيحة" }, { status: 400 });
      const price = Number(p.price);
      sum += price * qty;
      lines.push({ id: p.id, name: p.name, price, quantity: qty, image_url: p.image_url ?? it.image_url ?? null, variants: it.variants ?? undefined });
    }
    const total = Math.round(sum * 100) / 100;
    if (!(total > 0)) return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });

    // Offer rule: ONE piece per customer of each discounted product (old_price > price)
    // while the offer is on — counted across variants, this cart and earlier orders.
    if (sale.on && saleCfg?.limitOne !== false) {
      const discounted = new Map<string, { name: string; qty: number }>();
      for (const it of items) {
        const p = byId.get(String(it?.id ?? ""));
        if (!p || !(Number(p.old_price) > Number(p.price))) continue;
        const cur = discounted.get(String(p.id)) ?? { name: p.name, qty: 0 };
        cur.qty += Math.floor(Number(it.quantity));
        discounted.set(String(p.id), cur);
      }
      const over = [...discounted.values()].find((d) => d.qty > 1);
      if (over) return NextResponse.json({ error: `عروض الجمعة: قطعة واحدة فقط لكل زبون من «${over.name}» بسعر التخفيض. عدّل الكمية إلى 1.` }, { status: 409 });

      if (discounted.size) {
        // Earlier orders during the offer that really count: paid ones, cash-on-delivery,
        // and an electronic payment still in progress (≤15 min). A failed/abandoned
        // electronic payment never blocks the customer from trying again.
        const since = sale.opensAt ? new Date(Math.min(sale.opensAt, Date.now() - 3600_000)).toISOString() : new Date(Date.now() - 24 * 3600_000).toISOString();
        const fresh = Date.now() - 15 * 60_000;
        const { data: prev } = await supabaseAdmin.from("store_orders")
          .select("products, payment_method, payment_status, status, created_at")
          .eq("user_id", user.id).is("deleted_at", null).gte("created_at", since).limit(200);
        for (const o of prev ?? []) {
          if (["cancelled", "canceled", "rejected", "refunded"].includes(String(o.status))) continue;
          const counts = o.payment_status === "paid" || o.payment_method === "cash" || new Date(o.created_at).getTime() >= fresh;
          if (!counts) continue;
          for (const l of (Array.isArray(o.products) ? o.products : []) as { id?: unknown }[]) {
            const d = discounted.get(String(l?.id ?? ""));
            if (!d) continue;
            const inProgress = o.payment_status !== "paid" && o.payment_method !== "cash";
            return NextResponse.json({ error: inProgress
              ? `لديك طلب قيد الدفع فيه «${d.name}». أكمل دفعه، أو انتظر 15 دقيقة ثم أعد المحاولة.`
              : `عروض الجمعة: سبق أن اشتريت «${d.name}» بسعر التخفيض — قطعة واحدة فقط لكل زبون. احذفه من السلة لإكمال طلبك.` }, { status: 409 });
          }
        }
      }
    }

    const { data, error } = await supabaseAdmin.from("store_orders").insert({
      user_id: user.id,
      products: lines,
      total,
      address_text: address_text || address || null,
      notes: notes || note || null,
      payment_method: payment_method || null,
      payment_status: "pending",
      status: "pending",
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await notifyUser(user.id, NOTICES.orderPlaced(String(data.id), total));
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
    const { id, status } = await req.json();
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    // A customer may only cancel their own order. payment_status and the
    // payment session are written by the payment routes alone: letting the
    // browser set them meant any customer could mark an order "paid".
    if (status !== "cancelled") return NextResponse.json({ error: "تعديل غير مسموح" }, { status: 403 });
    const updates: Record<string, unknown> = { status };

    const { error } = await supabaseAdmin
      .from("store_orders")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .neq("payment_status", "paid");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطأ في تحديث الطلب" }, { status: 500 });
  }
}
