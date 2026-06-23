"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wrench, Search, ArrowLeft } from "lucide-react";

type Req = {
  id: string; name?: string; phone: string; device?: string; fault?: string;
  status: string; quote_price?: number; technician?: string; notes?: string;
  created_at: string; updated_at: string;
};

const STEPS = [
  { key: "new", ar: "قيد المراجعة" },
  { key: "quoted", ar: "عرض سعر" },
  { key: "in_progress", ar: "جاري الإصلاح" },
  { key: "ready", ar: "جاهز للاستلام" },
  { key: "delivered", ar: "تم التسليم" },
];

function Track() {
  const sp = useSearchParams();
  const [id, setId] = useState(sp.get("id") || "");
  const [req, setReq] = useState<Req | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async (rid: string) => {
    if (!rid.trim()) return;
    setLoading(true); setErr(""); setReq(null);
    const r = await fetch(`/api/maintenance?id=${encodeURIComponent(rid.trim())}`);
    const d = await r.json();
    setLoading(false);
    if (d.id) setReq(d); else setErr("لم يُعثر على طلب بهذا الرقم");
  };

  useEffect(() => { if (sp.get("id")) load(sp.get("id")!); }, []); // eslint-disable-line

  const stepIdx = req ? STEPS.findIndex((s) => s.key === req.status) : -1;
  const cancelled = req?.status === "cancelled";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-8" dir="rtl">
      <div className="max-w-lg mx-auto">
        <a href="/" className="inline-flex items-center gap-2 text-[var(--muted)] hover:text-purple-400 text-sm mb-6"><ArrowLeft size={16} /> الرئيسية</a>
        <div className="flex items-center gap-2 mb-5">
          <Wrench className="text-purple-400" size={22} />
          <h1 className="text-xl font-black">تتبّع طلب الصيانة</h1>
        </div>

        <div className="flex gap-2 mb-6">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="أدخل رقم الطلب"
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-purple-500/60" />
          <button onClick={() => load(id)} className="px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold flex items-center gap-2"><Search size={16} /> بحث</button>
        </div>

        {loading && <p className="text-[var(--muted-2)] text-sm">جاري التحميل…</p>}
        {err && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

        {req && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-[var(--muted)]">رقم الطلب</p><p className="font-black tracking-wider">{req.id.slice(0, 8).toUpperCase()}</p></div>
              {req.device && <div className="text-left"><p className="text-xs text-[var(--muted)]">الجهاز</p><p className="font-bold text-sm">{req.device}</p></div>}
            </div>

            {cancelled ? (
              <p className="text-red-400 font-bold bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">تم إلغاء الطلب</p>
            ) : (
              <div className="space-y-3">
                {STEPS.map((s, i) => {
                  const done = i <= stepIdx;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${done ? "bg-gradient-to-br from-purple-600 to-blue-500 text-white" : "bg-[var(--input)] text-[var(--muted-2)]"}`}>{i + 1}</span>
                      <span className={done ? "font-bold" : "text-[var(--muted-2)]"}>{s.ar}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {req.quote_price != null && (
              <div className="bg-[var(--input)] rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-[var(--muted)] text-sm">عرض السعر</span>
                <span className="font-black text-purple-400">{req.quote_price} د.ل</span>
              </div>
            )}
            {req.notes && <p className="text-sm text-[var(--muted)] bg-[var(--input)] rounded-xl px-4 py-3">{req.notes}</p>}
            {req.technician && <p className="text-xs text-[var(--muted-2)]">الفني: {req.technician}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}><Track /></Suspense>;
}
