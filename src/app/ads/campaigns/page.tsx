"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Plus, Megaphone, CheckCircle, Clock,
  TrendingUp, ExternalLink, Loader2, RefreshCw, AlertCircle,
  Eye, MousePointerClick, BarChart3, Receipt, Wallet, Pause, Play,
} from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_LABELS_EN, CAMPAIGN_STATUS_COLORS } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import AdsBottomNav from "@/components/AdsBottomNav";
import WalletModal from "@/components/WalletModal";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const PINK    = "#d6409f";

interface Campaign {
  id:                  string;
  page_name?:          string;
  post_url?:           string | null;
  budget:              number;
  duration_days?:      number | null;
  total_price:         number;
  status:              string;
  external_campaign_id?: string;
  error_message?:      string;
  created_at:          string;
  reach?:              number;
  impressions?:        number;
  clicks?:             number;
  spend_usd?:          number;
  objective?:          string;
  continuous?:         boolean;
  daily_price_lyd?:    number | null;
  ab_test?:            boolean;
}

const OBJECTIVE_LABELS: Record<string, [string, string]> = {
  engagement:  ["تفاعل", "Engagement"],
  messages:    ["رسائل", "Messages"],
  traffic:     ["زيارات", "Traffic"],
  calls:       ["مكالمات", "Calls"],
  video_views: ["مشاهدات", "Video views"],
  awareness:   ["وصول", "Awareness"],
  page_likes:  ["إعجابات الصفحة", "Page likes"],
};

