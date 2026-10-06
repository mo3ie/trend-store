"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Plus, Eye, MousePointerClick, Wallet,
  Pause, Play, Square, CheckCircle, AlertCircle, RefreshCw, Infinity as InfinityIcon,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { tt, ttCard, ttPrimary, ttSecondary, TT_CYAN } from "@/lib/tiktokTheme";
import { ScreenTitle } from "@/components/tiktok/TikTokKit";
import LangToggle from "@/components/LangToggle";
import {
  CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_LABELS_EN, CAMPAIGN_STATUS_COLORS,
} from "@/services/campaigns";

const PINK = "#ff0050", CYAN = TT_CYAN;

interface Campaign {
  id: string;
  page_name: string | null;
  status: string;
  objective: string | null;
  budget: number;
  total_price: number;
  duration_days: number | null;
  continuous: boolean | null;
  daily_price_lyd: number | null;
  reach: number | null;
  impressions: number | null;
  clicks: number | null;
  spend_usd: number | null;
  error_message: string | null;
  external_campaign_id: string | null;
  created_at: string;
}

const OBJECTIVE_LABELS: Record<string, [string, string]> = {
  video_views: ["مشاهدات الفيديو", "Video views"],
  reach:       ["أكبر وصول", "Reach"],
  traffic:     ["زيارات المتجر", "Store traffic"],
  engagement:  ["تفاعل", "Engagement"],
  followers:   ["زيادة المتابعين", "More followers"],
};

function CampaignsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const justPaid = params.get("paid") === "1";
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = tt(light);
  const Fwd = rtl ? ArrowLeft : ArrowRight;
  const LYD = t("د.ل", "LYD");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/tiktok/ads/campaigns");
    if (r.status === 401) { router.push("/login?next=/tiktok-ads/campaigns"); return; }
    const d = await r.json();
    setCampaigns(d.campaigns || []);
    setLoading(false);
  }, [router]);

  // Load, then pull fresh numbers from TikTok and show them. The stored row renders
  // first so the screen is never blank while TikTok is being waited on.
  useEffect(() => {
    load().then(async () => {
      setSyncing(true);
      try {
        const r = await fetch("/api/tiktok/ads/campaigns/sync", { method: "POST" });
        const d = await r.json().catch(() => ({}));
        if (d?.synced) await load();
        else if (d?.message) setError(d.message);
      } catch { /* the stored numbers stand */ }
      setSyncing(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, action: "pause" | "resume" | "stop") {
    setBusyId(id); setError("");
    try {
      const r = action === "stop"
        ? await fetch(`/api/tiktok/ads/campaigns/${id}`, { method: "DELETE" })
        : await fetch(`/api/tiktok/ads/campaigns/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.message || d.error || t("تعذّر تنفيذ الطلب", "Action failed"));
      else await load();
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setBusyId("");
  }

  const card: React.CSSProperties = {
    ...ttCard(c), padding: 16,
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={26} className="spin" color={PINK} />
      </div>
    );
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.bg, color: c.text }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "18px 16px 70px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/tiktok-ads")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 14 }}>
            <Fwd size={18} /> {t("إعلانات تيك توك", "TikTok Ads")}
          </button>
          <LangToggle />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
            {t("حملاتي", "My campaigns")}
            {syncing && <Loader2 size={15} className="spin" color={c.muted} />}
          </h1>
          <button onClick={() => router.push("/tiktok-ads/create")}
            style={{ ...ttPrimary(rtl), padding: "10px 16px", fontSize: 13.5 }}>
            <Plus size={16} /> {t("حملة جديدة", "New campaign")}
          </button>
        </div>

        {justPaid && (
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#22c55e18", border: "1px solid #22c55e55", borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <CheckCircle size={17} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              {t("تم الدفع. تُنشأ الحملة الآن على تيك توك وتبدأ بعد مراجعتها — عادة خلال ساعات.",
                 "Payment received. The campaign is being created on TikTok and starts after its review — usually within hours.")}
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#ef444418", border: "1px solid #ef444455", borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
            <AlertCircle size={17} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>{error}</div>
          </div>
        )}

        {campaigns.length === 0 ? (
          <div style={{ ...card, marginTop: 16, textAlign: "center", padding: 34 }}>
            <Eye size={26} color={c.muted} />
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>{t("لا حملات بعد", "No campaigns yet")}</div>
            <div style={{ fontSize: 13, color: c.muted, marginTop: 7, lineHeight: 1.8 }}>
              {t("أنشئ حملتك الأولى واختر فيديو من حسابك لترويجه.",
                 "Create your first campaign and pick a video from your account to promote.")}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {campaigns.map((cp) => {
              const label = rtl
                ? (CAMPAIGN_STATUS_LABELS[cp.status] || cp.status)
                : (CAMPAIGN_STATUS_LABELS_EN[cp.status] || cp.status);
              const color = CAMPAIGN_STATUS_COLORS[cp.status] || c.muted;
              const obj = cp.objective ? OBJECTIVE_LABELS[cp.objective] : null;
              const live = ["active", "in_review", "issues"].includes(cp.status);
              const busy = busyId === cp.id;

              return (
                <div key={cp.id} style={card}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {cp.page_name || t("حساب تيك توك", "TikTok account")}
                        {cp.continuous && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${CYAN}1f`, border: `1px solid ${CYAN}55`, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
                            <InfinityIcon size={11} /> {t("مفتوحة", "Open")}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: c.muted, marginTop: 5 }}>
                        {obj ? t(obj[0], obj[1]) : ""}
                        {obj ? " · " : ""}
                        {cp.continuous
                          ? `${(cp.daily_price_lyd ?? 0).toLocaleString()} ${LYD}/${t("يوم", "day")}`
                          : `${cp.duration_days ?? 0} ${t("أيام", "days")} · ${(cp.total_price ?? 0).toLocaleString()} ${LYD}`}
                      </div>
                    </div>
                    <span style={{ background: `${color}22`, border: `1px solid ${color}66`, color, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                  </div>

                  {/* Results. Spend is deliberately NOT shown in USD to the customer —
                      they paid in dinars and the platform's dollar spend is our side
                      of the transaction, not theirs. */}
                  {live && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(92px,1fr))", gap: 9, marginTop: 14 }}>
                      {([
                        [Eye, t("مشاهدات", "Views"), (cp.impressions ?? 0).toLocaleString()],
                        [Wallet, t("وصول", "Reach"), (cp.reach ?? 0).toLocaleString()],
                        [MousePointerClick, t("نقرات", "Clicks"), (cp.clicks ?? 0).toLocaleString()],
                      ] as const).map(([Icon, lbl, val], i) => (
                        <div key={i} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 11, padding: "10px 12px" }}>
                          <Icon size={14} color={i % 2 ? CYAN : PINK} />
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 5 }}>{val}</div>
                          <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {cp.error_message && (
                    <div style={{ fontSize: 12.5, color: "#f59e0b", marginTop: 12, lineHeight: 1.8, background: "#f59e0b14", borderRadius: 10, padding: "10px 12px" }}>
                      {cp.error_message}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    {cp.status === "pending_payment" && (
                      <button onClick={() => router.push(`/ads/checkout?campaignId=${cp.id}`)}
                        style={{ flex: "1 1 130px", ...ttPrimary(rtl), padding: "10px 0", fontSize: 13, width: "100%" }}>
                        {t("إكمال الدفع", "Complete payment")}
                      </button>
                    )}
                    {cp.external_campaign_id && ["active", "in_review", "issues"].includes(cp.status) && (
                      <button onClick={() => act(cp.id, "pause")} disabled={busy}
                        style={{ flex: "1 1 110px", background: c.surface, color: c.text, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {busy ? <Loader2 size={14} className="spin" /> : <Pause size={14} />} {t("إيقاف مؤقت", "Pause")}
                      </button>
                    )}
                    {cp.external_campaign_id && cp.status === "paused" && (
                      <button onClick={() => act(cp.id, "resume")} disabled={busy}
                        style={{ flex: "1 1 110px", background: c.surface, color: c.text, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {busy ? <Loader2 size={14} className="spin" /> : <Play size={14} />} {t("استئناف", "Resume")}
                      </button>
                    )}
                    {cp.external_campaign_id && !["completed", "failed"].includes(cp.status) && (
                      <button onClick={() => act(cp.id, "stop")} disabled={busy}
                        style={{ flex: "1 1 110px", background: "transparent", color: "#ef4444", border: "1px solid #ef444455", borderRadius: 10, padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Square size={13} /> {t("إنهاء", "Stop")}
                      </button>
                    )}
                    {cp.status === "paid" && (
                      <div style={{ flex: "1 1 100%", fontSize: 12.5, color: c.muted, display: "flex", alignItems: "center", gap: 7, lineHeight: 1.8 }}>
                        <RefreshCw size={14} />
                        {t("مدفوعة — تُنشأ على تيك توك الآن.", "Paid — being created on TikTok now.")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TikTokAdsCampaignsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsInner />
    </Suspense>
  );
}
