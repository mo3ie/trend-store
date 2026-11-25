import { createClient } from "@supabase/supabase-js";
import { creditWallet, debitWallet } from "@/lib/wallet";
import { notifyUser } from "@/lib/notify";

/**
 * «سوق المستعمل بضمان» — used-device marketplace with the store as escrow.
 *
 * Money flow (all through the atomic wallet):
 *   buy      → buyer's wallet is debited; the money is HELD by the store (order.status = held)
 *   handover → seller marks the device delivered; buyer has `protection_days` to check it
 *   confirm  → buyer confirms (or the window lapses) → seller is credited price − commission
 *   dispute  → frozen until an admin releases to the seller or refunds the buyer
 *   cancel   → seller backs out before handover → full refund to the buyer
 */
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const CONDITIONS: Record<string, string> = { like_new: "كالجديد", good: "جيد", fair: "مقبول", parts: "قطع غيار / عطلان" };
export const DELIVERY: Record<string, string> = { store: "التسليم والفحص في المحل", meet: "لقاء مباشر", courier: "توصيل" };
export const ORDER_STATUS: Record<string, string> = {
  held: "مدفوع — المبلغ محجوز عند ترند", handed_over: "تم التسليم — فترة الفحص", completed: "مكتمل — تم تحويل المبلغ للبائع",
  disputed: "في نزاع — الإدارة تراجع", refunded: "مسترجع للمشتري", cancelled: "ملغي",
};

export async function settings() {
  const { data } = await db.from("market_settings").select("*").eq("id", 1).maybeSingle();
  return { commission_pct: Number(data?.commission_pct ?? 5), protection_days: Number(data?.protection_days ?? 3), min_price: Number(data?.min_price ?? 20) };
}

type Order = { id: string; listing_id: string; buyer_id: string; seller_id: string; price: number; seller_payout: number; status: string; timeline: unknown[] };

const step = (o: Order, what: string, by: string) => [...(Array.isArray(o.timeline) ? o.timeline : []), { at: new Date().toISOString(), what, by }];

async function notify(userId: string, title: string, body: string, link: string) {
  await notifyUser(userId, { type: "market", title, body, link });
}

async function txLog(userId: string, amount: number, type: "credit" | "debit", note: string) {
  await db.from("wallet_transactions").insert({ user_id: userId, amount, type, method: "market", status: "completed", note });
}

export async function buy(listingId: string, buyerId: string, delivery: string) {
  if (!DELIVERY[delivery]) throw new Error("طريقة تسليم غير صالحة");
  // 1) reserve the listing atomically (only one buyer can win it)
  const { data: l } = await db.from("market_listings").update({ status: "reserved", updated_at: new Date().toISOString() })
    .eq("id", listingId).eq("status", "active").neq("seller_id", buyerId).select("id,seller_id,price,title").maybeSingle();
  if (!l) throw new Error("الإعلان غير متاح (تم بيعه أو حجزه، أو هو إعلانك)");
  const s = await settings();
  const price = Number(l.price);
  const commission = Math.round(price * s.commission_pct) / 100;
  // 2) take the money into escrow
  const bal = await debitWallet(buyerId, price);
  if (bal === null) {
    await db.from("market_listings").update({ status: "active" }).eq("id", listingId).eq("status", "reserved");
    throw new Error("INSUFFICIENT");
  }
  const { data: o, error } = await db.from("market_orders").insert({
    listing_id: l.id, buyer_id: buyerId, seller_id: l.seller_id, price, commission, seller_payout: price - commission, delivery,
    status: "held", timeline: [{ at: new Date().toISOString(), what: "تم الدفع وحجز المبلغ عند ترند", by: "buyer" }],
  }).select("id").single();
  if (error || !o) {
    await creditWallet(buyerId, price); // never keep money without an order
    await db.from("market_listings").update({ status: "active" }).eq("id", listingId);
    throw new Error("تعذّر إنشاء الطلب — رجّعنا المبلغ لمحفظتك");
  }
  await txLog(buyerId, price, "debit", `شراء من سوق المستعمل (محجوز): ${l.title}`);
  await notify(l.seller_id, "🛒 جهازك انباع!", `«${l.title}» — المبلغ محجوز عند ترند. سلّم الجهاز واضغط «تم التسليم».`, `/market/order/${o.id}`);
  return { orderId: o.id, balance: bal };
}

async function release(o: Order, by: string, note: string) {
  const { data: upd } = await db.from("market_orders").update({ status: "completed", timeline: step(o, note, by), updated_at: new Date().toISOString() })
    .eq("id", o.id).in("status", ["held", "handed_over", "disputed"]).select("id");
  if (!upd?.length) throw new Error("حالة الطلب تغيّرت");
  await creditWallet(o.seller_id, Number(o.seller_payout));
  await txLog(o.seller_id, Number(o.seller_payout), "credit", "مبيعات سوق المستعمل (بعد العمولة)");
  await db.from("market_listings").update({ status: "sold" }).eq("id", o.listing_id);
  await notify(o.seller_id, "💰 وصلك مبلغ البيع", `${o.seller_payout} د.ل انضافت لمحفظتك.`, `/market/order/${o.id}`);
}

