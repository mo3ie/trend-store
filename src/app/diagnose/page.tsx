"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, Smartphone, Monitor, Hand, Fingerprint, Gauge, Volume2, Mic, Camera, Move3d, Vibrate,
  Wifi, Cpu, BatteryMedium, ClipboardList, Sparkles, CheckCircle2, XCircle, AlertCircle, MinusCircle, Play, Loader2,
} from "lucide-react";
import {
  readDeviceInfo, measureFps, cpuScore, networkTest, batteryInfo, playTone, micPeak, motionTest,
  type DeviceInfo, type Result, type Status,
} from "./tests";
import ReportView, { type Report } from "./Report";

type TestId = "display" | "touch" | "multi" | "fps" | "speaker" | "mic" | "camFront" | "camBack" | "motion" | "vibrate" | "network" | "cpu" | "battery";

const TESTS: { id: TestId; ar: string; desc: string; Icon: typeof Monitor; auto?: boolean }[] = [
  { id: "display", ar: "الشاشة", desc: "ألوان كاملة لكشف البكسلات الميتة والخطوط", Icon: Monitor },
  { id: "touch", ar: "اللمس", desc: "مرّر إصبعك على كل الشاشة لكشف المناطق الميتة", Icon: Hand },
  { id: "multi", ar: "اللمس المتعدد", desc: "حط أكثر من إصبع مع بعض", Icon: Fingerprint },
  { id: "fps", ar: "سلاسة الشاشة", desc: "قياس معدل التحديث", Icon: Gauge, auto: true },
  { id: "speaker", ar: "السماعات", desc: "صوت يمين ويسار", Icon: Volume2 },
  { id: "mic", ar: "المايك", desc: "تكلّم 3 ثواني", Icon: Mic },
  { id: "camFront", ar: "الكاميرا الأمامية", desc: "عرض مباشر للكاميرا", Icon: Camera },
  { id: "camBack", ar: "الكاميرا الخلفية", desc: "عرض مباشر للكاميرا", Icon: Camera },
  { id: "motion", ar: "الحساسات", desc: "التسارع والجيروسكوب — حرّك الجوال", Icon: Move3d },
  { id: "vibrate", ar: "الهزاز", desc: "أندرويد فقط", Icon: Vibrate },
  { id: "network", ar: "الإنترنت", desc: "السرعة وزمن الاستجابة", Icon: Wifi, auto: true },
  { id: "cpu", ar: "المعالج", desc: "اختبار أداء سريع", Icon: Cpu, auto: true },
  { id: "battery", ar: "البطارية", desc: "النسبة والشحن (حسب المتصفح)", Icon: BatteryMedium, auto: true },
];

const SYMPTOMS = [
  "الجهاز يسخن", "البطارية تخلص بسرعة", "يعيد التشغيل لحاله", "بطء وتعليق", "التطبيقات تقفل فجأة",
  "الشحن بطيء أو يقطع", "الشبكة أو الإشارة ضعيفة", "الواي فاي يقطع", "البلوتوث مشكلة", "Face ID / البصمة لا تعمل",
  "الصوت في المكالمات ضعيف", "الكاميرا ضبابية", "مساحة التخزين ممتلئة", "اللمس يضغط لوحده", "لا شيء — فحص عام",
];

const ST: Record<Status, { Icon: typeof CheckCircle2; cls: string; ar: string }> = {
  ok: { Icon: CheckCircle2, cls: "ok", ar: "سليم" },
  warn: { Icon: AlertCircle, cls: "warn", ar: "ملاحظة" },
  fail: { Icon: XCircle, cls: "fail", ar: "مشكلة" },
  skip: { Icon: MinusCircle, cls: "skip", ar: "تم تخطيه" },
};

