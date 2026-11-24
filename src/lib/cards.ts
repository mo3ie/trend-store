import { createClient } from "@supabase/supabase-js";
import { creditWallet, debitWallet } from "@/lib/wallet";
import { anisEnabled, anisOrder, anisRefusalAr } from "@/lib/anis";

/**
 * Digital cards (local top-ups + international gift cards).
 *
 * The supplier API is plugged in through ONE adapter (`provider()` below).
 * Until it is configured (CARDS_API_URL + CARDS_API_KEY), orders are paid and
 * then fulfilled MANUALLY by the admin (codes typed in /admin/cards), so the
 * store can sell cards today and switch to instant delivery the day the API
 * arrives — no UI change needed.
 */
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type CardCode = { code: string; serial?: string; pin?: string; expiry?: string };

export interface CardsProvider {
  name: string;
  /** Buy `qty` of a provider SKU; returns the codes or throws. `ref` is our order id (idempotency). */
  purchase(sku: string, qty: number, ref: string): Promise<{ codes: CardCode[]; providerRef?: string }>;
  /** Optional: current supplier balance, shown in admin. */
  balance?(): Promise<number | null>;
}

/**
 * Generic JSON adapter — adjust field names here once the supplier's docs arrive.
 * Expected: POST {url}/purchase { sku, qty, reference } → { codes:[{code,serial,pin,expiry}], id }
 */
function httpProvider(url: string, key: string): CardsProvider {
  return {
    name: process.env.CARDS_PROVIDER_NAME || "supplier",
    async purchase(sku, qty, ref) {
      const r = await fetch(`${url.replace(/\/$/, "")}/purchase`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ sku, qty, reference: ref }),
        cache: "no-store",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || d.error || `supplier_${r.status}`);
      const codes = (Array.isArray(d.codes) ? d.codes : []).map((c: Record<string, string>) => ({ code: String(c.code || c.pin || ""), serial: c.serial, pin: c.pin, expiry: c.expiry }));
      if (codes.length !== qty || codes.some((c: CardCode) => !c.code)) throw new Error("supplier returned incomplete codes");
      return { codes, providerRef: String(d.id || d.reference || "") };
    },
    async balance() {
      const r = await fetch(`${url.replace(/\/$/, "")}/balance`, { headers: { authorization: `Bearer ${key}` }, cache: "no-store" }).catch(() => null);
      if (!r?.ok) return null;
      const d = await r.json().catch(() => ({}));
      return Number(d.balance ?? NaN) || null;
    },
  };
}

export function provider(): CardsProvider | null {
  const url = (process.env.CARDS_API_URL || "").trim(), key = (process.env.CARDS_API_KEY || "").trim();
  return url && key ? httpProvider(url, key) : null;
}

async function notify(userId: string, title: string, body: string) {
  await db.from("notifications").insert({ user_id: userId, type: "cards", title, body, link: "/cards/orders" });
}

export async function buyCard(userId: string, productId: string, qty: number) {
  if (!(qty >= 1 && qty <= 10)) throw new Error("الكمية من 1 إلى 10");
  const { data: p } = await db.from("card_products").select("*").eq("id", productId).eq("active", true).maybeSingle();
  if (!p) throw new Error("الكرت غير متوفر");
  const total = Math.round(Number(p.price) * qty * 100) / 100;
  const bal = await debitWallet(userId, total);
  if (bal === null) throw new Error("INSUFFICIENT");
  const { data: o, error } = await db.from("card_orders").insert({ user_id: userId, card_product_id: p.id, qty, total, status: "pending" }).select("id").single();
  if (error || !o) { await creditWallet(userId, total); throw new Error("تعذّر إنشاء الطلب — رجّعنا المبلغ"); }
  await db.from("wallet_transactions").insert({ user_id: userId, amount: total, type: "debit", method: "cards", status: "completed", note: `شراء ${qty} × ${p.name}` });

  // Anis: signed + verified, resumable under our order id (never refunded unless Anis says "not placed").
  if (p.provider === "anis" && p.provider_sku && p.provider_cost && anisEnabled()) {
    if (Number(p.price) < Number(p.provider_cost)) { await refundCardOrder(o.id, "سعر البيع أقل من التكلفة", true); throw new Error("الكرت غير متاح حالياً — رجعلك المبلغ"); }
    await db.from("card_orders").update({ provider: "anis", provider_card_id: p.provider_sku, provider_cost: p.provider_cost, provider_state: "sent" }).eq("id", o.id);
    const r = await settleAnis(o.id, false);
    if (r === "notPlaced") throw new Error("تعذّر إصدار الكرت من المزوّد — رجعلك المبلغ لمحفظتك");
    return { orderId: o.id, status: r === "delivered" ? "delivered" : "pending", balance: bal };
  }

  const prov = provider();
  if (prov && p.provider_sku) {
    try {
      const r = await prov.purchase(p.provider_sku, qty, o.id);
      await db.from("card_orders").update({ status: "delivered", codes: r.codes, provider_ref: r.providerRef || null }).eq("id", o.id);
      await notify(userId, "🎫 وصلك الكرت", `${qty} × ${p.name} — الأكواد في «كروتي».`);
      return { orderId: o.id, status: "delivered", balance: bal };
    } catch (e) {
      // Supplier failed → never keep the customer's money.
      await refundCardOrder(o.id, `فشل المزوّد: ${(e as Error).message}`);
      throw new Error("تعذّر إصدار الكرت من المزوّد — رجعلك المبلغ لمحفظتك");
    }
  }
  return { orderId: o.id, status: "pending", balance: bal };
}

