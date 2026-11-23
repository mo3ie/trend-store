"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ArrowRight, Microscope, ShieldCheck, Loader2, CheckCircle2, Smartphone, FileUp, Settings, ChevronLeft, BatteryCharging, Bug, AppWindow, MemoryStick, Store, Copy, Check, FileCheck2, Lock } from "lucide-react";
import WalletModal from "@/components/WalletModal";
import { summarize, hasUsefulData, type AnalyticsSummary } from "@/lib/iosAnalytics";

type Data = { price: number; signedIn: boolean; vouchers: { code: string; status: string; created_at: string; report_id: string | null }[]; reports: { id: string; score: number; created_at: string; device: { model?: string; source?: string } }[] };

const SHOTS_IOS = [
  { t: "الإعدادات ← البطارية ← صحة البطارية والشحن", d: "صوّر الشاشة اللي فيها «السعة القصوى» %" },
  { t: "الإعدادات ← عام ← حول", d: "صوّر أعلى الصفحة (الموديل والسعة) — وانزل وصوّر قسم «البطارية» (عدد الدورات) لو موجود" },
  { t: "داخل «حول»: سجل القطع والصيانة", d: "Parts and Service History — يوضح كل قطعة أصلية أو «غير معروفة» (iOS 17.4 وأحدث)" },
];
const SHOTS_ANDROID = [
  { t: "الإعدادات ← حول الهاتف", d: "صوّر الموديل ونسخة أندرويد" },
  { t: "الإعدادات ← البطارية ← معلومات البطارية", d: "سامسونج: «العناية بالجهاز ← البطارية» أو تطبيق Samsung Members ← التشخيص · بكسل: «صحة البطارية»" },
  { t: "سامسونج (اختياري): اطلب #0228#*", d: "يعرض حالة البطارية (Battery status) — صوّرها" },
];
const STEPS_IOS = [
  { t: "افتح «الإعدادات»", d: "تطبيق الإعدادات الرمادي ⚙️" },
  { t: "الخصوصية والأمان", d: "انزل تحت شوية — Privacy & Security" },
  { t: "التحليلات والتحسينات", d: "آخر الصفحة — Analytics & Improvements (تأكد إن «مشاركة تحليلات iPhone» مفعّلة)" },
  { t: "بيانات التحليلات", d: "Analytics Data — قائمة ملفات بأسماء وتواريخ" },
  { t: "اختار الملفات", d: "أحدث ملف يبدأ بـ «Analytics-»، وأي ملف يبدأ بـ «panic-full» أو «JetsamEvent» لو موجود" },
  { t: "شارك ← حفظ في الملفات", d: "اضغط زر المشاركة ↑ ثم «حفظ في الملفات» (Save to Files) لكل ملف" },
  { t: "ارجع هنا وارفعهم", d: "اضغط «اختار الملفات» تحت واختارهم من تطبيق الملفات — القراءة تتم في جوالك" },
];

