"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Save, Plus, Plug, Undo2, Send, RefreshCw } from "lucide-react";

type P = { id?: string; provider?: string | null; provider_cost?: number | null; provider_available?: boolean | null; name: string; brand: string; region: string; category: string; face_value: string | null; price: number | string; image: string | null; provider_sku: string | null; active: boolean; sort: number };
type Pending = { id: string; provider?: string | null; provider_state?: string | null; qty: number; total: number; created_at: string; card_products: { name: string } | null; customer: { full_name: string | null; phone: string | null } | null };
type Recent = { id: string; qty: number; total: number; status: string; created_at: string; card_products: { name: string } | null };

const EMPTY: P = { name: "", brand: "", region: "local", category: "mobile", face_value: "", price: "", image: "", provider_sku: "", active: true, sort: 0 };

export default function AdminCards() {
  const [d, setD] = useState<{ products: P[]; pending: Pending[]; recent: Recent[]; provider: { name: string; balance: number | null } | null } | null>(null);
  const [edit, setEdit] = useState<Record<string, P>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [nw, setNw] = useState<P>(EMPTY);
  const [markup, setMarkup] = useState("5");
  const [syncing, setSyncing] = useState(false);
  const sync = async () => {
    setSyncing(true);
    const r = await fetch("/api/admin/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "anis_sync", markup: Number(markup) }) });
    const j = await r.json(); setSyncing(false);
    if (!r.ok) return alert(j.error);
    alert(`تمت المزامنة: ${j.total} كرت عند أنيس · جديد ${j.added} (مخفية — راجع السعر وفعّلها) · محدّث ${j.updated}${j.loss ? ` · ⚠️ ${j.loss} كرت سعر بيعه أقل من التكلفة` : ""}`);
    load();
  };
  const load = () => fetch("/api/admin/cards").then((r) => r.json()).then(setD);
  useEffect(() => { load(); }, []);
  const post = async (b: object) => { const r = await fetch("/api/admin/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) { alert((await r.json()).error); return false; } await load(); return true; };

  if (!d) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  const inp = "px-2 py-1.5 rounded-lg bg-black/20 border border-purple-500/20 text-sm w-full";
  const row = (p: P) => edit[p.id!] || p;
  const setRow = (p: P, k: keyof P, v: unknown) => setEdit((e) => ({ ...e, [p.id!]: { ...row(p), [k]: v } }));

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-6 text-[var(--text)]">
      <div className="flex items-center gap-3"><CreditCard className="text-purple-400" /><h1 className="text-xl font-bold flex-1">الكروت</h1><a href="/cards" target="_blank" className="text-sm text-blue-400">صفحة الكروت ↗</a></div>

      <section className={`rounded-2xl border p-4 text-sm flex items-center gap-3 ${d.provider ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
        <Plug size={18} />
        {d.provider ? <span>المزوّد متصل: <b>{d.provider.name}</b>{d.provider.balance != null ? ` · الرصيد ${d.provider.balance}` : ""} — التسليم فوري للمنتجات اللي عندها كود المزوّد (SKU).</span>
          : <span>المزوّد غير متصل بعد — بانتظار تفعيل مفتاح أنيس — الطلبات تنتظر تسليم يدوي تحت. لما توصل بيانات الـ API نضيفها (CARDS_API_URL / CARDS_API_KEY) ويصير التسليم فوري.</span>}
        {d.provider?.name.startsWith("أنيس") && (
          <span className="flex items-center gap-2 ms-auto">
            هامش الربح للجديد % <input value={markup} onChange={(e) => setMarkup(e.target.value)} className={inp + " !w-16"} dir="ltr" />
            <button onClick={sync} disabled={syncing} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white flex items-center gap-1 whitespace-nowrap">{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} مزامنة كروت أنيس</button>
          </span>
        )}
      </section>

      <section className="rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold">طلبات تنتظر التسليم ({d.pending.length})</h2>
        {!d.pending.length ? <p className="text-sm text-[var(--muted)]">ما فيش.</p> : d.pending.map((o) => (
          <div key={o.id} className="rounded-xl bg-black/15 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap gap-2"><b className="flex-1">{o.qty} × {o.card_products?.name} · {o.total} د.ل</b><span>{o.customer?.full_name || "-"} {o.customer?.phone ? `· ${o.customer.phone}` : ""}</span><span className="text-[var(--muted)]">{new Date(o.created_at).toLocaleString("ar-LY")}</span></div>
            {o.provider === "anis" && <div className="text-xs rounded-lg bg-purple-500/10 p-2 flex items-center gap-2">عند أنيس — الحالة: <b dir="ltr">{o.provider_state || "-"}</b><button onClick={() => post({ action: "anis_settle", order_id: o.id })} className="ms-auto px-2 py-1 rounded bg-purple-600 text-white flex items-center gap-1"><RefreshCw size={12} /> تحديث من المزوّد</button></div>}
            <textarea rows={Math.min(5, o.qty + 1)} dir="ltr" placeholder={`كود في كل سطر (${o.qty})  —  اختياري: CODE | SERIAL`} value={codes[o.id] || ""} onChange={(e) => setCodes({ ...codes, [o.id]: e.target.value })} className={inp + " font-mono"} />
            <div className="flex gap-2">
              <button onClick={() => post({ action: "fulfill", order_id: o.id, codes: codes[o.id] || "" })} className="px-3 py-1.5 rounded-lg bg-green-600 text-white flex items-center gap-1"><Send size={14} /> تسليم للزبون</button>
              <button onClick={() => confirm("إرجاع المبلغ للزبون؟") && post({ action: "refund", order_id: o.id })} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white flex items-center gap-1"><Undo2 size={14} /> استرجاع</button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-3 overflow-x-auto">
        <h2 className="font-bold">المنتجات والأسعار</h2>
        <p className="text-xs text-[var(--muted)]">المنتجات المضافة مسبقاً مطفية وسعرها مؤقت — حدّد السعر بالدينار وفعّلها. «كود المزوّد» يتعبّى لما يوصل الـ API.</p>
        <table className="w-full text-sm min-w-[860px]">
          <thead className="text-[var(--muted)] text-xs"><tr><th className="text-start p-1">الاسم</th><th className="p-1">الماركة</th><th className="p-1">النوع</th><th className="p-1">التصنيف</th><th className="p-1">القيمة</th><th className="p-1">السعر د.ل</th><th className="p-1">كود المزوّد</th><th className="p-1">مفعّل</th><th /></tr></thead>
          <tbody>
            {d.products.map((p) => { const r = row(p); return (
              <tr key={p.id} className="border-t border-white/5">
                <td className="p-1"><input className={inp} value={r.name} onChange={(e) => setRow(p, "name", e.target.value)} /></td>
                <td className="p-1"><input className={inp} value={r.brand} onChange={(e) => setRow(p, "brand", e.target.value)} /></td>
                <td className="p-1"><select className={inp} value={r.region} onChange={(e) => setRow(p, "region", e.target.value)}><option value="local">محلي</option><option value="international">دولي</option></select></td>
                <td className="p-1"><select className={inp} value={r.category} onChange={(e) => setRow(p, "category", e.target.value)}><option value="mobile">رصيد</option><option value="games">ألعاب</option><option value="stores">متاجر</option><option value="streaming">اشتراكات</option><option value="other">أخرى</option></select></td>
                <td className="p-1"><input className={inp} value={r.face_value || ""} onChange={(e) => setRow(p, "face_value", e.target.value)} /></td>
                <td className="p-1"><input className={inp} value={r.price} onChange={(e) => setRow(p, "price", e.target.value)} />{p.provider === "anis" && p.provider_cost != null && <small className={`block text-[10px] ${Number(r.price) < Number(p.provider_cost) ? "text-red-400" : "text-[var(--muted)]"}`}>تكلفة أنيس {p.provider_cost}{p.provider_available === false ? " · غير متوفر" : ""}</small>}</td>
                <td className="p-1"><input className={inp} dir="ltr" value={r.provider_sku || ""} onChange={(e) => setRow(p, "provider_sku", e.target.value)} /></td>
                <td className="p-1 text-center"><input type="checkbox" checked={r.active} onChange={(e) => setRow(p, "active", e.target.checked)} /></td>
                <td className="p-1">{edit[p.id!] && <button onClick={async () => { if (await post({ action: "save", product: r })) setEdit((e) => { const n = { ...e }; delete n[p.id!]; return n; }); }} className="p-1.5 rounded-lg bg-purple-600 text-white"><Save size={14} /></button>}</td>
              </tr>
            ); })}
            <tr className="border-t border-purple-500/30">
              <td className="p-1"><input className={inp} placeholder="منتج جديد" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} /></td>
              <td className="p-1"><input className={inp} value={nw.brand} onChange={(e) => setNw({ ...nw, brand: e.target.value })} /></td>
              <td className="p-1"><select className={inp} value={nw.region} onChange={(e) => setNw({ ...nw, region: e.target.value })}><option value="local">محلي</option><option value="international">دولي</option></select></td>
              <td className="p-1"><select className={inp} value={nw.category} onChange={(e) => setNw({ ...nw, category: e.target.value })}><option value="mobile">رصيد</option><option value="games">ألعاب</option><option value="stores">متاجر</option><option value="streaming">اشتراكات</option><option value="other">أخرى</option></select></td>
              <td className="p-1"><input className={inp} value={nw.face_value || ""} onChange={(e) => setNw({ ...nw, face_value: e.target.value })} /></td>
              <td className="p-1"><input className={inp} value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value })} /></td>
              <td className="p-1"><input className={inp} dir="ltr" value={nw.provider_sku || ""} onChange={(e) => setNw({ ...nw, provider_sku: e.target.value })} /></td>
              <td className="p-1 text-center"><input type="checkbox" checked={nw.active} onChange={(e) => setNw({ ...nw, active: e.target.checked })} /></td>
              <td className="p-1"><button onClick={async () => { if (await post({ action: "save", product: nw })) setNw(EMPTY); }} className="p-1.5 rounded-lg bg-green-600 text-white"><Plus size={14} /></button></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-1.5">
        <h2 className="font-bold mb-1">آخر الطلبات</h2>
        {d.recent.map((o) => <div key={o.id} className="flex gap-3 text-sm rounded-lg bg-black/10 px-3 py-1.5"><span className="flex-1">{o.qty} × {o.card_products?.name}</span><span>{o.total} د.ل</span><span className="text-[var(--muted)]">{({ pending: "ينتظر", delivered: "مسلّم", failed: "فشل", refunded: "مسترجع" } as Record<string, string>)[o.status]}</span></div>)}
      </section>
    </div>
  );
}
