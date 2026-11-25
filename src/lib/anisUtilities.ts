import { Money, type MeterCharge, type DirectRecharge } from "@anis-ly/partners";
import { createClient } from "@supabase/supabase-js";
import { anis, anisEnabled, anisWallet, anisRefusalAr } from "@/lib/anis";
import { creditWallet, debitWallet } from "@/lib/wallet";
import { notifyUser } from "@/lib/notify";

/**
 * Anis utilities sold from the customer's Trend wallet:
 *   • meter    — «خالص» electricity (GECOL) package → receipt with STS/KCT tokens
 *   • recharge — direct recharge (InstaPay / Vodafone Cash / USDT …), delivered by Anis staff (can take time)
 *
 * Money rules (from Anis docs):
 *   - operation id = utility_orders.id, saved with the exact request BEFORE sending; unknown → resume same id.
 *   - customer is refunded ONLY when Anis says nothing was charged or the money came back:
 *       notPlaced · meter failed + refund refunded/notCharged · recharge paymentFailed/rejectedWithRefund · partialRefund settled.
 *   - meter failed + refund pending / recharge rejectedAwaitingRefund → keep waiting, settle later.
 */
export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type UtilSettings = { meter_enabled: boolean; meter_markup_pct: number; meter_fee: number; recharge_enabled: boolean; recharge_markup_pct: number; recharge_fee: number };
export async function settings(): Promise<UtilSettings> {
  const { data } = await db.from("utility_settings").select("*").eq("id", 1).maybeSingle();
  const n = (v: unknown, d: number) => (isFinite(Number(v)) ? Number(v) : d);
  return {
    meter_enabled: !!data?.meter_enabled && anisEnabled(), meter_markup_pct: n(data?.meter_markup_pct, 0), meter_fee: n(data?.meter_fee, 0),
    recharge_enabled: !!data?.recharge_enabled && anisEnabled(), recharge_markup_pct: n(data?.recharge_markup_pct, 3), recharge_fee: n(data?.recharge_fee, 0),
  };
}
/** Customer price in LYD: cost + markup% + fee, rounded UP to 0.25, never below cost. */
export const sellPrice = (cost: number, pct: number, fee: number) => Math.max(cost, Math.ceil((cost * (1 + pct / 100) + fee) * 4) / 4);

const r3 = (x: number | string) => Number(x).toFixed(3);
async function notify(userId: string, title: string, body: string, kind: "meter" | "recharge" = "meter") {
  await notifyUser(userId, { type: "utilities", title, body, link: `${kind === "meter" ? "/electricity" : "/recharge"}?tab=orders` });
}

// ───────────────────────── catalogue ─────────────────────────
export async function meterPackages() {
  const c = await anis(), w = await anisWallet(), s = await settings();
  const out = [];
  for await (const p of c.meterCharges.getMeterPackages(w)) {
    const cost = Number(p.unitPrice.amount);
    out.push({ id: p.id, name: p.name, logo: p.logo || null, cost, retail: Number(p.personalPrice.amount), price: sellPrice(cost, s.meter_markup_pct, s.meter_fee) });
  }
  return out;
}

export async function rechargeProducts() {
  const c = await anis(), w = await anisWallet();
  const out = [];
  for await (const p of c.directRechargeProducts.getDirectRechargeProducts(w)) {
    if (!p.available || p.type !== "external") continue;
    out.push({ id: p.id, title: p.title, description: p.description || null, icon: p.category?.icon || null, currency: p.payoutCurrency.name,
      minPayout: p.limits?.minimumPayout || null, maxPayout: p.limits?.maximumPayout || null,
      minTotal: p.limits?.minimumTotal ? Number(p.limits.minimumTotal.amount) : null, maxTotal: p.limits?.maximumTotal ? Number(p.limits.maximumTotal.amount) : null });
  }
  return out;
}

