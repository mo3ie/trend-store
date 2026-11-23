"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Copy, Check, Loader2, Clock, XCircle, Eye, EyeOff } from "lucide-react";

type O = { id: string; qty: number; total: number; status: string; codes: { code: string; serial?: string; pin?: string; expiry?: string }[]; error: string | null; created_at: string; card_products: { name: string; brand: string; face_value: string | null } | null };

export default function MyCards() {
  const [orders, setOrders] = useState<O[] | null>(null);
  const [copied, setCopied] = useState("");
  const [shown, setShown] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const load = () => fetch("/api/cards/orders").then(async (r) => { if (r.status === 401) { window.location.href = "/login?next=/cards/orders"; return; } setOrders((await r.json()).orders || []); });
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  const copy = async (c: string) => { try { await navigator.clipboard.writeText(c); setCopied(c); setTimeout(() => setCopied(""), 1500); } catch {} };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/cards" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold">كروتي</h1>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-3">
        {!orders ? <Loader2 className="animate-spin mx-auto" /> : !orders.length ? <div className="gp-panel p-10 text-center text-[var(--muted)]">ما شريت حتى كرت لحد الآن. <a href="/cards" className="text-cyan-400">تصفّح الكروت</a></div> :
          orders.map((o) => (
            <section key={o.id} className="gp-panel p-4 space-y-2">
              <div className="flex items-center gap-2">
                <b className="flex-1">{o.qty} × {o.card_products?.name}</b>
                <span className="text-sm">{o.total} د.ل</span>
              </div>
              <p className="text-xs text-[var(--muted)]">{new Date(o.created_at).toLocaleString("ar-LY")}</p>
              {o.status === "pending" && <p className="text-amber-300 text-sm flex items-center gap-1"><Clock size={14} /> قيد التجهيز — يوصلك إشعار أول ما يجهز</p>}
              {o.status === "refunded" && <p className="text-[var(--muted)] text-sm flex items-center gap-1"><XCircle size={14} /> تم استرجاع المبلغ لمحفظتك{o.error ? ` — ${o.error}` : ""}</p>}
              {o.status === "delivered" && (
                <div className="space-y-2">
                  <button className="text-xs text-cyan-400 flex items-center gap-1" onClick={() => setShown((s) => ({ ...s, [o.id]: !s[o.id] }))}>{shown[o.id] ? <EyeOff size={13} /> : <Eye size={13} />} {shown[o.id] ? "إخفاء الأكواد" : "إظهار الأكواد"}</button>
                  {o.codes.map((c, i) => (
                    <div key={i} className="cd-code">
                      <span dir="ltr" className="font-mono">{shown[o.id] ? c.code : "•••• •••• ••••"}</span>
                      {c.serial && shown[o.id] && <small dir="ltr">S/N {c.serial}</small>}
                      <button onClick={() => copy(c.code)}>{copied === c.code ? <Check size={15} /> : <Copy size={15} />}</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
