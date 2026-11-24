"use client";

import { useEffect, useState } from "react";
import { Zap, Send, Loader2, Save, RefreshCw, Plug } from "lucide-react";

type S = { meter_enabled: boolean; meter_markup_pct: number; meter_fee: number; recharge_enabled: boolean; recharge_markup_pct: number; recharge_fee: number };
type O = { id: string; kind: string; status: string; title: string; target: string; price: number; cost: number; refunded: number; provider_status: string | null; created_at: string; error?: string | null };
type D = { connected: boolean; balance: { amount: number; currency: string } | null; settings: S; meter: { id: string; name: string; cost: number; retail: number; price: number }[]; recharge: { id: string; title: string; currency: string; minTotal: number | null; maxTotal: number | null }[]; open: O[]; recent: O[] };

const sell = (cost: number, pct: number, fee: number) => Math.max(cost, Math.ceil((cost * (1 + pct / 100) + fee) * 4) / 4);

export default function AdminUtilities() {
  const [d, setD] = useState<D | null>(null);
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/admin/utilities").then((r) => r.json()).then((j: D) => { setD(j); setS(j.settings); });
  useEffect(() => { load(); }, []);
  const post = async (b: object) => { setBusy(true); const r = await fetch("/api/admin/utilities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); setBusy(false); if (!r.ok) alert((await r.json()).error); await load(); };

  if (!d || !s) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  const inp = "px-2 py-1.5 rounded-lg bg-black/20 border border-purple-500/20 text-sm w-24";
  const num = (k: keyof S) => <input className={inp} dir="ltr" value={String(s[k])} onChange={(e) => setS({ ...s, [k]: e.target.value as never })} />;
  const margin = d.recent.filter((o) => o.status === "succeeded").reduce((a, o) => a + Number(o.price) - Number(o.cost) - Number(o.refunded), 0);

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-6 text-[var(--text)]">
      <div className="flex items-center gap-3"><Zap className="text-amber-400" /><h1 className="text-xl font-bold flex-1">الكهرباء (خالص) والشحن المباشر</h1><a href="/electricity" target="_blank" className="text-sm text-blue-400">صفحة الكهرباء ↗</a><a href="/recharge" target="_blank" className="text-sm text-blue-400">صفحة الشحن المباشر ↗</a></div>

      <section className={`rounded-2xl border p-4 text-sm flex items-center gap-3 ${d.connected ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
        <Plug size={18} />{d.connected ? <span>أنيس متصل{d.balance ? ` · رصيد المحفظة ${d.balance.amount} ${d.balance.currency}` : ""} · ربح آخر 50 طلب ناجح: <b>{margin.toFixed(3)} د.ل</b></span> : <span>أنيس غير متصل بعد (ANIS_* في إعدادات الخادم).</span>}
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Zap size={16} /> خالص — شحن الكهرباء</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.meter_enabled} onChange={(e) => setS({ ...s, meter_enabled: e.target.checked })} /> مفعّل للزبائن</label>
          <span>هامش % {num("meter_markup_pct")}</span><span>رسوم ثابتة د.ل {num("meter_fee")}</span>
        </div>
        <table className="w-full text-sm"><thead className="text-xs text-[var(--muted)]"><tr><th className="text-start p-1">الباقة</th><th>تكلفة أنيس</th><th>السعر المقترح من أنيس</th><th>سعر البيع عندك</th></tr></thead>
          <tbody>{d.meter.map((p) => { const price = sell(p.cost, Number(s.meter_markup_pct) || 0, Number(s.meter_fee) || 0); return (
            <tr key={p.id} className="border-t border-white/5"><td className="p-1">{p.name}</td><td className="text-center">{p.cost}</td><td className="text-center">{p.retail}</td><td className={`text-center font-bold ${price > p.retail ? "text-amber-400" : ""}`}>{price}</td></tr>); })}</tbody></table>
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Send size={16} /> الشحن المباشر</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.recharge_enabled} onChange={(e) => setS({ ...s, recharge_enabled: e.target.checked })} /> مفعّل للزبائن</label>
          <span>هامش % {num("recharge_markup_pct")}</span><span>رسوم ثابتة د.ل {num("recharge_fee")}</span>
        </div>
        <p className="text-xs text-[var(--muted)]">سعر الزبون = تكلفة أنيس (حسب سعر الصرف لحظتها) + الهامش + الرسوم. الخدمات المتاحة: {d.recharge.map((p) => `${p.title} (${p.currency})`).join("، ") || "—"}</p>
      </section>

      <button disabled={busy} onClick={() => post({ action: "save", settings: s })} className="px-4 py-2 rounded-xl bg-purple-600 text-white flex items-center gap-2"><Save size={15} /> حفظ الإعدادات</button>

      <section className="rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-5 space-y-2">
        <h2 className="font-bold">طلبات مفتوحة ({d.open.length})</h2>
        {!d.open.length ? <p className="text-sm text-[var(--muted)]">ما فيش.</p> : d.open.map((o) => (
          <div key={o.id} className="rounded-xl bg-black/15 p-3 text-sm flex flex-wrap items-center gap-3">
            <b className="flex-1">{o.kind === "meter" ? "⚡" : "💸"} {o.title} · <span dir="ltr">{o.target}</span></b>
            <span>{o.price} د.ل</span><span className="text-amber-400" dir="ltr">{o.status} / {o.provider_status || "-"}</span>
            <span className="text-[var(--muted)]">{new Date(o.created_at).toLocaleString("ar-LY")}</span>
            <button onClick={() => post({ action: "settle", id: o.id })} className="px-2 py-1 rounded bg-purple-600 text-white flex items-center gap-1"><RefreshCw size={12} /> تحديث من أنيس</button>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 overflow-x-auto">
        <h2 className="font-bold mb-2">آخر الطلبات</h2>
        <table className="w-full text-sm min-w-[700px]"><thead className="text-xs text-[var(--muted)]"><tr><th className="text-start p-1">الطلب</th><th>الحالة</th><th>المدفوع</th><th>التكلفة</th><th>المسترجع</th><th>التاريخ</th></tr></thead>
          <tbody>{d.recent.map((o) => <tr key={o.id} className="border-t border-white/5"><td className="p-1">{o.kind === "meter" ? "⚡" : "💸"} {o.title}</td><td className="text-center" dir="ltr">{o.status}</td><td className="text-center">{o.price}</td><td className="text-center">{o.cost}</td><td className="text-center">{o.refunded || "-"}</td><td className="text-center text-xs">{new Date(o.created_at).toLocaleString("ar-LY")}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
