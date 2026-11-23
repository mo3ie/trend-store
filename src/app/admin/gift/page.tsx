"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, Trash2, CheckCircle2, Search, Trophy } from "lucide-react";

type Plan = { day: string; gift_title: string; gift_image: string | null };
type Draw = { day: string; gift_title: string; entries_count: number; winner_name: string | null; claim_code: string | null; drawn_at: string | null; claimed_at: string | null; winner: { full_name: string | null; phone: string | null; email: string | null } | null };

const tomorrow = () => new Date(Date.now() + 2 * 3600_000 + 864e5).toISOString().slice(0, 10);

export default function AdminGiftPage() {
  const [plan, setPlan] = useState<Plan[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [form, setForm] = useState({ day: tomorrow(), gift_title: "", gift_image: "" });
  const [code, setCode] = useState("");
  const [claim, setClaim] = useState<{ msg: string; ok?: boolean; info?: string; canConfirm?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/admin/gift").then((r) => r.json()).then((d) => { setPlan(d.plan || []); setDraws(d.draws || []); });
  useEffect(() => { load(); }, []);

  const post = (b: object) => fetch("/api/admin/gift", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ ok: r.ok, d: await r.json() }));

  const savePlan = async () => {
    setBusy(true);
    const { ok, d } = await post({ action: "plan", ...form });
    if (!ok) alert(d.error); else { setForm({ day: tomorrow(), gift_title: "", gift_image: "" }); load(); }
    setBusy(false);
  };
  const lookup = async (confirm = false) => {
    if (!code.trim()) return;
    setBusy(true);
    const { ok, d } = await post({ action: "claim", code, confirm });
    if (!ok) setClaim({ msg: d.error, ok: false });
    else {
      const w = d.winner || {};
      const info = `${d.gift_title} · ${d.day} — ${w.full_name || "بدون اسم"} ${w.phone ? "· " + w.phone : ""} ${w.email ? "· " + w.email : ""}`;
      setClaim(d.claimed ? { msg: "✅ تم تسليم الهدية وتسجيلها", ok: true, info } : { msg: "الكود صحيح — تأكد من هوية الفائز ثم سلّم الهدية", ok: true, info, canConfirm: true });
      if (d.claimed) load();
    }
    setBusy(false);
  };

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-6 text-[var(--text)]">
      <div className="flex items-center gap-3">
        <Gift className="text-purple-400" />
        <div><h1 className="text-xl font-bold">هدية اليوم</h1><p className="text-sm text-[var(--muted)]">السحب تلقائي كل يوم الساعة 9 بالليل — أنت بس تحدد الهدية وتتأكد من كود الاستلام.</p></div>
      </div>

      <section className="rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Search size={17} /> تسليم هدية (تحقق من الكود)</h2>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setClaim(null); }} placeholder="كود الاستلام (8 حروف)" dir="ltr" className="flex-1 px-4 py-2.5 rounded-xl bg-black/20 border border-purple-500/20 font-mono tracking-widest" />
          <button onClick={() => lookup(false)} disabled={busy} className="px-5 rounded-xl bg-purple-600 text-white font-bold">تحقق</button>
        </div>
        {claim && (
          <div className={`rounded-xl p-3 text-sm ${claim.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
            <p className="font-bold">{claim.msg}</p>
            {claim.info && <p>{claim.info}</p>}
            {claim.canConfirm && <button onClick={() => lookup(true)} disabled={busy} className="mt-2 px-4 py-2 rounded-lg bg-green-600 text-white font-bold flex items-center gap-2"><CheckCircle2 size={16} /> تم التسليم</button>}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold">جدول الهدايا</h2>
        <p className="text-xs text-[var(--muted)]">لو ما حددتش هدية ليوم معيّن، تظهر «هدية مفاجأة من محل ترند».</p>
        <div className="grid md:grid-cols-[150px_1fr_1fr_auto] gap-2">
          <input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="px-3 py-2 rounded-xl bg-black/20 border border-purple-500/20" />
          <input value={form.gift_title} onChange={(e) => setForm({ ...form, gift_title: e.target.value })} placeholder="اسم الهدية (مثلاً: سماعة بلوتوث)" className="px-3 py-2 rounded-xl bg-black/20 border border-purple-500/20" />
          <input value={form.gift_image} onChange={(e) => setForm({ ...form, gift_image: e.target.value })} placeholder="رابط صورة (اختياري)" dir="ltr" className="px-3 py-2 rounded-xl bg-black/20 border border-purple-500/20" />
          <button onClick={savePlan} disabled={busy} className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold">حفظ</button>
        </div>
        {plan.map((p) => (
          <div key={p.day} className="flex items-center gap-3 text-sm rounded-lg bg-black/10 px-3 py-2">
            <b className="w-28">{p.day}</b><span className="flex-1">{p.gift_title}</span>
            <button onClick={async () => { await post({ action: "unplan", day: p.day }); load(); }} className="text-red-400"><Trash2 size={15} /></button>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-2">
        <h2 className="font-bold flex items-center gap-2"><Trophy size={17} /> السحوبات والفائزين</h2>
        {!draws.length ? <Loader2 className="animate-spin" /> : draws.map((d) => (
          <div key={d.day} className="grid md:grid-cols-[110px_1fr_1fr_auto] gap-2 text-sm rounded-lg bg-black/10 px-3 py-2 items-center">
            <b>{d.day}</b>
            <span>{d.gift_title} · {d.drawn_at ? `${d.entries_count} مشارك` : "لم يُسحب بعد"}</span>
            <span>{d.winner ? `${d.winner.full_name || "-"} · ${d.winner.phone || d.winner.email || ""}` : d.drawn_at ? "لا يوجد مشاركين" : ""}</span>
            <span className={d.claimed_at ? "text-green-400" : d.winner ? "text-amber-400" : "text-[var(--muted)]"}>{d.claimed_at ? "استُلمت" : d.winner ? <span dir="ltr" className="font-mono">{d.claim_code}</span> : ""}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