export default function DeepScanPage() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [topup, setTopup] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [sum, setSum] = useState<AnalyticsSummary | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const shotRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [done, setDone] = useState<{ id: string; score: number } | null>(null);
  const [copied, setCopied] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetch("/api/deep-scan").then((r) => r.json()).then(setD);
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search).get("quick");
    try {
      if (q) { localStorage.setItem("trend_deep_quick", q); localStorage.removeItem("trend_deep_pending"); }
      setQuick(q || localStorage.getItem("trend_deep_quick"));
    } catch { setQuick(q); }
  }, []);

  const paid = d?.vouchers.find((v) => v.status === "paid");
  const buy = async () => {
    if (!d?.signedIn) { window.location.href = "/login?next=/deep-scan"; return; }
    setBusy(true); setErr("");
    const r = await fetch("/api/deep-scan", { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (j.code === "INSUFFICIENT") { setTopup(true); return; }
    if (!r.ok) { setErr(j.error); return; }
    load();
  };
  const runQuick = () => { try { localStorage.setItem("trend_deep_pending", "1"); } catch {} window.location.href = "/diagnose"; };
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setParsing(true); setErr("");
    try {
      const s = await summarize(Array.from(files));
      setSum(s);
      if (!hasUsefulData(s)) setErr("الملفات هذي ما فيهاش بيانات بطارية أو أعطال. اختار أحدث ملف يبدأ بـ «Analytics-» (يكون فيه تاريخ أمس أو اليوم).");
    } catch { setErr("تعذّرت قراءة الملفات"); }
    setParsing(false);
  };
  const submit = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/deep-scan/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analytics: sum, images: shots, quickReportId: quick }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    try { localStorage.removeItem("trend_deep_quick"); } catch {}
    setDone({ id: j.id, score: j.score }); load();
  };

  const step = !paid && !done ? 1 : done ? 4 : (sum && hasUsefulData(sum)) || shots.length ? 3 : 2;

  // Screenshots are downscaled in the browser (≤1280px JPEG) before upload.
  const addShots = async (files: FileList | null) => {
    const out: string[] = [];
    for (const f of Array.from(files || []).slice(0, 5 - shots.length)) {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      out.push(c.toDataURL("image/jpeg", 0.82));
    }
    setShots((p) => [...p, ...out].slice(0, 5)); setErr("");
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/diagnose" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold">الفحص العميق للآيفون</h1>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-4">
        <section className="gp-panel p-5 flex gap-4 items-center">
          <Microscope size={38} className="text-cyan-300 shrink-0" />
          <div><h2 className="text-lg font-black">فحص عميق من جوالك — بدون كابل</h2>
            <p className="text-sm text-[var(--muted)] leading-7">نقرأ سجلات النظام اللي يحفظها الآيفون بنفسه: <b>صحة البطارية الحقيقية ودوراتها، أعطال النظام وأسبابها، التطبيقات اللي تتعطّل، وضغط الذاكرة</b> — مع فحص الشاشة واللمس والصوت والكاميرات — وتطلع شهادة بالذكاء الاصطناعي. <b>{d?.price ?? 5} د.ل</b>.</p></div>
        </section>

        <ol className="dsx-steps">{["الدفع", "فحص الهاردوير", "ملفات النظام", "الشهادة"].map((t, i) => <li key={t} className={step > i + 1 ? "done" : step === i + 1 ? "on" : ""}><i>{step > i + 1 ? "✓" : i + 1}</i>{t}</li>)}</ol>
        {err && <p className="gm-warn">{err}</p>}

        {/* 1 — pay */}
        {step === 1 && (
          <section className="gp-panel p-5 space-y-3 text-center">
            <Lock size={28} className="mx-auto text-cyan-300" />
            <p className="text-sm">ادفع {d?.price ?? 5} د.ل من محفظتك وتبدأ الفحص فوراً. لو الملفات طلعت فاضية ما يتخصمش الكود.</p>
            <button onClick={buy} disabled={busy} className="gp-btn gp-btn-main w-full">{busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} ادفع {d?.price ?? 5} د.ل وابدأ</button>
          </section>
        )}

        {/* 2 — hardware (optional) + files */}
        {(step === 2 || step === 3) && (
          <>
            <section className="gp-panel p-5 space-y-3">
              <h3 className="font-bold flex items-center gap-2"><Smartphone size={18} /> فحص الهاردوير <small className="font-normal text-[var(--muted)]">(اختياري — دقيقتين)</small></h3>
              {quick ? <p className="text-sm text-green-400 flex items-center gap-1"><CheckCircle2 size={16} /> تم — بيتضاف للشهادة</p>
                : <button onClick={runQuick} className="gp-btn gp-btn-ghost w-full">ابدأ فحص الشاشة واللمس والصوت والكاميرات <ChevronLeft size={16} /></button>}
            </section>

            <section className="gp-panel p-5 space-y-3">
              <h3 className="font-bold flex items-center gap-2"><Camera size={18} /> صوّر شاشات الإعدادات <small className="font-normal text-green-400">(الأسهل — دقيقة)</small></h3>
              <div className="flex gap-2">{(["ios", "android"] as const).map((p) => <button key={p} className={`gp-pill ${platform === p ? "on" : ""}`} onClick={() => setPlatform(p)}>{p === "ios" ? "آيفون" : "أندرويد"}</button>)}</div>
              <ol className="dsx-guide">{(platform === "ios" ? SHOTS_IOS : SHOTS_ANDROID).map((s, i) => <li key={i}><b>{i + 1}</b><div><span>{s.t}</span><small>{s.d}</small></div></li>)}</ol>
              {!!shots.length && <div className="dsx-shots">{shots.map((u, i) => <div key={i}><img src={u} alt="" /><button onClick={() => setShots(shots.filter((_, j) => j !== i))}>×</button></div>)}</div>}
              <button onClick={() => shotRef.current?.click()} className="gp-btn gp-btn-main w-full"><Camera size={18} /> {shots.length ? "أضف صور أخرى" : "اختار الصور"}</button>
              <input ref={shotRef} type="file" accept="image/*" multiple hidden onChange={(e) => addShots(e.target.files)} />
              <p className="text-xs text-[var(--muted)] text-center">الذكاء الاصطناعي يقرا الأرقام من الصور — صحة البطارية، الدورات، والقطع الأصلية أو المبدّلة.</p>
            </section>

            <section className="gp-panel p-5 space-y-3">
              <h3 className="font-bold flex items-center gap-2"><Settings size={18} /> ملفات النظام <small className="font-normal text-[var(--muted)]">(متقدم — للآيفون: أعطال النظام والتطبيقات)</small></h3>
              <ol className="dsx-guide">{STEPS_IOS.map((s, i) => <li key={i}><b>{i + 1}</b><div><span>{s.t}</span><small>{s.d}</small></div></li>)}</ol>
              <button onClick={() => fileRef.current?.click()} disabled={parsing} className="gp-btn gp-btn-main w-full">{parsing ? <Loader2 className="animate-spin" size={18} /> : <FileUp size={18} />} اختار الملفات</button>
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => pick(e.target.files)} />
              <p className="text-xs text-[var(--muted)] text-center">🔒 الملفات تنقرا داخل جوالك — نرسل للموقع الأرقام فقط، مش الملفات.</p>
            </section>
          </>
        )}

        {/* 3 — preview + submit */}
        {step === 3 && (
          <section className="gp-panel p-5 space-y-3">
            <h3 className="font-bold">{shots.length ? `${shots.length} صورة` : ""}{shots.length && sum ? " + " : ""}{sum ? `${sum.files} ملف` : ""} — جاهز للتحليل</h3>
            {sum && <div className="dsx-grid">
              <div><BatteryCharging size={18} /><small>صحة البطارية</small><b>{sum.battery.healthPct != null ? `${sum.battery.healthPct}%` : "—"}</b><small>{sum.battery.cycles != null ? `${sum.battery.cycles} دورة` : ""}</small></div>
              <div><Bug size={18} /><small>أعطال النظام</small><b>{sum.panics.total}</b><small>آخر 30 يوم: {sum.panics.last30d}</small></div>
              <div><AppWindow size={18} /><small>أعطال التطبيقات</small><b>{sum.appCrashes.total}</b><small>{sum.appCrashes.top[0]?.app || ""}</small></div>
              <div><MemoryStick size={18} /><small>ضغط الذاكرة</small><b>{sum.jetsam}</b><small>{sum.device.model || ""} {sum.device.ios ? `· iOS ${sum.device.ios}` : ""}</small></div>
            </div>}
            <div className="flex gap-2">
              <button onClick={submit} disabled={busy} className="gp-btn gp-btn-main flex-1">{busy ? <Loader2 className="animate-spin" size={18} /> : <FileCheck2 size={18} />} حلّل وأصدر الشهادة</button>
              <button onClick={() => fileRef.current?.click()} className="gp-btn gp-btn-ghost">ملفات أخرى</button>
            </div>
          </section>
        )}

        {/* 4 — done */}
        {done && (
          <section className="gp-panel p-6 space-y-3 text-center">
            <CheckCircle2 size={44} className="mx-auto text-green-400" />
            <h3 className="text-xl font-black">الشهادة جاهزة — {done.score}/100</h3>
            <a href={`/diagnose/r/${done.id}`} className="gp-btn gp-btn-main w-full">اعرض الشهادة</a>
          </section>
        )}

        <section className="gp-panel p-5 space-y-2 text-sm">
          <b className="flex items-center gap-2"><Store size={16} /> تفضّل الفحص في المحل بالكابل؟</b>
          <p className="text-[var(--muted)] leading-7">نفس الكود يصلح في المحل: جيب الجوال والفني يفحصه بالكابل — شهادة <b>موثّقة من المحل</b> (الأفضل لو بتبيع الجهاز في سوق المستعمل).</p>
          {d?.vouchers.filter((v) => v.status === "paid").map((v) => (
            <div key={v.code} className="cd-code"><span dir="ltr" className="font-mono">{v.code}</span><small>جاهز</small>
              <button onClick={async () => { await navigator.clipboard.writeText(v.code); setCopied(v.code); setTimeout(() => setCopied(""), 1500); }}>{copied === v.code ? <Check size={15} /> : <Copy size={15} />}</button></div>
          ))}
        </section>

        {!!d?.reports.length && (
          <section className="gp-panel p-5 space-y-2">
            <b className="flex items-center gap-2"><FileCheck2 size={16} /> شهاداتي</b>
            {d.reports.map((r) => <a key={r.id} href={`/diagnose/r/${r.id}`} className="flex gap-3 text-sm rounded-lg bg-white/5 px-3 py-2"><span className="flex-1">{r.device?.model || "iPhone"} · {r.device?.source === "usb" ? "بالكابل في المحل" : "من الجوال"}</span><b>{r.score}/100</b><span className="text-[var(--muted)]">{new Date(r.created_at).toLocaleDateString("ar-LY")}</span></a>)}
          </section>
        )}
      </div>
      {topup && <WalletModal onClose={() => setTopup(false)} payAmount={d?.price ?? 5} payLabel="الفحص العميق للآيفون" onPaid={() => { setTopup(false); buy(); }} />}
    </div>
  );
}