async function refund(o: Order, by: string, note: string, relist: boolean) {
  const { data: upd } = await db.from("market_orders").update({ status: o.status === "held" && by === "seller" ? "cancelled" : "refunded", timeline: step(o, note, by), updated_at: new Date().toISOString() })
    .eq("id", o.id).in("status", ["held", "handed_over", "disputed"]).select("id");
  if (!upd?.length) throw new Error("حالة الطلب تغيّرت");
  await creditWallet(o.buyer_id, Number(o.price));
  await txLog(o.buyer_id, Number(o.price), "credit", "استرجاع مبلغ من سوق المستعمل");
  await db.from("market_listings").update({ status: relist ? "active" : "removed" }).eq("id", o.listing_id);
  await notify(o.buyer_id, "↩️ رجعلك المبلغ", `${o.price} د.ل رجعت لمحفظتك.`, `/market/order/${o.id}`);
}

export async function getOrder(id: string) {
  const { data } = await db.from("market_orders").select("*").eq("id", id).maybeSingle();
  return data as (Order & Record<string, unknown>) | null;
}

/** Applies the protection window lazily (also run by the daily cron). */
export async function autoComplete(o: Order & { confirm_deadline?: string | null }) {
  if (o.status === "handed_over" && o.confirm_deadline && new Date(o.confirm_deadline) < new Date()) {
    await release(o, "system", "انتهت فترة الفحص بدون اعتراض — تحويل تلقائي للبائع").catch(() => {});
    return true;
  }
  return false;
}

export async function act(orderId: string, userId: string, isAdmin: boolean, action: string, text?: string) {
  const o = await getOrder(orderId);
  if (!o) throw new Error("الطلب غير موجود");
  const isBuyer = o.buyer_id === userId, isSeller = o.seller_id === userId;
  if (!isBuyer && !isSeller && !isAdmin) throw new Error("غير مصرّح");
  const s = await settings();

  switch (action) {
    case "handover": {
      if (!isSeller && !isAdmin) throw new Error("البائع فقط");
      if (o.status !== "held") throw new Error("لا يمكن الآن");
      const deadline = new Date(Date.now() + s.protection_days * 864e5).toISOString();
      await db.from("market_orders").update({ status: "handed_over", confirm_deadline: deadline, timeline: step(o, "البائع سلّم الجهاز — بدأت فترة الفحص", isAdmin ? "admin" : "seller") }).eq("id", o.id).eq("status", "held");
      await notify(o.buyer_id, "📦 استلمت الجهاز؟", `افحصه وأكّد الاستلام خلال ${s.protection_days} أيام، أو افتح نزاع لو فيه مشكلة.`, `/market/order/${o.id}`);
      return;
    }
    case "confirm":
      if (!isBuyer && !isAdmin) throw new Error("المشتري فقط");
      if (!["held", "handed_over"].includes(o.status)) throw new Error("لا يمكن الآن");
      return release(o, isAdmin ? "admin" : "buyer", "المشتري أكّد الاستلام — تم تحويل المبلغ للبائع");
    case "dispute":
      if (!isBuyer) throw new Error("المشتري فقط");
      if (!["held", "handed_over"].includes(o.status)) throw new Error("لا يمكن الآن");
      if (!text?.trim()) throw new Error("اكتب سبب النزاع");
      await db.from("market_orders").update({ status: "disputed", dispute_reason: text.slice(0, 1000), timeline: step(o, `نزاع: ${text.slice(0, 200)}`, "buyer") }).eq("id", o.id);
      await notify(o.seller_id, "⚠️ المشتري فتح نزاع", "المبلغ مجمّد لين الإدارة تراجع.", `/market/order/${o.id}`);
      return;
    case "cancel":
      if (!isSeller) throw new Error("البائع فقط");
      if (o.status !== "held") throw new Error("ما تقدرش تلغي بعد التسليم");
      return refund(o, "seller", "البائع ألغى البيع — رجع المبلغ للمشتري", true);
    case "resolve_release":
      if (!isAdmin) throw new Error("الإدارة فقط");
      return release(o, "admin", `قرار الإدارة: تحويل للبائع${text ? " — " + text : ""}`);
    case "resolve_refund":
      if (!isAdmin) throw new Error("الإدارة فقط");
      return refund(o, "admin", `قرار الإدارة: استرجاع للمشتري${text ? " — " + text : ""}`, false);
    case "message": {
      const body = (text || "").trim().slice(0, 1000);
      if (!body) throw new Error("رسالة فارغة");
      await db.from("market_messages").insert({ order_id: o.id, sender_id: userId, is_admin: isAdmin && !isBuyer && !isSeller, body });
      const to = isBuyer ? o.seller_id : o.buyer_id;
      if (isBuyer || isSeller) await notify(to, "💬 رسالة جديدة في طلب السوق", body.slice(0, 80), `/market/order/${o.id}`);
      return;
    }
    default:
      throw new Error("إجراء غير معروف");
  }
}

export function maskName(full: string | null | undefined) {
  const p = String(full || "").trim().split(/\s+/).filter(Boolean);
  return p.length ? (p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]) : "بائع ترند";
}