export default function DiagnosePage() {
  const [dev, setDev] = useState<DeviceInfo | null>(null);
  const [res, setRes] = useState<Partial<Record<TestId, Result>>>({});
  const [running, setRunning] = useState<TestId | null>(null);
  const [overlay, setOverlay] = useState<null | "display" | "touch" | "multi" | "camFront" | "camBack">(null);
  const [ask, setAsk] = useState<null | { q: string; onYes: () => void; onNo: () => void }>(null);
  const [micLvl, setMicLvl] = useState(0);
  const [answers, setAnswers] = useState<{ symptoms: string[]; batteryHealth: string; iosUpdated: string; storageFull: string; age: string; drops: string; notes: string }>({
    symptoms: [], batteryHealth: "", iosUpdated: "", storageFull: "", age: "", drops: "", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [repId, setRepId] = useState<string | null>(null);
  const autoRan = useRef(false);

  const set = (id: TestId, r: Result) => setRes((p) => ({ ...p, [id]: r }));
  const confirm = (q: string): Promise<boolean> => new Promise((ok) => setAsk({ q, onYes: () => { setAsk(null); ok(true); }, onNo: () => { setAsk(null); ok(false); } }));

  useEffect(() => { setDev(readDeviceInfo()); }, []);

  const runAuto = async () => {
    setRunning("fps");
    const fps = await measureFps();
    set("fps", { status: fps >= 50 ? "ok" : fps >= 30 ? "warn" : "fail", value: `${fps} إطار/ث`, note: fps >= 100 ? "شاشة 120Hz (ProMotion)" : fps < 50 ? "الشاشة تتحرك ببطء — قد يكون وضع توفير الطاقة مفعّل" : undefined });
    setRunning("cpu");
    const cpu = await cpuScore();
    set("cpu", { status: cpu >= 300 ? "ok" : cpu >= 120 ? "warn" : "fail", value: `${cpu} نقطة`, note: cpu < 120 ? "أداء منخفض — قد يكون الجهاز سخن أو وضع توفير الطاقة مفعّل" : undefined });
    setRunning("battery");
    const b = await batteryInfo();
    set("battery", b ? { status: b.level < 15 && !b.charging ? "warn" : "ok", value: `${b.level}%${b.charging ? " · يشحن" : ""}` } : { status: "skip", note: "المتصفح لا يسمح بقراءة البطارية (الآيفون) — أدخل صحة البطارية في الأسئلة تحت" });
    setRunning("network");
    try {
      const n = await networkTest();
      set("network", { status: n.mbps >= 5 && n.pingMs < 250 ? "ok" : n.mbps >= 1 ? "warn" : "fail", value: `${n.mbps} ميجابت/ث · ${n.pingMs}ms` });
    } catch { set("network", { status: "fail", note: "تعذّر الاتصال" }); }
    setRunning(null);
  };

  useEffect(() => {
    if (dev && !autoRan.current) { autoRan.current = true; runAuto(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dev]);

  const run = async (id: TestId) => {
    if (running) return;
    setRunning(id);
    try {
      if (id === "display" || id === "touch" || id === "multi" || id === "camFront" || id === "camBack") { setOverlay(id); return; }
      if (id === "speaker") {
        playTone(-1); await new Promise((r) => setTimeout(r, 1100));
        const left = await confirm("سمعت الصوت من الجهة اليسرى؟");
        playTone(1); await new Promise((r) => setTimeout(r, 1100));
        const right = await confirm("سمعت الصوت من الجهة اليمنى؟");
        playTone(0, 220, 1200); await new Promise((r) => setTimeout(r, 1300));
        const clear = await confirm("الصوت واضح بدون تشويش أو طقطقة؟");
        const bad = [!left && "اليسار", !right && "اليمين"].filter(Boolean);
        set("speaker", { status: bad.length === 2 ? "fail" : bad.length || !clear ? "warn" : "ok", value: bad.length ? `لا صوت: ${bad.join("، ")}` : "يعمل", note: !clear ? "تشويش في الصوت" : undefined });
      } else if (id === "mic") {
        try {
          const peak = await micPeak(3000, setMicLvl);
          set("mic", { status: peak >= 25 ? "ok" : peak >= 8 ? "warn" : "fail", value: `مستوى ${peak}`, note: peak < 8 ? "المايك ما التقط صوت" : peak < 25 ? "الصوت الملتقط ضعيف" : undefined });
        } catch { set("mic", { status: "skip", note: "لم يتم السماح بالمايك" }); }
        setMicLvl(0);
      } else if (id === "motion") {
        set("motion", await motionTest());
      } else if (id === "vibrate") {
        if (!("vibrate" in navigator)) set("vibrate", { status: "skip", note: "الآيفون لا يسمح للمواقع بتشغيل الهزاز" });
        else { navigator.vibrate([400, 150, 400]); const ok = await confirm("حسّيت بالهزاز؟"); set("vibrate", { status: ok ? "ok" : "fail", value: ok ? "يعمل" : "لا يعمل" }); }
      } else if (id === "fps" || id === "cpu" || id === "network" || id === "battery") {
        await runAuto();
      }
    } finally {
      setRunning((r) => (r === id ? null : r));
    }
  };

  const closeOverlay = (id: TestId, r: Result) => { set(id, r); setOverlay(null); setRunning(null); };

  const analyze = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/ai/diagnose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device: dev, results: res, answers }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "فشل التحليل");
      setReport(d.report); setRepId(d.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setErr(e instanceof Error ? e.message : "فشل التحليل"); }
    setBusy(false);
  };

  const done = Object.keys(res).length;
  const ios = dev?.platform === "ios";

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold">افحص جهازك</h1>
      </header>

      <div className="gp-wrap gp-narrow w-full space-y-5">
        {report ? (
          <>
            <ReportView report={report} id={repId} device={dev || undefined} />
            <button className="gp-btn gp-btn-ghost w-full" onClick={() => { setReport(null); setRepId(null); }}>رجوع للفحص</button>
          </>
        ) : (
          <>
            <section className="gp-panel dg-hero">
              <span className="dg-hero-ic"><Smartphone size={26} /></span>
              <div>
                <h2>فحص ذكي لجهازك في دقيقتين</h2>
                <p>نفحص الشاشة واللمس والصوت والكاميرا والحساسات والأداء من المتصفح، والذكاء الاصطناعي يكتبلك تقرير بالمشاكل وحلولها خطوة بخطوة.</p>
              </div>
            </section>

            {dev && (
              <section className="gp-panel dg-info">
                <div><small>الجهاز</small><b>{dev.model || dev.os}</b></div>
                <div><small>النظام</small><b>{dev.os} {dev.osVersion}</b></div>
                <div><small>الشاشة</small><b>{dev.screen} ×{dev.dpr}</b></div>
                <div><small>المتصفح</small><b>{dev.browser}</b></div>
                {dev.cores && <div><small>الأنوية</small><b>{dev.cores}</b></div>}
                {dev.memoryGb && <div><small>الذاكرة</small><b>~{dev.memoryGb}GB</b></div>}
              </section>
            )}
            {ios && (
              <p className="dg-note">ملاحظة: أبل ما تسمحش للمواقع تقرأ صحة البطارية وسجلات النظام. لهذا نسألك عنها تحت — وللفحص العميق بالكابل زورنا في المحل.</p>
            )}

            <div className="dg-grid">
              {TESTS.map(({ id, ar, desc, Icon }) => {
                const r = res[id];
                const s = r ? ST[r.status] : null;
                return (
                  <button key={id} className={`gp-panel dg-test ${s ? s.cls : ""}`} onClick={() => run(id)} disabled={!!running && running !== id}>
                    <span className="dg-ic"><Icon size={20} /></span>
                    <span className="dg-t"><b>{ar}</b><small>{r?.value || r?.note || desc}</small></span>
                    <span className="dg-st">
                      {running === id ? <Loader2 size={18} className="animate-spin" /> : s ? <s.Icon size={19} /> : <Play size={16} />}
                    </span>
                    {id === "mic" && running === "mic" && <i className="dg-meter" style={{ width: `${micLvl}%` }} />}
                  </button>
                );
              })}
            </div>

            <section className="gp-panel dg-q">
              <h3><ClipboardList size={18} /> أسئلة سريعة</h3>
              <p className="dg-qlabel">شنو المشاكل اللي تلاحظها؟</p>
              <div className="dg-chips">
                {SYMPTOMS.map((s) => {
                  const on = answers.symptoms.includes(s);
                  return <button key={s} className={on ? "on" : ""} onClick={() => setAnswers((a) => ({ ...a, symptoms: on ? a.symptoms.filter((x) => x !== s) : [...a.symptoms, s] }))}>{s}</button>;
                })}
              </div>
              {ios && (
                <>
                  <label className="dg-field">صحة البطارية % <small>(الإعدادات ← البطارية ← صحة البطارية)</small>
                    <input inputMode="numeric" maxLength={3} value={answers.batteryHealth} onChange={(e) => setAnswers((a) => ({ ...a, batteryHealth: e.target.value.replace(/\D/g, "") }))} placeholder="مثلاً 86" />
                  </label>
                  <label className="dg-field">هل نظام iOS محدّث؟ <small>(الإعدادات ← عام ← تحديث البرنامج)</small>
                    <select value={answers.iosUpdated} onChange={(e) => setAnswers((a) => ({ ...a, iosUpdated: e.target.value }))}>
                      <option value="">—</option><option>نعم محدّث</option><option>فيه تحديث متاح</option><option>ما نعرف</option>
                    </select>
                  </label>
                </>
              )}
              <label className="dg-field">مساحة التخزين
                <select value={answers.storageFull} onChange={(e) => setAnswers((a) => ({ ...a, storageFull: e.target.value }))}>
                  <option value="">—</option><option>فيها مساحة كافية</option><option>شبه ممتلئة</option><option>ممتلئة</option>
                </select>
              </label>
              <label className="dg-field">عمر الجهاز
                <select value={answers.age} onChange={(e) => setAnswers((a) => ({ ...a, age: e.target.value }))}>
                  <option value="">—</option><option>أقل من سنة</option><option>1-2 سنة</option><option>2-4 سنوات</option><option>أكثر من 4</option>
                </select>
              </label>
              <label className="dg-field">طاح أو تبلّل قبل؟
                <select value={answers.drops} onChange={(e) => setAnswers((a) => ({ ...a, drops: e.target.value }))}>
                  <option value="">—</option><option>لا</option><option>طاح</option><option>تبلّل</option><option>الاثنين</option>
                </select>
              </label>
              <label className="dg-field">ملاحظات أخرى
                <textarea rows={2} maxLength={400} value={answers.notes} onChange={(e) => setAnswers((a) => ({ ...a, notes: e.target.value }))} placeholder="اوصف المشكلة بكلامك…" />
              </label>
            </section>

            {err && <p className="dg-err">{err}</p>}
            <button className="gp-btn gp-btn-main w-full dg-go" onClick={analyze} disabled={busy || done < 3}>
              {busy ? <><Loader2 size={18} className="animate-spin" /> الذكاء الاصطناعي يحلّل…</> : <><Sparkles size={18} /> حلّل النتائج واكتب التقرير</>}
            </button>
            {done < 3 && <p className="dg-note text-center">سوّ 3 فحوصات على الأقل (الفحوصات التلقائية تشتغل لحالها)</p>}
          </>
        )}
      </div>

      {overlay === "display" && <DisplayTest onDone={(r) => closeOverlay("display", r)} confirm={confirm} />}
      {overlay === "touch" && <TouchTest onDone={(r) => closeOverlay("touch", r)} />}
      {overlay === "multi" && <MultiTest onDone={(r) => closeOverlay("multi", r)} />}
      {(overlay === "camFront" || overlay === "camBack") && <CamTest facing={overlay === "camFront" ? "user" : "environment"} onDone={(r) => closeOverlay(overlay, r)} confirm={confirm} />}
      {ask && createPortal(
        <div className="dg-ask"><div className="gp-panel"><p>{ask.q}</p><div><button className="gp-btn gp-btn-main" onClick={ask.onYes}>نعم</button><button className="gp-btn gp-btn-ghost" onClick={ask.onNo}>لا</button></div></div></div>,
        document.body,
      )}
    </div>
  );
}

