"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Search, ShieldCheck, Plus, Stethoscope, BatteryMedium, User, Loader2, Lock, BadgeCheck, RotateCcw } from "lucide-react";

type L = { id: string; title: string; category: string; condition: string; battery_health: number | null; price: number; images: string[]; city: string | null; diag_report_id: string | null; status: string; storage: string | null };

import { COND } from "@/lib/marketShared";
const CATS = ["الكل", "هواتف", "آيباد وتابلت", "لابتوبات", "ساعات", "سماعات", "بلايستيشن", "أخرى"];

export default function MarketPage() {
  const [items, setItems] = useState<L[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("الكل");
  const [cond, setCond] = useState("");
  const [sort, setSort] = useState("new");

  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (cat !== "الكل") p.set("category", cat);
    if (cond) p.set("condition", cond);
    p.set("sort", sort);
    const t = setTimeout(() => fetch(`/api/market/listings?${p}`).then((r) => r.json()).then((d) => setItems(d.listings || [])), 250);
    return () => clearTimeout(t);
  }, [q, cat, cond, sort]);

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold flex-1">سوق المستعمل بضمان</h1>
        <a href="/market/me" className="gp-btn gp-btn-ghost text-sm px-3 py-2"><User size={15} /> حسابي في السوق</a>
      </header>

      <div className="gp-wrap w-full space-y-5">
        <section className="gp-panel mk-hero">
          <div>
            <h2>بيع واشري مستعمل بدون خوف</h2>
            <p>ترند تمسك فلوس المشتري لين يستلم الجهاز ويتأكد منه. لو فيه مشكلة — الفلوس ترجعله.</p>
            <div className="mk-steps">
              <span><Lock size={15} /> تدفع → المبلغ محجوز عند ترند</span>
              <span><BadgeCheck size={15} /> تستلم وتفحص</span>
              <span><RotateCcw size={15} /> فيه مشكلة؟ نزاع واسترجاع</span>
            </div>
          </div>
          <a href="/market/sell" className="gp-btn gp-btn-main"><Plus size={17} /> بيع جهازك</a>
        </section>

        <div className="mk-filters">
          <div className="mk-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: آيفون 13، سامسونج S23…" /></div>
          <select value={cond} onChange={(e) => setCond(e.target.value)}><option value="">كل الحالات</option>{Object.entries(COND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">الأحدث</option><option value="cheap">الأرخص</option><option value="expensive">الأغلى</option></select>
        </div>
        <div className="mk-cats">{CATS.map((c) => <button key={c} className={`gp-pill ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div>

        {!items ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>
          : items.length === 0 ? (
            <div className="gp-panel gp-empty flex flex-col items-center py-16 gap-3 text-[var(--muted)]">
              <ShieldCheck size={40} /><p>ما فيش إعلانات مطابقة لحد الآن.</p>
              <a href="/market/sell" className="gp-btn gp-btn-main px-6"><Plus size={16} /> كن أول من يبيع</a>
            </div>
          ) : (
            <div className="mk-grid">
              {items.map((l) => (
                <a key={l.id} href={`/market/${l.id}`} className="gp-panel mk-card">
                  <div className="mk-img">
                    {l.images?.[0] ? <img src={l.images[0]} alt="" loading="lazy" /> : null}
                    {l.status === "reserved" && <span className="mk-badge res">محجوز</span>}
                    {l.diag_report_id && <span className="mk-badge diag"><Stethoscope size={11} /> مفحوص</span>}
                  </div>
                  <div className="mk-info">
                    <b>{l.title}</b>
                    <span className="mk-meta">{COND[l.condition]}{l.storage ? ` · ${l.storage}` : ""}{l.battery_health ? <> · <BatteryMedium size={12} /> {l.battery_health}%</> : null}</span>
                    <span className="mk-price">{l.price} د.ل</span>
                    {l.city && <span className="mk-city">{l.city}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
