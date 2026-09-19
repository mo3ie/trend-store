"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CreditCard, Loader2, Save, CheckCircle, Users, TrendingUp } from "lucide-react";

interface Plan {
  id: string;
  product: "bot" | "ads" | "studio";
  tier: string;
  page_scope: "single" | "triple" | "unlimited";
  page_limit: number;
  duration: "monthly" | "quarterly" | "yearly";
  months: number;
  price_lyd: number;
  features: string[];
  active: boolean;
  sort: number;
}
interface Subscriber {
  id: string; user_id: string; full_name: string | null; phone: string | null; email: string | null;
  product: string; tier: string | null; page_scope: string | null; page_ids: string[];
  status: string; active: boolean; starts_at: string; expires_at: string | null; price_lyd: number | null; created_at: string;
}
interface PaymentRow {
  id: string; user_id: string; full_name: string | null; phone: string | null;
  product: string; plan_id: string | null; amount_lyd: number; provider: string; status: string; created_at: string;
}
interface Stats {
  total_revenue: number; revenue_month: number; revenue_by_product: Record<string, number>;
  active_count: number; active_by_product: Record<string, number>; total_subscriptions: number; total_payments: number;
}

const PRODUCT_LABEL: Record<string, string> = { bot: "بوت الرد الآلي", ads: "الإعلانات (VIP)", studio: "الموظف الذكي" };
const TIER_LABEL: Record<string, string> = { regular: "عادي", vip: "VIP", basic: "عادي", medium: "متوسط" };
const SCOPE_LABEL: Record<string, string> = { single: "صفحة واحدة", triple: "٣ صفحات", unlimited: "غير محدود" };
const DUR = [
  { key: "monthly", label: "شهري" },
  { key: "quarterly", label: "٣ أشهر" },
  { key: "yearly", label: "سنوي" },
] as const;

