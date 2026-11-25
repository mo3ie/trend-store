"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, Stethoscope, Wrench, Sparkles, Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { speak, stopVoice, voiceOn, setVoiceOn } from "./trendyVoice";

type P = { id: string; name: string; price: number; image_url: string | null; inStock: boolean };
type M = { role: "user" | "assistant"; content: string; products?: P[]; action?: string | null; page?: { href: string; label: string } | null };

const CHIPS = [
  "أبي جوال كويس تحت 1500 دينار",
  "سماعات مناسبة للألعاب",
  "جوالي صاير بطيء والبطارية تخلص بسرعة",
  "كيف نشحن عداد الكهرباء من الموقع؟",
  "كيف نبيع جوالي المستعمل بضمان؟",
];

const KEY = "trendy_chat_v1";

export type ChatState = "thinking" | "speaking" | "idle";

export default function TrendyChat({ open, onClose, onState }: { open: boolean; onClose: () => void; onState?: (s: ChatState) => void }) {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [voice, setVoice] = useState(true);
  useEffect(() => { setVoice(voiceOn()); }, []);
  useEffect(() => { if (!open) stopVoice(); }, [open]);

  useEffect(() => {
    setMounted(true);
    try { const s = sessionStorage.getItem(KEY); if (s) setMsgs(JSON.parse(s)); } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20))); } catch {}
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (q: string) => {
    const content = q.trim();
    if (!content || busy) return;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setText("");
    setBusy(true);
    onState?.("thinking");
    let reply = "";
    try {
      const r = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const d = await r.json();
      setMsgs([...next, { role: "assistant", content: d.reply || "…", products: d.products || [], action: d.action, page: d.page || null }]);
      reply = d.reply || "";
    } catch {
      setMsgs([...next, { role: "assistant", content: "ما قدرتش نوصل للسيرفر، جرّب مرة ثانية." }]);
    } finally {
      setBusy(false);
      if (reply && voiceOn()) speak(reply, { start: () => onState?.("speaking"), end: () => onState?.("idle") });
      else { onState?.("speaking"); setTimeout(() => onState?.("idle"), 2200); }
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="tc-wrap" role="dialog" aria-label="ترندي — المساعد الذكي" dir="rtl">
      <div className="tc-panel">
        <header className="tc-head">
          <span className="tc-orb" aria-hidden><Sparkles size={16} /></span>
          <div className="tc-title"><b>ترندي</b><small>مساعدك الذكي في محل ترند</small></div>
          <button className="tc-x" onClick={() => { const n = !voice; setVoice(n); setVoiceOn(n); if (n) speak("هلا! أنا ترندي، تحت أمرك."); }} aria-label={voice ? "إيقاف الصوت" : "تشغيل الصوت"} title={voice ? "إيقاف صوت ترندي" : "تشغيل صوت ترندي"}>{voice ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="tc-x" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </header>

        <div className="tc-body">
          {msgs.length === 0 && (
            <div className="tc-hello">
              <p>أهلاً 👋 أنا <b>ترندي</b>. قولّي شنو تدوّر عليه، اوصفلي مشكلة جوالك، أو اسألني على أي ميزة في الموقع ونشرحهالك.</p>
              <div className="tc-chips">
                {CHIPS.map((c) => <button key={c} onClick={() => send(c)}>{c}</button>)}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`tc-msg ${m.role}`}>
              <div className="tc-bubble" style={{ whiteSpace: "pre-line" }}>{m.content}</div>
              {!!m.products?.length && (
                <div className="tc-prods">
                  {m.products.map((p) => (
                    <a key={p.id} href={`/products/${p.id}`} className="tc-prod">
                      {p.image_url ? <img src={p.image_url} alt="" /> : <span className="tc-noimg" />}
                      <span className="tc-pn">{p.name}</span>
                      <b>{p.price} د.ل</b>
                      {!p.inStock && <em>غير متوفر</em>}
                    </a>
                  ))}
                </div>
              )}
              {m.action === "diagnose" && <a className="tc-act" href="/diagnose"><Stethoscope size={15} /> افحص جهازك الآن</a>}
              {m.action === "repair" && <a className="tc-act" href="/?repair=1"><Wrench size={15} /> احجز صيانة</a>}
              {m.page && m.page.href !== "/diagnose" && m.page.href !== "/?repair=1" && <a className="tc-act" href={m.page.href}><ArrowLeft size={15} /> افتح «{m.page.label}»</a>}
            </div>
          ))}
          {busy && <div className="tc-msg assistant"><div className="tc-bubble tc-typing"><i /><i /><i /></div></div>}
          <div ref={endRef} />
        </div>

        <form className="tc-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب سؤالك…" maxLength={500} />
          <button type="submit" disabled={busy || !text.trim()} aria-label="إرسال"><Send size={17} /></button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
