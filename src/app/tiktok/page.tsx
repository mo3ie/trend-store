"use client";

import Link from "next/link";
import {
  MessageSquareReply, Megaphone, ArrowLeft, ArrowRight, Check, Clock,
  Users, LayoutGrid, Upload, MessageSquare, PlayCircle, Link2, ShieldCheck, Settings2,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import LangToggle from "@/components/LangToggle";
import { DemoBadge, StatusChip } from "@/components/tiktok-demo/DemoKit";

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
  const { connected, hydrated } = useTikTokDemo();
  const Fwd = rtl ? ArrowLeft : ArrowRight;

  // Capability cards for the Accounts API integration. Their status follows the demo
  // connection state, so the screen recording shows a real before/after.
  const capabilities = [
    {
      key: "accounts", icon: Users,
      titleAr: "حسابات TikTok", titleEn: "TikTok Accounts",
      descAr: "اربط وأدِر حسابات TikTok المصرّح بها.",
      descEn: "Connect and manage authorized TikTok accounts.",
      href: "/tiktok-bot",
    },
    {
      key: "content", icon: LayoutGrid,
      titleAr: "إدارة المحتوى", titleEn: "Content Management",
      descAr: "عرض الفيديوهات والتعليقات والردود.",
      descEn: "View videos, comments and replies.",
      href: "/tiktok-bot/demo-account/videos",
    },
    {
      key: "publishing", icon: Upload,
      titleAr: "النشر", titleEn: "Publishing",
      descAr: "انشر الفيديوهات والصور مباشرة من محل ترند.",
      descEn: "Publish videos and photos directly from Trend Store.",
      href: "/tiktok-bot/demo-account/publish",
    },
    {
      key: "comments", icon: MessageSquare,
      titleAr: "التعليقات", titleEn: "Comments",
      descAr: "اقرأ وأدِر التعليقات والردود على فيديوهاتك المملوكة.",
      descEn: "Read and manage comments and replies on your owned TikTok videos.",
      href: "/tiktok-bot/demo-account/comments",
    },
  ];

  const steps = [
    {
      icon: Link2, titleAr: "الربط", titleEn: "Connect",
      bodyAr: "يصرّح صاحب النشاط لـمحل ترند عبر TikTok.",
      bodyEn: "Business owner authorizes Trend Store through TikTok.",
    },
    {
      icon: ShieldCheck, titleAr: "الوصول", titleEn: "Access",
      bodyAr: "يصل محل ترند إلى الصلاحيات الممنوحة من صاحب الحساب فقط.",
      bodyEn: "Trend Store accesses only the permissions granted by the account owner.",
    },
    {
      icon: Settings2, titleAr: "الإدارة", titleEn: "Manage",
      bodyAr: "عرض معلومات الحساب والفيديوهات والتعليقات والردود.",
      bodyEn: "View account information, videos, comments and replies.",
    },
    {
      icon: Upload, titleAr: "النشر", titleEn: "Publish",
      bodyAr: "يمكن للأنشطة المصرّح بها نشر الفيديوهات والصور.",
      bodyEn: "Authorized businesses can publish videos and photos.",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="border-b border-purple-500/20 px-6 py-4 flex items-center gap-4 sticky top-0 bg-[var(--glass)] backdrop-blur z-10">
        <Link href="/" className="text-[var(--muted)] hover:text-pink-400 transition-colors" aria-label="الرئيسية">
          {rtl ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </Link>
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

        {/* TikTok Accounts API integration (prototype) */}
        <section aria-labelledby="accounts-api-heading" className="pt-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="accounts-api-heading" className="text-lg font-black text-[var(--text)]">
                {t("حسابات TikTok والمحتوى", "TikTok Accounts & Content")}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-2)]">
                {t(
                  "أدِر حسابات TikTok والمحتوى الخاص بك من محل ترند.",
                  "Manage your TikTok accounts and content from Trend Store",
                )}
              </p>
            </div>
            <DemoBadge
              label={t("نموذج أولي", "Prototype / Demo")}
              hint={t(
                "هذه الواجهة توضّح سير عمل TikTok Accounts API المخطط له باستخدام بيانات تجريبية.",
                "This interface demonstrates the planned TikTok Accounts API workflow using demo data.",
              )}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((c) => {
              const Icon = c.icon;
              const isAccounts = c.key === "accounts";
              const available = isAccounts || (hydrated && connected);
              return (
                <Link
                  key={c.key}
                  href={c.href}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-4 transition hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600">
                      <Icon size={18} className="text-white" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-[var(--text)]">{t(c.titleAr, c.titleEn)}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{t(c.descAr, c.descEn)}</p>
                      <div className="mt-2">
                        {isAccounts ? (
                          hydrated && connected
                            ? <StatusChip tone="green">{t("متصل", "Connected")}</StatusChip>
                            : <StatusChip tone="slate">{t("غير متصل", "Not connected")}</StatusChip>
                        ) : available ? (
                          <StatusChip tone="green">{t("متاح", "Available")}</StatusChip>
                        ) : (
                          <StatusChip tone="slate">
                            {t("متاح بعد ربط حساب", "Available after connecting an account")}
                          </StatusChip>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-5">
            <h3 className="text-sm font-black text-[var(--text)]">
              {t("كيف يستخدم محل ترند واجهة TikTok Accounts API", "How Trend Store uses TikTok Accounts API")}
            </h3>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.titleEn} className="rounded-xl border border-[var(--border)] bg-white/5 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-xs font-black text-purple-300">
                        {i + 1}
                      </span>
                      <Icon size={15} className="text-blue-400" aria-hidden="true" />
                      <span className="text-sm font-bold text-[var(--text)]">{t(s.titleAr, s.titleEn)}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{t(s.bodyAr, s.bodyEn)}</p>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-purple-400/25 bg-gradient-to-r from-purple-600/15 to-blue-600/10 p-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-[var(--text)]">
                {t("ربط حساب TikTok", "Connect TikTok Account")}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                {t(
                  "استعرض تدفق التصريح المخطط له: الصلاحيات، ثم لوحة الحساب والفيديوهات والتعليقات والنشر.",
                  "Walk through the planned official authorization flow: permissions, then the account dashboard, videos, comments and publishing.",
                )}
              </p>
            </div>
            <Link
              href="/tiktok-demo/authorization"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:from-purple-500 hover:to-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
            >
              <PlayCircle size={16} aria-hidden="true" />
              {hydrated && connected
                ? t("عرض تدفق التجربة", "View Demo Flow")
                : t("ربط حساب TikTok", "Connect TikTok Account")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
