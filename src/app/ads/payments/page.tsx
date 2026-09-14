"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Wallet, Receipt, TrendingUp } from "lucide-react";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_LABELS_EN, CAMPAIGN_STATUS_COLORS } from "@/services/campaigns";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";

const G_HERO = "linear-gradient(140deg,#6d28d9 0%,#d6409f 55%,#ff7a59 100%)";
const PINK   = "#d6409f";

interface Campaign {
  id: string; page_name?: string; total_price: number; status: string; created_at: string;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const Back = rtl ? ArrowLeft : ArrowRight;
  const LYD  = t("د.ل", "LYD");
  const statusLabels = rtl ? CAMPAIGN_STATUS_LABELS : CAMPAIGN_STATUS_LABELS_EN;

  const c = light ? {
    bg: "#fbf7ff", text: "#1e1330", muted: "#6b5b78", dim: "#8b7d97", surface: "#ffffff", border: "rgba(120,60,160,0.14)",
  } : {
    bg: "#100a18", text: "#f6eefb", muted: "#a394b0", dim: "#7a6d88", surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)",
  };

  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/promo/campaigns").then((r) => r.json()).then((d) => {
      const paid = (d.campaigns || []).filter((x: Campaign) => x.status !== "pending_payment" && x.status !== "failed");
      setRows(paid);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const total = rows.reduce((s, r) => s + (Number(r.total_price) || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text, fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 60, transition: "background .2s,color .2s" }}>
      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, maxWidth: 700, margin: "0 auto" }}>
        <button onClick={() => router.push("/ads/campaigns")} style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("نشاطات الدفع", "Payment activity")}</h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "12px 18px" }}>
        {/* Total spent */}
        <div style={{ borderRadius: 20, padding: 22, background: G_HERO, position: "relative", overflow: "hidden", marginBottom: 18 }}>
          <div style={{ position: "absolute", top: -30, insetInlineStart: -20, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.16)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.9)", fontSize: 13 }}><Wallet size={16} /> {t("إجمالي مدفوعات الإعلانات", "Total ad spend")}</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", marginTop: 6 }}>{total.toLocaleString("en")} <span style={{ fontSize: 16, color: "rgba(255,255,255,0.85)" }}>{LYD}</span></div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", marginTop: 6 }}>{t(`${rows.length} عملية دفع`, `${rows.length} payments`)}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 50, color: c.dim }}><Loader2 size={30} className="spin" /></div>
        ) : rows.length === 0 ? (
          <div style={{ background: c.surface, border: `2px solid ${c.border}`, borderRadius: 18, padding: 40, textAlign: "center", color: c.muted }}>
            {t("لا توجد مدفوعات بعد", "No payments yet")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(214,64,159,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <TrendingUp size={18} color={PINK} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.page_name || t("حملة إعلانية", "Ad campaign")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 11.5, color: c.dim }}>{new Date(r.created_at).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}</span>
                    <span style={{ fontSize: 11, color: CAMPAIGN_STATUS_COLORS[r.status], fontWeight: 700 }}>· {statusLabels[r.status] || r.status}</span>
                  </div>
                </div>
                <div style={{ textAlign: rtl ? "left" : "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: PINK }}>−{r.total_price} <span style={{ fontSize: 10, color: c.dim }}>{LYD}</span></div>
                  <a href={`/ads/invoice/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: c.muted, fontSize: 11, textDecoration: "none", marginTop: 2 }}>
                    <Receipt size={11} /> {t("فاتورة", "Invoice")}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin-anim{to{transform:rotate(360deg)}}.spin{animation:spin-anim 1s linear infinite}`}</style>
    </div>
  );
}
