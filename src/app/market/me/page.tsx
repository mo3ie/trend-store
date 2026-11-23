"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Plus, Loader2, Trash2 } from "lucide-react";
import { ORDER_LABEL, LISTING_LABEL } from "@/lib/marketShared";

type Listing = { id: string; title: string; price: number; images: string[]; status: string; reject_reason: string | null; views: number };
type Order = { id: string; price: number; seller_payout: number; status: string; created_at: string; market_listings: { title: string; images: string[] } | null };

export default function MarketMe() {
  const [tab, setTab] = useState<"listings" | "bought" | "sold">("listings");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [orders, setOrders] = useState<{ bought: Order[]; sold: Order[] } | null>(null);

  const load = () => {
    fetch("/api/market/listings?mine=1").then(async (r) => { if (r.status === 401) { window.location.href = "/login?next=/market/me"; return; } setListings((await r.json()).listings || []); });
    fetch("/api/market/orders").then((r) => r.json()).then((d) => setOrders({ bought: d.bought || [], sold: d.sold || [] }));
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("حذف الإعلان؟")) return;
    const r = await fetch(`/api/market/listings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ remove: true }) });
    if (!r.ok) alert((await r.json()).error); else load();
  };

  const list = tab === "listings" ? null : orders?.[tab] || null;
  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/market" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold flex-1">حسابي في السوق</h1>
        <a href="/market/sell" className="gp-btn gp-btn-main text-sm px-3 py-2"><Plus size={15} /> بيع جهاز</a>
      </header>
      <div className="gp-wrap gp-narrow w-full space-y-4">
        <div className="flex gap-2">
          {([["listings", "إعلاناتي"], ["bought", "مشترياتي"], ["sold", "مبيعاتي"]] as const).map(([k, t]) => <button key={k} className={`gp-pill ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{t}</button>)}
        </div>
        {tab === "listings" ? (
          !listings ? <Loader2 className="animate-spin mx-auto" /> : !listings.length ? <div className="gp-panel p-8 text-center text-[var(--muted)]">ما عندكش إعلانات.</div> :
          listings.filter((l) => l.status !== "removed").map((l) => (
            <div key={l.id} className="gp-panel p-3 flex items-center gap-3">
              {l.images[0] && <img src={l.images[0]} alt="" className="w-16 h-16 rounded-xl object-cover" />}
              <a href={`/market/${l.id}`} className="flex-1 min-w-0">
                <b className="block truncate">{l.title}</b>
                <span className="text-sm">{l.price} د.ل · {LISTING_LABEL[l.status]} · {l.views} مشاهدة</span>
                {l.reject_reason && <span className="block text-xs text-red-400">{l.reject_reason}</span>}
              </a>
              {["pending", "active", "rejected"].includes(l.status) && <button onClick={() => remove(l.id)} className="text-red-400 p-2"><Trash2 size={17} /></button>}
            </div>
          ))
        ) : !list ? <Loader2 className="animate-spin mx-auto" /> : !list.length ? <div className="gp-panel p-8 text-center text-[var(--muted)]">لا يوجد.</div> :
          list.map((o) => (
            <a key={o.id} href={`/market/order/${o.id}`} className="gp-panel p-3 flex items-center gap-3">
              {o.market_listings?.images?.[0] && <img src={o.market_listings.images[0]} alt="" className="w-16 h-16 rounded-xl object-cover" />}
              <div className="flex-1 min-w-0">
                <b className="block truncate">{o.market_listings?.title}</b>
                <span className="text-sm">{tab === "sold" ? `${o.seller_payout} د.ل لك` : `${o.price} د.ل`} · {ORDER_LABEL[o.status]}</span>
              </div>
            </a>
          ))}
      </div>
    </div>
  );
}