export default function AdminSubscriptionsPage() {
  const [view, setView] = useState<"prices" | "subscribers">("prices");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, { price_lyd?: number; active?: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subPayments, setSubPayments] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [subsLoading, setSubsLoading] = useState(false);

  const loadSubscribers = useCallback(async () => {
    setSubsLoading(true);
    const r = await fetch("/api/admin/subscriptions/subscribers").then((x) => x.json()).catch(() => null);
    if (r && !r.error) { setSubscribers(r.subscribers || []); setSubPayments(r.payments || []); setStats(r.stats || null); }
    setSubsLoading(false);
  }, []);
  useEffect(() => { if (view === "subscribers" && !stats) loadSubscribers(); }, [view, stats, loadSubscribers]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/subscriptions").then((x) => x.json()).catch(() => ({ plans: [] }));
    setPlans(r.plans || []);
    setEdits({});
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setPrice = (id: string, v: number) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], price_lyd: v } }));
  const setActive = (id: string, v: boolean) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], active: v } }));

  const priceOf = (p: Plan) => edits[p.id]?.price_lyd ?? p.price_lyd;
  const activeOf = (p: Plan) => edits[p.id]?.active ?? p.active;

  const dirtyIds = useMemo(() => Object.keys(edits).filter((id) => {
    const p = plans.find((x) => x.id === id); if (!p) return false;
    const e = edits[id];
    return (e.price_lyd !== undefined && e.price_lyd !== p.price_lyd) ||
           (e.active !== undefined && e.active !== p.active);
  }), [edits, plans]);

  async function saveAll() {
    if (dirtyIds.length === 0) return;
    setSaving(true);
    for (const id of dirtyIds) {
      const e = edits[id];
      await fetch("/api/admin/subscriptions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...e }),
      });
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2200);
    await load();
  }

  // Group: product → scope → tier, each holding the 3 durations.
  const grouped = useMemo(() => {
    const out: Record<string, Record<string, Record<string, Record<string, Plan>>>> = {};
    for (const p of plans) {
      (((out[p.product] ??= {})[p.page_scope] ??= {})[p.tier] ??= {})[p.duration] = p;
    }
    return out;
  }, [plans]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-400" size={32} /></div>;
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <CreditCard className="text-purple-400" size={26} />
        <div>
          <h1 className="text-2xl font-bold">الاشتراكات</h1>
          <p className="text-sm text-slate-400 mt-0.5">أسعار الباقات، والمشتركون والإيرادات.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setView("prices")}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${view === "prices" ? "bg-gradient-to-l from-purple-600 to-blue-600" : "bg-white/5 border border-purple-500/20 text-slate-300"}`}>
          <CreditCard size={16} /> الأسعار
        </button>
        <button onClick={() => setView("subscribers")}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${view === "subscribers" ? "bg-gradient-to-l from-purple-600 to-blue-600" : "bg-white/5 border border-purple-500/20 text-slate-300"}`}>
          <Users size={16} /> المشتركون والإيرادات
        </button>
      </div>

      {view === "subscribers" && (
        <SubscribersView loading={subsLoading} stats={stats} subscribers={subscribers} payments={subPayments} onReload={loadSubscribers} />
      )}

      {view === "prices" && (["bot", "ads", "studio"] as const).map((product) => {
        const scopes = grouped[product]; if (!scopes) return null;
        return (
          <section key={product} className="bg-white/5 border border-purple-500/20 rounded-2xl p-5 space-y-4">
            <h2 className="font-bold text-lg text-purple-300">{PRODUCT_LABEL[product]}</h2>
            {Object.keys(scopes).sort((a, b) => {
              const order = { single: 0, triple: 1, unlimited: 2 } as Record<string, number>;
              return (order[a] ?? 9) - (order[b] ?? 9);
            }).map((scope) => (
              <div key={scope} className="rounded-xl border border-white/10 overflow-hidden">
                <div className="bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300">{SCOPE_LABEL[scope]}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="text-right px-4 py-2 font-medium">الفئة</th>
                        {DUR.map((d) => <th key={d.key} className="px-4 py-2 font-medium">{d.label}</th>)}
                        <th className="px-4 py-2 font-medium">مفعّلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(scopes[scope]).map((tier) => {
                        const byDur = scopes[scope][tier];
                        // active toggle is per-plan; show the row's monthly plan as the toggle anchor.
                        return (
                          <tr key={tier} className="border-t border-white/5">
                            <td className="px-4 py-2 font-semibold whitespace-nowrap">{TIER_LABEL[tier] ?? tier}</td>
                            {DUR.map((d) => {
                              const p = byDur[d.key];
                              if (!p) return <td key={d.key} className="px-4 py-2 text-center text-slate-600">—</td>;
                              return (
                                <td key={d.key} className="px-2 py-2">
                                  <div className="flex items-center gap-1 justify-center">
                                    <input
                                      type="number" min={0} value={priceOf(p)}
                                      onChange={(e) => setPrice(p.id, Number(e.target.value))}
                                      className={`w-24 bg-white/5 border rounded-lg px-2 py-1.5 text-center outline-none focus:border-purple-400 ${
                                        edits[p.id]?.price_lyd !== undefined && edits[p.id]?.price_lyd !== p.price_lyd
                                          ? "border-amber-400/70" : "border-purple-500/25"}`}
                                    />
                                    <span className="text-[11px] text-slate-500">د.ل</span>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-4 py-2 text-center">
                              {/* toggle every duration of this tier+scope together */}
                              <input type="checkbox"
                                checked={Object.values(byDur).every((p) => activeOf(p))}
                                onChange={(e) => Object.values(byDur).forEach((p) => setActive(p.id, e.target.checked))}
                                className="w-4 h-4 accent-purple-500" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {view === "prices" && (
        <div className="fixed bottom-0 inset-x-0 md:pr-64 bg-[#0b0f1a]/90 backdrop-blur border-t border-purple-500/20 px-6 py-3 flex items-center gap-4">
          <span className="text-sm text-slate-400">
            {dirtyIds.length > 0 ? `${dirtyIds.length} باقة معدّلة غير محفوظة` : "لا تغييرات"}
          </span>
          <button onClick={saveAll} disabled={saving || dirtyIds.length === 0}
            className="mr-auto bg-gradient-to-l from-purple-600 to-blue-600 rounded-xl px-6 py-2.5 font-bold flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={17} /> : saved ? <CheckCircle size={17} /> : <Save size={17} />}
            {saved ? "تم الحفظ" : "حفظ التغييرات"}
          </button>
        </div>
      )}
    </div>
  );
}

const PRODUCT_LABEL_S: Record<string, string> = { bot: "بوت الرد", ads: "إعلانات", studio: "الموظف" };
const TIER_LABEL_S: Record<string, string> = { regular: "عادي", vip: "VIP", basic: "عادي", medium: "متوسط" };

function SubscribersView({ loading, stats, subscribers, payments, onReload }: {
  loading: boolean; stats: Stats | null; subscribers: Subscriber[]; payments: PaymentRow[]; onReload: () => void;
}) {
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-purple-400" size={30} /></div>;

  const cards = stats ? [
    ["إجمالي الإيرادات", `${stats.total_revenue.toLocaleString()} د.ل`, "text-green-400"],
    ["إيراد هذا الشهر", `${stats.revenue_month.toLocaleString()} د.ل`, "text-blue-400"],
    ["اشتراكات فعّالة", stats.active_count, "text-purple-400"],
    ["إجمالي الدفعات", stats.total_payments, "text-amber-400"],
  ] as const : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([label, value, color]) => (
          <div key={label} className="bg-white/5 border border-purple-500/20 rounded-2xl p-5">
            <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
            <div className="text-slate-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="bg-white/5 border border-purple-500/20 rounded-2xl p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp size={17} className="text-green-400" /> الإيراد حسب المنتج</h3>
          <div className="grid grid-cols-3 gap-3">
            {(["bot", "ads", "studio"] as const).map((p) => (
              <div key={p} className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-lg font-extrabold text-green-300">{(stats.revenue_by_product[p] || 0).toLocaleString()}</div>
                <div className="text-xs text-slate-400">{PRODUCT_LABEL_S[p]} · {stats.active_by_product[p] || 0} فعّال</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscribers */}
      <div className="bg-white/5 border border-purple-500/20 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><Users size={17} className="text-purple-400" /> المشتركون ({subscribers.length})</h3>
          <button onClick={onReload} className="text-xs text-purple-300 hover:text-purple-200">تحديث</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-right">
                <th className="px-3 py-2 font-medium">المشترك</th>
                <th className="px-3 py-2 font-medium">الهاتف</th>
                <th className="px-3 py-2 font-medium">المنتج</th>
                <th className="px-3 py-2 font-medium">الفئة</th>
                <th className="px-3 py-2 font-medium">السعر</th>
                <th className="px-3 py-2 font-medium">ينتهي</th>
                <th className="px-3 py-2 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{s.full_name || "—"}</td>
                  <td className="px-3 py-2 text-slate-400" dir="ltr">{s.phone || "—"}</td>
                  <td className="px-3 py-2">{PRODUCT_LABEL_S[s.product] ?? s.product}</td>
                  <td className="px-3 py-2">{TIER_LABEL_S[s.tier ?? ""] ?? s.tier}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{Number(s.price_lyd ?? 0).toLocaleString()} د.ل</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{s.expires_at ? new Date(s.expires_at).toLocaleDateString("ar-LY") : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${s.active ? "bg-green-500/15 text-green-300" : "bg-slate-500/15 text-slate-400"}`}>
                      {s.active ? "فعّال" : "منتهٍ"}
                    </span>
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">لا مشتركين بعد.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments / invoices */}
      <div className="bg-white/5 border border-purple-500/20 rounded-2xl p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><CreditCard size={17} className="text-blue-400" /> الفواتير والدفعات ({payments.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-right">
                <th className="px-3 py-2 font-medium">المشترك</th>
                <th className="px-3 py-2 font-medium">المنتج</th>
                <th className="px-3 py-2 font-medium">المبلغ</th>
                <th className="px-3 py-2 font-medium">الوسيلة</th>
                <th className="px-3 py-2 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{p.full_name || "—"}</td>
                  <td className="px-3 py-2">{PRODUCT_LABEL_S[p.product] ?? p.product}</td>
                  <td className="px-3 py-2 font-extrabold text-blue-300 whitespace-nowrap">{Number(p.amount_lyd).toLocaleString()} د.ل</td>
                  <td className="px-3 py-2 text-slate-400">{p.provider}</td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{new Date(p.created_at).toLocaleString("ar-LY")}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">لا دفعات بعد.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
