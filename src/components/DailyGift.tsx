"use client";

import { useEffect, useState } from "react";
import { Gift, Clock, Users, CheckCircle2, ShieldCheck, Trophy, Loader2 } from "lucide-react";

type Draw = { day: string; gift_title: string; gift_image: string | null; seed_hash: string; winner_name: string | null; drawn: boolean; entries_live?: number; draw_at?: string };
type Data = { today: Draw | null; history: Draw[]; signedIn: boolean; entered: boolean; myWins: { day: string; gift_title: string; claim_code: string; claimed: boolean }[] };

function left(ms: number) {
  if (ms <= 0) return "الآن";
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Homepage block: today's gift, live countdown, one-tap entry, last winner. */
export default function DailyGift() {
  const [d, setD] = useState<Data | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => fetch("/api/gift").then((r) => r.json()).then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const enter = async () => {
    if (!d?.signedIn) { window.location.href = "/login?next=/"; return; }
    setBusy(true); setMsg("");
    const r = await fetch("/api/gift", { method: "POST" });
    const j = await r.json();
    if (!r.ok) setMsg(j.error || "تعذّرت المشاركة"); else await load();
    setBusy(false);
  };

  if (!d?.today) return null;
  const t = d.today;
  const ms = new Date(t.draw_at || 0).getTime() - now;
  const last = d.history[0];
  const unclaimed = d.myWins.find((w) => !w.claimed);

  return (
    <section className="dg2" aria-label="هدية اليوم">
      {unclaimed && (
        <div className="dg2-win"><Trophy size={18} /> مبروك! فزت بـ «{unclaimed.gift_title}» — كود الاستلام: <b dir="ltr">{unclaimed.claim_code}</b> <a href="/gift">التفاصيل</a></div>
      )}
      <div className="dg2-main">
        <div className="dg2-gift">
          {t.gift_image ? <img src={t.gift_image} alt="" /> : <span className="dg2-box"><Gift size={46} /></span>}
        </div>
        <div className="dg2-body">
          <span className="dg2-kicker"><Gift size={13} /> هدية اليوم · مجانية</span>
          <h2>{t.gift_title}</h2>
          <p>شارك بضغطة وحدة كل يوم. السحب يصير <b>تلقائياً الساعة 9 بالليل</b> بدون أي تدخل منا — والنتيجة تقدر تتحقق منها بنفسك.</p>
          <div className="dg2-stats">
            <span><Clock size={14} /> السحب بعد <b dir="ltr">{left(ms)}</b></span>
            <span><Users size={14} /> {t.entries_live ?? 0} مشارك</span>
          </div>
          <div className="dg2-cta">
            {d.entered ? (
              <span className="dg2-in"><CheckCircle2 size={17} /> أنت مشارك اليوم — بالتوفيق!</span>
            ) : ms > 0 ? (
              <button onClick={enter} disabled={busy} className="dg2-btn">{busy ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />} {d.signedIn ? "شارك في سحب اليوم" : "سجّل دخول وشارك"}</button>
            ) : <span className="dg2-in">تم سحب اليوم — شارك بكرة</span>}
            <a href="/gift" className="dg2-link"><ShieldCheck size={14} /> كيف نضمن النزاهة؟</a>
          </div>
          {msg && <p className="dg2-msg">{msg}</p>}
          {last && <p className="dg2-last"><Trophy size={13} /> فائز {new Date(last.day).toLocaleDateString("ar-LY", { day: "numeric", month: "long" })}: <b>{last.winner_name || "لا يوجد مشاركين"}</b> — {last.gift_title}</p>}
        </div>
      </div>
    </section>
  );
}
