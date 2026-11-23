"use client";

import { useEffect, useState } from "react";
import { Gamepad2, Loader2, Save, ShieldAlert } from "lucide-react";

type Row = { rank: number; name: string; score: number; full_name: string | null; phone: string | null };
type Week = { week_start: string; prize_title: string; finalized_at: string | null; winners: { rank: number; score: number; code: string; claimed: boolean; full_name: string | null; phone: string | null }[] };

export default function AdminGames() {
  const [d, setD] = useState<{ weekStart: string; playsToday: number; flaggedThisWeek: number; leaderboard: Row[]; weeks: Week[] } | null>(null);
  const [prize, setPrize] = useState("");
  const load = () => fetch("/api/admin/games").then((r) => r.json()).then((x) => { setD(x); setPrize(x.weeks?.find((w: Week) => w.week_start === x.weekStart)?.prize_title || ""); });
  useEffect(() => { load(); }, []);
  const post = async (b: object) => { const r = await fetch("/api/admin/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) alert((await r.json()).error); load(); };

  if (!d) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-6 text-[var(--text)]">
      <div className="flex items-center gap-3"><Gamepad2 className="text-purple-400" /><h1 className="text-xl font-bold flex-1">التحديات والألعاب</h1><a href="/games" target="_blank" className="text-sm text-blue-400">صفحة الألعاب ↗</a></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-4"><b className="text-2xl block">{d.playsToday}</b>محاولات اليوم</div>
        <div className="rounded-2xl border border-red-500/30 bg-[var(--surface)] p-4 flex items-center gap-2"><ShieldAlert className="text-red-400" /><div><b className="text-2xl block">{d.flaggedThisWeek}</b>نتائج مستبعدة هذا الأسبوع (وقت مزوّر / متأخر)</div></div>
      </div>
      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold">جائزة هذا الأسبوع (يبدأ {d.weekStart})</h2>
        <div className="flex gap-2"><input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="مثلاً: سماعة + شاحن + كوبون 50 د.ل" className="flex-1 px-3 py-2 rounded-xl bg-black/20 border border-purple-500/20" />
          <button onClick={() => post({ action: "prize", week_start: d.weekStart, prize_title: prize })} className="px-4 rounded-xl bg-purple-600 text-white flex items-center gap-1"><Save size={15} /> حفظ</button></div>
      </section>
      <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-1.5">
        <h2 className="font-bold mb-1">الترتيب الحالي</h2>
        {!d.leaderboard.length ? <p className="text-sm text-[var(--muted)]">ما فيش نتائج.</p> : d.leaderboard.map((r) => (
          <div key={r.rank} className="flex gap-3 text-sm rounded-lg bg-black/10 px-3 py-1.5"><b>#{r.rank}</b><span className="flex-1">{r.full_name || r.name}</span><span className="text-[var(--muted)]">{r.phone}</span><b>{r.score}</b></div>
        ))}
      </section>
      <section className="rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-5 space-y-3">
        <h2 className="font-bold">فائزي الأسابيع (تُقفل تلقائياً بعد نهاية الأسبوع)</h2>
        {d.weeks.filter((w) => w.finalized_at).map((w) => (
          <div key={w.week_start} className="rounded-xl bg-black/15 p-3 text-sm space-y-1">
            <b>{w.week_start} · {w.prize_title}</b>
            {w.winners.map((x) => (
              <div key={x.rank} className="flex flex-wrap gap-3 items-center"><span>#{x.rank} {x.full_name} · {x.phone} · {x.score}</span><span dir="ltr" className="font-mono">{x.code}</span>
                {x.claimed ? <span className="text-green-400">استُلمت</span> : <button onClick={() => post({ action: "claim", week_start: w.week_start, code: x.code })} className="px-2 py-0.5 rounded-lg bg-green-600 text-white text-xs">تم التسليم</button>}</div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