export async function rechargeProduct(productId: string) {
  const c = await anis(), w = await anisWallet();
  const p = await c.directRechargeProducts.get(w, productId);
  const fields = [...p.recipientFields].filter((f) => f.for !== "sender" || f.kind !== "note").sort((a, b) => a.order - b.order);
  const lists: Record<string, { id: string; name: string }[]> = {};
  if (fields.some((f) => f.kind === "list")) {
    const locs: { id: string; name: string }[] = [];
    for await (const l of c.directRechargeProducts.getDirectRechargeProductLocations(w, productId)) { locs.push({ id: l.id, name: l.name }); if (locs.length >= 300) break; }
    for (const f of fields) if (f.kind === "list") lists[f.key] = locs;
  }
  return {
    id: p.id, title: p.title, currency: p.payoutCurrency.name, available: p.available,
    fields: fields.map((f) => ({ key: f.key, label: f.name?.ar || f.name?.en || f.key, kind: f.kind, required: f.kind !== "note", validation: f.validation || null, message: f.validationMessage?.ar || f.validationMessage?.en || null })),
    lists,
  };
}

export async function rechargeQuote(productId: string, amount: string, amountIn: "fx" | "lyd") {
  const c = await anis(), w = await anisWallet(), s = await settings();
  const q = await c.directRechargeProducts.quote(w, productId, Number(amount).toFixed(3), amountIn); // SDK needs fixed 3-decimal strings
  const cost = Number(q.total.amount);
  return { payout: q.payout.amount, currency: q.payout.currency.name, rate: q.exchangeRate, cost, price: sellPrice(cost, s.recharge_markup_pct, s.recharge_fee) };
}

// ───────────────────────── buying ─────────────────────────
async function open(userId: string, kind: "meter" | "recharge", price: number, row: Record<string, unknown>) {
  const bal = await debitWallet(userId, price);
  if (bal === null) throw new Error("INSUFFICIENT");
  const { data: o, error } = await db.from("utility_orders").insert({ user_id: userId, kind, price, ...row }).select("id").single();
  if (error || !o) { await creditWallet(userId, price); throw new Error("تعذّر إنشاء الطلب — رجّعنا المبلغ"); }
  await db.from("wallet_transactions").insert({ user_id: userId, amount: price, type: "debit", method: kind === "meter" ? "electricity" : "direct_recharge", status: "completed", note: `${kind === "meter" ? "شحن كهرباء" : "شحن مباشر"} — ${row.title}` });
  return { id: o.id as string, balance: bal };
}

export async function buyMeter(userId: string, packageId: string, meterNumber: string) {
  const s = await settings();
  if (!s.meter_enabled) throw new Error("الخدمة غير متاحة حالياً");
  const meter = String(meterNumber || "").replace(/\s+/g, "");
  if (!/^\d{6,20}$/.test(meter)) throw new Error("رقم العداد لازم يكون أرقام فقط (كما هو مكتوب على العداد)");
  const pkg = (await meterPackages()).find((p) => p.id === packageId);
  if (!pkg) throw new Error("الباقة غير متوفرة");
  const o = await open(userId, "meter", pkg.price, {
    cost: pkg.cost, title: pkg.name, target: meter,
    request: { packageId: pkg.id, meterNumber: meter, expectedTotal: r3(pkg.cost) },
  });
  const st = await settleUtility(o.id, false);
  return { orderId: o.id, status: st, balance: o.balance };
}