/* ── Full-screen tests ─────────────────────────────────────────── */

function Full({ children, onClick, bg }: { children?: React.ReactNode; onClick?: () => void; bg?: string }) {
  return createPortal(<div className="dg-full" style={{ background: bg }} onClick={onClick}>{children}</div>, document.body);
}

function DisplayTest({ onDone, confirm }: { onDone: (r: Result) => void; confirm: (q: string) => Promise<boolean> }) {
  const COLORS = ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000", "#808080"];
  const [i, setI] = useState(0);
  const next = async () => {
    if (i < COLORS.length - 1) { setI(i + 1); return; }
    const dead = await confirm("شفت نقاط ثابتة أو خطوط أو بقع في أي لون؟");
    const tint = await confirm("فيه اصفرار أو ظل أو حرق صورة (Burn-in) واضح؟");
    onDone({ status: dead ? "fail" : tint ? "warn" : "ok", value: dead ? "نقاط/خطوط ظاهرة" : tint ? "تغيّر لون/ظل" : "الشاشة سليمة" });
  };
  return <Full bg={COLORS[i]} onClick={next}>{i === 0 && <span className="dg-hint">المس الشاشة للون التالي ({COLORS.length} ألوان)</span>}</Full>;
}

function TouchTest({ onDone }: { onDone: (r: Result) => void }) {
  const COLS = 7, ROWS = 12;
  const [hit, setHit] = useState<Set<number>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const finish = (h: Set<number>) => {
    const pct = Math.round((h.size / (COLS * ROWS)) * 100);
    onDone({ status: pct >= 98 ? "ok" : pct >= 85 ? "warn" : "fail", value: `${pct}% من الشاشة استجابت`, note: pct < 98 ? "فيه مناطق ما استجابتش للمس" : undefined });
  };
  const mark = (x: number, y: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const c = Math.floor(((x - r.left) / r.width) * COLS), w = Math.floor(((y - r.top) / r.height) * ROWS);
    if (c < 0 || w < 0 || c >= COLS || w >= ROWS) return;
    const k = w * COLS + c;
    setHit((h) => { if (h.has(k)) return h; const n = new Set(h); n.add(k); if (n.size === COLS * ROWS) setTimeout(() => finish(n), 200); return n; });
  };
  return (
    <Full bg="#0b1220">
      <div ref={ref} className="dg-touch" style={{ gridTemplateColumns: `repeat(${COLS},1fr)` }}
        onPointerDown={(e) => mark(e.clientX, e.clientY)}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") mark(e.clientX, e.clientY); }}
        onTouchMove={(e) => { for (const t of Array.from(e.touches)) mark(t.clientX, t.clientY); }}>
        {Array.from({ length: COLS * ROWS }, (_, k) => <i key={k} className={hit.has(k) ? "on" : ""} />)}
      </div>
      <button className="dg-done" onClick={() => finish(hit)}>انتهيت ({Math.round((hit.size / (COLS * ROWS)) * 100)}%)</button>
    </Full>
  );
}

