"use client";

import { useEffect, useState } from "react";
import { Wrench, Phone, Save, Loader2 } from "lucide-react";

type Req = {
  id: string; name?: string; phone: string; device?: string; fault?: string;
  images?: string[]; status: string; quote_price?: number | null; technician?: string; notes?: string;
  created_at: string;
};

const STATUS: { k: string; ar: string }[] = [
  { k: "new", ar: "جديد" },
  { k: "quoted", ar: "عرض سعر" },
  { k: "in_progress", ar: "جاري الإصلاح" },
  { k: "ready", ar: "جاهز للاستلام" },
  { k: "delivered", ar: "تم التسليم" },
  { k: "cancelled", ar: "ملغي" },
];
const statusColor: Record<string, string> = {
  new: "bg-yellow-500/20 text-yellow-400", quoted: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-purple-500/20 text-purple-400", ready: "bg-green-500/20 text-green-400",
  delivered: "bg-gray-500/20 text-[var(--muted)]", cancelled: "bg-red-500/20 text-red-400",
};
const input = "w-full px-3 py-2 rounded-lg bg-[var(--input)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60";

export default function AdminMaintenance() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/maintenance");
    const d = await r.json();
    setReqs(Array.isArray(d) ? d : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = (id: string, p: Partial<Req>) => setReqs((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const save = async (r: Req) => {
    setSaving(r.id);
    await fetch("/api/maintenance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: r.status, quote_price: r.quote_price, technician: r.technician, notes: r.notes }) });
    setSaving(null);
  };

  if (loading) return <div className="p-8 text-[var(--muted-2)]">جاري التحميل…</div>;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-2">
        <Wrench className="text-purple-400" size={20} />
        <h1 className="text-2xl font-bold">طلبات الصيانة</h1>
        <span className="text-[var(--muted-2)] text-sm">({reqs.length})</span>
      </div>

      {reqs.length === 0 && <p className="text-[var(--muted-2)]">لا توجد طلبات بعد.</p>}

      {reqs.map((r) => (
        <div key={r.id} className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-wider">{r.id.slice(0, 8).toUpperCase()}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] || ""}`}>{STATUS.find((s) => s.k === r.status)?.ar || r.status}</span>
              </div>
              <p className="text-sm font-bold mt-1">{r.device || "—"} {r.name ? `· ${r.name}` : ""}</p>
              {r.fault && <p className="text-sm text-[var(--muted)] mt-0.5">{r.fault}</p>}
            </div>
            <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 text-purple-300 text-sm font-bold"><Phone size={14} /> {r.phone}</a>
          </div>

          {!!r.images?.length && (
            <div className="flex gap-2 flex-wrap">
              {r.images.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]" /></a>)}
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="text-xs text-[var(--muted)] mb-1 block">الحالة</label>
              <select className={input} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })}>
                {STATUS.map((s) => <option key={s.k} value={s.k} style={{ background: "var(--surface)" }}>{s.ar}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-[var(--muted)] mb-1 block">عرض السعر (د.ل)</label>
              <input className={input} type="number" value={r.quote_price ?? ""} onChange={(e) => patch(r.id, { quote_price: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div><label className="text-xs text-[var(--muted)] mb-1 block">الفني</label>
              <input className={input} value={r.technician ?? ""} onChange={(e) => patch(r.id, { technician: e.target.value })} />
            </div>
          </div>
          <div><label className="text-xs text-[var(--muted)] mb-1 block">ملاحظات للزبون</label>
            <input className={input} value={r.notes ?? ""} onChange={(e) => patch(r.id, { notes: e.target.value })} placeholder="تظهر للزبون في صفحة التتبّع" />
          </div>

          <button onClick={() => save(r)} disabled={saving === r.id} className="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2 disabled:opacity-50 text-sm">
            {saving === r.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ
          </button>
        </div>
      ))}
    </div>
  );
}
