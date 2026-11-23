"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Trophy, Brain, Tag, Grid3x3, Loader2, CheckCircle2, XCircle, Clock, Gift, Medal } from "lucide-react";
import { deviceHeaders } from "@/lib/deviceId";

type Data = {
  day: string; prize: string;
  quiz: { q: string; options: string[] }[];
  price: { id: string; name: string; image_url: string }[];
  memory: { k: number; img: string }[];
  leaderboard: { rank: number; name: string; score: number }[];
  myRank: number | null; myWeek: number; signedIn: boolean; blocked: string | null;
  mine: Record<string, { score: number; submitted: boolean }>;
  lastWeek: { week: string; prize: string; winners: { rank: number; name: string; score: number }[] } | null;
};
type Game = "quiz" | "price" | "memory";

const call = (body: object) => fetch("/api/games", { method: "POST", headers: { "content-type": "application/json", ...deviceHeaders() }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, status: r.status, d: await r.json() }));

function Timer({ limit, onEnd }: { limit: number; onEnd: () => void }) {
  const [left, setLeft] = useState(limit);
  const done = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => { if (s <= 1 && !done.current) { done.current = true; onEnd(); } return Math.max(0, s - 1); }), 1000);
    return () => clearInterval(t);
  }, [onEnd]);
  return <span className={`gm-timer ${left < 20 ? "low" : ""}`}><Clock size={14} /> {left}ث</span>;
}

