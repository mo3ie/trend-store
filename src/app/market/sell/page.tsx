"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Loader2, X, Stethoscope, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { COND } from "@/lib/marketShared";

const CATS = ["هواتف", "آيباد وتابلت", "لابتوبات", "ساعات", "سماعات", "بلايستيشن", "أخرى"];

export default function SellPage() {
  const { user, loading } = useAuth();
  const [f, setF] = useState({ title: "", category: "هواتف", brand: "", model: "", storage: "", color: "", condition: "good", battery_health: "", price: "", city: "", description: "", diag_report_id: "" });
  const [images, setImages] = useState<string[]>([]);
  const [up, setUp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { if (!loading && !user) window.location.href = "/login?next=/market/sell"; }, [loading, user]);

  const upload = async (files: FileList | null) => {
    for (const file of Array.from(files || []).slice(0, 8 - images.length)) {
      setUp((n) => n + 1);
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/market/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.url) setImages((p) => [...p, d.url]); else setErr(d.error || "فشل رفع صورة");
      setUp((n) => n - 1);
    }
  };

  const submit = async () => {
    setErr(""); setBusy(true);
    const report = f.diag_report_id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || "";
    const r = await fetch("/api/market/listings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, diag_report_id: report, images }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) setErr(d.error || "تعذّر النشر"); else setDone(true);
  };

  if (done) return (
    <div dir="rtl" className="gp-wrap gp-narrow"><div className="gp-panel p-8 text-center space-y-3">
      <ShieldCheck size={44} className="mx-auto text-green-400" />
      <h2 className="text-xl font-bold">وصل إعلانك!</h2>
      <p className="text-[var(--muted)]">الإدارة تراجعه وينشر خلال ساعات. يوصلك إشعار.</p>
      <a href="/market/me" className="gp-btn gp-btn-main">إعلاناتي</a>
    </div></div>
  );

  const inp = "w-full px-4 py-3 rounded-xl bg-black/15 border border-white/15 text-[var(--text)] text-sm outline-none focus:border-cyan-300/60";
  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/market" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold">بيع جهازك</h1>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-4">
        <section className="gp-panel p-5 space-y-3">
          <h2 className="font-bold">الصور <small className="text-[var(--muted)] font-normal">(2 على الأقل — من كل الجهات والشاشة شغالة)</small></h2>
          <div className="mk-upl">
            {images.map((u, i) => <div key={u} className="mk-upl-i"><img src={u} alt="" /><button onClick={() => setImages(images.filter((_, j) => j !== i))}><X size={14} /></button></div>)}
            {images.length < 8 && <button className="mk-upl-add" onClick={() => fileRef.current?.click()}>{up ? <Loader2 className="animate-spin" /> : <Camera />}<span>أضف صور</span></button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </section>

        <section className="gp-panel p-5 grid sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 text-sm">اسم الجهاز *<input className={inp} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="مثلاً: iPhone 13 Pro 256GB أزرق" /></label>
          <label className="text-sm">النوع<select className={inp} value={f.category} onChange={(e) => set("category", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm">الحالة *<select className={inp} value={f.condition} onChange={(e) => set("condition", e.target.value)}>{Object.entries(COND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-sm">الماركة<input className={inp} value={f.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Apple" /></label>
          <label className="text-sm">الموديل<input className={inp} value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="13 Pro" /></label>
          <label className="text-sm">السعة<input className={inp} value={f.storage} onChange={(e) => set("storage", e.target.value)} placeholder="256GB" /></label>
          <label className="text-sm">اللون<input className={inp} value={f.color} onChange={(e) => set("color", e.target.value)} /></label>
          <label className="text-sm">صحة البطارية %<input className={inp} inputMode="numeric" value={f.battery_health} onChange={(e) => set("battery_health", e.target.value.replace(/\D/g, "").slice(0, 3))} /></label>
          <label className="text-sm">المدينة<input className={inp} value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="طرابلس" /></label>
          <label className="sm:col-span-2 text-sm">السعر (د.ل) *<input className={inp} inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="sm:col-span-2 text-sm">الوصف<textarea className={inp} rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="فيه خدوش؟ تبدّل فيه شي؟ معاه علبة وشاحن؟" /></label>
          <label className="sm:col-span-2 text-sm flex flex-col gap-1">
            <span className="flex items-center gap-1"><Stethoscope size={14} /> رابط تقرير الفحص (اختياري — يزيد الثقة والسرعة في البيع)</span>
            <input className={inp} dir="ltr" value={f.diag_report_id} onChange={(e) => set("diag_report_id", e.target.value)} placeholder="https://www.trendstore-ly.com/diagnose/r/..." />
            <a href="/diagnose" target="_blank" className="text-cyan-400 text-xs underline">افحص جهازك الآن وانسخ رابط التقرير</a>
          </label>
        </section>

        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
        <button onClick={submit} disabled={busy || up > 0} className="gp-btn gp-btn-main w-full">{busy ? <Loader2 className="animate-spin" size={18} /> : null} أرسل الإعلان للمراجعة</button>
        <p className="text-xs text-[var(--muted)] text-center leading-6">لما يتباع جهازك، ترند تمسك المبلغ لين المشتري يستلم ويتأكد، وبعدها يتحوّل لمحفظتك مخصوم منه عمولة السوق.</p>
      </div>
    </div>
  );
}
