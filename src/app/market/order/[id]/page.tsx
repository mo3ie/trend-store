"use client";

import { use, useEffect, useState } from "react";
import { ArrowRight, Loader2, Send, ShieldCheck, PackageCheck, CheckCircle2, AlertTriangle, XCircle, Phone } from "lucide-react";
import { ORDER_LABEL } from "@/lib/marketShared";

type Data = {
  order: { id: string; status: string; price: number; commission: number; seller_payout: number; delivery: string; confirm_deadline: string | null; dispute_reason: string | null; timeline: { at: string; what: string; by: string }[]; created_at: string };
  listing: { id: string; title: string; images: string[] } | null;
  role: "buyer" | "seller" | "admin"; protection_days: number;
  buyer: { name: string; phone: string | null }; seller: { name: string; phone: string | null };
  messages: { id: number; is_admin: boolean; body: string; created_at: string; mine: boolean }[];
};
const DLV: Record<string, string> = { store: "التسليم والفحص في محل ترند", meet: "لقاء مباشر", courier: "توصيل" };
const STEPS = ["held", "handed_over", "completed"];

export default function MarketOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => fetch(`/api/market/orders/${id}`).then(async (r) => { if (r.status === 401) { window.location.href = `/login?next=/market/order/${id}`; return; } if (r.ok) setD(await r.json()); });
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: string, text?: string) => {
    setBusy(true); setErr("");
    const r = await fetch(`/api/market/orders/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, text }) });
    const j = await r.json();
    if (!r.ok) setErr(j.error); else { if (action === "message") setMsg(""); await load(); }
    setBusy(false);
  };

  if (!d) return <div className="flex justify-center py-24"><Loader2 className="animate-spin" /></div>;
  const o = d.order;
  const other = d.role === "buyer" ? d.seller : d.buyer;
  const stepIdx = STEPS.indexOf(o.status);

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/market/me" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold truncate">طلب: {d.listing?.title}</h1>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-4">
        <section className="gp-panel p-5 space-y-4">
          <div className="flex items-center gap-3">
            {d.listing?.images?.[0] && <img src={d.listing.images[0]} alt="" className="w-16 h-16 rounded-xl object-cover" />}
            <div className="flex-1"><b>{d.listing?.title}</b><p className="text-sm text-[var(--muted)]">{DLV[o.delivery]}</p></div>
            <div className="text-end"><b className="text-xl">{o.price} د.ل</b>{d.role === "seller" && <p className="text-xs text-[var(--muted)]">لك بعد العمولة: {o.seller_payout}</p>}</div>
          </div>
          <div className={`mk-status s-${o.status}`}>{o.status === "disputed" ? <AlertTriangle size={17} /> : o.status === "completed" ? <CheckCircle2 size={17} /> : ["refunded", "cancelled"].includes(o.status) ? <XCircle size={17} /> : <ShieldCheck size={17} />} {ORDER_LABEL[o.status]}</div>
          {stepIdx >= 0 && (
            <div className="gp-track flex items-center justify-between">
              {["الدفع والحجز", "التسليم", "تحويل للبائع"].map((t, i) => (
                <div key={t} className={`gp-track-step flex-1 flex flex-col items-center gap-1.5 relative ${i === stepIdx ? "active" : i < stepIdx ? "done" : ""}`}>
                  {i < 2 && <div className={`gp-track-line absolute top-4 end-1/2 w-full ${i < stepIdx ? "on" : ""}`} />}
                  <div className="gp-track-dot relative z-10 w-8 h-8 rounded-full flex items-center justify-center">{i + 1}</div>
                  <span className="text-xs">{t}</span>
                </div>
              ))}
            </div>
          )}
          {o.status === "handed_over" && o.confirm_deadline && <p className="text-sm text-amber-300">فترة الفحص تنتهي {new Date(o.confirm_deadline).toLocaleString("ar-LY")} — بعدها يتحوّل المبلغ للبائع تلقائياً.</p>}
          {o.dispute_reason && <p className="text-sm text-red-300">سبب النزاع: {o.dispute_reason}</p>}

          {other.phone && d.role !== "admin" && !["cancelled", "refunded"].includes(o.status) && (
            <a href={`tel:${other.phone}`} className="text-sm flex items-center gap-2 text-cyan-300"><Phone size={15} /> {d.role === "buyer" ? "البائع" : "المشتري"}: {other.name} · <span dir="ltr">{other.phone}</span></a>
          )}

          <div className="flex flex-wrap gap-2">
            {d.role === "seller" && o.status === "held" && <>
              <button disabled={busy} onClick={() => act("handover")} className="gp-btn gp-btn-main"><PackageCheck size={17} /> سلّمت الجهاز</button>
              <button disabled={busy} onClick={() => confirm("إلغاء البيع وإرجاع المبلغ للمشتري؟") && act("cancel")} className="gp-btn gp-btn-ghost">إلغاء البيع</button>
            </>}
            {d.role === "buyer" && ["held", "handed_over"].includes(o.status) && <>
              <button disabled={busy} onClick={() => confirm("متأكد إن الجهاز سليم؟ المبلغ بيتحوّل للبائع ولا يمكن التراجع.") && act("confirm")} className="gp-btn gp-btn-main"><CheckCircle2 size={17} /> استلمت والجهاز سليم</button>
              <button disabled={busy} onClick={() => { const r = prompt("شنو المشكلة في الجهاز؟"); if (r) act("dispute", r); }} className="gp-btn gp-btn-ghost"><AlertTriangle size={17} /> فيه مشكلة (نزاع)</button>
            </>}
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
        </section>

        <section className="gp-panel p-5 space-y-3">
          <h3 className="font-bold">المحادثة</h3>
          <div className="mk-chat">
            {d.messages.length === 0 && <p className="text-sm text-[var(--muted)]">اتفقوا على التسليم هنا — الإدارة تقدر تشوف المحادثة لو صار نزاع.</p>}
            {d.messages.map((m) => <div key={m.id} className={`mk-msg ${m.mine ? "me" : ""} ${m.is_admin ? "adm" : ""}`}>{m.is_admin && <b>إدارة ترند: </b>}{m.body}<small>{new Date(m.created_at).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })}</small></div>)}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) act("message", msg); }}>
            <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} placeholder="اكتب رسالة…" className="flex-1 px-4 py-2.5 rounded-xl bg-black/15 border border-white/15 outline-none" />
            <button disabled={busy || !msg.trim()} className="gp-btn gp-btn-main px-4"><Send size={16} /></button>
          </form>
        </section>

        <section className="gp-panel p-5">
          <h3 className="font-bold mb-2">سجل الطلب</h3>
          <ul className="space-y-1.5 text-sm">{o.timeline.map((t, i) => <li key={i} className="flex gap-2"><span className="text-[var(--muted)] shrink-0">{new Date(t.at).toLocaleString("ar-LY", { dateStyle: "short", timeStyle: "short" })}</span><span>{t.what}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
