"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Plus, Megaphone, CheckCircle, Clock,
  TrendingUp, ExternalLink, Loader2, RefreshCw, AlertCircle,
} from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_LABELS_EN, CAMPAIGN_STATUS_COLORS } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)";
const BLUE     = "#1877f2";
const CARD_BG  = "rgba(255,255,255,0.04)";

interface Campaign {
  id:                  string;
  page_name?:          string;
  post_url:            string;
  budget:              number;
  duration_days:       number;
  total_price:         number;
  status:              string;
  external_campaign_id?: string;
  error_message?:      string;
  created_at:          string;
}

function statusIcon(status: string) {
  switch (status) {
    case "active":    return <TrendingUp size={14} />;
    case "completed": return <CheckCircle size={14} />;
    case "failed":    return <AlertCircle size={14} />;
    case "creating":  return <Loader2 size={14} className="spin" />;
    default:          return <Clock size={14} />;
  }
}

function CampaignsInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const paid         = searchParams.get("paid");
  const { t, rtl } = useLang();
  const Back = rtl ? ArrowLeft : ArrowRight;
  const LYD  = t("د.ل", "LYD");
  const statusLabels = rtl ? CAMPAIGN_STATUS_LABELS : CAMPAIGN_STATUS_LABELS_EN;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showSuccess, setShowSuccess] = useState(paid === "1");

  useEffect(() => {
    loadCampaigns();
    if (paid === "1") setTimeout(() => setShowSuccess(false), 5000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    const res  = await fetch("/api/promo/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>

      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/ads")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Back size={18} /> {t("رجوع", "Back")}
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t("حملاتي الإعلانية", "My campaigns")}</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadCampaigns} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 12px", color: "#94a3b8", cursor: "pointer" }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={() => router.push("/ads/create")}
            style={{ background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> {t("حملة جديدة", "New campaign")}
          </button>
          <LangToggle />
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px" }}>

        {showSuccess && (
          <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e40", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, color: "#86efac" }}>
            <CheckCircle size={18} />
            {t("تم الدفع بنجاح! سيبدأ إعلانك خلال دقائق.", "Payment successful! Your ad will start within minutes.")}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
            <Loader2 size={32} className="spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "60px 32px", textAlign: "center" }}>
            <Megaphone size={48} color="#334155" style={{ marginBottom: 16 }} />
            <p style={{ color: "#64748b", fontSize: 15, marginBottom: 24 }}>{t("لم تنشئ أي حملة إعلانية بعد", "You haven't created any campaigns yet")}</p>
            <button onClick={() => router.push("/ads/create")}
              style={{ background: `linear-gradient(135deg,${BLUE},#6b46c1)`, border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
              {t("أنشئ أول حملة", "Create your first campaign")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {campaigns.map((c) => (
              <div key={c.id} style={{ background: CARD_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 22, transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      {c.page_name || t("حملة إعلانية", "Ad campaign")}
                    </div>
                    <a href={c.post_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#64748b", fontSize: 12, display: "flex", alignItems: "center", gap: 4, textDecoration: "none", wordBreak: "break-all" }}>
                      <ExternalLink size={11} />
                      {c.post_url.length > 50 ? c.post_url.slice(0, 50) + "..." : c.post_url}
                    </a>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: `${CAMPAIGN_STATUS_COLORS[c.status]}22`,
                    border: `1px solid ${CAMPAIGN_STATUS_COLORS[c.status]}40`,
                    borderRadius: 100, padding: "4px 12px",
                    color: CAMPAIGN_STATUS_COLORS[c.status],
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {statusIcon(c.status)}
                    {statusLabels[c.status] || c.status}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
                  {[
                    { label: t("الميزانية", "Budget"), val: `${c.budget} ${LYD}` },
                    { label: t("المدة", "Duration"),   val: t(`${c.duration_days} يوم`, `${c.duration_days} days`) },
                    { label: t("الإجمالي", "Total"),   val: `${c.total_price} ${LYD}` },
                  ].map((r) => (
                    <div key={r.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{r.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{r.val}</div>
                    </div>
                  ))}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{t("تاريخ الإنشاء", "Created")}</div>
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>
                      {new Date(c.created_at).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}
                    </div>
                  </div>
                </div>

                {c.status === "pending_payment" && (
                  <button onClick={() => router.push(`/ads/checkout?campaignId=${c.id}`)}
                    style={{ marginTop: 14, width: "100%", background: `${BLUE}22`, border: `1px solid ${BLUE}40`, borderRadius: 10, padding: "10px 0", color: "#93c5fd", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    {t("استكمال الدفع", "Complete payment")}
                  </button>
                )}

                {c.status === "failed" && c.error_message && (
                  <div style={{ marginTop: 10, background: "rgba(239,68,68,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#f87171" }}>
                    {c.error_message}
                  </div>
                )}

                {c.external_campaign_id && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#475569" }}>
                    Campaign ID: {c.external_campaign_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}

export default function CampaignsPage() {
  return <Suspense><CampaignsInner /></Suspense>;
}
