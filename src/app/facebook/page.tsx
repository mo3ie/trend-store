"use client";

import { Megaphone, MessageSquareReply, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const TOOLS = [
  {
    key: "ads",
    name: ["إعلانات فيسبوك", "Facebook Ads"] as const,
    tagline: ["روّج منشوراتك بضغطة", "Boost your posts in a tap"] as const,
    desc: [
      "اختر منشوراً من صفحتك، حدّد الميزانية والجمهور (المدينة، العمر، الجنس)، وادفع محلياً — وننشئ لك حملة إعلانية حقيقية على Meta.",
      "Pick a post from your Page, set the budget and audience (city, age, gender), pay locally — and we create a real Meta ad campaign for you.",
    ] as const,
    href: "/ads",
    icon: Megaphone,
    color: "#1877f2",
    accent: "#5aa2ff",
    features: [
      ["حملات حقيقية على Meta", "Real Meta campaigns"],
      ["استهداف بالمدينة والعمر", "City & age targeting"],
      ["دفع محلي بالدينار", "Local payment in LYD"],
      ["متابعة الحملات", "Track campaigns"],
    ] as const,
  },
  {
    key: "bot",
    name: ["الرد الآلي", "Auto-Reply Bot"] as const,
    tagline: ["ردّ على تعليقات صفحتك تلقائياً", "Auto-reply to your Page comments"] as const,
    desc: [
      "عندما يعلّق أحد على منشورك، يردّ البوت تلقائياً بردّ عام ويرسل رسالة خاصة بالسعر والتفاصيل — على مدار الساعة، دون أن تفوتك أي رسالة.",
      "When someone comments on your post, the bot posts a public reply and sends a private message with the price and details — 24/7, so you never miss a customer.",
    ] as const,
    href: "/bot",
    icon: MessageSquareReply,
    color: "#16a34a",
    accent: "#4ade80",
    features: [
      ["ردّ فوري 24/7", "Instant 24/7 reply"],
      ["ردّ عام + رسالة خاصة", "Public reply + private DM"],
      ["قواعد كلمات مفتاحية + ذكاء", "Keyword rules + AI"],
      ["حماية من الحظر", "Anti-block protection"],
    ] as const,
  },
];

export default function FacebookToolsPage() {
  const { t, rtl } = useLang();
  const Fwd = rtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="border-b border-purple-500/20 px-6 py-4 flex items-center gap-4 sticky top-0 bg-[var(--glass)] backdrop-blur z-10">
        <a href="/" className="text-[var(--muted)] hover:text-purple-400 transition-colors">
          {rtl ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </a>
        <div>
          <h1 className="text-lg font-black tracking-wide bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
            {t("أدوات فيسبوك", "Facebook Tools")}
          </h1>
          <p className="text-xs text-[var(--muted-2)]">{t("سوّق لصفحتك وردّ على عملائك تلقائياً", "Market your Page and auto-reply to your customers")}</p>
        </div>
        <div className="ms-auto"><LangToggle /></div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <p className="text-[var(--muted)] text-sm leading-relaxed">
          {t(
            "أدوات مخصّصة لأصحاب صفحات فيسبوك في ليبيا — اربط صفحتك مرة واحدة واختر ما تريد.",
            "Tools built for Facebook Page owners in Libya — connect your Page once and choose what you need.",
          )}
        </p>

        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <a
              key={tool.key}
              href={tool.href}
              className="block rounded-3xl border border-[var(--border)] overflow-hidden hover:border-white/20 transition-all hover:shadow-[0_0_40px_rgba(59,130,246,0.12)] group"
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
                  <Fwd size={18} className="text-[var(--muted-2)] group-hover:text-[var(--text)] transition-colors mt-1 shrink-0" />
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
                <div className="flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all"
                  style={{ color: tool.accent }}>
                  <span>{t("افتح", "Open")}</span>
                  <Fwd size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