function statusIcon(status: string) {
  switch (status) {
    case "active":    return <TrendingUp size={14} />;
    case "completed": return <CheckCircle size={14} />;
    case "failed":
    case "rejected":  return <AlertCircle size={14} />;
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
  const [syncing, setSyncing]     = useState(false);
  const [showSuccess, setShowSuccess] = useState(paid === "1");

  useEffect(() => {
    loadCampaigns(true);
    if (paid === "1") setTimeout(() => setShowSuccess(false), 5000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCampaigns(sync = false) {
    setLoading(true);
    // Pull the latest status + insights from Meta before showing the list.
    if (sync) {
      setSyncing(true);
      try { await fetch("/api/promo/campaigns/sync", { method: "POST" }); } catch { /* best-effort */ }
      setSyncing(false);
    }
    const res  = await fetch("/api/promo/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    setLoading(false);
  }

  const [busyId, setBusyId] = useState<string>("");
  const [showWallet, setShowWallet] = useState(false);
  async function togglePause(camp: Campaign, action: "pause" | "resume") {
    if (action === "pause" && !confirm(t("إيقاف هذه الحملة؟ يمكنك تشغيلها لاحقاً.", "Pause this campaign? You can resume it later."))) return;
    setBusyId(camp.id);
    const r = await fetch(`/api/promo/campaigns/${camp.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await r.json();
    setBusyId("");
    if (r.ok && d.campaign) setCampaigns((cs) => cs.map((x) => (x.id === camp.id ? { ...x, status: d.campaign.status } : x)));
    else if (d.error === "insufficient_balance") { setShowWallet(true); }
    else alert(d.error || t("تعذّر تنفيذ الطلب", "Action failed"));
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
          <button onClick={() => router.push("/ads/payments")} title={t("نشاطات الدفع", "Payment activity")}
            style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px", color: c.muted, cursor: "pointer" }}>
            <Wallet size={15} />
          </button>
          <button onClick={() => loadCampaigns(true)} disabled={syncing} title={t("تحديث", "Refresh")}
            style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px", color: c.muted, cursor: "pointer" }}>
            <RefreshCw size={15} className={syncing ? "spin" : ""} />
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
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>
                      {camp.page_name || t("حملة إعلانية", "Ad campaign")}
                    </div>
                    {/* Type badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                      {camp.objective && OBJECTIVE_LABELS[camp.objective] && (
                        <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "3px 9px", background: "rgba(109,40,217,0.14)", color: light ? "#6d28d9" : "#c4b5fd" }}>
                          {t(OBJECTIVE_LABELS[camp.objective][0], OBJECTIVE_LABELS[camp.objective][1])}
                        </span>
                      )}
                      {camp.continuous && (
                        <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "3px 9px", background: "rgba(240,180,41,0.16)", color: "#f0b429" }}>
                          {t("حتى الإيقاف ∞", "Until stopped ∞")}
                        </span>
                      )}
                      {camp.ab_test && (
                        <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "3px 9px", background: `${PINK}22`, color: PINK }}>
                          {t("اختبار A/B", "A/B test")}
                        </span>
                      )}
                    </div>
                    {camp.post_url ? (
                      <a href={camp.post_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: c.dim, fontSize: 12, display: "flex", alignItems: "center", gap: 4, textDecoration: "none", wordBreak: "break-all" }}>
                        <ExternalLink size={11} />
                        {camp.post_url.length > 50 ? camp.post_url.slice(0, 50) + "..." : camp.post_url}
                      </a>
                    ) : (
                      <span style={{ color: c.dim, fontSize: 12 }}>{t("إعلان لزيادة إعجابات الصفحة", "A campaign to grow Page likes")}</span>
                    )}
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
                    camp.continuous
                      ? { label: t("يومياً", "Daily"), val: `${camp.daily_price_lyd ?? camp.total_price} ${LYD}` }
                      : { label: t("الميزانية", "Budget"), val: `${camp.budget} ${LYD}` },
                    { label: t("المدة", "Duration"),   val: camp.continuous ? t("حتى الإيقاف ∞", "Until stopped ∞") : t(`${camp.duration_days} يوم`, `${camp.duration_days} days`) },
                    { label: camp.continuous ? t("دُفع (اليوم 1)", "Paid (day 1)") : t("الإجمالي", "Total"),   val: `${camp.total_price} ${LYD}` },
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

                {/* Performance report */}
                {camp.external_campaign_id && (camp.status === "active" || camp.status === "completed" || camp.status === "paused" || (camp.impressions ?? 0) > 0) && (
                  <div style={{ marginTop: 14, background: light ? "#faf5ff" : "rgba(255,255,255,0.03)", border: `1px solid ${c.border}`, borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontSize: 12.5, fontWeight: 800, color: c.muted }}>
                      <BarChart3 size={14} color={PINK} /> {t("أداء الإعلان", "Ad performance")}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {[
                        { icon: Eye,                 val: (camp.reach ?? 0).toLocaleString("en"),       label: t("الوصول", "Reach") },
                        { icon: TrendingUp,          val: (camp.impressions ?? 0).toLocaleString("en"), label: t("الظهور", "Impr.") },
                        { icon: MousePointerClick,   val: (camp.clicks ?? 0).toLocaleString("en"),      label: t("النقرات", "Clicks") },
                        { icon: TrendingUp,          val: `$${camp.spend_usd ?? 0}`,                     label: t("الإنفاق", "Spent") },
                      ].map((m, i) => (
                        <div key={i} style={{ textAlign: "center" }}>
                          <m.icon size={15} color={PINK} style={{ marginBottom: 3 }} />
                          <div style={{ fontSize: 15, fontWeight: 900 }}>{m.val}</div>
                          <div style={{ fontSize: 10, color: c.dim, marginTop: 1 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* delivery bar: reach vs impressions */}
                    {(camp.impressions ?? 0) > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ height: 8, borderRadius: 100, background: c.border, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, Math.round((camp.reach ?? 0) / (camp.impressions || 1) * 100))}%`, background: G_HERO }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: c.dim, marginTop: 5 }}>
                          {t("معدل تكرار الظهور لكل شخص", "Frequency (impressions per person)")}: {((camp.impressions ?? 0) / (camp.reach || 1)).toFixed(1)}×
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status hints */}
                {camp.status === "in_review" && (
                  <div style={{ marginTop: 10, background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#3b82f6", display: "flex", gap: 8, alignItems: "center" }}>
                    <Clock size={14} /> {t("إعلانك قيد المراجعة من فيسبوك — يبدأ فور الموافقة.", "Your ad is under Facebook review — it starts once approved.")}
                  </div>
                )}
                {camp.status === "rejected" && (
                  <div style={{ marginTop: 10, background: "rgba(239,68,68,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#ef4444", display: "flex", gap: 8, alignItems: "center" }}>
                    <AlertCircle size={14} /> {t("تم رفض الإعلان من فيسبوك (مخالفة سياسات). تواصل معنا للمساعدة.", "The ad was rejected by Facebook (policy). Contact us for help.")}
                  </div>
                )}
                {camp.status === "paused" && (
                  camp.error_message ? (
                    <div style={{ marginTop: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#f59e0b", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 120 }}>{camp.error_message}</span>
                      {camp.continuous && (
                        <button onClick={() => setShowWallet(true)}
                          style={{ background: G_HERO, border: "none", borderRadius: 9, padding: "6px 14px", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Wallet size={13} /> {t("شحن المحفظة", "Top up")}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, background: "rgba(154,164,178,0.15)", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: c.muted, display: "flex", gap: 8, alignItems: "center" }}>
                      <Clock size={14} /> {t("الإعلان متوقف حالياً.", "The ad is currently paused.")}
                    </div>
                  )
                )}

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

                {/* Actions: pause/resume + invoice */}
                {camp.status !== "pending_payment" && camp.status !== "failed" && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {camp.external_campaign_id && ["active", "in_review", "issues"].includes(camp.status) && (
                      <button onClick={() => togglePause(camp, "pause")} disabled={busyId === camp.id}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(154,164,178,0.15)", border: `1px solid ${c.border}`, borderRadius: 10, padding: "7px 14px", color: c.muted, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                        {busyId === camp.id ? <Loader2 size={13} className="spin" /> : <Pause size={13} />} {t("إيقاف", "Pause")}
                      </button>
                    )}
                    {camp.external_campaign_id && camp.status === "paused" && (
                      <button onClick={() => togglePause(camp, "resume")} disabled={busyId === camp.id}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.14)", border: "1px solid #22c55e55", borderRadius: 10, padding: "7px 14px", color: "#22c55e", fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                        {busyId === camp.id ? <Loader2 size={13} className="spin" /> : <Play size={13} />} {t("تشغيل", "Resume")}
                      </button>
                    )}
                    <a href={`/ads/invoice/${camp.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, color: c.muted, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                      <Receipt size={14} color={PINK} /> {t("عرض الفاتورة", "View invoice")}
                    </a>
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

      {showWallet && <WalletModal onClose={() => setShowWallet(false)} />}
      <AdsBottomNav />
      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}} .spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}

export default function CampaignsPage() {
  return <Suspense><CampaignsInner /></Suspense>;
}
