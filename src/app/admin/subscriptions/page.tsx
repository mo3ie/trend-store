"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { CreditCard, Loader2, Save, CheckCircle } from "lucide-react";

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

const PRODUCT_LABEL: Record<string, string> = { bot: "بوت الرد الآلي", ads: "الإعلانات (VIP)", studio: "الموظف الذكي" };
const TIER_LABEL: Record<string, string> = { regular: "عادي", vip: "VIP", basic: "عادي", medium: "متوسط" };
const SCOPE_LABEL: Record<string, string> = { single: "صفحة واحدة", triple: "٣ صفحات", unlimited: "غير محدود" };
const DUR = [
  { key: "monthly", label: "شهري" },
  { key: "quarterly", label: "٣ أشهر" },
  { key: "yearly", label: "سنوي" },
] as const;

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, { price_lyd?: number; active?: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          <h1 className="text-2xl font-bold">أسعار الباقات والاشتراكات</h1>
          <p className="text-sm text-slate-400 mt-0.5">حرّر أسعار كل باقة وفعّلها أو أوقفها. الأسعار بالدينار الليبي.</p>
        </div>
      </div>

      {(["bot", "ads", "studio"] as const).map((product) => {
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
    </div>
  );
}