function MultiTest({ onDone }: { onDone: (r: Result) => void }) {
  const [max, setMax] = useState(0);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const upd = (e: React.TouchEvent) => {
    const p = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
    setPts(p); setMax((m) => Math.max(m, p.length));
  };
  return (
    <Full bg="#0b1220">
      <div className="dg-multi" onTouchStart={upd} onTouchMove={upd} onTouchEnd={upd}>
        <p>حط أصابعك على الشاشة مع بعض<br /><b>{max}</b> أصابع</p>
        {pts.map((p, i) => <span key={i} style={{ left: p.x, top: p.y }} />)}
      </div>
      <button className="dg-done" onClick={() => onDone({ status: max >= 4 ? "ok" : max >= 2 ? "warn" : "fail", value: `${max} لمسات في نفس الوقت`, note: max < 2 ? "اللمس المتعدد ما اشتغلش (أو الجهاز بدون شاشة لمس)" : undefined })}>انتهيت</button>
    </Full>
  );
}

function CamTest({ facing, onDone, confirm }: { facing: "user" | "environment"; onDone: (r: Result) => void; confirm: (q: string) => Promise<boolean> }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [info, setInfo] = useState("");
  const [fail, setFail] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing }, width: { ideal: 1920 } }, audio: false })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false }));
        streamRef.current = s;
        if (vid.current) { vid.current.srcObject = s; await vid.current.play().catch(() => {}); }
        const st = s.getVideoTracks()[0]?.getSettings();
        if (st?.width) setInfo(`${st.width}×${st.height}`);
      } catch { setFail(true); }
    })();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [facing]);
  const end = async () => {
    if (fail) { onDone({ status: "fail", note: "الكاميرا ما اشتغلتش أو ما تم السماح بيها" }); return; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const clear = await confirm("الصورة واضحة وبدون بقع أو اهتزاز؟");
    onDone({ status: clear ? "ok" : "warn", value: info ? `تعمل · ${info}` : "تعمل", note: clear ? undefined : "الصورة غير واضحة — قد تكون العدسة مخدوشة أو التركيز لا يعمل" });
  };
  return (
    <Full bg="#000">
      {fail ? <p className="dg-hint">تعذّر تشغيل الكاميرا</p> : <video ref={vid} playsInline muted className="dg-cam" style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} />}
      <button className="dg-done" onClick={end}>انتهيت</button>
    </Full>
  );
}
