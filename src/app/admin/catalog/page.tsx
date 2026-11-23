"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, AlertCircle, Info, Sparkles, RefreshCw, Loader2, Pencil, History } from "lucide-react";

type Issue = { product_id: string; name: string; severity: "high" | "medium" | "low"; code: string; message: string };
type Fix = { product_id: string; name: string; action: string; detail: string; sources?: { title: string; url: string }[] };
type Summary = { high: number; medium: number; low: number; ai_descriptions: number; ai_available: boolean; still_missing_descriptions: number };
type Report = { id: string; created_at: string; trigger: string; checked: number; issues: Issue[]; fixes: Fix[]; summary: Summary };
type Hist = { id: string; created_at: string; trigger: string; checked: number; summary: Summary };

const SEV = {
  high: { ar: "مهم", Icon: AlertTriangle, cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  medium: { ar: "متوسط", Icon: AlertCircle, cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  low: { ar: "ملاحظة", Icon: Info, cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
} as const;

const fmt = (d: string) => new Date(d).toLocaleString("ar-LY", { dateStyle: "medium", timeStyle: "short" });

export default function CatalogHealthPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | Issue["severity"]>("all");

  const load = async (id?: string) => {
    setLoading(true);
    const r = await fetch(`/api/admin/catalog-check${id ? `?id=${id}` : ""}`);
    const d = await r.json();
    setReport(d.report); setHistory(d.history || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true); setErr("");
    const r = await fetch("/api/admin/catalog-check", { method: "POST" });
    const d = await r.json();
    if (!r.ok) setErr(d.error || "فشل الفحص"); else await load();
    setRunning(false);
  };

  const issues = (report?.issues || []).filter((i) => filter === "all" || i.severity === filter);
  const byProduct = new Map<string, Issue[]>();
  for (const i of issues) byProduct.set(i.product_id, [...(byProduct.get(i.product_id) || []), i]);

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-6 text-[var(--text)]">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck className="text-purple-400" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">فحص المنتجات</h1>
          <p className="text-sm text-[var(--muted)]">فحص تلقائي كل يوم (4:20 صباحاً UTC) — أخطاء البيانات والصور، ويكتب الوصف الناقص من مصادر حقيقية على الإنترنت (مع الروابط).</p>
        </div>
        {history.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <History size={15} />
            <select className="bg-[var(--surface)] border border-purple-500/20 rounded-lg px-2 py-1.5" value={report?.id || ""} onChange={(e) => load(e.target.value)}>
              {history.map((h) => <option key={h.id} value={h.id}>{fmt(h.created_at)} {h.trigger === "manual" ? "(يدوي)" : ""}</option>)}
            </select>
          </label>
        )}
        <button onClick={runNow} disabled={running} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold disabled:opacity-50">
          {running ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />} {running ? "جاري الفحص… (حتى دقيقة)" : "افحص الآن"}
        </button>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>
      ) : !report ? (
        <div className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-10 text-center text-[var(--muted)]">ما فيش تقارير لحد الآن — اضغط «افحص الآن».</div>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)]">آخر فحص: {fmt(report.created_at)} · {report.checked} منتج {report.trigger === "manual" ? "· يدوي" : "· تلقائي"}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["high", "medium", "low"] as const).map((s) => {
              const { ar, Icon, cls } = SEV[s];
              return (
                <button key={s} onClick={() => setFilter(filter === s ? "all" : s)} className={`rounded-2xl border p-4 text-start ${cls} ${filter === s ? "ring-2 ring-current" : ""}`}>
                  <Icon size={18} /><div className="text-2xl font-black mt-1">{report.summary[s]}</div><div className="text-xs">{ar}</div>
                </button>
              );
            })}
            <div className="rounded-2xl border p-4 text-cyan-300 bg-cyan-500/10 border-cyan-500/30">
              <Sparkles size={18} /><div className="text-2xl font-black mt-1">{report.summary.ai_descriptions}</div>
              <div className="text-xs">وصف كتبه الذكاء{report.summary.ai_available ? "" : " (الذكاء غير متاح)"}</div>
            </div>
          </div>

          {report.fixes.length > 0 && (
            <section className="rounded-2xl border border-cyan-500/30 bg-[var(--surface)] p-5 space-y-3">
              <h2 className="font-bold flex items-center gap-2"><Sparkles size={17} className="text-cyan-400" /> اللي صلّحه الفحص تلقائياً</h2>
              {report.fixes.map((f) => (
                <div key={f.product_id} className="rounded-xl bg-black/15 p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <b className="flex-1">{f.name}</b>
                    <a href={`/admin/products/${f.product_id}/edit`} className="text-blue-400 flex items-center gap-1 text-xs"><Pencil size={12} /> راجع وعدّل</a>
                  </div>
                  <p className="text-[var(--muted)] whitespace-pre-line leading-7">{f.detail}</p>
                  {!!f.sources?.length && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="text-[var(--muted)]">المصادر:</span>
                      {f.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline underline-offset-2">{s.title}</a>)}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <section className="rounded-2xl border border-purple-500/20 bg-[var(--surface)] p-5 space-y-3">
            <h2 className="font-bold">الأخطاء والملاحظات {filter !== "all" && <span className="text-xs font-normal text-[var(--muted)]">({SEV[filter].ar} فقط — اضغط البطاقة مرة ثانية للكل)</span>}</h2>
            {byProduct.size === 0 ? (
              <p className="text-green-400 text-sm">كل شي سليم ✅</p>
            ) : [...byProduct.entries()].map(([pid, list]) => (
              <div key={pid} className="rounded-xl border border-purple-500/10 bg-black/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <b className="flex-1 text-sm">{list[0].name}</b>
                  <a href={`/admin/products/${pid}/edit`} className="text-blue-400 flex items-center gap-1 text-xs"><Pencil size={12} /> تعديل</a>
                </div>
                <ul className="space-y-1.5">
                  {list.map((i, k) => {
                    const { Icon, cls } = SEV[i.severity];
                    return <li key={k} className={`flex items-start gap-2 text-sm rounded-lg border px-2.5 py-1.5 ${cls}`}><Icon size={15} className="mt-0.5 shrink-0" /><span>{i.message}</span></li>;
                  })}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