export async function refundCardOrder(orderId: string, reason: string, force = false) {
  if (!force) {
    const { data: chk } = await db.from("card_orders").select("provider,provider_state").eq("id", orderId).maybeSingle();
    if (chk?.provider === "anis" && !String(chk.provider_state || "").startsWith("notPlaced")) throw new Error("طلب عند المزوّد ولم يُحسم بعد — استعمل «تحديث من المزوّد» أولاً");
  }
  const { data: o } = await db.from("card_orders").update({ status: "refunded", error: reason.slice(0, 300) })
    .eq("id", orderId).in("status", ["pending", "failed"]).select("user_id,total").maybeSingle();
  if (!o) return false;
  await creditWallet(o.user_id, Number(o.total));
  await db.from("wallet_transactions").insert({ user_id: o.user_id, amount: o.total, type: "credit", method: "cards", status: "completed", note: "استرجاع طلب كرت" });
  await notify(o.user_id, "↩️ رجعلك مبلغ الكرت", `${o.total} د.ل رجعت لمحفظتك.`);
  return true;
}

export async function fulfillManually(orderId: string, codes: CardCode[]) {
  const { data: o } = await db.from("card_orders").select("user_id,qty,status,card_products(name)").eq("id", orderId).maybeSingle();
  if (!o || o.status !== "pending") throw new Error("الطلب غير قابل للتسليم");
  if (codes.length !== o.qty) throw new Error(`لازم ${o.qty} كود`);
  await db.from("card_orders").update({ status: "delivered", codes }).eq("id", orderId).eq("status", "pending");
  const name = (o.card_products as unknown as { name?: string } | null)?.name || "الكرت";
  await notify(o.user_id, "🎫 وصلك الكرت", `${o.qty} × ${name} — الأكواد في «كروتي».`);
}

/**
 * Push an Anis order to a final state. Safe to call repeatedly (same operation id + same stored request).
 * delivered → codes saved; notPlaced → refunded; pending → try again later (customer/admin page open).
 */
export async function settleAnis(orderId: string, resume = true): Promise<"delivered" | "notPlaced" | "pending"> {
  const { data: o } = await db.from("card_orders").select("id,user_id,qty,status,provider,provider_card_id,provider_cost,provider_tries,card_products(name)").eq("id", orderId).maybeSingle();
  if (!o || o.provider !== "anis" || o.status !== "pending" || !o.provider_card_id || !o.provider_cost) return "pending";
  await db.from("card_orders").update({ provider_tries: (o.provider_tries || 0) + 1, updated_at: new Date().toISOString() }).eq("id", orderId);
  const r = await anisOrder(o.id, { cardId: o.provider_card_id, qty: o.qty, unitCost: String(o.provider_cost) }, resume);
  if (r.kind === "delivered") {
    if (r.codes.length !== o.qty) { await db.from("card_orders").update({ provider_state: "count_mismatch" }).eq("id", orderId); return "pending"; }
    const { data: done } = await db.from("card_orders").update({ status: "delivered", codes: r.codes, provider_ref: r.invoiceId || null, provider_state: "completed" })
      .eq("id", orderId).eq("status", "pending").select("id").maybeSingle();
    const name = (o.card_products as unknown as { name?: string } | null)?.name || "الكرت";
    if (done) await notify(o.user_id, "🎫 وصلك الكرت", `${o.qty} × ${name} — الأكواد في «كروتي».`);
    return "delivered";
  }
  if (r.kind === "notPlaced") {
    await db.from("card_orders").update({ provider_state: `notPlaced:${r.code}` }).eq("id", orderId);
    await refundCardOrder(orderId, anisRefusalAr(r.code));
    return "notPlaced";
  }
  await db.from("card_orders").update({ provider_state: r.reason }).eq("id", orderId);
  return "pending";
}

/** Resume every unresolved Anis order (optionally for one customer). */
export async function settlePendingAnis(userId?: string) {
  if (!anisEnabled()) return 0;
  let q = db.from("card_orders").select("id").eq("provider", "anis").eq("status", "pending").order("created_at").limit(10);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  let n = 0;
  for (const r of data || []) if ((await settleAnis(r.id)) !== "pending") n++;
  return n;
}
