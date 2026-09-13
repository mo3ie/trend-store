"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Plus, Megaphone, CheckCircle, Clock,
  TrendingUp, ExternalLink, Loader2, RefreshCw, AlertCircle,
} from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_LABELS_EN, CAMPAIGN_STATUS_COLORS } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const PINK    = "#d6409f";

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
  const { light } = useTheme();
  const Back = rtl ? ArrowLeft : ArrowRight;
  const LYD  = t("د.ل", "LYD");
  const statusLabels = rtl ? CAMPAIGN_STATUS_LABELS : CAMPAIGN_STATUS_LABELS_EN;

  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97",
    surface: "#ffffff", border: "rgba(120,60,160,0.14)",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)",
  };

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
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80, transition: "background .2s,color .2s" }}>

      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/ads")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
            <Back size={18} /> {t("رجوع", "Back")}
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("حملاتي الإعلانية", "My campaigns")}</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadCampaigns} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px", color: c.muted, cursor: "pointer" }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={() => router.push("/ads/create")}
            style={{ background: G_HERO, border: "none", borderRadius: 11, padding: "9px 16px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
            <Plus size={15} /> {t("حملة جديدة", "New campaign")}
          </button>
          <LangToggle />
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "22px 20px" }}>

        {showSuccess && (
          <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e55", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, color: "#22c55e" }}>
            <CheckCircle size={18} />
            {t("تم الدفع بنجاح! سيبدأ إعلانك خلال دقائق.", "Payment successful! Your ad will start within minutes.")}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: c.dim }}><Loader2 size={32} className="spin" /></div>
        ) : campaigns.length === 0 ? (
          <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 20, padding: "60px 32px", textAlign: "center" }}>
            <Megaphone size={48} color={PINK} style={{ marginBottom: 16, opacity: 0.7 }} />
            <p style={{ color: c.muted, fontSize: 15, marginBottom: 24 }}>{t("لم تنشئ أي حملة إعلانية بعد", "You haven't created any campaigns yet")}</p>
            <button onClick={() => router.push("/ads/create")}
              style={{ background: G_HERO, border: "none", borderRadius: 14, padding: "13px 28px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15, fontFamily: "inherit" }}>
              {t("أنشئ أول حملة", "Create your first campaign")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {campaigns.map((camp) => (
              <div key={camp.id} style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 18, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                      {camp.page_name || t("حملة إعلانية", "Ad campaign")}
                    </div>
                    <a href={camp.post_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: c.dim, fontSize: 12, display: "flex", alignItems: "center", gap: 4, textDecoration: "none", wordBreak: "break-all" }}>
                      <ExternalLink size={11} />
                      {camp.post_url.length > 50 ? camp.post_url.slice(0, 50) + "..." : camp.post_url}
                    </a>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: `${CAMPAIGN_STATUS_COLORS[camp.status]}22`,
                    border: `1px solid ${CAMPAIGN_STATUS_COLORS[camp.status]}55`,
                    borderRadius: 100, padding: "4px 12px",
                    color: CAMPAIGN_STATUS_COLORS[camp.status],
                    fontSize: 12, fontWeight: 800, flexShrink: 0,
                  }}>
                    {statusIcon(camp.status)}
                    {statusLabels[camp.status] || camp.status}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
                  {[
                    { label: t("الميزانية", "Budget"), val: `${camp.budget} ${LYD}` },
                    { label: t("المدة", "Duration"),   val: t(`${camp.duration_days} يوم`, `${camp.duration_days} days`) },
                    { label: t("الإجمالي", "Total"),   val: `${camp.total_price} ${LYD}` },
                  ].map((r) => (
                    <div key={r.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: c.dim, marginBottom: 2 }}>{r.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{r.val}</div>
                    </div>
                  ))}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: c.dim, marginBottom: 2 }}>{t("تاريخ الإنشاء", "Created")}</div>
                    <div style={{ fontSize: 13, color: c.muted }}>
                      {new Date(camp.created_at).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}
                    </div>
                  </div>
                </div>

                {camp.status === "pending_payment" && (
                  <button onClick={() => router.push(`/ads/checkout?campaignId=${camp.id}`)}
                    style={{ marginTop: 14, width: "100%", background: "rgba(214,64,159,0.14)", border: `1px solid ${PINK}55`, borderRadius: 12, padding: "11px 0", color: PINK, fontWeight: 800, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                    {t("استكمال الدفع", "Complete payment")}
                  </button>
                )}

                {camp.status === "failed" && camp.error_message && (
                  <div style={{ marginTop: 10, background: "rgba(239,68,68,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#ef4444" }}>
                    {camp.error_message}
                  </div>
                )}

                {camp.external_campaign_id && (
                  <div style={{ marginTop: 8, fontSize: 11, color: c.dim }}>
                    Campaign ID: {camp.external_campaign_id}
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