export async function buyRecharge(userId: string, productId: string, payoutAmount: string, quotedCost: number, recipient: { key: string; value: string }[]) {
  const s = await settings();
  if (!s.recharge_enabled) throw new Error("الخدمة غير متاحة حالياً");
  const prod = await rechargeProduct(productId);
  if (!prod.available) throw new Error("الخدمة غير متاحة حالياً");
  const vals = new Map(recipient.map((r) => [String(r.key), String(r.value ?? "").trim()]));
  const clean: { key: string; value: string }[] = [];
  for (const f of prod.fields) {
    if (f.kind === "note") continue;
    const v = vals.get(f.key) || "";
    if (!v) throw new Error(`${f.label} مطلوب`);
    if (f.validation) { let ok = true; try { ok = new RegExp(f.validation).test(v); } catch {} if (!ok) throw new Error(f.message || `${f.label} غير صحيح`); }
    if (f.kind === "list" && !(prod.lists[f.key] || []).some((l) => l.id === v)) throw new Error(`اختر ${f.label}`);
    clean.push({ key: f.key, value: v.slice(0, 200) });
  }
  const cost = Number(quotedCost);
  if (!(cost > 0)) throw new Error("احسب السعر أولاً");
  if (!/^\d+(\.\d{1,3})?$/.test(String(payoutAmount))) throw new Error("المبلغ غير صحيح");
  const payout = Number(payoutAmount).toFixed(3);
  // Our markup is applied to the cost Anis will verify (a tampered cost → Anis refuses with price_changed → refund).
  const price = sellPrice(cost, s.recharge_markup_pct, s.recharge_fee);
  const o = await open(userId, "recharge", price, {
    cost, title: `${prod.title} — ${payout} ${prod.currency}`, target: clean.map((c) => c.value).join(" · ").slice(0, 120),
    request: { productId, payoutAmount: payout, expectedTotal: r3(cost), recipient: clean },
  });
  const st = await settleUtility(o.id, false);
  return { orderId: o.id, status: st, balance: o.balance };
}

// ───────────────────────── settle / resume ─────────────────────────
type Row = { id: string; user_id: string; kind: "meter" | "recharge"; status: string; provider_status: string | null; request: Record<string, unknown>; cost: number; price: number; refunded: number; title: string; tries: number };

async function refund(o: Row, amount: number, why: string, final: "refunded" | "failed" | "succeeded") {
  const amt = Math.round(Math.min(amount, Number(o.price) - Number(o.refunded)) * 1000) / 1000;
  // Guarded update first so two settles can never refund twice.
  const { data: ok } = await db.from("utility_orders").update({ refunded: Number(o.refunded) + Math.max(0, amt), status: final, error: why.slice(0, 300), updated_at: new Date().toISOString() })
    .eq("id", o.id).eq("refunded", o.refunded).in("status", ["processing", "action_needed", "failed"]).select("id").maybeSingle();
  if (!ok || amt <= 0) return;
  await creditWallet(o.user_id, amt);
  await db.from("wallet_transactions").insert({ user_id: o.user_id, amount: amt, type: "credit", method: o.kind === "meter" ? "electricity" : "direct_recharge", status: "completed", note: `استرجاع — ${o.title}` });
  await notify(o.user_id, "↩️ رجعلك المبلغ", `${amt} د.ل رجعت لمحفظتك — ${why}`, o.kind);
}

function meterView(m: MeterCharge) {
  return {
    status: m.status, receiptNumber: m.receipt?.receiptNumber, creditedAmount: m.receipt?.creditedAmount,
    tokens: [...(m.receipt?.tokens || [])].sort((a, b) => a.sequence - b.sequence).map((t) => ({ sequence: t.sequence, label: t.label, code: t.code, description: t.description || null })),
    taxes: (m.receipt?.taxes || []).map((t) => ({ description: t.description, amount: t.amount })),
    failure: m.failure ? { code: m.failure.code, message: m.failure.message?.ar || m.failure.message?.en || null } : null,
    refund: m.refund ? { status: m.refund.status, amount: m.refund.amount?.amount || null } : null,
    completedAt: m.completedAt?.toISOString() || null,
  };
}
function rechargeView(d: DirectRecharge) {
  return {
    status: d.status, number: d.number, payout: d.payout.amount, currency: d.payout.currency.name, rate: d.exchangeRate,
    proofUrl: d.proofUrl || null, reason: d.reason || null, recipient: d.recipient.map((r) => ({ key: r.key, label: r.name?.ar || r.name?.en || r.key, value: r.valueName || r.value })),
    partialRefund: d.partialRefund ? { refundedTotal: d.partialRefund.refundedTotal.amount, remainingTotal: d.partialRefund.remainingTotal.amount } : null,
    completedAt: d.completedAt?.toISOString() || null,
  };
}

