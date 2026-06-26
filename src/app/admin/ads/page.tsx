"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, DollarSign, AlertCircle,
  CheckCircle, Clock, ExternalLink, RefreshCw, Loader2,
  Users, Activity, Settings, Save, Star, Plus, Trash2,
} from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS, DEFAULT_ADS_PRICING, mergeAdsPricing, type AdsPricing } from "@/services/campaigns";
import { supabase } from "@/lib/supabaseClient";

interface Campaign {
  id:                   string;
  user_id:              string;
  page_name?:           string;
  post_url:             string;
  budget:               number;
  service_fee:          number;
  total_price:          number;
  duration_days:        number;
  status:               string;
  external_campaign_id?: string;
  external_adset_id?:   string;
  external_ad_id?:      string;
  error_message?:       string;
  created_at:           string;
  profiles?:            { full_name?: string; email?: string };
}

const DARK = "#0f0f1a";
const CARD = "rgba(255,255,255,0.04)";
const BLUE = "#1877f2";

export default function AdminAdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [token, setToken]         = useState<string | null>(null);

  // Pricing + VIP settings
  const [showSettings, setShowSettings] = useState(false);
  const [pricing, setPricing]   = useState<AdsPricing>(DEFAULT_ADS_PRICING);
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingMsg, setPricingMsg] = useState("");
  const [vips, setVips]         = useState<{ id: string; email: string; full_name?: string }[]>([]);
  const [vipEmail, setVipEmail] = useState("");
  const [vipBusy, setVipBusy]   = useState(false);
  const [vipMsg, setVipMsg]     = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token || null);
      loadCampaigns();
    });
    loadPricing();
    loadVips();
  }, []);

  async function loadPricing() {
    const res = await fetch("/api/promo/admin/pricing");
    if (res.ok) { const d = await res.json(); setPricing(mergeAdsPricing(d.pricing)); }
  }
  async function loadVips() {
    const res = await fetch("/api/promo/admin/tier");
    if (res.ok) { const d = await res.json(); setVips(d.vips || []); }
  }
  async function savePricing() {
    setSavingPricing(true); setPricingMsg("");
    const res = await fetch("/api/promo/admin/pricing", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pricing),
    });
    const d = await res.json();
    setPricingMsg(res.ok ? "✅ تم الحفظ" : `❌ ${d.error || "فشل"}`);
    setSavingPricing(false);
    setTimeout(() => setPricingMsg(""), 3000);
  }
  async function setVip(email: string, tier: "vip" | "regular") {
    if (!email.trim()) return;
    setVipBusy(true); setVipMsg("");
    const res = await fetch("/api/promo/admin/tier", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), tier }),
    });
    const d = await res.json();
    if (res.ok) { setVipEmail(""); await loadVips(); setVipMsg("✅ تم التحديث"); }
    else setVipMsg(`❌ ${d.error || "فشل"}`);
    setVipBusy(false);
    setTimeout(() => setVipMsg(""), 3000);
  }

  function updatePkg(idx: number, patch: Partial<AdsPricing["packages"][number]>) {
    setPricing((p) => ({ ...p, packages: p.packages.map((pk, i) => i === idx ? { ...pk, ...patch } : pk) }));
  }

  async function loadCampaigns() {
    setLoading(true);
    // Admin: fetch all campaigns via Supabase (RLS allows admin)
    const { data } = await supabase
      .from("ad_campaigns")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  }

  async function setStatus(id: string, status: string) {
    if (!token) return;
    setUpdating(id);
    await fetch(`/api/promo/campaigns/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    setUpdating(null);
  }

  async function triggerBoost(campaignId: string) {
    if (!token || !confirm("تشغيل إعلان Meta يدويًا؟")) return;
    setUpdating(campaignId);
    const res  = await fetch("/api/promo/boost", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    const data = await res.json();
    if (data.success) {
      setCampaigns((prev) => prev.map((c) =>
        c.id === campaignId
          ? { ...c, status: "active", external_campaign_id: data.campaignId, external_ad_id: data.adId }
          : c
      ));
    } else {
      alert("فشل: " + data.error);
    }
    setUpdating(null);
  }

  // Stats
  const total   = campaigns.length;
  const active  = campaigns.filter((c) => c.status === "active").length;
  const revenue = campaigns.filter((c) => c.status !== "pending_payment" && c.status !== "failed")
    .reduce((s, c) => s + c.total_price, 0);
  const profit  = campaigns.filter((c) => c.status !== "pending_payment" && c.status !== "failed")
    .reduce((s, c) => s + c.service_fee, 0);
  const failed  = campaigns.filter((c) => c.status === "failed").length;

  const stats = [
    { label: "إجمالي الحملات", val: total,          icon: BarChart3,   color: BLUE    },
    { label: "نشطة الآن",      val: active,         icon: Activity,    color: "#22c55e" },
    { label: "إيرادات (د.ل)",  val: revenue.toFixed(0), icon: DollarSign, color: "#f59e0b" },
    { label: "أرباح (د.ل)",   val: profit.toFixed(0),  icon: TrendingUp, color: "#a78bfa" },
    { label: "فشل",           val: failed,          icon: AlertCircle, color: "#ef4444" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: DARK, color: "#fff", fontFamily: "Cairo,sans-serif", direction: "rtl", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart3 size={22} color={BLUE} />
          لوحة إدارة الإعلانات
        </h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowSettings((s) => !s)} style={{ background: showSettings ? `${BLUE}22` : "rgba(255,255,255,0.06)", border: `1px solid ${showSettings ? BLUE + "55" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "8px 14px", color: showSettings ? "#93c5fd" : "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Settings size={14} /> الأسعار والعملاء
          </button>
          <button onClick={loadCampaigns} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> تحديث
          </button>
        </div>
      </div>

      <div style={{ padding: "28px" }}>

        {/* Pricing + VIP settings */}
        {showSettings && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20, marginBottom: 32 }}>

            {/* Rates + commissions */}
            <div style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <DollarSign size={18} color={BLUE} /> أسعار الصرف والعمولات
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {([
                  ["سعر VIP (د.ل/دولار)", "vipRate"],
                  ["سعر العادي (د.ل/دولار)", "regularRate"],
                  ["عمولة VIP (%)", "vipCommission"],
                  ["عمولة العادي (%)", "regularCommission"],
                ] as const).map(([lbl, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>{lbl}</label>
                    <input type="number" min={0} step="0.1" value={pricing[key]}
                      onChange={(e) => setPricing((p) => ({ ...p, [key]: Number(e.target.value) }))}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>

              <h4 style={{ fontSize: 13, fontWeight: 700, margin: "20px 0 10px", color: "#cbd5e1" }}>الباقات (بالدولار)</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pricing.packages.map((pk, i) => (
                  <div key={pk.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 1.4fr", gap: 8, alignItems: "center" }}>
                    <input value={pk.name} onChange={(e) => updatePkg(i, { name: e.target.value })} placeholder="الاسم"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 8px", color: "#fff", fontSize: 12, outline: "none", minWidth: 0 }} />
                    <input type="number" min={1} value={pk.usd} onChange={(e) => updatePkg(i, { usd: Number(e.target.value) })} title="دولار"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 8px", color: "#fff", fontSize: 12, outline: "none", minWidth: 0 }} />
                    <input type="number" min={1} value={pk.days} onChange={(e) => updatePkg(i, { days: Number(e.target.value) })} title="أيام"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 8px", color: "#fff", fontSize: 12, outline: "none", minWidth: 0 }} />
                    <input value={pk.reach} onChange={(e) => updatePkg(i, { reach: e.target.value })} placeholder="وصول تقديري"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 8px", color: "#fff", fontSize: 12, outline: "none", minWidth: 0 }} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#64748b", margin: "10px 0 0" }}>الأعمدة: الاسم · الدولار · الأيام · الوصول التقديري</p>

              <button onClick={savePricing} disabled={savingPricing}
                style={{ marginTop: 16, width: "100%", background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 10, padding: "11px 0", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {savingPricing ? <Loader2 size={16} className="spin" /> : <Save size={16} />} حفظ الأسعار
              </button>
              {pricingMsg && <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "#cbd5e1" }}>{pricingMsg}</div>}
            </div>

            {/* VIP customers */}
            <div style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <Star size={18} color="#fbbf24" /> العملاء المميّزون (VIP)
              </h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input value={vipEmail} onChange={(e) => setVipEmail(e.target.value)} placeholder="بريد العميل"
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", minWidth: 0 }} />
                <button onClick={() => setVip(vipEmail, "vip")} disabled={vipBusy}
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, padding: "9px 14px", color: "#fbbf24", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  {vipBusy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} إضافة
                </button>
              </div>
              {vipMsg && <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>{vipMsg}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vips.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 16 }}>لا يوجد عملاء VIP بعد</div>
                ) : vips.map((v) => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.full_name || "—"}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{v.email}</div>
                    </div>
                    <button onClick={() => setVip(v.email, "regular")} disabled={vipBusy} title="إزالة من VIP"
                      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 10px", color: "#f87171", cursor: "pointer", flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16, marginBottom: 32 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: CARD, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>{s.label}</span>
                <s.icon size={16} color={s.color} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Campaigns table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Loader2 size={32} color={BLUE} className="spin" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {campaigns.map((c) => (
              <div key={c.id} style={{ background: CARD, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                      {c.page_name || "—"}
                      <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12, marginRight: 8 }}>
                        {(c.profiles as { full_name?: string })?.full_name || c.user_id.slice(0, 8)}
                      </span>
                    </div>
                    <a href={c.post_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "#64748b", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      <ExternalLink size={10} />
                      {c.post_url.length > 55 ? c.post_url.slice(0, 55) + "..." : c.post_url}
                    </a>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                      {new Date(c.created_at).toLocaleString("ar-LY")}
                    </div>
                  </div>

                  {/* Amounts */}
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    {[
                      { label: "ميزانية", val: c.budget },
                      { label: "خدمة",   val: c.service_fee },
                      { label: "إجمالي", val: c.total_price },
                      { label: "أيام",   val: c.duration_days },
                    ].map((r) => (
                      <div key={r.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{r.label}</div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{r.val} {r.label !== "أيام" ? "د.ل" : ""}</div>
                      </div>
                    ))}
                  </div>

                  {/* Status + actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: `${CAMPAIGN_STATUS_COLORS[c.status]}22`,
                      border: `1px solid ${CAMPAIGN_STATUS_COLORS[c.status]}40`,
                      borderRadius: 100, padding: "4px 12px",
                      color: CAMPAIGN_STATUS_COLORS[c.status], fontSize: 12, fontWeight: 700,
                    }}>
                      {CAMPAIGN_STATUS_LABELS[c.status] || c.status}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {c.status === "paid" && (
                        <button onClick={() => triggerBoost(c.id)} disabled={updating === c.id}
                          style={{ background: `${BLUE}22`, border: `1px solid ${BLUE}40`, borderRadius: 8, padding: "5px 12px", color: "#93c5fd", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                          {updating === c.id ? <Loader2 size={12} className="spin" /> : "🚀 تشغيل Meta"}
                        </button>
                      )}
                      {["creating", "failed"].includes(c.status) && (
                        <button onClick={() => triggerBoost(c.id)} disabled={updating === c.id}
                          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "5px 12px", color: "#fbbf24", cursor: "pointer", fontSize: 12 }}>
                          إعادة المحاولة
                        </button>
                      )}
                      <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)}
                        disabled={updating === c.id}
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 10px", color: "#94a3b8", cursor: "pointer", fontSize: 12, outline: "none" }}>
                        {Object.entries(CAMPAIGN_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Meta IDs */}
                {c.external_campaign_id && (
                  <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 11, color: "#475569", flexWrap: "wrap" }}>
                    <span>Campaign: {c.external_campaign_id}</span>
                    <span>AdSet: {c.external_adset_id}</span>
                    <span>Ad: {c.external_ad_id}</span>
                  </div>
                )}

                {c.status === "failed" && c.error_message && (
                  <div style={{ marginTop: 8, background: "rgba(239,68,68,0.1)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#f87171", display: "flex", gap: 6, alignItems: "center" }}>
                    <AlertCircle size={12} /> {c.error_message}
                  </div>
                )}
              </div>
            ))}

            {campaigns.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
                لا توجد حملات بعد
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}
