"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Zap, Send, ListChecks, Loader2, Copy, Check, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import WalletModal from "@/components/WalletModal";

type Pkg = { id: string; name: string; logo: string | null; price: number };
type Prod = { id: string; title: string; description: string | null; icon: string | null; currency: string; minPayout: string | null; maxPayout: string | null };
type Field = { key: string; label: string; kind: string; required: boolean; validation: string | null; message: string | null };
type Detail = { id: string; title: string; currency: string; fields: Field[]; lists: Record<string, { id: string; name: string }[]> };
type Quote = { payout: string; currency: string; rate: string; cost: number; price: number };
type Token = { sequence: number; label: string; code: string; description: string | null };
type Order = {
  id: string; kind: "meter" | "recharge"; status: string; title: string; target: string; price: number; refunded: number; error: string | null; created_at: string; product_id: string | null;
  result: { tokens?: Token[]; receiptNumber?: string; creditedAmount?: string; taxes?: { description: string; amount: string }[]; failure?: { message: string | null } | null; refund?: { status: string } | null; proofUrl?: string | null; reason?: string | null; status?: string; number?: number } | null;
};

const STATUS: Record<string, [string, string]> = {
  processing: ["قيد التنفيذ", "text-amber-400"], succeeded: ["تم ✅", "text-green-400"], refunded: ["رجع المبلغ ↩️", "text-sky-400"],
  failed: ["فشل — الاسترجاع جارٍ", "text-red-400"], action_needed: ["يحتاج تصحيح ✏️", "text-orange-400"],
};
const RSTAGE: Record<string, string> = { awaitingPayment: "جاري الخصم", pending: "بانتظار الموظف", inProgress: "الموظف يشتغل عليه", rejectedAwaitingRefund: "رُفض — الاسترجاع جارٍ" };

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button className="gp-btn gp-btn-ghost px-2 py-1 text-xs" onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }}>{ok ? <Check size={13} /> : <Copy size={13} />} نسخ</button>;
}

