"use client";

import { MessageSquareReply, Megaphone, ArrowLeft, ArrowRight, Check, Clock } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

// Same shape as the Facebook tools hub — TikTok palette (pink/cyan) instead of blue.
const TOOLS = [
  {
    key: "bot",
    name: ["الرد الآلي", "Auto-Reply Bot"] as const,
    tagline: ["ردّ على تعليقات فيديوهاتك تلقائياً", "Auto-reply to your videos' comments"] as const,
    desc: [
      "عندما يعلّق أحد على فيديو في حسابك، يردّ البوت تلقائياً بالسعر والتفاصيل تحت التعليق — على مدار الساعة، دون أن تفوتك أي فرصة بيع.",
      "When someone comments on your video, the bot replies under the comment with the price and details — 24/7, so you never miss a sale.",
    ] as const,
    href: "/tiktok-bot",
    icon: MessageSquareReply,
    color: "#ff0050",
    accent: "#ff4d80",
    soon: false,
    features: [
      ["ردّ فوري 24/7", "Instant 24/7 reply"],
      ["قواعد كلمات مفتاحية", "Keyword rules"],
      ["ردود ذكية بالذكاء الاصطناعي", "Smart AI replies"],
      ["حماية من الحظر", "Anti-block protection"],
    ] as const,
  },
  {
    key: "ads",
    name: ["إعلانات تيك توك", "TikTok Ads"] as const,
    tagline: ["روّج فيديوهاتك بضغطة", "Boost your videos in a tap"] as const,
    desc: [
      "اختر فيديو من حسابك، حدّد الميزانية والجمهور، وادفع محلياً — وننشئ لك حملة إعلانية حقيقية على تيك توك.",
      "Pick a video from your account, set the budget and audience, pay locally — and we create a real TikTok ad campaign for you.",
    ] as const,
    href: "/tiktok-ads",
    icon: Megaphone,
    color: "#00f2ea",
    accent: "#00f2ea",
    soon: true,
    features: [
      ["حملات حقيقية على تيك توك", "Real TikTok campaigns"],
      ["استهداف بالمدينة والعمر", "City & age targeting"],
      ["دفع محلي بالدينار", "Local payment in LYD"],
      ["متابعة الحملات", "Track campaigns"],
    ] as const,
  },
];

export default function TikTokToolsPage() {
  const { t, rtl } = useLang();
  const Fwd = rtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="border-b border-purple-500/20 px-6 py-4 flex items-center gap-4 sticky top-0 bg-[var(--glass)] backdrop-blur z-10">
        <a href="/" className="text-[var(--muted)] hover:text-pink-400 transition-colors">
          {rtl ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </a>
        <div>
          <h1 className="text-lg font-black tracking-wide bg-gradient-to-r from-[#ff0050] to-[#00f2ea] bg-clip-text text-transparent">
            {t("أدوات تيك توك", "TikTok Tools")}
          </h1>
          <p className="text-xs text-[var(--muted-2)]">{t("ردّ على متابعينك وسوّق لحسابك تلقائياً", "Auto-reply to followers and market your account")}</p>
        </div>
        <div className="ms-auto"><LangToggle /></div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <p className="text-[var(--muted)] text-sm leading-relaxed">
          {t(
            "أدوات مخصّصة لأصحاب حسابات تيك توك في ليبيا — اربط حسابك مرة واحدة واختر ما تريد.",
            "Tools built for TikTok account owners in Libya — connect your account once and choose what you need.",
          )}
        </p>

        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const Card = tool.soon ? "div" : "a";
          return (
            <Card
              key={tool.key}
              {...(tool.soon ? {} : { href: tool.href })}
              className={`block rounded-3xl border border-[var(--border)] overflow-hidden transition-all group ${
                tool.soon ? "opacity-60" : "hover:border-white/20 hover:shadow-[0_0_40px_rgba(255,0,80,0.14)]"
              }`}
              style={{ background: `linear-gradient(135deg, ${tool.color}22, ${tool.color}11)` }}
            >
              <div className="p-6">
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: `${tool.color}33`, border: `1px solid ${tool.accent}44` }}>
                      <Icon size={24} style={{ color: tool.accent }} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-[var(--text)]">{t(tool.name[0], tool.name[1])}</h2>
                      <p className="text-sm font-medium" style={{ color: tool.accent }}>{t(tool.tagline[0], tool.tagline[1])}</p>
                    </div>
                  </div>
                  {tool.soon ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 shrink-0"
                      style={{ background: `${tool.accent}22`, color: tool.accent }}>
                      <Clock size={11} /> {t("قريباً", "Soon")}
                    </span>
                  ) : (
                    <Fwd size={18} className="text-[var(--muted-2)] group-hover:text-[var(--text)] transition-colors mt-1 shrink-0" />
                  )}
                </div>

                {/* Description */}
                <p className="text-[var(--muted)] text-sm leading-relaxed mb-5">{t(tool.desc[0], tool.desc[1])}</p>

                {/* Features */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {tool.features.map((f) => (
                    <div key={f[0]} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `${tool.accent}22` }}>
                        <Check size={11} style={{ color: tool.accent }} />
                      </span>
                      {t(f[0], f[1])}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {!tool.soon && (
                  <div className="flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all"
                    style={{ color: tool.accent }}>
                    <span>{t("افتح", "Open")}</span>
                    <Fwd size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