/** Drive one order toward a final state. Safe to call any number of times. */
export async function settleUtility(id: string, resume = true): Promise<string> {
  const { data } = await db.from("utility_orders").select("*").eq("id", id).maybeSingle();
  const o = data as Row | null;
  if (!o || !["processing", "action_needed", "failed"].includes(o.status)) return o?.status || "missing";
  await db.from("utility_orders").update({ tries: (o.tries || 0) + 1, updated_at: new Date().toISOString() }).eq("id", id);
  const c = await anis(), w = await anisWallet();
  const q = o.request;
  const set = (patch: Record<string, unknown>) => db.from("utility_orders").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);

  try {
    if (o.kind === "meter") {
      let m: MeterCharge | null = null;
      if (o.status === "processing" && (!resume || !o.provider_status || ["sent", "unknown", "processing_create"].includes(o.provider_status))) {
        const req = { packageId: String(q.packageId), meterNumber: String(q.meterNumber), expectedTotal: Money.of(String(q.expectedTotal), "LYD"), externalReference: `trend-${id.slice(0, 8)}` };
        const r = resume ? await c.meterCharges.resume(w, id, req) : await c.meterCharges.create(w, id, req);
        if (r.kind === "notPlaced") { const code = r.refusal.rawCode || r.refusal.code; await set({ provider_status: `notPlaced:${code}` }); await refund(o, o.price, code === "meter_rejected" ? "رقم العداد غير مقبول — تأكد منه" : anisRefusalAr(code), "refunded"); return "refunded"; }
        if (r.kind === "final") m = r.meterCharge;
        else { await set({ provider_status: r.kind === "unknown" ? "unknown" : "processing" }); return "processing"; }
      } else {
        const g = await c.meterCharges.get(id);
        if ("operationType" in g || g.status === "processing") return "processing";
        m = g as MeterCharge;
      }
      const v = meterView(m);
      if (m.status === "succeeded") {
        const { data: done } = await db.from("utility_orders").update({ status: "succeeded", provider_status: "succeeded", result: v, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "processing").select("id").maybeSingle();
        if (done) await notify(o.user_id, "⚡ تم شحن الكهرباء", `${o.title} — العداد ${String(q.meterNumber)}. الرموز في «شحناتي».`);
        return "succeeded";
      }
      if (m.status === "failed") {
        const rs = m.refund?.status;
        await set({ result: v, provider_status: `failed:${m.failure?.code || "?"}:${rs || "?"}`, status: "failed" });
        if (rs === "refunded" || rs === "notCharged") { await refund({ ...o, status: "failed" }, o.price, v.failure?.message || "فشل الشحن", "refunded"); return "refunded"; }
        return "failed"; // refund pending at Anis → we refund the customer when it lands
      }
      await set({ provider_status: "processing" });
      return "processing";
    }

    // ── direct recharge
    let d: DirectRecharge | null = null;
    if (o.status === "processing" && (!o.provider_status || ["sent", "unknown", "processing_create"].includes(o.provider_status))) {
      const req = { productId: String(q.productId), payoutAmount: String(q.payoutAmount), expectedTotal: Money.of(String(q.expectedTotal), "LYD"), recipient: q.recipient as { key: string; value: string }[], externalReference: `trend-${id.slice(0, 8)}` };
      const r = resume ? await c.directRecharges.resume(w, id, req) : await c.directRecharges.create(w, id, req);
      if (r.kind === "notPlaced") { const code = r.refusal.rawCode || r.refusal.code; await set({ provider_status: `notPlaced:${code}` }); await refund(o, o.price, code === "price_changed" ? "تغيّر السعر — احسبه من جديد" : anisRefusalAr(code), "refunded"); return "refunded"; }
      if (r.kind === "final") d = r.directRecharge;
      else { await set({ provider_status: r.kind === "unknown" ? "unknown" : "accepted" }); if (r.kind === "unknown") return "processing"; }
    }
    if (!d) {
      const g = await c.directRecharges.get(id);
      if ("operationType" in g) { await set({ provider_status: "accepted" }); return "processing"; }
      d = g as DirectRecharge;
    }
    const v = rechargeView(d);
    switch (d.status) {
      case "completed": {
        if (d.partialRefund) { await set({ result: v, provider_status: "completed_partial" }); await refund(o, Number(o.price) * (Number(d.partialRefund.refundedTotal.amount) / Number(o.cost)), "استرجاع جزئي", "succeeded"); return "succeeded"; }
        const { data: done } = await db.from("utility_orders").update({ status: "succeeded", provider_status: "completed", result: v, updated_at: new Date().toISOString() }).eq("id", id).in("status", ["processing", "action_needed"]).select("id").maybeSingle();
        if (done) await notify(o.user_id, "✅ تم الشحن المباشر", o.title, "recharge");
        return "succeeded";
      }
      case "paymentFailed": await set({ result: v, provider_status: d.status }); await refund(o, o.price, "لم يتم الخصم", "refunded"); return "refunded";
      case "rejectedWithRefund": await set({ result: v, provider_status: d.status }); await refund(o, o.price, d.reason || "رُفض الطلب", "refunded"); return "refunded";
      case "rejectedAwaitingRefund": await set({ result: v, provider_status: d.status, status: "failed", error: d.reason || "رُفض — الاسترجاع جارٍ" }); return "failed";
      case "suspendedDataError": {
        const was = o.status;
        await set({ result: v, provider_status: d.status, status: "action_needed", error: d.reason || "بيانات المستلم تحتاج تصحيح" });
        if (was !== "action_needed") await notify(o.user_id, "✏️ صحّح بيانات المستلم", `${o.title} — ${d.reason || "البيانات تحتاج تصحيح"}`, "recharge");
        return "action_needed";
      }
      default: await set({ result: v, provider_status: d.status, status: "processing" }); return "processing";
    }
  } catch (e) {
    // Network / verification failure: outcome unknown — never refund here; try again later with the same id.
    await set({ provider_status: o.provider_status === "sent" || !o.provider_status ? "unknown" : o.provider_status, error: (e as Error).name || "error" });
    return o.status;
  }
}

