"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CreditCard, Loader2, Minus, Plus, Zap, Clock, Ticket, X } from "lucide-react";
import WalletModal from "@/components/WalletModal";

type P = { id: string; name: string; brand: string; region: "local" | "international"; category: string; face_value: string | null; price: number; image: string | null };
const CATS: Record<string, string> = { all: "الكل", mobile: "رصيد واتصالات", games: "ألعاب", stores: "متاجر التطبيقات", streaming: "اشتراكات", other: "أخرى" };
const BRAND_COLOR: Record<string, string> = { "ليبيانا": "#e11d48", "المدار": "#16a34a", LTT: "#2563eb", Apple: "#111827", "Google Play": "#0f9d58", PlayStation: "#1d4ed8", Xbox: "#15803d", Steam: "#1e293b", "PUBG Mobile": "#ca8a04", "Free Fire": "#ea580c", Netflix: "#dc2626", Spotify: "#16a34a" };

export default function CardsPage() {
  const [d, setD] = useState<{ products: P[]; instant: boolean } | null>(null);
  const [region, setRegion] = useState<"local" | "international">("local");
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState<P | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [topup, setTopup] = useState(false);

  useEffect(() => { fetch("/api/cards").then((r) => r.json()).then(setD); }, []);
  const list = useMemo(() => (d?.products || []).filter((p) => p.region === region && (cat === "all" || p.category === cat)), [d, region, cat]);
  const brands = useMemo(() => [...new Set(list.map((p) => p.brand))], [list]);

  const buy = async () => {
    if (!sel) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product_id: sel.id, qty }) });
    const j = await r.json();
    setBusy(false);
    if (r.status === 401) { window.location.href = "/login?next=/cards"; return; }
    if (j.code === "INSUFFICIENT") { setTopup(true); return; }
    if (!r.ok) { setErr(j.error); return; }
    window.location.href = "/cards/orders";
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold flex-1">الكروت والخدمات الرقمية</h1>
        <a href="/utilities" className="gp-btn gp-btn-ghost text-sm px-3 py-2"><Zap size={15} /> كهرباء وشحن مباشر</a>
        <a href="/cards/orders" className="gp-btn gp-btn-ghost text-sm px-3 py-2"><Ticket size={15} /> كروتي</a>
      </header>
      <div className="gp-wrap w-full space-y-5">
        <section className="gp-panel cd-hero">
          <CreditCard size={30} />
          <div><h2>كروت محلية ودولية — ادفع من محفظتك</h2>
            <p>{d?.instant ? <><Zap size={13} className="inline" /> الكود يوصلك فوراً بعد الدفع.</> : <><Clock size={13} className="inline" /> الكود يوصلك في «كروتي» خلال دقائق بعد الدفع (أوقات العمل).</>}</p></div>
        </section>
        <div className="flex gap-2">
          <button className={`gp-pill ${region === "local" ? "on" : ""}`} onClick={() => { setRegion("local"); setCat("all"); }}>محلية 🇱🇾</button>
          <button className={`gp-pill ${region === "international" ? "on" : ""}`} onClick={() => { setRegion("international"); setCat("all"); }}>دولية 🌍</button>
        </div>
        {region === "international" && <div className="mk-cats">{Object.entries(CATS).filter(([k]) => k !== "mobile").map(([k, v]) => <button key={k} className={`gp-pill ${cat === k ? "on" : ""}`} onClick={() => setCat(k)}>{v}</button>)}</div>}

        {!d ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>
          : !list.length ? <div className="gp-panel p-10 text-center text-[var(--muted)]">الكروت هذي تتجهّز — قريباً جداً.</div>
          : brands.map((b) => (
            <section key={b} className="space-y-2">
              <h3 className="font-bold">{b}</h3>
              <div className="cd-grid">
                {list.filter((p) => p.brand === b).map((p) => (
                  <button key={p.id} className="cd-card" style={{ ["--c" as string]: BRAND_COLOR[p.brand] || "#0e7490" }} onClick={() => { setSel(p); setQty(1); setErr(""); }}>
                    {p.image ? <img src={p.image} alt="" /> : <span className="cd-brand">{p.brand}</span>}
                    <b>{p.face_value || p.name}</b>
                    <span className="cd-price">{p.price} د.ل</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
      </div>

      {sel && (
        <div className="dg-ask" onClick={() => setSel(null)}>
          <div className="gp-panel cd-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="cd-x" onClick={() => setSel(null)}><X size={18} /></button>
            <div className="cd-card big" style={{ ["--c" as string]: BRAND_COLOR[sel.brand] || "#0e7490" }}><span className="cd-brand">{sel.brand}</span><b>{sel.face_value || sel.name}</b></div>
            <h3 className="font-bold">{sel.name}</h3>
            <div className="cd-qty"><button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16} /></button><b>{qty}</b><button onClick={() => setQty(Math.min(10, qty + 1))}><Plus size={16} /></button></div>
            <button onClick={buy} disabled={busy} className="gp-btn gp-btn-main w-full">{busy ? <Loader2 className="animate-spin" size={18} /> : null} ادفع {Math.round(sel.price * qty * 100) / 100} د.ل من المحفظة</button>
            {err && <p className="text-red-400 text-sm">{err}</p>}
          </div>
        </div>
      )}
      {topup && sel && <WalletModal onClose={() => setTopup(false)} payAmount={Math.round(sel.price * qty * 100) / 100} payLabel={sel.name} onPaid={() => { setTopup(false); buy(); }} />}
    </div>
  );
}
