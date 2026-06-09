"use client";

import { Building2, ShoppingCart, ArrowLeft, ExternalLink, Globe } from "lucide-react";

const SITES = [
  {
    name: "Trendy",
    tagline: "منصة الحجوزات العقارية الليبية",
    desc: "احجز فنادق، شاليهات، منتجعات واستراحات في جميع أنحاء ليبيا بأفضل الأسعار.",
    href: "https://trendy.trendstore-ly.com",
    icon: Building2,
    color: "#1B3A6B",
    accent: "#C9A84C",
    badge: "جديد",
    features: ["فنادق وشاليهات", "منتجعات واستراحات", "حجز فوري", "دفع محلي"],
  },
  {
    name: "Shein Order",
    tagline: "اطلب من شي إن إلى ليبيا",
    desc: "أرسل رابط سلة شي إن وسنوصّل لك طلبك مباشرة إلى باب منزلك في ليبيا.",
    href: "https://order.trendstore-ly.com",
    icon: ShoppingCart,
    color: "#7c3aed",
    accent: "#a78bfa",
    badge: null,
    features: ["أي منتج من شي إن", "توصيل لليبيا", "دفع محلي", "تتبع الطلب"],
  },
];

export default function OurSitesPage() {
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white" dir="rtl">
      {/* Header */}
      <div className="border-b border-purple-500/20 px-6 py-4 flex items-center gap-4 sticky top-0 bg-[#0b0f1a]/90 backdrop-blur z-10">
        <a href="/" className="text-gray-400 hover:text-purple-400 transition-colors">
          <ArrowLeft size={20} />
        </a>
        <div>
          <h1 className="text-lg font-black tracking-wide bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            مواقعنا وخدماتنا
          </h1>
          <p className="text-xs text-gray-500">مشاريع من تصميم وتطوير فريق Trend</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        <p className="text-gray-400 text-sm leading-relaxed">
          نطوّر منصات رقمية متخصصة لخدمة السوق الليبي. كل مشروع مصمم بعناية ليقدم تجربة سلسة وآمنة.
        </p>

        {SITES.map((site) => {
          const Icon = site.icon;
          return (
            <a
              key={site.name}
              href={site.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-3xl border border-white/10 overflow-hidden hover:border-white/20 transition-all hover:shadow-[0_0_40px_rgba(168,85,247,0.12)] group"
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
                        <h2 className="text-xl font-black text-white">{site.name}</h2>
                        {site.badge && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${site.accent}33`, color: site.accent }}>
                            {site.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium" style={{ color: site.accent }}>{site.tagline}</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-gray-500 group-hover:text-white transition-colors mt-1 shrink-0" />
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm leading-relaxed mb-5">{site.desc}</p>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {site.features.map(f => (
                    <span key={f} className="text-xs px-3 py-1 rounded-full border"
                      style={{ borderColor: `${site.accent}33`, color: `${site.accent}cc`, background: `${site.accent}11` }}>
                      {f}
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
          <p className="text-gray-500 font-bold text-sm">مشاريع قادمة قريباً</p>
          <p className="text-gray-600 text-xs mt-1">نعمل على مزيد من المنصات لخدمة السوق الليبي</p>
        </div>

      </div>
    </div>
  );
}