export async function settleOpen(userId?: string, limit = 8) {
  if (!anisEnabled()) return 0;
  let q = db.from("utility_orders").select("id").in("status", ["processing", "action_needed", "failed"]).order("updated_at").limit(limit);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  for (const r of data || []) await settleUtility(r.id).catch(() => null);
  return (data || []).length;
}

/** Customer fixes recipient data while Anis has the recharge in suspendedDataError. */
export async function correctRecipient(userId: string, id: string, recipient: { key: string; value: string }[]) {
  const { data: o } = await db.from("utility_orders").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!o || o.kind !== "recharge" || o.status !== "action_needed") throw new Error("الطلب لا يحتاج تصحيح");
  const prod = await rechargeProduct(String(o.request.productId));
  const vals = new Map(recipient.map((r) => [String(r.key), String(r.value ?? "").trim()]));
  const full = prod.fields.filter((f) => f.kind !== "note").map((f) => {
    const v = vals.get(f.key) || "";
    if (!v) throw new Error(`${f.label} مطلوب`);
    if (f.validation) { let ok = true; try { ok = new RegExp(f.validation).test(v); } catch {} if (!ok) throw new Error(f.message || `${f.label} غير صحيح`); }
    return { key: f.key, value: v.slice(0, 200) };
  });
  const c = await anis();
  await c.directRecharges.updateRecipient(id, { recipient: full });
  await db.from("utility_orders").update({ status: "processing", provider_status: "corrected", target: full.map((x) => x.value).join(" · ").slice(0, 120), updated_at: new Date().toISOString() }).eq("id", id);
}
