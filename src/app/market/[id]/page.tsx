"use client";

import { use, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Stethoscope, BatteryMedium, MapPin, Loader2, Lock, Store, Handshake, Truck, BadgeCheck } from "lucide-react";
import WalletModal from "@/components/WalletModal";
import { COND } from "@/lib/marketShared";

type Data = {
  listing: { id: string; title: string; category: string; brand: string | null; model: string | null; storage: string | null; color: string | null; condition: string; battery_health: number | null; price: number; description: string | null; images: string[]; city: string | null; status: string; created_at: string; views: number; reject_reason?: string | null };
  owner: boolean; seller: { name: string; since: string | null; completed_sales: number };
  report: { id: string; score: number; created_at: string } | null; protection_days: number;
};
const DELIV = [
  { id: "store", Icon: Store, t: "التسليم والفحص في المحل", d: "البائع يجيب الجهاز للمحل، نفحصوه قدامك — الأضمن" },
  { id: "meet", Icon: Handshake, t: "لقاء مباشر", d: "تتفقوا على مكان، وتأكد الاستلام من التطبيق" },
  { id: "courier", Icon: Truck, t: "توصيل", d: "البائع يرسله مع شركة توصيل" },
];

export default function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [img, setImg] = useState(0);
  const [deliv, setDeliv] = useState("store");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [topup, setTopup] = useState(false);

  useEffect(() => {
    fetch(`/api/market/listings/${id}`).then(async (r) => { if (!r.ok) setMissing(true); else setD(await r.json()); });
  }, [id]);

  const buy = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/market/buy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listing_id: id, delivery: deliv }) });
    const j = await r.json();
    setBusy(false);
    if (r.status === 401) { window.location.href = `/login?next=/market/${id}`; return; }
    if (j.code === "INSUFFICIENT") { setTopup(true); return; }
    if (!r.ok) { setErr(j.error || "تعذّر الشراء"); return; }
    window.location.href = `/market/order/${j.orderId}`;
  };

  if (missing) return <div dir="rtl" className="gp-wrap"><div className="gp-panel p-10 text-center">الإعلان غير موجود.</div></div>;
  if (!d) return <div className="flex justify-center py-24"><Loader2 className="animate-spin" /></div>;
  const l = d.listing;

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/market" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold truncate">{l.title}</h1>
      </header>
      <div className="gp-wrap w-full">
        <div className="mk-detail">
          <section className="gp-panel p-3">
            <div className="mk-main-img">{l.images[img] && <img src={l.images[img]} alt={l.title} />}</div>
            {l.images.length > 1 && <div className="gp-thumbs">{l.images.map((s, i) => <button key={i} className={img === i ? "on" : ""} onClick={() => setImg(i)}><img src={s} alt="" /></button>)}</div>}
          </section>

          <section className="space-y-4">
            <div className="gp-panel p-5 space-y-3">
              <span className="gp-chip">{l.category}</span>
              <h2 className="text-xl font-black">{l.title}</h2>
              <div className="text-3xl font-black">{l.price} <span className="text-base font-normal">د.ل</span></div>
              <dl className="mk-specs">
                <div><dt>الحالة</dt><dd>{COND[l.condition]}</dd></div>
                {l.brand && <div><dt>الماركة</dt><dd>{l.brand}</dd></div>}
                {l.model && <div><dt>الموديل</dt><dd>{l.model}</dd></div>}
                {l.storage && <div><dt>السعة</dt><dd>{l.storage}</dd></div>}
                {l.color && <div><dt>اللون</dt><dd>{l.color}</dd></div>}
                {l.battery_health && <div><dt>البطارية</dt><dd><BatteryMedium size={13} className="inline" /> {l.battery_health}%</dd></div>}
                {l.city && <div><dt>المدينة</dt><dd><MapPin size={13} className="inline" /> {l.city}</dd></div>}
              </dl>
              {d.report && (
                <a href={`/diagnose/r/${d.report.id}`} target="_blank" className="mk-report"><Stethoscope size={16} /> تقرير فحص الجهاز: <b>{d.report.score}/100</b> — اعرض التقرير</a>
              )}
              {l.description && <p className="text-sm leading-7 whitespace-pre-line text-[var(--muted)]">{l.description}</p>}
              <p className="text-xs text-[var(--muted)]">البائع: <b>{d.seller.name}</b> · {d.seller.completed_sales} بيعة مكتملة · {l.views} مشاهدة</p>
            </div>

            {d.owner ? (
              <div className="gp-panel p-5 text-sm space-y-2">
                <p>هذا إعلانك — الحالة: <b>{({ pending: "قيد المراجعة", active: "منشور", reserved: "محجوز (عليه طلب)", sold: "مباع", rejected: "مرفوض", removed: "محذوف" } as Record<string, string>)[l.status]}</b></p>
                {l.reject_reason && <p className="text-red-400">سبب الرفض: {l.reject_reason}</p>}
                <a href="/market/me" className="gp-btn gp-btn-ghost text-sm">إدارة إعلاناتي</a>
              </div>
            ) : l.status === "active" ? (
              <div className="gp-panel p-5 space-y-3">
                <h3 className="font-bold">طريقة الاستلام</h3>
                {DELIV.map(({ id: k, Icon, t, d: desc }) => (
                  <button key={k} onClick={() => setDeliv(k)} className={`mk-opt ${deliv === k ? "on" : ""}`}>
                    <Icon size={18} /><span><b>{t}</b><small>{desc}</small></span>
                  </button>
                ))}
                <button onClick={buy} disabled={busy} className="gp-btn gp-btn-main w-full">{busy ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />} اشتري بضمان ترند — {l.price} د.ل</button>
                {err && <p className="text-red-400 text-sm">{err}</p>}
                <ul className="mk-guarantee">
                  <li><ShieldCheck size={15} /> المبلغ يتحجز من محفظتك عند ترند — ما يوصلش للبائع لين تأكد الاستلام.</li>
                  <li><BadgeCheck size={15} /> بعد التسليم عندك <b>{d.protection_days} أيام</b> تفحص الجهاز. فيه مشكلة؟ افتح نزاع والمبلغ يتجمّد.</li>
                </ul>
              </div>
            ) : (
              <div className="gp-panel p-5 text-center font-bold">{l.status === "reserved" ? "الجهاز محجوز لمشتري آخر" : "الجهاز اتباع"}</div>
            )}
          </section>
        </div>
      </div>
      {topup && <WalletModal onClose={() => setTopup(false)} payAmount={l.price} payLabel={`شراء: ${l.title}`} onPaid={() => { setTopup(false); buy(); }} />}
    </div>
  );
}
