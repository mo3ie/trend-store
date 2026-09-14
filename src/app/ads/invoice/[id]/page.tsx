"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer, Loader2, Megaphone } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_LABELS_EN } from "@/services/campaigns";

interface Campaign {
  id: string; page_name?: string; post_url: string; budget: number; duration_days: number;
  service_fee: number; total_price: number; status: string; created_at: string;
}

export default function InvoicePage() {
  const params = useParams();
  const id = String(params.id);
  const { t, rtl } = useLang();
  const [camp, setCamp] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const LYD = t("د.ل", "LYD");

  useEffect(() => {
    fetch(`/api/promo/campaigns/${id}`).then((r) => r.json()).then((d) => { setCamp(d.campaign || null); setLoading(false); });
  }, [id]);

  if (loading) return <div style={{ minHeight: "100vh", background: "#eef1f6", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={30} color="#6d28d9" className="spin" /><style>{`@keyframes s{to{transform:rotate(360deg)}}.spin{animation:s 1s linear infinite}`}</style></div>;
  if (!camp) return <div style={{ minHeight: "100vh", background: "#eef1f6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Cairo,sans-serif", color: "#334" }}>{t("الفاتورة غير موجودة", "Invoice not found")}</div>;

  const statusLabels = rtl ? CAMPAIGN_STATUS_LABELS : CAMPAIGN_STATUS_LABELS_EN;
  const num = `INV-${camp.id.slice(0, 8).toUpperCase()}`;
  const date = new Date(camp.created_at).toLocaleDateString(rtl ? "ar-LY" : "en-GB");

  const row = (label: string, val: string, strong = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #eceef3", fontSize: strong ? 17 : 14, fontWeight: strong ? 900 : 500, color: strong ? "#1a1330" : "#4a4a5a" }}>
      <span>{label}</span><span>{val}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#eef1f6", padding: "24px 16px", fontFamily: "Cairo,sans-serif", direction: rtl ? "rtl" : "ltr" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Toolbar (hidden in print) */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <a href="/ads/campaigns" style={{ color: "#6d28d9", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>← {t("حملاتي", "My campaigns")}</a>
          <button onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(140deg,#6d28d9,#d6409f,#ff7a59)", border: "none", borderRadius: 11, padding: "10px 20px", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            <Printer size={16} /> {t("طباعة", "Print")}
          </button>
        </div>

        {/* Invoice */}
        <div id="invoice" style={{ background: "#fff", borderRadius: 18, padding: "34px 30px", boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26, gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(135deg,#6d28d9,#d6409f)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Megaphone size={22} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#1a1330" }}>{t("ترند ستور", "Trend Store")}</div>
                <div style={{ fontSize: 12, color: "#8a8a9a" }}>{t("خدمات الإعلانات الرقمية", "Digital advertising")}</div>
              </div>
            </div>
            <div style={{ textAlign: rtl ? "left" : "right" }}>
              <div style={{ fontWeight: 900, fontSize: 20, color: "#1a1330" }}>{t("فاتورة", "INVOICE")}</div>
              <div style={{ fontSize: 12.5, color: "#8a8a9a", marginTop: 3 }}>{num}</div>
              <div style={{ fontSize: 12.5, color: "#8a8a9a" }}>{date}</div>
            </div>
          </div>

          <div style={{ background: "#f7f5fc", borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
            <div style={{ fontSize: 11.5, color: "#8a8a9a", marginBottom: 3 }}>{t("العميل / الصفحة", "Customer / Page")}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1330" }}>{camp.page_name || t("حملة إعلانية", "Ad campaign")}</div>
          </div>

          <div style={{ fontSize: 12.5, color: "#8a8a9a", fontWeight: 700, marginBottom: 4 }}>{t("التفاصيل", "Details")}</div>
          {row(t("حملة إعلانية ممولة على فيسبوك", "Facebook sponsored campaign"), "")}
          {row(t("المدة", "Duration"), t(`${camp.duration_days} أيام`, `${camp.duration_days} days`))}
          {row(t("ميزانية الإعلان", "Ad budget"), `${camp.budget} ${LYD}`)}
          {camp.service_fee > 0 && row(t("رسوم الخدمة", "Service fee"), `${camp.service_fee} ${LYD}`)}
          {row(t("الإجمالي المدفوع", "Total paid"), `${camp.total_price} ${LYD}`, true)}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 13 }}>
            <span style={{ color: "#8a8a9a" }}>{t("الحالة", "Status")}</span>
            <span style={{ fontWeight: 800, color: "#16a34a" }}>{statusLabels[camp.status] || camp.status}</span>
          </div>

          <div style={{ marginTop: 26, paddingTop: 16, borderTop: "1px dashed #d8dae2", fontSize: 11.5, color: "#a0a0b0", textAlign: "center", lineHeight: 1.7 }}>
            {t("شكراً لثقتك بترند ستور — هذه فاتورة إلكترونية لا تحتاج توقيعاً.", "Thank you for choosing Trend Store — this is an electronic invoice, no signature required.")}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes s{to{transform:rotate(360deg)}}.spin{animation:s 1s linear infinite}
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          #invoice { box-shadow: none !important; border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}