export default function GamesPage() {
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<Game | null>(null);
  const [limit, setLimit] = useState(0);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ game: Game; score: number; reveal: unknown; late: boolean } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // memory
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const startAt = useRef(0);

  const load = () => fetch("/api/games").then((r) => r.json()).then(setD);
  useEffect(() => { load(); }, []);

  const start = async (g: Game) => {
    setErr(""); setResult(null);
    if (!d?.signedIn) { window.location.href = "/login?next=/games"; return; }
    const { ok, d: j } = await call({ action: "start", game: g });
    if (!ok) { setErr(j.error); return; }
    setLimit(j.limit); setOpen(g); setAnswers([]); setGuesses({}); setFlipped([]); setMatched(new Set()); setMoves(0); startAt.current = Date.now();
  };
  const submit = async (g: Game, payload: object) => {
    if (busy) return;
    setBusy(true);
    const { ok, d: j } = await call({ action: "submit", game: g, payload });
    setBusy(false);
    if (!ok) { setErr(j.error); setOpen(null); return; }
    setResult({ game: g, score: j.score, reveal: j.reveal, late: j.late });
    setOpen(null); load();
  };

  const flip = (i: number) => {
    if (!d || flipped.length === 2 || flipped.includes(i) || matched.has(d.memory[i].img)) return;
    const f = [...flipped, i];
    setFlipped(f);
    if (f.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = f;
      if (d.memory[a].img === d.memory[b].img) {
        const nm = new Set(matched); nm.add(d.memory[a].img); setMatched(nm); setFlipped([]);
        if (nm.size === d.memory.length / 2) submit("memory", { moves: moves + 1, seconds: Math.round((Date.now() - startAt.current) / 1000) });
      } else setTimeout(() => setFlipped([]), 800);
    }
  };

  if (!d) return <div className="flex justify-center py-24"><Loader2 className="animate-spin" /></div>;
  const GAMES: { id: Game; t: string; desc: string; Icon: typeof Brain }[] = [
    { id: "quiz", t: "تحدي المعلومات", desc: "5 أسئلة تقنية — 20 نقطة لكل إجابة صحيحة", Icon: Brain },
    { id: "price", t: "خمّن السعر", desc: "5 منتجات من المحل — كل ما قرّبت أكثر نقاط", Icon: Tag },
    { id: "memory", t: "ذاكرة ترند", desc: "طابق صور المنتجات بأقل حركات ووقت", Icon: Grid3x3 },
  ];

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold flex-1">تحديات ترند</h1>
        <a href="/gift" className="gp-btn gp-btn-ghost text-sm px-3 py-2"><Gift size={15} /> هدية اليوم</a>
      </header>
      <div className="gp-wrap w-full space-y-5">
        <section className="gp-panel gm-hero">
          <Trophy size={34} />
          <div><h2>العب كل يوم واجمع نقاط</h2><p>أعلى 3 في الأسبوع يفوزوا بـ: <b>{d.prize}</b>. الأسبوع يبدأ السبت ويقفل الجمعة بالليل.</p>
            {d.myRank && <p className="gm-me">ترتيبك هذا الأسبوع: <b>#{d.myRank}</b> · {d.myWeek} نقطة</p>}</div>
        </section>
        {d.blocked && <p className="gm-warn">{d.blocked}</p>}
        {err && <p className="gm-warn">{err}</p>}

        {result && (
          <section className="gp-panel p-5 space-y-3">
            <h3 className="font-bold text-lg">{result.late ? "⏰ انتهى الوقت" : "🎉 النتيجة"}: {result.score} نقطة</h3>
            {result.game === "quiz" && (result.reveal as { answer: number; explain: string | null; correct: boolean }[]).map((r, i) => (
              <p key={i} className="text-sm flex gap-2">{r.correct ? <CheckCircle2 size={16} className="text-green-400 shrink-0" /> : <XCircle size={16} className="text-red-400 shrink-0" />}
                <span>{d.quiz[i]?.q} — <b>{d.quiz[i]?.options[r.answer]}</b>{r.explain ? ` · ${r.explain}` : ""}</span></p>
            ))}
            {result.game === "price" && (result.reveal as { id: string; real: number; guess: number; points: number }[]).map((r) => (
              <p key={r.id} className="text-sm">{d.price.find((p) => p.id === r.id)?.name}: السعر <b>{r.real} د.ل</b> · تخمينك {r.guess} → {r.points} نقطة</p>
            ))}
            <button onClick={() => setResult(null)} className="gp-btn gp-btn-ghost text-sm">تمام</button>
          </section>
        )}

        {!open && (
          <div className="gm-grid">
            {GAMES.map(({ id, t, desc, Icon }) => {
              const m = d.mine[id];
              return (
                <div key={id} className="gp-panel gm-card">
                  <Icon size={28} />
                  <b>{t}</b><p>{desc}</p>
                  {m?.submitted ? <span className="gm-done"><CheckCircle2 size={15} /> لعبتها اليوم · {m.score} نقطة</span>
                    : <button onClick={() => start(id)} disabled={!!d.blocked} className="gp-btn gp-btn-main w-full">{m ? "كمّل" : "العب الآن"}</button>}
                </div>
              );
            })}
          </div>
        )}

        {open === "quiz" && (
          <section className="gp-panel p-5 space-y-4">
            <div className="flex items-center"><b className="flex-1">تحدي المعلومات</b><Timer limit={limit} onEnd={() => submit("quiz", { answers })} /></div>
            {d.quiz.map((q, i) => (
              <div key={i} className="space-y-2">
                <p className="font-bold text-sm">{i + 1}. {q.q}</p>
                <div className="gm-opts">{q.options.map((o, j) => <button key={j} className={answers[i] === j ? "on" : ""} onClick={() => { const a = [...answers]; a[i] = j; setAnswers(a); }}>{o}</button>)}</div>
              </div>
            ))}
            <button disabled={busy || answers.filter((x) => x !== undefined).length < d.quiz.length} onClick={() => submit("quiz", { answers })} className="gp-btn gp-btn-main w-full">{busy ? <Loader2 className="animate-spin" size={17} /> : null} إرسال الإجابات</button>
          </section>
        )}

        {open === "price" && (
          <section className="gp-panel p-5 space-y-4">
            <div className="flex items-center"><b className="flex-1">خمّن السعر بالدينار</b><Timer limit={limit} onEnd={() => submit("price", { guesses: Object.fromEntries(Object.entries(guesses).map(([k, v]) => [k, Number(v)])) })} /></div>
            <div className="gm-price">
              {d.price.map((p) => (
                <label key={p.id}>
                  <img src={p.image_url} alt="" />
                  <span>{p.name}</span>
                  <input inputMode="numeric" value={guesses[p.id] || ""} onChange={(e) => setGuesses({ ...guesses, [p.id]: e.target.value.replace(/\D/g, "") })} placeholder="السعر؟" />
                </label>
              ))}
            </div>
            <button disabled={busy || Object.values(guesses).filter(Boolean).length < d.price.length} onClick={() => submit("price", { guesses: Object.fromEntries(Object.entries(guesses).map(([k, v]) => [k, Number(v)])) })} className="gp-btn gp-btn-main w-full">إرسال</button>
          </section>
        )}

        {open === "memory" && (
          <section className="gp-panel p-5 space-y-3">
            <div className="flex items-center"><b className="flex-1">ذاكرة ترند · {moves} حركة</b><Timer limit={limit} onEnd={() => submit("memory", { moves, seconds: Math.round((Date.now() - startAt.current) / 1000) })} /></div>
            <div className="gm-mem">
              {d.memory.map((c, i) => {
                const show = flipped.includes(i) || matched.has(c.img);
                return <button key={i} onClick={() => flip(i)} className={show ? "up" : ""}>{show ? <img src={c.img} alt="" /> : <span>T</span>}</button>;
              })}
            </div>
          </section>
        )}

        <section className="gp-panel p-5 space-y-2">
          <h3 className="font-bold flex items-center gap-2"><Medal size={18} /> ترتيب هذا الأسبوع</h3>
          {!d.leaderboard.length ? <p className="text-sm text-[var(--muted)]">كن أول من يلعب هذا الأسبوع!</p> : d.leaderboard.map((r) => (
            <div key={r.rank} className={`gm-row r${r.rank}`}><b>#{r.rank}</b><span className="flex-1">{r.name}</span><b>{r.score}</b></div>
          ))}
          {d.lastWeek && <p className="text-xs text-[var(--muted)] pt-2">فائزي الأسبوع الماضي ({d.lastWeek.prize}): {d.lastWeek.winners.map((w) => `#${w.rank} ${w.name}`).join(" · ") || "لا يوجد"}</p>}
        </section>
        <p className="text-xs text-[var(--muted)] text-center leading-6">محاولة وحدة لكل لعبة يومياً لكل شخص (مربوطة بالحساب ورقم الهاتف والجهاز). الحسابات المكررة أو النتائج غير الطبيعية تُستبعد من الترتيب.</p>
      </div>
    </div>
  );
}
