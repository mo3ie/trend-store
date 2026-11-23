"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Microscope, BatteryCharging, HardDrive, Bug, Cpu, ShieldCheck, Loader2, Copy, Check, Store, FileCheck2 } from "lucide-react";
import WalletModal from "@/components/WalletModal";

type Data = { price: number; signedIn: boolean; vouchers: { code: string; status: string; created_at: string; report_id: string | null }[]; reports: { id: string; score: number; created_at: string; device: { model?: string } }[] };

export default function DeepScanPage() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [topup, setTopup] = useState(false);
  const [copied, setCopied] = useState("");
  const load = () => fetch("/api/deep-scan").then((r) => r.json()).then(setD);
  useEffect(() => { load(); }, []);

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

  const READS = [
    { Icon: BatteryCharging, t: "صحة البطارية الحقيقية", d: "النسبة الفعلية + عدد دورات الشحن + السعة الأصلية مقابل الحالية" },
    { Icon: Bug, t: "سجلات أعطال النظام", d: "كل الـ Kernel Panics وأسبابها — تكشف قطع أو فلكسات معطوبة" },
    { Icon: Cpu, t: "الموديل والسيريال", d: "الطراز الدقيق ونسخة iOS وحالة التفعيل" },
    { Icon: HardDrive, t: "التخزين", d: "المساحة الكلية والفاضية" },
  ];

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/diagnose" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold">الفحص العميق للآيفون</h1>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-5">
        <section className="gp-panel p-6 space-y-3 text-center">
          <Microscope size={40} className="mx-auto text-cyan-300" />
          <h2 className="text-xl font-black">فحص بالكابل يقرأ من داخل الآيفون</h2>
          <p className="text-sm text-[var(--muted)] leading-7">الفحص من المتصفح يقيس اللي يقدر المتصفح يشوفه. الفحص العميق يتم في المحل بالكابل ويقرأ بيانات أبل ما تسمحش لأي موقع يوصلها — وتطلعلك <b>شهادة فحص رسمية</b> بالذكاء الاصطناعي تقدر تشاركها أو تحطها في إعلان بيع.</p>
          <div className="text-4xl font-black">{d?.price ?? 5} <span className="text-base font-normal">د.ل</span></div>
          <button onClick={buy} disabled={busy} className="gp-btn gp-btn-main w-full">{busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} ادفع واحصل على كود الفحص</button>
          {err && <p className="text-red-400 text-sm">{err}</p>}
        </section>

        <section className="grid sm:grid-cols-2 gap-3">
          {READS.map(({ Icon, t, d: desc }) => (
            <div key={t} className="gp-panel p-4 flex gap-3"><Icon className="text-cyan-300 shrink-0" /><div><b className="text-sm">{t}</b><p className="text-xs text-[var(--muted)] mt-1 leading-6">{desc}</p></div></div>
          ))}
        </section>

        <section className="gp-panel p-5 text-sm leading-7 space-y-1">
          <b className="flex items-center gap-2"><Store size={16} /> كيف يتم؟</b>
          <p>1) ادفع واحصل على الكود هنا. 2) جيب الآيفون للمحل (ما تحتاج حجز). 3) الفني يوصّله بالكابل ويدخّل الكود. 4) الشهادة توصلك في حسابك وإشعار خلال دقائق.</p>
        </section>

        {!!d?.vouchers.length && (
          <section className="gp-panel p-5 space-y-2">
            <b>أكواد الفحص</b>
            {d.vouchers.map((v) => (
              <div key={v.code} className="cd-code">
                <span dir="ltr" className="font-mono">{v.code}</span>
                <small>{v.status === "paid" ? "جاهز للاستعمال" : v.status === "used" ? "مستعمل" : "مسترجع"}</small>
                {v.status === "paid" ? <button onClick={async () => { await navigator.clipboard.writeText(v.code); setCopied(v.code); setTimeout(() => setCopied(""), 1500); }}>{copied === v.code ? <Check size={15} /> : <Copy size={15} />}</button>
                  : v.report_id ? <a href={`/diagnose/r/${v.report_id}`} className="text-cyan-300 text-xs">الشهادة</a> : null}
              </div>
            ))}
          </section>
        )}
        {!!d?.reports.length && (
          <section className="gp-panel p-5 space-y-2">
            <b className="flex items-center gap-2"><FileCheck2 size={16} /> شهاداتي</b>
            {d.reports.map((r) => <a key={r.id} href={`/diagnose/r/${r.id}`} className="flex gap-3 text-sm rounded-lg bg-white/5 px-3 py-2"><span className="flex-1">{r.device?.model || "iPhone"}</span><b>{r.score}/100</b><span className="text-[var(--muted)]">{new Date(r.created_at).toLocaleDateString("ar-LY")}</span></a>)}
          </section>
        )}
      </div>
      {topup && <WalletModal onClose={() => setTopup(false)} payAmount={d?.price ?? 5} payLabel="الفحص العميق للآيفون" onPaid={() => { setTopup(false); buy(); }} />}
    </div>
  );
}
