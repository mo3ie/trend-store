"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, Loader2, Save, Music2, CheckCircle } from "lucide-react";

interface Sub { price_lyd: number; expires_at: string | null; }
interface BotRow {
  id: string; page_id: string; page_name: string | null; platform: string;
  enabled: boolean; sub_active: boolean; subscription: Sub | null;
}
interface Overview {
  bots: BotRow[]; total_bots: number; running_bots: number;
  active_subs: number; monthly_revenue_lyd: number; total_replies: number;
}

export default function AdminBotPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState(50);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ov, st] = await Promise.all([
      fetch("/api/bot/admin").then((r) => r.json()).catch(() => null),
      fetch("/api/bot/settings").then((r) => r.json()).catch(() => ({ monthly_price_lyd: 50 })),
    ]);
    setData(ov);
    setPrice(Number(st.monthly_price_lyd ?? 50));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function savePrice() {
    setSaving(true);
    await fetch("/api/bot/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthly_price_lyd: price }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-400" size={32} /></div>;
  }

  const stats = [
    ["البوتات النشطة", data?.running_bots ?? 0, "text-green-400"],
    ["الاشتراكات الفعّالة", data?.active_subs ?? 0, "text-purple-400"],
    ["الدخل الشهري (د.ل)", data?.monthly_revenue_lyd ?? 0, "text-blue-400"],
    ["إجمالي الردود", data?.total_replies ?? 0, "text-amber-400"],
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-3">
        <Bot className="text-purple-400" size={26} /> بوت الرد الآلي
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(([label, value, color]) => (
          <div key={label} className="bg-white/5 border border-purple-500/20 rounded-2xl p-5">
            <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
            <div className="text-slate-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div className="bg-white/5 border border-purple-500/20 rounded-2xl p-6">
        <h2 className="font-bold mb-4">سعر الاشتراك الشهري</h2>
        <div className="flex gap-3 items-center">
          <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))}
            className="w-40 bg-white/5 border border-purple-500/25 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400" />
          <span className="text-slate-400">د.ل / شهر</span>
          <button onClick={savePrice} disabled={saving}
            className="mr-auto bg-gradient-to-l from-purple-600 to-blue-600 rounded-xl px-6 py-3 font-bold flex items-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={17} /> : saved ? <CheckCircle size={17} /> : <Save size={17} />}
            {saved ? "تم الحفظ" : "حفظ"}
          </button>
        </div>
      </div>

      {/* Bots list */}
      <div className="bg-white/5 border border-purple-500/20 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-purple-500/15 font-bold">
          كل البوتات ({data?.total_bots ?? 0})
        </div>
        {!data?.bots?.length ? (
          <div className="p-8 text-center text-slate-400">لا بوتات بعد</div>
        ) : (
          <div className="divide-y divide-purple-500/10">
            {data.bots.map((b) => (
              <div key={b.id} className="px-6 py-4 flex items-center gap-4">
                {b.platform === "tiktok"
                  ? <Music2 size={18} className="text-pink-500 shrink-0" />
                  : <Bot size={18} className="text-blue-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{b.page_name || b.page_id}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {b.platform === "tiktok" ? "تيك توك" : "فيسبوك"} · {b.page_id}
                  </div>
                </div>
                {b.sub_active && b.subscription?.expires_at && (
                  <div className="text-xs text-slate-400 hidden sm:block">
                    ينتهي {new Date(b.subscription.expires_at).toLocaleDateString("ar-LY")}
                  </div>
                )}
                <span className={`text-xs px-3 py-1 rounded-lg font-bold ${
                  b.enabled && b.sub_active ? "bg-green-500/15 text-green-400"
                  : b.sub_active ? "bg-amber-500/15 text-amber-400"
                  : "bg-white/5 text-slate-400"
                }`}>
                  {b.enabled && b.sub_active ? "يعمل" : b.sub_active ? "مشترك — متوقف" : "غير مشترك"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
