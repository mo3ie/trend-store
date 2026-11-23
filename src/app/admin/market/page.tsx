"use client";

import { useEffect, useState } from "react";
import { Store, Loader2, Check, X, AlertTriangle, Settings2 } from "lucide-react";
import { COND, ORDER_LABEL } from "@/lib/marketShared";

type Listing = { id: string; title: string; price: number; images: string[]; condition: string; battery_health: number | null; description: string | null; city: string | null; diag_report_id: string | null; created_at: string };
type Dispute = { id: string; price: number; dispute_reason: string | null; market_listings: { title: string; images: string[] } | null };
type Order = { id: string; price: number; commission: number; status: string; created_at: string; market_listings: { title: string } | null };

export default function AdminMarket() {
  const [d, setD] = useState<{ pending: Listing[]; disputes: Dispute[]; orders: Order[]; settings: { commission_pct: number; protection_days: number; min_price: number } | null; totals: { held: number; earned: number } } | null>(null);
  const [s, setS] = useState({ commission_pct: "5", protection_days: "3", min_price: "20" });
  const load = () => fetch("/api/admin/market").then((r) => r.json()).then((x) => { setD(x); if (x.settings) setS({ commission_pct: String(x.settings.commission_pct), protection_days: String(x.settings.protection_days), min_price: String(x.settings.min_price) }); });
  useEffect(() => { load(); }, []);
  const post = async (b: object) => { const r = await fetch("/api/admin/market", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) alert((await r.json()).error); load(); };

  if (!d) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-6 text-[var(--text)]">
      <div className="flex items-center gap-3"><Store className="text-purple-400" /><h1 className="text-xl font-bold flex-1">سوق المستعمل</h1>
        <a href="/market" target="_blank" className="text-sm text-blue-400">فتح السوق ↗</a></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-4"><b className="text-2xl block">{d.pending.length}</b>إعلانات تنتظر المراجعة</div>
        <div className="rounded-2xl border border-red-500/30 bg-[var(--surface)] p-4"><b className="text-2xl block">{d.disputes.length}</b>نزاعات مفتوحة</div>
        <div className="rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-4"><b className="text-2xl block">{d.totals.held}</b>د.ل محجوزة حالياً</div>
        <div className="rounded-2xl border border-green-500/30 bg-[var(--surface)] p-4"><b className="text-2xl block">{d.totals.earned}</b>د.ل عمولات (آخر 50 طلب)</div>
      </div>

      {d.disputes.length > 0 && <section className="rounded-2xl border border-red-500/30 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><AlertTriangle size={17} className="text-red-400" /> النزاعات</h2>
        {d.disputes.map((x) => (
          <div key={x.id} className="rounded-xl bg-black/15 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2"><b className="flex-1">{x.market_listings?.title} · {x.price} د.ل</b><a href={`/market/order/${x.id}`} target="_blank" className="text-blue-400">المحادثة والسجل ↗</a></div>
            <p className="text-red-300">{x.dispute_reason}</p>
            <div className="flex gap-2">
              <button onClick={() => { const r = prompt("ملاحظة القرار (اختياري)") ?? ""; post({ action: "resolve_release", id: x.id, reason: r }); }} className="px-3 py-1.5 rounded-lg bg-green-600 text-white">تحويل للبائع</button>
              <button onClick={() => { const r = prompt("ملاحظة القرار (اختياري)") ?? ""; post({ action: "resolve_refund", id: x.id, reason: r }); }} className="px-3 py-1.5 rounded-lg bg-red-600 text-white">استرجاع للمشتري</button>
            </div>
          </div>
        ))}
      </section>}

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold">إعلانات للمراجعة</h2>
        {!d.pending.length ? <p className="text-sm text-[var(--muted)]">ما فيش.</p> : d.pending.map((l) => (
          <div key={l.id} className="rounded-xl bg-black/15 p-3 flex flex-wrap gap-3">
            <div className="flex gap-1.5">{l.images.slice(0, 4).map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="" className="w-16 h-16 rounded-lg object-cover" /></a>)}</div>
            <div className="flex-1 min-w-[200px] text-sm">
              <b>{l.title}</b> · {l.price} د.ل · {COND[l.condition]}{l.battery_health ? ` · بطارية ${l.battery_health}%` : ""}{l.city ? ` · ${l.city}` : ""}
              {l.diag_report_id && <a href={`/diagnose/r/${l.diag_report_id}`} target="_blank" className="block text-cyan-400">تقرير الفحص ↗</a>}
              {l.description && <p className="text-[var(--muted)] mt-1">{l.description}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => post({ action: "approve", id: l.id })} className="px-3 py-1.5 rounded-lg bg-green-600 text-white flex items-center gap-1"><Check size={15} /> نشر</button>
              <button onClick={() => { const r = prompt("سبب الرفض؟"); if (r) post({ action: "reject", id: l.id, reason: r }); }} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white flex items-center gap-1"><X size={15} /> رفض</button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-2">
        <h2 className="font-bold">آخر الطلبات</h2>
        {d.orders.map((o) => <a key={o.id} href={`/market/order/${o.id}`} target="_blank" className="flex gap-3 text-sm rounded-lg bg-black/10 px-3 py-2"><span className="flex-1">{o.market_listings?.title}</span><span>{o.price} د.ل</span><span className="text-[var(--muted)]">{ORDER_LABEL[o.status]}</span></a>)}
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Settings2 size={17} /> إعدادات السوق</h2>
        <div className="grid sm:grid-cols-4 gap-3 text-sm">
          <label>العمولة %<input value={s.commission_pct} onChange={(e) => setS({ ...s, commission_pct: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-black/20 border border-purple-500/20" /></label>
          <label>أيام الفحص للمشتري<input value={s.protection_days} onChange={(e) => setS({ ...s, protection_days: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-black/20 border border-purple-500/20" /></label>
          <label>أقل سعر للإعلان<input value={s.min_price} onChange={(e) => setS({ ...s, min_price: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl bg-black/20 border border-purple-500/20" /></label>
          <button onClick={() => post({ action: "settings", ...s })} className="self-end px-4 py-2 rounded-xl bg-purple-600 text-white font-bold">حفظ</button>
        </div>
      </section>
    </div>
  );
}