export default function UtilitiesPage() {
  const [tab, setTab] = useState<"meter" | "recharge" | "orders">("meter");
  const [d, setD] = useState<{ meter: { enabled: boolean; packages: Pkg[] }; recharge: { enabled: boolean; products: Prod[] } } | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [topup, setTopup] = useState(false);
  // meter
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [meterNo, setMeterNo] = useState("");
  // recharge
  const [prod, setProd] = useState<Detail | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fix, setFix] = useState<{ order: Order; detail: Detail; vals: Record<string, string> } | null>(null);

  useEffect(() => {
    fetch("/api/utilities").then((r) => r.json()).then(setD);
    const t = new URLSearchParams(location.search).get("tab");
    if (t === "recharge" || t === "orders") setTab(t);
    try { const m = localStorage.getItem("trend_meter_no"); if (m) setMeterNo(m); } catch {}
  }, []);

  const loadOrders = useCallback(async () => {
    const r = await fetch("/api/utilities/orders");
    if (r.status === 401) { setOrders([]); return; }
    setOrders((await r.json()).orders || []);
  }, []);
  useEffect(() => { if (tab === "orders") loadOrders(); }, [tab, loadOrders]);
  // While something is still running, refresh every 8s.
  useEffect(() => {
    if (tab !== "orders" || !orders?.some((o) => o.status === "processing")) return;
    const t = setTimeout(loadOrders, 8000);
    return () => clearTimeout(t);
  }, [tab, orders, loadOrders]);

  const post = async (body: object) => {
    setBusy(true); setErr("");
    const r = await fetch("/api/utilities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (r.status === 401) { location.href = "/login?next=/utilities"; return; }
    if (j.code === "INSUFFICIENT") { setTopup(true); return; }
    if (!r.ok) { setErr(j.error); return; }
    setTab("orders"); setPkg(null); setQuote(null); setProd(null); setAmount(""); loadOrders();
  };

  const openProd = async (p: Prod) => {
    setErr(""); setQuote(null); setVals({}); setAmount(p.minPayout ? String(Number(p.minPayout)) : "");
    const r = await fetch(`/api/utilities/recharge/${p.id}`); const j = await r.json();
    if (!r.ok) return setErr(j.error);
    setProd(j);
  };
  const getQuote = async () => {
    if (!prod) return;
    setBusy(true); setErr(""); setQuote(null);
    const r = await fetch(`/api/utilities/recharge/${prod.id}?amount=${encodeURIComponent(amount)}&in=fx`); const j = await r.json(); setBusy(false);
    if (!r.ok) return setErr(j.error);
    setQuote(j);
  };
  const badField = (f: Field, v: string) => { if (!f.required) return false; if (!v) return true; if (f.validation) { try { return !new RegExp(f.validation).test(v); } catch { return false; } } return false; };

  const startFix = async (o: Order) => {
    if (!o.product_id) return;
    const r = await fetch(`/api/utilities/recharge/${o.product_id}`); const j = await r.json();
    if (r.ok) setFix({ order: o, detail: j, vals: {} });
  };
  const sendFix = async () => {
    if (!fix) return;
    setBusy(true);
    const r = await fetch(`/api/utilities/orders/${fix.order.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipient: Object.entries(fix.vals).map(([key, value]) => ({ key, value })) }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return alert(j.error);
    setFix(null); loadOrders();
  };

  const inp = "w-full px-3 py-2.5 rounded-xl bg-black/20 border border-[var(--line,rgba(255,255,255,.12))] text-[var(--text)]";

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <header className="gp-top flex items-center gap-4 px-6 py-4">
        <a href="/" className="text-[var(--muted)] hover:text-[var(--text)]"><ArrowRight size={20} /></a>
        <h1 className="text-lg font-bold flex-1">الكهرباء والشحن المباشر</h1>
      </header>
      <div className="gp-wrap w-full space-y-5">
        <div className="flex gap-2 flex-wrap">
          <button className={`gp-pill ${tab === "meter" ? "on" : ""}`} onClick={() => setTab("meter")}><Zap size={14} className="inline" /> خالص — الكهرباء</button>
          <button className={`gp-pill ${tab === "recharge" ? "on" : ""}`} onClick={() => setTab("recharge")}><Send size={14} className="inline" /> الشحن المباشر</button>
          <button className={`gp-pill ${tab === "orders" ? "on" : ""}`} onClick={() => setTab("orders")}><ListChecks size={14} className="inline" /> طلباتي</button>
        </div>
        {err && <div className="gp-panel p-3 text-sm text-red-400 flex gap-2"><AlertTriangle size={16} /> {err}</div>}

        {!d ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : tab === "meter" ? (
          !d.meter.enabled || !d.meter.packages.length ? <div className="gp-panel p-10 text-center text-[var(--muted)]">شحن الكهرباء يتفعّل قريباً.</div> : (
            <section className="gp-panel p-5 space-y-4">
              <div><h2 className="font-bold text-lg">⚡ اشحن عداد الكهرباء (الدفع المسبق)</h2><p className="text-sm text-[var(--muted)]">اختار الباقة، اكتب رقم العداد، وتوصلك رموز الشحن هنا خلال ثواني — تدخلها في العداد.</p></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {d.meter.packages.map((p) => (
                  <button key={p.id} onClick={() => setPkg(p)} className={`rounded-2xl p-4 text-center border transition ${pkg?.id === p.id ? "border-amber-400 bg-amber-400/10" : "border-white/10 bg-black/15"}`}>
                    {p.logo ? <img src={p.logo} alt="" className="h-10 mx-auto mb-2 object-contain" /> : <Zap className="mx-auto mb-2 text-amber-400" />}
                    <div className="font-bold">{p.name}</div><div className="text-sm text-[var(--muted)]">{p.price} د.ل</div>
                  </button>
                ))}
              </div>
              <label className="block text-sm space-y-1"><span>رقم العداد</span>
                <input className={inp} dir="ltr" inputMode="numeric" placeholder="مثال: 0268000710262" value={meterNo} onChange={(e) => setMeterNo(e.target.value.replace(/[^\d]/g, ""))} />
                <small className="text-[var(--muted)]">اكتبه كامل زي ما هو على العداد، بالأصفار اللي في البداية.</small>
              </label>
              <button disabled={!pkg || meterNo.length < 6 || busy} className="gp-btn w-full py-3 justify-center"
                onClick={() => { if (!pkg) return; if (!confirm(`تأكيد شحن ${pkg.name} للعداد ${meterNo} بمبلغ ${pkg.price} د.ل من محفظتك؟`)) return; try { localStorage.setItem("trend_meter_no", meterNo); } catch {} post({ kind: "meter", package_id: pkg.id, meter_number: meterNo }); }}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} {pkg ? `ادفع ${pkg.price} د.ل واشحن` : "اختار باقة"}
              </button>
            </section>
          )
        ) : tab === "recharge" ? (
          !d.recharge.enabled || !d.recharge.products.length ? <div className="gp-panel p-10 text-center text-[var(--muted)]">الشحن المباشر يتفعّل قريباً.</div> : (
            <section className="gp-panel p-5 space-y-4">
              <div><h2 className="font-bold text-lg">💸 الشحن المباشر</h2><p className="text-sm text-[var(--muted)]">ادفع بالدينار من محفظتك، والمستلم يوصله المبلغ على محفظته. التنفيذ يدوي من المزوّد وممكن ياخذ وقت — تتابعه في «طلباتي».</p></div>
              <div className="flex gap-2 flex-wrap">
                {d.recharge.products.map((p) => <button key={p.id} onClick={() => openProd(p)} className={`gp-pill ${prod?.id === p.id ? "on" : ""}`}>{p.icon ? <img src={p.icon} alt="" className="inline h-4 me-1" /> : null}{p.title}</button>)}
              </div>
              {prod && (() => {
                const meta = d.recharge.products.find((p) => p.id === prod.id);
                return (
                  <div className="space-y-3">
                    {prod.fields.filter((f) => f.kind !== "note").map((f) => (
                      <label key={f.key} className="block text-sm space-y-1"><span>{f.label}</span>
                        {f.kind === "list"
                          ? <select className={inp} value={vals[f.key] || ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}><option value="">اختر…</option>{(prod.lists[f.key] || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                          : <input className={inp} dir="ltr" value={vals[f.key] || ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value.trim() })} />}
                        {vals[f.key] && badField(f, vals[f.key]) && <small className="text-red-400">{f.message || "غير صحيح"}</small>}
                      </label>
                    ))}
                    <label className="block text-sm space-y-1"><span>المبلغ اللي يستلمه ({prod.currency})</span>
                      <div className="flex gap-2"><input className={inp} dir="ltr" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setQuote(null); }} />
                        <button className="gp-btn gp-btn-ghost px-4" disabled={!amount || busy} onClick={getQuote}>{busy && !quote ? <Loader2 size={15} className="animate-spin" /> : "احسب"}</button></div>
                      {meta?.minPayout && <small className="text-[var(--muted)]">من {Number(meta.minPayout)} إلى {Number(meta.maxPayout)} {prod.currency}</small>}
                    </label>
                    {quote && (
                      <div className="rounded-2xl bg-black/20 p-4 space-y-1 text-sm">
                        <div className="flex justify-between"><span>يستلم</span><b dir="ltr">{quote.payout} {quote.currency}</b></div>
                        <div className="flex justify-between text-[var(--muted)]"><span>سعر الصرف</span><span dir="ltr">{quote.rate}</span></div>
                        <div className="flex justify-between text-base"><span>تدفع</span><b>{quote.price} د.ل</b></div>
                      </div>
                    )}
                    <button className="gp-btn w-full py-3 justify-center" disabled={!quote || busy || prod.fields.some((f) => f.kind !== "note" && badField(f, vals[f.key] || ""))}
                      onClick={() => { if (!quote) return; if (!confirm(`تأكيد إرسال ${quote.payout} ${quote.currency} بمبلغ ${quote.price} د.ل؟ تأكد من بيانات المستلم — التحويل لا يُلغى بعد التنفيذ.`)) return; post({ kind: "recharge", product_id: prod.id, payout: quote.payout, cost: quote.cost, recipient: Object.entries(vals).map(([key, value]) => ({ key, value })) }); }}>
                      {busy && quote ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {quote ? `ادفع ${quote.price} د.ل وأرسل` : "احسب المبلغ أولاً"}
                    </button>
                  </div>
                );
              })()}
            </section>
          )
        ) : (
          <section className="space-y-3">
            <div className="flex justify-end"><button className="gp-btn gp-btn-ghost text-sm px-3 py-1.5" onClick={loadOrders}><RefreshCw size={14} /> تحديث</button></div>
            {!orders ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> : !orders.length ? <div className="gp-panel p-10 text-center text-[var(--muted)]">ما عندك طلبات بعد.</div> : orders.map((o) => {
              const [label, cls] = STATUS[o.status] || [o.status, ""];
              const r = o.result;
              return (
                <div key={o.id} className="gp-panel p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {o.kind === "meter" ? <Zap size={18} className="text-amber-400" /> : <Send size={18} className="text-sky-400" />}
                    <b className="flex-1">{o.title}</b><span className={`text-sm ${cls}`}>{label}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)] flex flex-wrap gap-3"><span dir="ltr">{o.target}</span><span>{o.price} د.ل</span><span>{new Date(o.created_at).toLocaleString("ar-LY")}</span>{o.refunded > 0 && <span className="text-sky-400">رجع {o.refunded} د.ل</span>}</div>
                  {o.status === "processing" && o.kind === "recharge" && r?.status && RSTAGE[r.status] && <div className="text-sm text-amber-400">{RSTAGE[r.status]}…</div>}
                  {o.kind === "meter" && o.status === "succeeded" && r?.tokens && (
                    <div className="space-y-2">
                      {r.tokens.map((t) => (
                        <div key={t.sequence} className="rounded-xl bg-black/25 p-3">
                          <div className="text-xs text-[var(--muted)]">{t.sequence}. {t.label}{t.description ? ` — ${t.description}` : ""}</div>
                          <div className="flex items-center gap-2"><code dir="ltr" className="flex-1 text-lg font-bold tracking-wider break-all">{t.code}</code><CopyBtn text={t.code} /></div>
                        </div>
                      ))}
                      {r.tokens.length > 1 && <p className="text-xs text-amber-400">ادخل الرموز بالترتيب من الأول للأخير.</p>}
                      <div className="text-xs text-[var(--muted)] space-y-0.5">
                        {r.receiptNumber && <div>رقم الإيصال: <span dir="ltr">{r.receiptNumber}</span></div>}
                        {r.creditedAmount && <div>المبلغ المضاف للعداد: {r.creditedAmount} (قد يختلف عن المدفوع بسبب الضرائب والرسوم)</div>}
                        {r.taxes?.map((t, i) => <div key={i}>{t.description}: {t.amount}</div>)}
                      </div>
                    </div>
                  )}
                  {o.kind === "recharge" && o.status === "succeeded" && r?.proofUrl && <a href={r.proofUrl} target="_blank" rel="noreferrer" className="text-sm text-sky-400 inline-flex items-center gap-1">إثبات التحويل <ExternalLink size={13} /></a>}
                  {(o.status === "failed" || o.status === "refunded") && (r?.failure?.message || o.error) && <div className="text-sm text-red-400">{r?.failure?.message || o.error}</div>}
                  {o.status === "failed" && <div className="text-xs text-[var(--muted)]">المبلغ يرجع لمحفظتك تلقائياً أول ما يأكده المزوّد.</div>}
                  {o.status === "action_needed" && (
                    <div className="rounded-xl bg-orange-500/10 p-3 text-sm space-y-2">
                      <div>{o.error || "بيانات المستلم تحتاج تصحيح"}</div>
                      {fix?.order.id !== o.id ? <button className="gp-btn px-3 py-1.5 text-sm" onClick={() => startFix(o)}>صحّح البيانات</button> : (
                        <div className="space-y-2">
                          {fix.detail.fields.filter((f) => f.kind !== "note").map((f) => (
                            <label key={f.key} className="block space-y-1"><span>{f.label}</span>
                              {f.kind === "list" ? <select className={inp} value={fix.vals[f.key] || ""} onChange={(e) => setFix({ ...fix, vals: { ...fix.vals, [f.key]: e.target.value } })}><option value="">اختر…</option>{(fix.detail.lists[f.key] || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                                : <input className={inp} dir="ltr" value={fix.vals[f.key] || ""} onChange={(e) => setFix({ ...fix, vals: { ...fix.vals, [f.key]: e.target.value.trim() } })} />}
                            </label>
                          ))}
                          <button className="gp-btn px-3 py-1.5 text-sm" disabled={busy} onClick={sendFix}>إرسال التصحيح</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
      {topup && <WalletModal onClose={() => setTopup(false)} />}
    </div>
  );
}
