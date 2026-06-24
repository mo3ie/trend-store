"use client";

"use client";

import { Building2, ShoppingCart, ArrowLeft, ExternalLink, Globe, Stethoscope } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const SITES = [
  {
    name: "Trendy",
    tagline: ["منصة الحجوزات العقارية الليبية", "Libya's property booking platform"] as const,
    desc: ["احجز فنادق، شاليهات، منتجعات واستراحات في جميع أنحاء ليبيا بأفضل الأسعار.", "Book hotels, chalets, resorts and rest houses across Libya at the best prices."] as const,
    href: "https://trendy.trendstore-ly.com",
    icon: Building2,
    color: "#1B3A6B",
    accent: "#C9A84C",
    badge: ["جديد", "New"] as const,
    features: [["فنادق وشاليهات", "Hotels & chalets"], ["منتجعات واستراحات", "Resorts & rest houses"], ["حجز فوري", "Instant booking"], ["دفع محلي", "Local payment"]] as const,
  },
  {
    name: "Shein Order",
    tagline: ["اطلب من شي إن إلى ليبيا", "Order from Shein to Libya"] as const,
    desc: ["أرسل رابط سلة شي إن وسنوصّل لك طلبك مباشرة إلى باب منزلك في ليبيا.", "Send your Shein cart link and we'll deliver your order straight to your door in Libya."] as const,
    href: "https://order.trendstore-ly.com",
    icon: ShoppingCart,
    color: "#7c3aed",
    accent: "#a78bfa",
    badge: null,
    features: [["أي منتج من شي إن", "Any Shein product"], ["توصيل لليبيا", "Delivery to Libya"], ["دفع محلي", "Local payment"], ["تتبع الطلب", "Order tracking"]] as const,
  },
  {
    name: "MedSprint",
    tagline: ["منصة التعليم الطبي الذكية", "The smart medical-education platform"] as const,
    desc: ["تعلّم الطب بذكاء — شروحات مبسّطة وعميقة، أسئلة وحالات سريرية ومحاكاة امتحانات، مبنية على مصادر موثوقة.", "Learn medicine smartly — clear, in-depth explanations, questions, clinical cases and exam simulations built on trusted sources."] as const,
    href: "https://medsprint.trendstore-ly.com",
    icon: Stethoscope,
    color: "#0d9488",
    accent: "#2dd4bf",
    badge: ["جديد", "New"] as const,
    features: [["شروحات ذكية", "Smart explanations"], ["أسئلة وحالات سريرية", "Questions & clinical cases"], ["محاكاة امتحانات", "Exam simulations"], ["للطلاب والأطباء", "For students & doctors"]] as const,
  },
];

export default function OurSitesPage() {
  const { t, rtl } = useLang();
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="border-b border-purple-500/20 px-6 py-4 flex items-center gap-4 sticky top-0 bg-[var(--glass)] backdrop-blur z-10">
        <a href="/" className="text-[var(--muted)] hover:text-purple-400 transition-colors">
          <ArrowLeft size={20} />
        </a>
        <div>
          <h1 className="text-lg font-black tracking-wide bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {t("مواقعنا وخدماتنا", "Our sites & services")}
          </h1>
          <p className="text-xs text-[var(--muted-2)]">{t("مشاريع من تصميم وتطوير فريق Trend", "Projects designed & built by the Trend team")}</p>
        </div>
        <div className="ms-auto"><LangToggle /></div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        <p className="text-[var(--muted)] text-sm leading-relaxed">
          {t("نطوّر منصات رقمية متخصصة لخدمة السوق الليبي. كل مشروع مصمم بعناية ليقدم تجربة سلسة وآمنة.", "We build specialized digital platforms for the Libyan market. Every project is carefully crafted for a smooth, secure experience.")}
        </p>

        {SITES.map((site) => {
          const Icon = site.icon;
          return (
            <a
              key={site.name}
              href={site.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-3xl border border-[var(--border)] overflow-hidden hover:border-white/20 transition-all hover:shadow-[0_0_40px_rgba(168,85,247,0.12)] group"
              style={{ background: `linear-gradient(135deg, ${site.color}22, ${site.color}11)` }}
            >
              <div className="p-6">
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: `${site.color}33`, border: `1px solid ${site.accent}44` }}>
                      <Icon size={24} style={{ color: site.accent }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-[var(--text)]">{site.name}</h2>
                        {site.badge && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${site.accent}33`, color: site.accent }}>
                            {t(site.badge[0], site.badge[1])}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium" style={{ color: site.accent }}>{t(site.tagline[0], site.tagline[1])}</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-[var(--muted-2)] group-hover:text-[var(--text)] transition-colors mt-1 shrink-0" />
                </div>

                {/* Description */}
                <p className="text-[var(--muted)] text-sm leading-relaxed mb-5">{t(site.desc[0], site.desc[1])}</p>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {site.features.map(f => (
                    <span key={f[0]} className="text-xs px-3 py-1 rounded-full border"
                      style={{ borderColor: `${site.accent}33`, color: `${site.accent}cc`, background: `${site.accent}11` }}>
                      {t(f[0], f[1])}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all"
                  style={{ color: site.accent }}>
                  <Globe size={15} />
                  <span>{site.href.replace("https://", "")}</span>
                  <ArrowLeft size={14} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </a>
          );
        })}

        {/* Coming soon */}
        <div className="rounded-3xl border border-dashed border-purple-500/20 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
            <Globe size={22} className="text-purple-400/50" />
          </div>
          <p className="text-[var(--muted-2)] font-bold text-sm">{t("مشاريع قادمة قريباً", "More projects coming soon")}</p>
          <p className="text-[var(--muted-2)] text-xs mt-1">{t("نعمل على مزيد من المنصات لخدمة السوق الليبي", "We're building more platforms to serve the Libyan market")}</p>
        </div>

      </div>
    </div>
  );
}
