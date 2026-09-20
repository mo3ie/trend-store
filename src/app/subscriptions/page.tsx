"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Wallet, Check, CreditCard, X, ReceiptText, ShieldCheck, RefreshCw, AlertTriangle, RotateCw } from "lucide-react";

interface Plan {
  id: string; product: "bot" | "ads" | "studio"; tier: string;
  page_scope: "single" | "triple" | "unlimited"; page_limit: number;
  duration: "monthly" | "quarterly" | "yearly"; months: number;
  price_lyd: number; features: string[];
  ai_image_quota?: number; ai_video_quota?: number;
}
interface Sub {
  id: string; product: string; tier: string | null; page_scope: string | null;
  page_ids: string[]; expires_at: string | null; price_lyd: number | null; features: string[];
  auto_renew?: boolean; status?: string;
}
interface Payment { id: string; product: string; amount_lyd: number; created_at: string; plan_id: string | null; kind?: string; }
interface Page { page_id: string; page_name: string | null; page_picture: string | null; }
interface Access { admin: boolean; trial: boolean; trialEndsAt: string | null; full: boolean; }

const PRODUCTS = [
  { key: "bot", label: "بوت الرد الآلي" },
  { key: "ads", label: "الإعلانات VIP" },
  { key: "studio", label: "الموظف الذكي" },
] as const;
const TIER_LABEL: Record<string, string> = { regular: "عادي", vip: "VIP", basic: "عادي", medium: "متوسط" };
const SCOPE_LABEL: Record<string, string> = { single: "صفحة واحدة", triple: "٣ صفحات", unlimited: "غير محدود" };
const DUR = [
  { key: "monthly", label: "شهري" },
  { key: "quarterly", label: "٣ أشهر" },
  { key: "yearly", label: "سنوي" },
] as const;
const SCOPE_ORDER: Record<string, number> = { single: 0, triple: 1, unlimited: 2 };
const FEATURE_LABEL: Record<string, string> = {
  reply_keyword: "الرد بالكلمات المفتاحية", private_dm: "رسالة خاصة تلقائية", like: "إعجاب تلقائي",
  post_targeting: "ردود مخصصة لكل منشور", ai_reply: "ردود الذكاء الاصطناعي", price_reply: "رد تلقائي بالأسعار",
  priority: "أولوية الدعم", ai_targeting: "مساعد الاستهداف بالذكاء الاصطناعي", auto_target: "استهداف تلقائي بلمسة",
  support_247: "دعم على مدار الساعة", full_bot_features: "كل مزايا بوت الرد",
  content_plan: "خطة محتوى بالذكاء الاصطناعي", auto_publish: "النشر التلقائي والجدولة", web_images: "صور من الإنترنت",
  boosting: "ترويج المنشورات", brain_memory: "عقل وذاكرة لكل صفحة", ai_images: "توليد الصور بالذكاء الاصطناعي",
  selective_boost: "ترويج انتقائي", all_bots_access: "الوصول لكل البوتات",
  ai_images_max: "أقوى مولّد صور (واقعية عالية)", ai_image_edit: "تعديل صور منتجاتك بالذكاء الاصطناعي",
  ai_video: "توليد فيديو من وصف نصّي", catalog_import: "رفع الكتالوج من ملف",
};

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [expiredSubs, setExpiredSubs] = useState<Sub[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState(0);
  const [pages, setPages] = useState<Page[]>([]);
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);

  const [product, setProduct] = useState<"bot" | "ads" | "studio">("bot");
  const [scope, setScope] = useState<"single" | "triple" | "unlimited">("single");
  const [duration, setDuration] = useState<"monthly" | "quarterly" | "yearly">("monthly");

  const [picker, setPicker] = useState<Plan | null>(null);
  const [chosenPages, setChosenPages] = useState<string[]>([]);
  const [buying, setBuying] = useState(false);
  const [invoice, setInvoice] = useState<{ amount: number; plan: string } | null>(null);
  const [err, setErr] = useState("");
  // Auto-renew is opt-in at purchase time; `busyId` marks the row being renewed/toggled.
  const [autoRenewNew, setAutoRenewNew] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [rowMsg, setRowMsg] = useState("");

  const loadMine = useCallback(async () => {
    const m = await fetch("/api/subscriptions/mine").then((r) => r.json()).catch(() => null);
    if (m && !m.error) {
      setSubs(m.subscriptions || []); setExpiredSubs(m.expired || []);
      setPayments(m.payments || []); setBalance(Number(m.balance || 0)); setAccess(m.access || null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [p, pg] = await Promise.all([
        fetch("/api/subscriptions/plans").then((r) => r.json()).catch(() => ({ plans: [] })),
        fetch("/api/promo/pages").then((r) => r.json()).catch(() => ({ pages: [] })),
      ]);
      setPlans(p.plans || []);
      setPages(pg.pages || []);
      await loadMine();
      setLoading(false);
    })();
  }, [loadMine]);

  const scopesForProduct = useMemo(() => {
    const s = new Set(plans.filter((p) => p.product === product).map((p) => p.page_scope));
    return [...s].sort((a, b) => (SCOPE_ORDER[a] ?? 9) - (SCOPE_ORDER[b] ?? 9));
  }, [plans, product]);

  useEffect(() => { if (scopesForProduct.length && !scopesForProduct.includes(scope)) setScope(scopesForProduct[0] as typeof scope); }, [scopesForProduct, scope]);

  // Tiers available for the current product+scope, with the chosen-duration plan + its monthly twin.
  const cards = useMemo(() => {
    const rows = plans.filter((p) => p.product === product && p.page_scope === scope);
    const tiers = [...new Set(rows.map((r) => r.tier))];
    return tiers.map((tier) => {
      const plan = rows.find((r) => r.tier === tier && r.duration === duration);
      const monthly = rows.find((r) => r.tier === tier && r.duration === "monthly");
      let discount = 0;
      if (plan && monthly && plan.months > 1) {
        const perMonth = plan.price_lyd / plan.months;
        discount = Math.round((1 - perMonth / monthly.price_lyd) * 100);
      }
      return { tier, plan, discount };
    }).filter((c) => c.plan);
  }, [plans, product, scope, duration]);

  function startBuy(plan: Plan) {
    setErr("");
    if (plan.page_limit >= 999) { doBuy(plan, []); return; }
    setChosenPages([]); setPicker(plan);
  }

  async function doBuy(plan: Plan, pageIds: string[]) {
    setBuying(true); setErr("");
    const r = await fetch("/api/subscriptions/purchase", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, page_ids: pageIds, auto_renew: autoRenewNew }),
    }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBuying(false);
    if (r.error) {
      setErr(r.message || (r.error === "insufficient_balance" ? "رصيد المحفظة غير كافٍ" : "تعذّر إتمام العملية"));
      return;
    }
    setPicker(null);
    setBalance(Number(r.balance ?? balance));
    setInvoice({ amount: Number(r.invoice?.amount_lyd ?? plan.price_lyd), plan: `${PRODUCTS.find((x) => x.key === plan.product)?.label} — ${TIER_LABEL[plan.tier] ?? plan.tier}` });
    await loadMine();
  }

  // Renew from the wallet. The server re-reads the current plan price and adds the new
  // term on top of whatever is left, so renewing early never wastes paid days.
  async function renewNow(sub: Sub) {
    setBusyId(sub.id); setRowMsg("");
    const r = await fetch("/api/subscriptions/renew", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: sub.id }),
    }).then((x) => x.json()).catch(() => ({ error: "network" }));
    setBusyId("");
    if (r.error) { setRowMsg(r.message || "تعذّر التجديد"); return; }
    setBalance(Number(r.balance ?? balance));
    setInvoice({ amount: Number(r.charged ?? 0), plan: `تجديد ${PRODUCTS.find((x) => x.key === sub.product)?.label ?? sub.product}` });
    await loadMine();
  }

  async function toggleAutoRenew(sub: Sub, value: boolean) {
    setBusyId(sub.id); setRowMsg("");
    await fetch("/api/subscriptions/renew", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: sub.id, auto_renew: value }),
    }).catch(() => null);
    setBusyId("");
    await loadMine();
  }

  const daysLeft = (iso: string | null) =>
    iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null;

  if (loading) return <div className="min-h-screen bg-[#0b0f1a] flex justify-center items-center"><Loader2 className="animate-spin text-purple-400" size={34} /></div>;

  return (
    <div dir="rtl" className="min-h-screen bg-[#0b0f1a] text-white px-4 py-6 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <CreditCard className="text-purple-400" size={26} /> الاشتراكات والباقات
          </h1>
          <div className="flex items-center gap-2 bg-white/5 border border-purple-500/20 rounded-2xl px-4 py-2">
            <Wallet size={18} className="text-blue-400" />
            <span className="text-slate-400 text-sm">الرصيد</span>
            <span className="font-extrabold text-blue-300">{balance.toLocaleString()} د.ل</span>
          </div>
        </div>

        {/* Product tabs */}
        <div className="flex gap-2 flex-wrap">
          {PRODUCTS.map((p) => (
            <button key={p.key} onClick={() => setProduct(p.key)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${product === p.key ? "bg-gradient-to-l from-purple-600 to-blue-600" : "bg-white/5 border border-purple-500/20 text-slate-300"}`}>
              {p.label}
            </button>
          ))}
        </div>

        {access?.admin && (
          <p className="text-sm bg-purple-500/10 border border-purple-500/30 text-purple-200 rounded-xl px-4 py-3">
            حساب أدمن — كل الأدوات والمزايا مفتوحة لك للتجربة والاختبار دون اشتراك.
          </p>
        )}
        {access && !access.admin && access.trial && (
          <p className="text-sm bg-green-500/10 border border-green-500/30 text-green-200 rounded-xl px-4 py-3">
            🎁 أنت في فترة التجربة المجانية — كل الأدوات مفتوحة
            {access.trialEndsAt ? ` حتى ${new Date(access.trialEndsAt).toLocaleDateString("ar-LY")} (${Math.max(0, Math.ceil((new Date(access.trialEndsAt).getTime() - Date.now()) / 86400000))} يوم متبقٍّ)` : ""}.
            بعدها يلزم الاشتراك للاستمرار.
          </p>
        )}
        {access && !access.admin && !access.trial && subs.length === 0 && (
          <p className="text-sm bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl px-4 py-3">
            انتهت تجربتك المجانية — اشترك في الأداة التي تريدها للاستمرار.
          </p>
        )}

        {product === "ads" && (
          <p className="text-sm bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl px-4 py-3">
            اشتراك الإعلانات VIP للمزايا فقط — تدفع قيمة الإعلان بشكل منفصل (أي مبلغ تريده).
          </p>
        )}

        {/* Scope + duration */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-white/5 border border-purple-500/20 rounded-xl p-1">
            {scopesForProduct.map((s) => (
              <button key={s} onClick={() => setScope(s as typeof scope)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${scope === s ? "bg-purple-600" : "text-slate-300"}`}>
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white/5 border border-purple-500/20 rounded-xl p-1">
            {DUR.map((d) => (
              <button key={d.key} onClick={() => setDuration(d.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${duration === d.key ? "bg-blue-600" : "text-slate-300"}`}>
                {d.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 bg-white/5 border border-purple-500/20 rounded-xl px-3 py-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={autoRenewNew} onChange={(e) => setAutoRenewNew(e.target.checked)}
              className="accent-purple-500 w-4 h-4" />
            <RefreshCw size={15} className="text-purple-300" />
            <span className="text-slate-300">جدّد اشتراكي تلقائياً</span>
          </label>
        </div>

        {/* Tier cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ tier, plan, discount }) => (
            <div key={tier} className="bg-white/5 border border-purple-500/20 rounded-2xl p-5 flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{TIER_LABEL[tier] ?? tier}</h3>
                {discount > 0 && <span className="text-xs font-bold bg-green-500/15 text-green-300 rounded-full px-2 py-0.5">وفّر {discount}%</span>}
              </div>
              <div className="my-3">
                <span className="text-3xl font-black text-purple-300">{plan!.price_lyd.toLocaleString()}</span>
                <span className="text-slate-400 text-sm"> د.ل / {DUR.find((d) => d.key === plan!.duration)?.label}</span>
              </div>
              <ul className="space-y-1.5 mb-4 flex-1">
                {plan!.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check size={15} className="text-green-400 shrink-0" /> {FEATURE_LABEL[f] ?? f}
                  </li>
                ))}
              </ul>
              {/* The monthly allowance is the single most important number on a Studio
                  plan, so it is stated on the card rather than discovered after paying. */}
              {plan!.product === "studio" && ((plan!.ai_image_quota ?? 0) > 0 || (plan!.ai_video_quota ?? 0) > 0) && (
                <div className="bg-purple-500/10 border border-purple-500/25 rounded-xl px-3 py-2.5 mb-4 text-xs leading-6">
                  <div className="font-bold text-purple-200 mb-0.5">حصة الذكاء القوي شهرياً</div>
                  <div className="text-slate-300">
                    {(plan!.ai_image_quota ?? 0) > 0 && <>🖼️ {plan!.ai_image_quota} صورة عالية الجودة</>}
                    {(plan!.ai_image_quota ?? 0) > 0 && (plan!.ai_video_quota ?? 0) > 0 && " · "}
                    {(plan!.ai_video_quota ?? 0) > 0 && <>🎬 {plan!.ai_video_quota} فيديو</>}
                  </div>
                  <div className="text-slate-500 mt-0.5">التوليد المجاني وصور الإنترنت والكتالوج بلا حدود</div>
                </div>
              )}
              <button onClick={() => startBuy(plan!)}
                className="w-full bg-gradient-to-l from-purple-600 to-blue-600 rounded-xl py-2.5 font-bold">
                اشترك الآن
              </button>
            </div>
          ))}
          {cards.length === 0 && <p className="text-slate-500 col-span-full">لا توجد باقات لهذا الخيار.</p>}
        </div>

        {/* Active subscriptions — expiry countdown, renew now, auto-renew switch */}
        {subs.length > 0 && (
          <section className="bg-white/5 border border-purple-500/20 rounded-2xl p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2"><ShieldCheck size={18} className="text-green-400" /> اشتراكاتك الفعّالة</h2>
            <div className="space-y-2">
              {subs.map((s) => {
                const left = daysLeft(s.expires_at);
                const soon = left !== null && left <= 7;
                return (
                  <div key={s.id} className={`rounded-xl px-4 py-3 text-sm border ${soon ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-transparent"}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-semibold">{PRODUCTS.find((p) => p.key === s.product)?.label} — {TIER_LABEL[s.tier ?? ""] ?? s.tier} · {SCOPE_LABEL[s.page_scope ?? ""] ?? s.page_scope}</span>
                      <span className={soon ? "text-amber-300 font-bold flex items-center gap-1" : "text-slate-400"}>
                        {soon && <AlertTriangle size={14} />}
                        ينتهي {s.expires_at ? new Date(s.expires_at).toLocaleDateString("ar-LY") : "—"}
                        {left !== null && ` (${left > 0 ? `${left} يوم متبقٍّ` : "اليوم"})`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-3 mt-2.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                        <input type="checkbox" checked={!!s.auto_renew} disabled={busyId === s.id}
                          onChange={(e) => toggleAutoRenew(s, e.target.checked)}
                          className="accent-purple-500 w-4 h-4" />
                        التجديد التلقائي من المحفظة
                      </label>
                      <button onClick={() => renewNow(s)} disabled={busyId === s.id}
                        className="flex items-center gap-1.5 bg-gradient-to-l from-purple-600 to-blue-600 rounded-xl px-4 py-1.5 font-bold disabled:opacity-50">
                        {busyId === s.id ? <Loader2 className="animate-spin" size={15} /> : <RotateCw size={15} />}
                        جدّد الآن
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {rowMsg && <p className="text-red-400 text-sm mt-3">{rowMsg}</p>}
          </section>
        )}

        {/* Lapsed subscriptions — one click brings them back on the same plan */}
        {expiredSubs.length > 0 && (
          <section className="bg-white/5 border border-red-500/20 rounded-2xl p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-red-400" /> اشتراكات منتهية</h2>
            <div className="space-y-2">
              {expiredSubs.map((s) => (
                <div key={s.id} className="flex items-center justify-between flex-wrap gap-2 bg-white/5 rounded-xl px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-300">{PRODUCTS.find((p) => p.key === s.product)?.label ?? s.product} — {TIER_LABEL[s.tier ?? ""] ?? s.tier}</span>
                  <span className="text-slate-500">انتهى {s.expires_at ? new Date(s.expires_at).toLocaleDateString("ar-LY") : "—"}</span>
                  <button onClick={() => renewNow(s)} disabled={busyId === s.id}
                    className="flex items-center gap-1.5 bg-white/10 border border-purple-500/30 rounded-xl px-4 py-1.5 font-bold disabled:opacity-50">
                    {busyId === s.id ? <Loader2 className="animate-spin" size={15} /> : <RotateCw size={15} />}
                    إعادة التفعيل
                  </button>
                </div>
              ))}
            </div>
            {rowMsg && <p className="text-red-400 text-sm mt-3">{rowMsg}</p>}
          </section>
        )}

        {/* Payment-activity window */}
        <section className="bg-white/5 border border-purple-500/20 rounded-2xl p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2"><ReceiptText size={18} className="text-blue-400" /> سجل الدفعات والفواتير</h2>
          {payments.length === 0 ? (
            <p className="text-slate-500 text-sm">لا توجد دفعات بعد.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between flex-wrap gap-2 bg-white/5 rounded-xl px-4 py-2.5 text-sm">
                  <span className="font-semibold">
                    {PRODUCTS.find((x) => x.key === p.product)?.label ?? p.product}
                    {p.kind === "renewal" && <span className="mr-2 text-xs font-bold bg-purple-500/15 text-purple-300 rounded-full px-2 py-0.5">تجديد</span>}
                  </span>
                  <span className="text-slate-400">{new Date(p.created_at).toLocaleString("ar-LY")}</span>
                  <span className="font-extrabold text-blue-300">{Number(p.amount_lyd).toLocaleString()} د.ل</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Page picker modal */}
      {picker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !buying && setPicker(null)}>
          <div dir="rtl" className="bg-[#111827] border border-purple-500/30 rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">اختر {picker.page_limit === 1 ? "الصفحة" : `حتى ${picker.page_limit} صفحات`}</h3>
              <button onClick={() => setPicker(null)} className="text-slate-400"><X size={18} /></button>
            </div>
            {pages.length === 0 ? (
              <p className="text-slate-400 text-sm">لا توجد صفحات مرتبطة بحسابك. اربط صفحة أولاً من صفحة الإعلانات.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pages.map((pg) => {
                  const on = chosenPages.includes(pg.page_id);
                  const full = chosenPages.length >= picker.page_limit && !on;
                  return (
                    <button key={pg.page_id} disabled={full}
                      onClick={() => setChosenPages((c) => on ? c.filter((x) => x !== pg.page_id) : [...c, pg.page_id])}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border text-sm ${on ? "border-purple-400 bg-purple-500/10" : "border-white/10 bg-white/5"} ${full ? "opacity-40" : ""}`}>
                      {pg.page_picture && <img src={pg.page_picture} alt="" className="w-8 h-8 rounded-full" />}
                      <span className="flex-1 text-right font-semibold">{pg.page_name || pg.page_id}</span>
                      {on && <Check size={16} className="text-purple-300" />}
                    </button>
                  );
                })}
              </div>
            )}
            {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
            <button
              disabled={buying || chosenPages.length === 0}
              onClick={() => doBuy(picker, chosenPages)}
              className="w-full mt-4 bg-gradient-to-l from-purple-600 to-blue-600 rounded-xl py-2.5 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {buying ? <Loader2 className="animate-spin" size={17} /> : <CreditCard size={17} />}
              ادفع {picker.price_lyd.toLocaleString()} د.ل
            </button>
          </div>
        </div>
      )}

      {/* Invoice confirmation */}
      {invoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setInvoice(null)}>
          <div dir="rtl" className="bg-[#111827] border border-green-500/30 rounded-2xl p-6 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
              <Check className="text-green-400" size={30} />
            </div>
            <h3 className="font-bold text-lg mb-1">تم الاشتراك بنجاح</h3>
            <p className="text-slate-400 text-sm mb-3">{invoice.plan}</p>
            <div className="bg-white/5 rounded-xl px-4 py-3 mb-4">
              <span className="text-slate-400 text-sm">المبلغ المدفوع</span>
              <div className="text-2xl font-black text-green-300">{invoice.amount.toLocaleString()} د.ل</div>
            </div>
            <button onClick={() => setInvoice(null)} className="w-full bg-gradient-to-l from-purple-600 to-blue-600 rounded-xl py-2.5 font-bold">تم</button>
          </div>
        </div>
      )}
    </div>
  );
}
