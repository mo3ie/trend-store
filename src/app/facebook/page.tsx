"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- plain links on purpose: the tools are separate apps with their own layouts; a full load matches the current /facebook hub */

/**
 * «أدوات فيسبوك» — the Facebook tools hub (approved 2026-11-26; all copy in Modern
 * Standard Arabic by the owner's request). Real data only: pages, stats and
 * subscriptions come from /api/facebook/overview (scoped to the signed-in user), prices
 * from the same sources the tools use (AD_TIER_PACKAGES, subscription_plans).
 * Statuses are honest: «قريباً» = not built yet.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Megaphone, MessageCircleReply, Bot, Check, Link2, Bell, Target, Receipt, CalendarClock, Inbox,
  BarChart3, Music2, Moon, Sun, Home, ChevronLeft, ChevronRight, ChevronDown, Wallet, BadgeCheck, Sparkles,
} from "lucide-react";
import RobotCanvas, { type RobotApi } from "@/components/holo/RobotCanvas";
import TrendyChat from "@/components/holo/TrendyChat";
import NotificationBell from "@/components/NotificationBell";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { AD_TIER_PACKAGES } from "@/services/campaigns";

type Overview = {
  signedIn: boolean; name?: string;
  pages?: { id: string; name: string; picture: string | null; since: string }[];
  stats?: { pages: number; activeCampaigns: number; inReview: number; botsOn: number; replies30: number; postsWeek: number; publishedWeek: number };
  subscriptions?: { product: string; tier: string | null; page_scope: string | null; expires_at: string | null; auto_renew: boolean }[];
  access?: { admin: boolean; trial: boolean; trialEndsAt: string | null; full: boolean };
};
type Rec = "ads" | "bot" | "studio" | null;

const LIGHT = {
  bg: "#F6F8FC", surface: "#FFFFFF", border: "#E8ECF4", dash: "#cbd5e6", text: "#111827", muted: "#64748B", dim: "#6b7a90",
  chipBlue: "#EEF4FE", blueText: "#2F6FD6", chipGreen: "#E6F8F1", greenText: "#13805a", chipAmber: "#FDF3E6", amberText: "#9a5a0c", soft: "#F1F4FA",
  shadow: "0 1px 2px rgba(17,24,39,.04), 0 8px 24px -18px rgba(17,24,39,.18)",
  trendy: "radial-gradient(120% 90% at 90% 10%, rgba(85,183,245,.22), transparent 60%), radial-gradient(90% 80% at 10% 100%, rgba(147,103,237,.16), transparent 60%), #ffffff",
  adsPanel: "linear-gradient(160deg,#e3eefe,#f4f8ff)", botPanel: "linear-gradient(160deg,#dcf6ec,#f2fbf8)", studioPanel: "linear-gradient(160deg,#ece4fd,#f6f2ff)",
};
const DARK = {
  bg: "#0B1120", surface: "#111827", border: "#263247", dash: "#33425c", text: "#F8FAFC", muted: "#A0AEC0", dim: "#8391a7",
  chipBlue: "rgba(67,141,245,.16)", blueText: "#8FBBFF", chipGreen: "rgba(32,190,131,.16)", greenText: "#5fe0ad", chipAmber: "rgba(242,167,75,.16)", amberText: "#f6c27f", soft: "#1A2436",
  shadow: "none",
  trendy: "radial-gradient(120% 90% at 90% 10%, rgba(85,183,245,.18), transparent 60%), radial-gradient(90% 80% at 10% 100%, rgba(147,103,237,.18), transparent 60%), #111827",
  adsPanel: "linear-gradient(160deg, rgba(67,141,245,.22), rgba(85,183,245,.06))", botPanel: "linear-gradient(160deg, rgba(32,190,131,.2), rgba(85,183,245,.05))", studioPanel: "linear-gradient(160deg, rgba(147,103,237,.24), rgba(67,141,245,.06))",
};

const TOOL = {
  ads: { a: "#438DF5", b: "#55B7F5", href: "/ads" },
  bot: { a: "#20BE83", b: "#55B7F5", href: "/bot" },
  studio: { a: "#9367ED", b: "#438DF5", href: "/studio" },
} as const;

const fmtDate = (iso: string | null, lang: string) => (iso ? new Date(iso).toLocaleDateString(lang === "ar" ? "ar-LY" : "en-GB", { day: "numeric", month: "long" }) : "");
const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5) : null);

export default function FacebookToolsPage() {
  const { t, lang, rtl } = useLang();
  const { dark } = useTheme();
  const C = dark ? DARK : LIGHT;
  const [ov, setOv] = useState<Overview | null>(null);
  const [planMin, setPlanMin] = useState<{ bot: number | null; studio: number | null }>({ bot: null, studio: null });
  const [rec, setRec] = useState<Rec>(null);
  const [chat, setChat] = useState(false);
  const bot = useRef<RobotApi>(null);

  useEffect(() => {
    fetch("/api/facebook/overview", { cache: "no-store" }).then((r) => r.json()).then(setOv).catch(() => setOv({ signedIn: false }));
    fetch("/api/subscriptions/plans").then((r) => r.json()).then((d) => {
      const min = (p: string) => {
        const xs = (d.plans || []).filter((x: { product: string; months: number }) => x.product === p && Number(x.months) === 1).map((x: { price_lyd: number }) => Number(x.price_lyd));
        return xs.length ? Math.min(...xs) : null;
      };
      setPlanMin({ bot: min("bot"), studio: min("studio") });
    }).catch(() => {});
  }, []);

  const adsFrom = useMemo(() => {
    const first = AD_TIER_PACKAGES[0]?.options?.[0];
    return { price: Math.min(...AD_TIER_PACKAGES.flatMap((p) => p.options.map((o) => o.priceLyd))), days: first?.days, vMin: first?.viewsMin, vMax: first?.viewsMax,
      minDays: Math.min(...AD_TIER_PACKAGES.flatMap((p) => p.options.map((o) => o.days))), maxDays: Math.max(...AD_TIER_PACKAGES.flatMap((p) => p.options.map((o) => o.days))) };
  }, []);

  const pick = (r: Rec) => {
    const next = rec === r ? null : r;
    setRec(next);
    bot.current?.setMood(next ? "excited" : "happy");
    setTimeout(() => bot.current?.setMood(next ? "confirm" : "neutral"), 1200);
    if (next) setTimeout(() => document.getElementById(`tool-${next}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 900);
  };
  const toggleTheme = () => {
    const nextLight = dark;
    document.documentElement.classList.toggle("light", nextLight);
    try { localStorage.setItem("theme", nextLight ? "light" : "dark"); } catch {}
  };

  const n = (v: number) => v.toLocaleString(lang === "ar" ? "ar-LY" : "en-US");
  const priceBot = planMin.bot ?? 50, priceStudio = planMin.studio ?? 250;
  const say: Record<string, string> = {
    none: t("أهلاً بك، أنا ترندي. أخبرني بما تريد تحقيقه من صفحتك، وسأرشدك إلى الأداة الأنسب للبدء.", "Hi, I'm Trendy. Tell me what you want from your Page and I'll suggest where to start."),
    ads: t(`الأنسب لك «إعلانات فيسبوك»: تختار منشوراً، وتحدد المدينة والفئة العمرية، وتدفع ابتداءً من ${n(adsFrom.price)} د.ل للحملة، فيصل منتجك إلى عملاء جدد.`, `You want «Facebook Ads»: pick a post, city and age, pay from ${adsFrom.price} LYD per campaign and reach new buyers.`),
    bot: t(`الأنسب لك «الرد الآلي»: يُجاب عن كل تعليق خلال ثوانٍ، ويصل السعر إلى العميل في رسالة خاصة، ابتداءً من ${n(priceBot)} د.ل شهرياً.`, `You want «Auto-Reply»: every comment answered in seconds, the price sent privately — from ${priceBot} LYD/month.`),
    studio: t(`الأنسب لك «الموظف الذكي»: يُعدّ لك خطة الأسبوع بالنصوص والصور، فتراجعها ثم تنشرها، ابتداءً من ${n(priceStudio)} د.ل شهرياً.`, `You want the «AI Employee»: a full weekly plan with captions and images, you review and publish — from ${priceStudio} LYD/month.`),
  };

  const s = ov?.stats;
  const signed = !!ov?.signedIn;
  const pages = ov?.pages || [];
  const Fwd = rtl ? ChevronLeft : ChevronRight;

  const productName = (p: string) => ({ bot: t("الرد الآلي", "Auto-Reply"), ads: t("إعلانات VIP", "Ads VIP"), studio: t("الموظف الذكي", "AI Employee"),
    tiktok_bot: t("الرد الآلي — تيك توك", "TikTok Auto-Reply"), tiktok_ads: t("إعلانات تيك توك", "TikTok Ads"), tiktok_studio: t("الموظف الذكي — تيك توك", "TikTok AI Employee") } as Record<string, string>)[p] || p;
  const scopeName = (sc: string | null) => ({ single: t("صفحة واحدة", "1 page"), triple: t("3 صفحات", "3 pages"), unlimited: t("بلا حدود", "Unlimited") } as Record<string, string>)[sc || ""] || "";

  const stats = [
    { label: t("الصفحات المربوطة", "Connected pages"), value: signed ? n(s?.pages ?? 0) : "—", hint: signed ? (s?.pages ? t("فيسبوك", "Facebook") : t("اربط صفحتك لتبدأ", "Connect a page to start")) : t("سجّل الدخول لعرضها", "Sign in to see"), color: "#438DF5", Icon: Link2 },
    { label: t("الحملات النشطة", "Active campaigns"), value: signed ? n(s?.activeCampaigns ?? 0) : "—", hint: signed && s?.inReview ? t(`+ ${n(s.inReview)} في مراجعة Meta`, `+ ${s.inReview} in Meta review`) : t("حملات إعلانات فيسبوك", "Facebook ad campaigns"), color: "#438DF5", Icon: Megaphone },
    { label: t("ردود آلية — آخر 30 يوم", "Auto-replies — 30 days"), value: signed ? n(s?.replies30 ?? 0) : "—", hint: signed ? t(`${n(s?.botsOn ?? 0)} بوت يعمل`, `${s?.botsOn ?? 0} bot(s) on`) : t("على تعليقات صفحاتك", "On your Page comments"), color: "#20BE83", Icon: MessageCircleReply },
    { label: t("منشورات هذا الأسبوع", "Posts this week"), value: signed ? n(s?.postsWeek ?? 0) : "—", hint: signed ? t(`${n(s?.publishedWeek ?? 0)} منشور نُشر`, `${s?.publishedWeek ?? 0} published`) : t("من خطة الموظف الذكي", "From the AI Employee plan"), color: "#9367ED", Icon: CalendarClock },
  ];

  const frame = (k: keyof typeof TOOL) => {
    const { a, b } = TOOL[k];
    return {
      background: rec === k ? `linear-gradient(135deg, ${a}, ${b})` : rec ? C.border : `linear-gradient(160deg, ${a}66, ${C.border} 45%)`,
      boxShadow: rec === k ? `0 24px 50px -24px ${a}` : C.shadow,
    };
  };

  const more = [
    { k: "link", Icon: Link2, color: "#20BE83", title: t("الرد الخاص برابط", "Private reply links"), text: t("يصل السعر عبر رابط خاص، مع تقرير: أُرسل ← فُتح ← طلب.", "Price behind a private link with a sent → opened → ordered report."), st: "ok", href: "/bot" },
    { k: "tt", Icon: Music2, color: dark ? "#F8FAFC" : "#111827", title: t("الرد الآلي على تيك توك", "TikTok auto-reply"), text: t("البوت نفسه يرد على تعليقات مقاطعك في تيك توك.", "The same bot replies to comments on your TikTok videos."), st: "ok", href: "/tiktok-bot" },
    { k: "push", Icon: Bell, color: "#F2A74B", title: t("إشعارات على هاتفك", "Phone notifications"), text: t("استلام دفعة، أو اقتراب انتهاء اشتراك، أو توقف حملة لنفاد الرصيد.", "Payment received, subscription expiring, campaign paused for balance."), st: "ok", href: null },
    { k: "aud", Icon: Target, color: "#438DF5", title: t("استهداف بالذكاء + جماهير محفوظة", "AI targeting + saved audiences"), text: t("يقترح الذكاء الاصطناعي الجمهور المناسب، وتحفظ جماهيرك لتستخدمها مجدداً (VIP).", "AI suggests the audience; save audiences and reuse them (VIP)."), st: "ok", href: "/ads/vip" },
    { k: "inv", Icon: Receipt, color: "#64748B", title: t("فواتير وسجل دفعات", "Invoices & payments"), text: t("فاتورة لكل حملة وكل اشتراك، وكل دفعة بتاريخها.", "An invoice per campaign and subscription, every payment dated."), st: "ok", href: "/ads/payments" },
    { k: "sch", Icon: CalendarClock, color: "#55B7F5", title: t("جدولة المنشورات", "Post scheduling"), text: t("مواعيد نشر لكل منشور — داخل خطة الموظف الذكي.", "Publish dates per post — inside the AI Employee plan."), st: "in", href: "/studio" },
    { k: "ttads", Icon: Megaphone, color: dark ? "#F8FAFC" : "#111827", title: t("إعلانات تيك توك", "TikTok Ads"), text: t("حملات ممولة على تيك توك بالدينار.", "Paid TikTok campaigns in LYD."), st: "prep", href: null },
    { k: "inbox", Icon: Inbox, color: "#F2A74B", title: t("صندوق الرسائل الموحد", "Unified inbox"), text: t("جميع محادثات عملائك في مكان واحد.", "All customer conversations in one place."), st: "soon", href: null },
    { k: "an", Icon: BarChart3, color: "#64748B", title: t("تحليلات الصفحة", "Page analytics"), text: t("التفاعل والوصول وأفضل منشوراتك (نتائج الحملات متاحة الآن في الإعلانات).", "Engagement, reach and top posts (campaign results already in Ads)."), st: "soon", href: null },
  ];
  const badge = (st: string) => ({
    ok: { label: t("متاح", "Available"), bg: C.chipGreen, color: C.greenText },
    in: { label: t("ضمن أداة", "Inside a tool"), bg: C.chipBlue, color: C.blueText },
    prep: { label: t("قيد التجهيز", "In preparation"), bg: C.chipAmber, color: C.amberText },
    soon: { label: t("قريباً", "Soon"), bg: C.soft, color: C.muted },
  } as Record<string, { label: string; bg: string; color: string }>)[st];

  const tint = (hex: string) => (dark ? `${hex}29` : `${hex}17`);
  const vars = { "--bg": C.bg, "--surface": C.surface, "--border": C.border, "--text": C.text, "--muted": C.muted, "--dim": C.dim, "--soft": C.soft, "--shadow": C.shadow } as React.CSSProperties;

  return (
    <div className="fbx" dir={rtl ? "rtl" : "ltr"} style={vars}>
      <style>{CSS}</style>

      {/* header */}
      <header className="fbx-head">
        <div className="fbx-wrap fbx-head-in">
          <a href="/facebook" className="fbx-brand" aria-label={t("أدوات فيسبوك", "Facebook Tools")}>
            <span className="fbx-logo"><Megaphone size={18} color="#fff" /></span>
            <span><b>{t("أدوات فيسبوك", "Facebook Tools")}</b><small>{t("من محل ترند", "by Trend Store")}</small></span>
          </a>
          <nav className="fbx-nav" aria-label={t("الأدوات", "Tools")}>
            <a className="on" href="/facebook">{t("الرئيسية", "Home")}</a>
            <a href="/ads">{t("الإعلانات", "Ads")}</a>
            <a href="/bot">{t("الرد الآلي", "Auto-Reply")}</a>
            <a href="/studio">{t("الموظف الذكي", "AI Employee")}</a>
            <a href="/subscriptions">{t("الاشتراكات", "Subscriptions")}</a>
          </nav>
          <div className="fbx-tools">
            <a href="/" className="fbx-ghost"><Home size={16} /> <span className="fbx-hide-sm">{t("المتجر", "Store")}</span></a>
            <LangToggle />
            <button type="button" className="fbx-icon" onClick={toggleTheme} aria-label={t("تبديل الوضع الداكن", "Toggle dark mode")}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            <span className="fbx-icon fbx-bell"><NotificationBell /></span>
            <a href={signed ? "/account" : "/login?next=/facebook"} className="fbx-avatar" aria-label={t("حسابي", "My account")}>{(ov?.name || "؟").trim().slice(0, 1) || "؟"}<ChevronDown size={13} /></a>
          </div>
        </div>
      </header>

      <main className="fbx-wrap fbx-main">
        {/* HERO + Trendy */}
        <section className="fbx-hero">
          <div className="fbx-hero-text">
            <span className="fbx-pill"><BadgeCheck size={15} /> {t("تطبيق معتمد من Meta · فيسبوك وانستغرام وتيك توك", "Meta-approved app · Facebook, Instagram & TikTok")}</span>
            <h1>{t("كل أدوات أعمالك على فيسبوك ", "All your Facebook business tools ")}<span className="fbx-grad">{t("في مكان واحد.", "in one place.")}</span></h1>
            <p>{t("إعلانات ممولة حقيقية، وردّ آلي على كل تعليق، وموظف تسويق ذكي يُعدّ منشوراتك. ادفع بالدينار الليبي، ودع ترندي يساعدك في الاختيار.", "Real paid ads, an auto-reply on every comment, and an AI marketing employee that prepares your posts. Pay in LYD — Trendy helps you choose.")}</p>
            <div className="fbx-row">
              <a href="#tools" className="fbx-btn">{t("اختر أداتك", "Choose your tool")} <ChevronDown size={16} /></a>
              <a href={signed && pages.length ? "/ads/connect" : "/ads/connect"} className="fbx-btn2">{signed && pages.length ? t("إدارة صفحاتي", "Manage my pages") : t("ربط صفحة فيسبوك", "Connect a Facebook Page")}</a>
            </div>
            <div className="fbx-checks">
              <span><Check size={15} /> {t("تجربة مجانية 3 أيام", "3-day free trial")}</span>
              <span><Check size={15} /> {t("دفع بالدينار الليبي", "Pay in Libyan dinars")}</span>
              <span><Check size={15} /> {t("إلغاء في أي وقت", "Cancel anytime")}</span>
            </div>
          </div>

          <div className="fbx-trendy" style={{ background: C.trendy }}>
            <div className="fbx-trendy-top">
              <button type="button" className="fbx-bot" onClick={() => bot.current?.wave()} aria-label={t("سلّم على ترندي", "Wave to Trendy")}>
                <RobotCanvas ref={bot} className="fbx-bot-canvas" />
              </button>
              <div className="fbx-say">
                <span className="fbx-say-name">{t("ترندي · مساعدك الذكي", "Trendy · your AI assistant")}</span>
                <div role="status" className="fbx-bubble">{say[rec || "none"]}</div>
              </div>
            </div>
            <div className="fbx-q">{t("أخبرني عن وضعك:", "Tell me your situation:")}</div>
            {([
              ["ads", t("أريد أن يرى عملاء جدد منتجاتي ويشتروها", "I want new people to see my products"), Megaphone],
              ["bot", t("عملائي يسألون عن الأسعار ولا أستطيع الرد على الجميع", "Customers ask prices and I can't keep up"), MessageCircleReply],
              ["studio", t("ليس لديّ وقت للكتابة والنشر يومياً", "I have no time to write and post daily"), Bot],
            ] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" className="fbx-opt" aria-pressed={rec === k} onClick={() => pick(k)}
                style={{ borderColor: rec === k ? TOOL[k].a : C.border, background: rec === k ? tint(TOOL[k].a) : C.surface }}>
                <span className="fbx-opt-ic" style={{ background: tint(TOOL[k].a) }}><Icon size={16} color={TOOL[k].a} /></span>
                <span className="fbx-grow">{label}</span><Fwd size={16} color={C.muted} />
              </button>
            ))}
          </div>
        </section>

        {/* connection */}
        {ov && !signed && (
          <section className="fbx-connect">
            <span className="fbx-connect-ic" style={{ background: C.chipBlue }}><Link2 size={24} color="#438DF5" /></span>
            <div className="fbx-grow"><b>{t("سجّل الدخول واربط صفحتك على فيسبوك.", "Sign in and connect your Facebook Page.")}</b><p>{t("تسجيل دخول فيسبوك الرسمي. نطلب صلاحيات صفحاتك فقط، ويمكنك إلغاؤها في أي وقت.", "Official Facebook login. We only ask for your own Pages' permissions — revoke anytime.")}</p></div>
            <a href="/login?next=/facebook" className="fbx-btn">{t("تسجيل الدخول", "Sign in")}</a>
          </section>
        )}
        {ov && signed && pages.length === 0 && (
          <section className="fbx-connect">
            <span className="fbx-connect-ic" style={{ background: C.chipBlue }}><Link2 size={24} color="#438DF5" /></span>
            <div className="fbx-grow"><b>{t("اربط صفحة فيسبوك وابدأ باستخدام أدواتك الذكية.", "Connect a Facebook Page to start using your smart tools.")}</b><p>{t("تسجيل دخول فيسبوك الرسمي. نطلب صلاحيات صفحاتك فقط، ويمكنك إلغاؤها في أي وقت.", "Official Facebook login. We only ask for your own Pages' permissions — revoke anytime.")}</p></div>
            <a href="/ads/connect" className="fbx-btn">{t("ربط صفحة فيسبوك", "Connect a Facebook Page")}</a>
          </section>
        )}
        {ov && signed && pages.length > 0 && (
          <section className="fbx-card fbx-conn">
            <div className="fbx-conn-page">
              {pages[0].picture
                ? <img src={pages[0].picture} alt="" className="fbx-page-pic" /> // eslint-disable-line @next/next/no-img-element
                : <span className="fbx-page-pic fbx-page-ph">{(pages[0].name || "؟").slice(0, 1)}</span>}
              <div className="fbx-grow">
                <div className="fbx-row-tight"><b>{pages[0].name}</b><span className="fbx-badge" style={{ background: C.chipGreen, color: C.greenText }}>{t("متصلة", "Connected")}</span></div>
                <small>{t("مربوطة منذ", "Connected since")} {fmtDate(pages[0].since, lang)}{pages.length > 1 ? ` · ${t(`+ ${n(pages.length - 1)} صفحة أخرى`, `+ ${pages.length - 1} more`)}` : ""}</small>
              </div>
            </div>
            <div className="fbx-perms">
              {[t("إدارة الإعلانات", "Manage ads"), t("قراءة التعليقات", "Read comments"), t("الرد على التعليقات", "Reply to comments"), t("الرسائل الخاصة", "Private messages"), t("نشر المنشورات", "Publish posts")].map((p) => (
                <span key={p}><Check size={12} color="#20BE83" strokeWidth={3} />{p}</span>
              ))}
            </div>
            <a href="/ads/connect" className="fbx-btn2 fbx-sm">{t("إدارة الربط", "Manage connection")}</a>
          </section>
        )}

        {/* stats */}
        <section className="fbx-stats" aria-label={t("ملخص", "Summary")}>
          {stats.map(({ label, value, hint, color, Icon }) => (
            <div key={label} className="fbx-card fbx-stat">
              <div className="fbx-stat-top"><span>{label}</span><i style={{ background: tint(color) }}><Icon size={16} color={color} /></i></div>
              <b>{ov ? value : <span className="fbx-skel" />}</b>
              <small>{hint}</small>
            </div>
          ))}
        </section>

        {/* THE THREE TOOLS */}
        <section id="tools" className="fbx-tools-sec">
          <div className="fbx-center">
            <span className="fbx-eyebrow">{t("الأدوات الأساسية", "Core tools")}</span>
            <h2>{t("اختر أداتك", "Choose your tool")}</h2>
            <p>{t("كل أداة تحل مشكلة محددة. ابدأ بواحدة، وأضف البقية متى احتجت إليها.", "Each tool solves one clear problem. Start with one, add the rest when you need them.")}</p>
          </div>
          <div className="fbx-tools-grid">
            {/* ADS */}
            <article id="tool-ads" className="fbx-tool" style={frame("ads")}>
              <div className="fbx-tool-in">
                {rec === "ads" && <span className="fbx-recbadge" style={{ background: TOOL.ads.a }}>{t("ترندي ينصحك بها", "Trendy recommends")}</span>}
                <div className="fbx-tool-vis" style={{ background: C.adsPanel }} aria-hidden="true">
                  <div className="fbx-chips"><span>{t("بنغازي", "Benghazi")}</span><span>18–35</span><span>{t("الهدف: رسائل", "Goal: messages")}</span></div>
                  <div className="fbx-bars">
                    {[28, 42, 55, 70, 88].map((h, i) => <span key={i} style={{ height: `${h}%`, background: ["#cfe0fc", "#b4cffb", "#93baf8", "#6aa2f6", "#438DF5"][i] }} />)}
                    <div className="fbx-bars-txt"><small>{t("مشاهدات متوقعة", "Expected views")}</small><b>{n(adsFrom.vMin || 0)}–{n(adsFrom.vMax || 0)}</b><small>{t(`الباقة الأولى · ${n(adsFrom.days || 0)} أيام`, `First package · ${adsFrom.days} days`)}</small></div>
                  </div>
                </div>
                <div className="fbx-tool-body">
                  <div className="fbx-tool-title">
                    <span className="fbx-tool-ic" style={{ background: "linear-gradient(135deg,#438DF5,#55B7F5)" }}><Megaphone size={22} color="#fff" /></span>
                    <div><h3>{t("إعلانات فيسبوك", "Facebook Ads")}</h3><span style={{ color: "#438DF5" }}>{t("إذا أردت أن يرى عملاء جدد منتجاتك", "When you want new customers to see your products")}</span></div>
                  </div>
                  <div className="fbx-price"><small>{t("من", "From")}</small><b>{n(adsFrom.price)}</b><small>{t("د.ل للحملة · بدون اشتراك", "LYD per campaign · no subscription")}</small></div>
                  <ul className="fbx-feats">
                    {[t("حملات حقيقية على Meta — فيسبوك وانستغرام وماسنجر", "Real Meta campaigns — Facebook, Instagram & Messenger"),
                      t("6 أهداف: رسائل، تفاعل، زيارات، مكالمات، فيديو، وصول", "6 goals: messages, engagement, traffic, calls, video, reach"),
                      t("استهداف بالمدن والمناطق ونطاق حول المدينة، والعمر والاهتمامات", "Cities, regions & radius, age and interests targeting"),
                      t(`3 باقات بالدينار من ${n(adsFrom.minDays)} إلى ${n(adsFrom.maxDays)} يوماً مع عدد مشاهدات متوقع`, `3 LYD packages, ${adsFrom.minDays}–${adsFrom.maxDays} days, with expected views`),
                      t("تقرير الوصول والنقرات، وفاتورة لكل حملة", "Reach & clicks report, an invoice per campaign"),
                      t("VIP: ميزانية مفتوحة ومساعد استهداف بالذكاء الاصطناعي", "VIP: free budget and an AI targeting assistant")].map((f) => <li key={f}><Check size={16} color="#438DF5" strokeWidth={2.6} />{f}</li>)}
                  </ul>
                  <div className="fbx-tool-cta">
                    <a href="/ads/create" className="fbx-big" style={{ background: "linear-gradient(90deg,#438DF5,#55B7F5)" }}>{t("أطلق حملتك الأولى", "Launch your first campaign")}</a>
                    <a href="/ads" className="fbx-sub">{t("اطّلع على الباقات الثلاث والمشاهدات", "See the 3 packages and views")}</a>
                  </div>
                </div>
              </div>
            </article>

            {/* BOT */}
            <article id="tool-bot" className="fbx-tool" style={frame("bot")}>
              <div className="fbx-tool-in">
                {rec === "bot" && <span className="fbx-recbadge" style={{ background: TOOL.bot.a }}>{t("ترندي ينصحك بها", "Trendy recommends")}</span>}
                <div className="fbx-tool-vis fbx-chat" style={{ background: C.botPanel }} aria-hidden="true">
                  <div className="fbx-msg in"><small>{t("عميلة", "Customer")}</small>{t("كم السعر؟ وهل يتوفر اللون الأسود؟", "How much? Is black available?")}</div>
                  <div className="fbx-msg out"><small>{t("ردّ آلي · خلال ثوانٍ", "Auto-reply · in seconds")}</small>{t("أهلاً بك! أرسلنا إليك السعر والألوان في رسالة خاصة", "Hi! We sent you the price and colours privately")}</div>
                  <div className="fbx-track"><span>{t("رابط السعر الخاص:", "Private price link:")}</span><b>{t("أُرسل ✓", "Sent ✓")}</b><b>{t("فُتح ✓", "Opened ✓")}</b><span>{t("طلب…", "Ordered…")}</span></div>
                </div>
                <div className="fbx-tool-body">
                  <div className="fbx-tool-title">
                    <span className="fbx-tool-ic" style={{ background: "linear-gradient(135deg,#20BE83,#55B7F5)" }}><MessageCircleReply size={22} color="#fff" /></span>
                    <div><h3>{t("الرد الآلي", "Auto-Reply")}</h3><span style={{ color: "#13a36f" }}>{t("إذا كثرت أسئلة عملائك ولم تتمكن من الرد", "When customers ask faster than you can answer")}</span></div>
                  </div>
                  <div className="fbx-price"><small>{t("من", "From")}</small><b>{n(priceBot)}</b><small>{t("د.ل شهرياً · لكل صفحة", "LYD/month · per page")}</small></div>
                  <ul className="fbx-feats">
                    {[t("يردّ علناً تحت كل تعليق خلال ثوانٍ", "Public reply under every comment within seconds"),
                      t("يرسل السعر والتفاصيل في رسالة خاصة (فيسبوك)", "Sends price and details privately (Facebook)"),
                      t("رابط سعر خاص مع تقرير أُرسل ← فُتح ← طلب", "Private price link with a sent → opened → ordered report"),
                      t("كلمات مفتاحية أو ذكاء اصطناعي يعرف كتالوجك", "Keyword rules or AI that knows your catalog"),
                      t("فيسبوك وتيك توك من مكان واحد", "Facebook and TikTok from one place"),
                      t("حدود وسقف لكل منشور حسب سياسات المنصة", "Rate limits and per-post caps per platform policy")].map((f) => <li key={f}><Check size={16} color="#20BE83" strokeWidth={2.6} />{f}</li>)}
                  </ul>
                  <div className="fbx-tool-cta">
                    <a href="/bot" className="fbx-big" style={{ background: "linear-gradient(90deg,#20BE83,#3cc7a6)" }}>{t("فعّل الرد الآلي", "Turn on Auto-Reply")}</a>
                    <a href="/subscriptions" className="fbx-sub">{t("جرّب 3 أيام مجاناً", "Try 3 days free")}</a>
                  </div>
                </div>
              </div>
            </article>

            {/* STUDIO */}
            <article id="tool-studio" className="fbx-tool" style={frame("studio")}>
              <div className="fbx-tool-in">
                {rec === "studio" && <span className="fbx-recbadge" style={{ background: TOOL.studio.a }}>{t("ترندي ينصحك بها", "Trendy recommends")}</span>}
                <div className="fbx-tool-vis" style={{ background: C.studioPanel }} aria-hidden="true">
                  <div className="fbx-week">
                    {[t("سبت", "Sat"), t("أحد", "Sun"), t("إثنين", "Mon"), t("ثلاثاء", "Tue"), t("أربعاء", "Wed"), t("خميس", "Thu"), t("جمعة", "Fri")].map((d, i) => (
                      <div key={d}><small>{d}</small><span className={i === 3 ? "today" : [0, 1, 4, 6].includes(i) ? "has" : ""} /></div>
                    ))}
                  </div>
                  <div className="fbx-today"><span /><div><b>{t("منشور اليوم", "Today's post")}</b> · {t("سماعات لاسلكية", "Wireless earbuds")}<br /><small>{t("نص وصورة جاهزان للمراجعة · 8:00م", "Caption + image ready to review · 8:00pm")}</small></div></div>
                </div>
                <div className="fbx-tool-body">
                  <div className="fbx-tool-title">
                    <span className="fbx-tool-ic" style={{ background: "linear-gradient(135deg,#9367ED,#438DF5)" }}><Bot size={22} color="#fff" /></span>
                    <div><h3>{t("الموظف الذكي", "AI Employee")}</h3><span style={{ color: "#9367ED" }}>{t("إذا لم يتسع وقتك للكتابة والنشر", "When you have no time to write and post")}</span></div>
                  </div>
                  <div className="fbx-price"><small>{t("من", "From")}</small><b>{n(priceStudio)}</b><small>{t("د.ل شهرياً · 3 مستويات", "LYD/month · 3 levels")}</small></div>
                  <ul className="fbx-feats">
                    {[t("يتعلّم هوية متجرك ولغة الكتابة التي تريدها", "Learns your brand and the writing language you want"),
                      t("كتالوج منتجاتك — أضفها يدوياً أو ارفع ملفاً", "Your product catalog — add items or upload a file"),
                      t("خطة محتوى أسبوعية كاملة بالذكاء", "A complete AI weekly content plan"),
                      t("صور بالذكاء الاصطناعي أو من 6 مصادر، وفيديو في الباقات العليا", "AI images or 6 image sources, video on higher plans"),
                      t("النشر على صفحتك بنقرة واحدة وفق مواعيد الخطة", "Publish to your Page in one tap, on the plan's schedule"),
                      t("تمويل المنشور الذي تختاره بنقرة واحدة", "Boost the post you like in one tap")].map((f) => <li key={f}><Check size={16} color="#9367ED" strokeWidth={2.6} />{f}</li>)}
                  </ul>
                  <div className="fbx-tool-cta">
                    <a href="/studio" className="fbx-big" style={{ background: "linear-gradient(90deg,#9367ED,#6d7cf0)" }}>{t("وظّف موظفك الذكي", "Hire your AI Employee")}</a>
                    <a href="/studio" className="fbx-sub">{t("تعرّف على طريقة إعداد خطة الأسبوع", "See how it builds a weekly plan")}</a>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* comparison */}
        <section className="fbx-card fbx-pad">
          <h2 className="fbx-h2">{t("ما الفرق بين الأدوات الثلاث؟", "How do they differ?")}</h2>
          <div className="fbx-scroll">
            <table className="fbx-table">
              <thead><tr><th scope="col" /><th scope="col" style={{ color: "#438DF5" }}>{t("إعلانات فيسبوك", "Facebook Ads")}</th><th scope="col" style={{ color: "#13a36f" }}>{t("الرد الآلي", "Auto-Reply")}</th><th scope="col" style={{ color: "#9367ED" }}>{t("الموظف الذكي", "AI Employee")}</th></tr></thead>
              <tbody>
                {[
                  [t("ماذا تحل؟", "Solves"), t("توصل منتجك إلى عملاء جدد", "Reach new people"), t("لا يضيع أي عميل يسأل", "No question goes unanswered"), t("صفحتك تنشر يومياً دون عناء", "Your Page posts daily, effortlessly")],
                  [t("طريقة الدفع", "How you pay"), t(`لكل حملة — ابتداءً من ${n(adsFrom.price)} د.ل`, `Per campaign — from ${adsFrom.price} LYD`), t(`اشتراك شهري — ابتداءً من ${n(priceBot)} د.ل`, `Monthly — from ${priceBot} LYD`), t(`اشتراك شهري — ابتداءً من ${n(priceStudio)} د.ل`, `Monthly — from ${priceStudio} LYD`)],
                  [t("المنصات", "Platforms"), t("فيسبوك، انستغرام، ماسنجر", "Facebook, Instagram, Messenger"), t("فيسبوك وتيك توك", "Facebook & TikTok"), t("فيسبوك", "Facebook")],
                  [t("المطلوب منك", "Needs from you"), t("اختيار المنشور والجمهور", "Pick the post and audience"), t("كتابة الردود أو تفعيل الذكاء الاصطناعي", "Write replies or enable AI"), t("مراجعة المنشورات قبل نشرها", "Review posts before publishing")],
                  [t("متى تظهر النتيجة", "Results show"), t("بعد موافقة Meta على الحملة", "After Meta approves the campaign"), t("من أول تعليق", "From the first comment"), t("من أول أسبوع", "From the first week")],
                ].map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}
              </tbody>
            </table>
          </div>
          <p className="fbx-note">{t("الأفضل للمبيعات: الأدوات الثلاث معاً — الموظف الذكي ينشر، والإعلان يوصل المنشور إلى عملاء جدد، والرد الآلي يجيب كل من يعلّق.", "Best for sales: all three — the employee posts, the ad reaches new people, the auto-reply answers everyone who comments.")}</p>
        </section>

        {/* more */}
        <section>
          <h2 className="fbx-h2">{t("خدمات إضافية", "And also")}</h2>
          <p className="fbx-note" style={{ marginTop: 4 }}>{t("أدوات وخدمات تعمل مع الأدوات الثلاث، وأخرى قادمة قريباً.", "Tools that work with all three, and what's coming next.")}</p>
          <div className="fbx-more">
            {more.map(({ k, Icon, color, title, text, st, href }) => {
              const b = badge(st);
              const inner = (<>
                <i style={{ background: tint(color === "#111827" || color === "#F8FAFC" ? "#64748B" : color) }}><Icon size={19} color={color} /></i>
                <div className="fbx-grow"><div className="fbx-more-top"><b>{title}</b><span className="fbx-badge" style={{ background: b.bg, color: b.color }}>{b.label}</span></div><small>{text}</small></div>
              </>);
              return href
                ? <a key={k} href={href} className="fbx-card fbx-more-item">{inner}</a>
                : <div key={k} className="fbx-card fbx-more-item" style={{ opacity: st === "soon" ? 0.85 : 1 }}>{inner}</div>;
            })}
          </div>
        </section>

        {/* subscriptions + pay */}
        <section className="fbx-split">
          <div className="fbx-card fbx-pad fbx-grow2">
            <div className="fbx-between">
              <div><h2 className="fbx-h2">{t("اشتراكاتك", "Your subscriptions")}</h2><p className="fbx-note">{t("جدّد اشتراكك، أو فعّل التجديد التلقائي، أو رقِّ باقتك.", "Renew, turn on auto-renew, or upgrade.")}</p></div>
              <a href="/subscriptions" className="fbx-btn2 fbx-sm" style={{ background: C.chipBlue, color: C.blueText, borderColor: "transparent" }}>{t("كل الباقات", "All plans")}</a>
            </div>
            {!ov ? <span className="fbx-skel" style={{ height: 60 }} /> : !signed ? (
              <div className="fbx-empty"><b>{t("سجّل الدخول لعرض اشتراكاتك.", "Sign in to see your subscriptions.")}</b><a href="/login?next=/facebook" className="fbx-btn fbx-sm">{t("تسجيل الدخول", "Sign in")}</a></div>
            ) : (ov.subscriptions || []).length === 0 ? (
              <div className="fbx-empty">
                <div><b>{t("لم تشترك في أي أداة بعد.", "You haven't subscribed to any tool yet.")}</b>
                  <small>{ov.access?.trial && ov.access.trialEndsAt ? t(`تنتهي تجربتك المجانية لجميع الأدوات في ${fmtDate(ov.access.trialEndsAt, lang)}.`, `Your free trial of all tools ends ${fmtDate(ov.access.trialEndsAt, lang)}.`) : t("تحصل الحسابات الجديدة على تجربة مجانية لجميع الأدوات مدة 3 أيام.", "New accounts try every tool free for 3 days.")}</small></div>
                <a href="/subscriptions" className="fbx-btn fbx-sm">{t("استكشف الباقات", "Explore plans")}</a>
              </div>
            ) : (ov.subscriptions || []).map((u, i) => {
              const left = daysLeft(u.expires_at); const soon = left != null && left <= 5;
              return (
                <div key={i} className="fbx-sub-row">
                  <div className="fbx-grow"><b>{productName(u.product)}</b><small>{[u.tier, scopeName(u.page_scope)].filter(Boolean).join(" · ")}</small></div>
                  <div className="fbx-sub-end">
                    <span className="fbx-badge" style={{ background: soon ? C.chipAmber : C.chipGreen, color: soon ? C.amberText : C.greenText }}>{soon ? t("ينتهي قريباً", "Expiring soon") : t("نشط", "Active")}</span>
                    <small>{u.expires_at ? (soon ? t(`بقي ${n(Math.max(0, left!))} أيام`, `${Math.max(0, left!)} days left`) : `${t("ينتهي", "Ends")} ${fmtDate(u.expires_at, lang)}`) : t("بدون انتهاء", "No expiry")}{u.auto_renew ? ` · ${t("تجديد تلقائي", "auto-renew")}` : ""}</small>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="fbx-card fbx-pad fbx-grow1">
            <h2 className="fbx-h2"><Wallet size={20} color="#438DF5" style={{ verticalAlign: -3 }} /> {t("الدفع بالدينار الليبي", "Pay in LYD")}</h2>
            <p className="fbx-note">{t("من محفظة ترند أو مباشرة:", "From your Trend wallet or directly:")}</p>
            <div className="fbx-pays">{[t("محفظة ترند", "Trend wallet"), t("معاملات (بطاقة)", "Moamalat (card)"), t("إدفع لي", "Edfali"), t("موبي كاش", "MobiCash"), t("يُسر", "Yusor"), t("مصرفي باي", "Masarafi Pay")].map((p) => <span key={p}>{p}</span>)}</div>
            <a href="/ads/payments" className="fbx-link">{t("الفواتير وسجل الدفعات", "Invoices & payment history")} <Fwd size={15} /></a>
          </div>
        </section>

        <footer className="fbx-foot">
          <span>{t("إعدادات إرسال متوافقة مع سياسات Meta · رموز الوصول مشفّرة ولا تصل للمتصفح", "Sending settings follow Meta policies · access tokens are encrypted and never reach the browser")}</span>
          <span><a href="/privacy">{t("الخصوصية", "Privacy")}</a><a href="/terms">{t("الشروط", "Terms")}</a><a href="/">{t("محل ترند", "Trend Store")}</a></span>
        </footer>
      </main>

      <button type="button" className="fbx-ask" onClick={() => setChat(true)} aria-label={t("اسأل ترندي", "Ask Trendy")}>
        <span className="fbx-ask-dot"><Bot size={18} color="#fff" /></span>{t("عندك سؤال؟", "Got a question?")}
      </button>
      <TrendyChat open={chat} onClose={() => setChat(false)} />
    </div>
  );
}

const CSS = `
.fbx{min-height:100vh;background:var(--bg);color:var(--text);font-family:"IBM Plex Sans Arabic",var(--font-plex),Cairo,Tahoma,sans-serif;padding-bottom:72px}
.fbx *{box-sizing:border-box}
.fbx a{color:inherit;text-decoration:none}
.fbx-wrap{max-width:1240px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.fbx-head{background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:env(safe-area-inset-top,0px);z-index:30}
.fbx-head-in{min-height:68px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-block:8px}
.fbx-brand{display:flex;align-items:center;gap:10px;flex:none}
.fbx-brand b{display:block;font-size:16px;line-height:1.2}.fbx-brand small{display:block;font-size:11.5px;color:var(--muted)}
.fbx-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#438DF5,#9367ED);display:grid;place-items:center}
.fbx-nav{display:flex;gap:2px;flex:1 1 380px;min-width:0;overflow-x:auto;scrollbar-width:none}
.fbx-nav a{padding:9px 12px;border-radius:10px;font-size:14px;font-weight:500;color:var(--muted);white-space:nowrap}
.fbx-nav a:hover{color:var(--text);background:var(--soft)}
.fbx-nav a.on{color:#2F6FD6;background:#EEF4FE;font-weight:700}
.fbx-tools{display:flex;align-items:center;gap:6px;flex:none}
.fbx-ghost{height:40px;padding:0 10px;border-radius:12px;display:flex;align-items:center;gap:6px;font-size:13.5px;color:var(--muted)}
.fbx-icon{height:40px;min-width:40px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);display:grid;place-items:center;cursor:pointer}
.fbx-bell{padding:0 10px}
.fbx-avatar{height:40px;padding:0 8px 0 6px;border-radius:12px;border:1px solid var(--border);display:flex;align-items:center;gap:4px;font-weight:700;font-size:14px}
.fbx-main{display:flex;flex-direction:column;gap:36px;padding-top:30px}
.fbx-hero{display:flex;flex-wrap:wrap;gap:28px;align-items:stretch}
.fbx-hero-text{flex:999 1 460px;min-width:0;display:flex;flex-direction:column;gap:16px;justify-content:center}
.fbx-pill{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;background:#EEF4FE;color:#2F6FD6;font-size:13px;font-weight:600}
.fbx h1{margin:0;font-size:clamp(30px,4.2vw,46px);line-height:1.3;font-weight:700;text-wrap:balance}
.fbx-grad{background:linear-gradient(90deg,#438DF5,#9367ED);-webkit-background-clip:text;background-clip:text;color:transparent}
.fbx-hero-text p{margin:0;font-size:17px;line-height:1.9;color:var(--muted);max-width:580px}
.fbx-row{display:flex;flex-wrap:wrap;gap:10px}.fbx-row-tight{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fbx-btn{height:48px;padding:0 22px;border-radius:12px;background:linear-gradient(90deg,#438DF5,#6d7cf0);color:#fff !important;display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:15px;box-shadow:0 10px 24px -12px rgba(67,141,245,.9);transition:transform .15s,box-shadow .15s}
.fbx-btn:hover{transform:translateY(-1px)}
.fbx-btn2{height:48px;padding:0 20px;border-radius:12px;background:var(--surface);border:1px solid var(--border);display:inline-flex;align-items:center;font-weight:600;font-size:15px}
.fbx-sm{height:40px;padding:0 14px;font-size:14px}
.fbx-checks{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13.5px;color:var(--muted)}
.fbx-checks span{display:flex;align-items:center;gap:6px}.fbx-checks svg{color:#20BE83}
.fbx-trendy{flex:1 1 400px;min-width:0;border-radius:24px;border:1px solid var(--border);padding:20px;display:flex;flex-direction:column;gap:10px}
.fbx-trendy-top{display:flex;gap:12px;align-items:flex-end}
.fbx-bot{width:150px;height:170px;flex:none;border:0;background:none;padding:0;cursor:pointer}
.fbx-bot-canvas{width:100%;height:100%;display:block}
.fbx-say{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;padding-bottom:14px}
.fbx-say-name{font-size:12.5px;font-weight:700;color:#438DF5}
.fbx-bubble{background:var(--surface);border:1px solid var(--border);border-radius:18px 18px 18px 6px;padding:12px 14px;font-size:15px;line-height:1.75;box-shadow:var(--shadow)}
[dir=ltr] .fbx-bubble{border-radius:18px 18px 6px 18px}
.fbx-q{font-size:13px;color:var(--muted);font-weight:600}
.fbx-opt{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:14px;border:1.5px solid;color:var(--text);font:inherit;font-size:14.5px;font-weight:600;cursor:pointer;text-align:start;transition:border-color .15s,background .15s}
.fbx-opt:hover{border-color:#438DF5 !important}
.fbx-opt-ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex:none}
.fbx-grow{flex:1;min-width:0}
.fbx-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow)}
.fbx-pad{padding:22px}
.fbx-connect{display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:22px;border-radius:18px;background:var(--surface);border:1px dashed var(--border)}
.fbx-connect b{font-size:17.5px}.fbx-connect p{margin:4px 0 0;font-size:14px;color:var(--muted)}
.fbx-connect-ic{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;flex:none}
.fbx-conn{display:flex;flex-wrap:wrap;gap:14px 26px;align-items:center;padding:18px 22px}
.fbx-conn-page{display:flex;align-items:center;gap:14px;flex:1 1 280px;min-width:0}
.fbx-conn-page b{font-size:17px}.fbx-conn-page small{font-size:13.5px;color:var(--muted)}
.fbx-page-pic{width:50px;height:50px;border-radius:50%;object-fit:cover;flex:none}
.fbx-page-ph{display:grid;place-items:center;background:linear-gradient(135deg,#55B7F5,#438DF5);color:#fff;font-weight:700;font-size:20px}
.fbx-perms{flex:999 1 360px;min-width:0;display:flex;flex-wrap:wrap;gap:6px}
.fbx-perms span{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:10px;background:var(--bg);border:1px solid var(--border);font-size:12.5px}
.fbx-badge{display:inline-block;padding:3px 9px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap}
.fbx-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-top:-14px}
.fbx-stat{padding:16px 18px;display:flex;flex-direction:column;gap:4px}
.fbx-stat-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13.5px;color:var(--muted)}
.fbx-stat-top i{width:30px;height:30px;border-radius:10px;display:grid;place-items:center}
.fbx-stat b{font-size:28px;font-variant-numeric:tabular-nums;line-height:1.25}.fbx-stat small{font-size:12.5px;color:var(--dim)}
.fbx-skel{display:block;height:28px;width:60%;border-radius:8px;background:var(--soft);animation:fbxPulse 1.2s ease-in-out infinite}
@keyframes fbxPulse{50%{opacity:.5}}
.fbx-tools-sec{display:flex;flex-direction:column;gap:20px;scroll-margin-top:90px}
.fbx-center{text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}
.fbx-eyebrow{font-size:13px;font-weight:700;color:#438DF5}
.fbx-center h2{margin:0;font-size:clamp(26px,3vw,34px)}.fbx-center p{margin:0;color:var(--muted);font-size:16px;max-width:560px}
.fbx-tools-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:20px;align-items:stretch}
.fbx-tool{position:relative;border-radius:24px;padding:2px;transition:transform .25s ease,box-shadow .25s ease,background .25s;scroll-margin-top:100px}
.fbx-tool:hover{transform:translateY(-4px)}
.fbx-tool-in{height:100%;border-radius:22px;background:var(--surface);display:flex;flex-direction:column;overflow:hidden}
.fbx-recbadge{position:absolute;top:14px;inset-inline-end:14px;z-index:2;padding:5px 11px;border-radius:999px;color:#fff;font-size:12px;font-weight:700}
.fbx-tool-vis{height:206px;padding:16px 18px;display:flex;flex-direction:column;gap:9px;justify-content:flex-end}
.fbx-chips{display:flex;gap:6px;flex-wrap:wrap}.fbx-chips span{padding:4px 9px;border-radius:8px;background:var(--surface);font-size:12px;font-weight:600}
.fbx-bars{background:var(--surface);border-radius:14px;padding:12px;display:flex;align-items:flex-end;gap:6px;height:92px}
.fbx-bars>span{flex:1;border-radius:4px}
.fbx-bars-txt{flex:2.4;align-self:stretch;display:flex;flex-direction:column;justify-content:center;padding-inline-start:8px}
.fbx-bars-txt small{font-size:11px;color:var(--muted)}.fbx-bars-txt b{font-size:15px;font-variant-numeric:tabular-nums}
.fbx-chat .fbx-msg{max-width:82%;padding:8px 12px;font-size:13px;line-height:1.55}
.fbx-msg small{display:block;font-size:11px;font-weight:700;opacity:.8}
.fbx-msg.in{align-self:flex-start;background:var(--surface);border-radius:14px 14px 14px 4px}
.fbx-msg.out{align-self:flex-end;background:#20BE83;color:#fff;border-radius:14px 14px 4px 14px}
.fbx-track{align-self:flex-end;display:flex;gap:8px;align-items:center;background:var(--surface);border-radius:12px;padding:6px 10px;font-size:12px;font-weight:600;flex-wrap:wrap}
.fbx-track span{color:var(--muted)}.fbx-track b{color:#20BE83}
.fbx-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;text-align:center}
.fbx-week small{display:block;font-size:10.5px;color:var(--muted);font-weight:600;margin-bottom:4px}
.fbx-week span{display:block;height:52px;border-radius:9px;background:var(--surface);border:1px solid var(--border)}
.fbx-week span.has{background:#ddd0fb;border-color:transparent}
.fbx-week span.today{background:linear-gradient(135deg,#9367ED,#55B7F5);border-color:#9367ED}
.fbx-today{display:flex;align-items:center;gap:10px;background:var(--surface);border-radius:12px;padding:8px 10px;font-size:12.5px}
.fbx-today>span{width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,#9367ED,#55B7F5);flex:none}
.fbx-today small{color:var(--muted)}
.fbx-tool-body{padding:22px;display:flex;flex-direction:column;gap:14px;flex:1}
.fbx-tool-title{display:flex;align-items:center;gap:12px}
.fbx-tool-title h3{margin:0;font-size:22px}.fbx-tool-title span{font-size:13.5px;font-weight:600}
.fbx-tool-ic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;flex:none}
.fbx-price{display:flex;align-items:baseline;gap:6px;padding:10px 14px;border-radius:12px;background:var(--bg);flex-wrap:wrap}
.fbx-price small{font-size:13px;color:var(--muted)}.fbx-price b{font-size:26px;font-variant-numeric:tabular-nums}
.fbx-feats{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px;font-size:14px}
.fbx-feats li{display:flex;align-items:flex-start;gap:9px}.fbx-feats svg{flex:none;margin-top:3px}
.fbx-tool-cta{margin-top:auto;display:flex;flex-direction:column;gap:6px;padding-top:6px}
.fbx-big{height:50px;border-radius:13px;color:#fff !important;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15.5px;transition:filter .15s}
.fbx-big:hover{filter:brightness(1.06)}
.fbx-sub{text-align:center;font-size:13.5px;font-weight:600;color:var(--muted);padding:6px}
.fbx-h2{margin:0;font-size:22px;font-weight:700}
.fbx-note{margin:8px 0 0;font-size:14px;color:var(--muted)}
.fbx-scroll{overflow-x:auto;margin-top:12px}
.fbx-table{width:100%;min-width:700px;border-collapse:collapse;font-size:14px}
.fbx-table th,.fbx-table td{padding:12px;border-bottom:1px solid var(--border);text-align:start}
.fbx-table thead th{font-weight:700}.fbx-table tbody th{color:var(--muted);font-weight:600;font-size:13.5px;white-space:nowrap}
.fbx-more{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;margin-top:14px}
.fbx-more-item{padding:16px;display:flex;gap:12px;align-items:flex-start;transition:border-color .15s}
a.fbx-more-item:hover{border-color:#438DF5}
.fbx-more-item i{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;flex:none}
.fbx-more-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.fbx-more-top b{font-size:15px}
.fbx-more-item small{display:block;font-size:13.5px;line-height:1.7;color:var(--muted);margin-top:3px}
.fbx-split{display:flex;flex-wrap:wrap;gap:16px}.fbx-grow2{flex:999 1 500px;min-width:0;display:flex;flex-direction:column;gap:12px}.fbx-grow1{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:10px}
.fbx-between{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.fbx-empty{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:18px;border:1px dashed var(--border);border-radius:16px}
.fbx-empty b{display:block}.fbx-empty small{display:block;color:var(--muted);font-size:13.5px;margin-top:2px}
.fbx-sub-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:16px;background:var(--bg)}
.fbx-sub-row b{display:block;font-size:15px}.fbx-sub-row small{font-size:13px;color:var(--muted)}
.fbx-sub-end{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:end}
.fbx-pays{display:flex;flex-wrap:wrap;gap:8px}.fbx-pays span{padding:8px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--border);font-size:13.5px;font-weight:600}
.fbx-link{margin-top:auto;display:inline-flex;align-items:center;gap:4px;font-size:14px;font-weight:700;color:#438DF5 !important}
.fbx-foot{display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:space-between;align-items:center;font-size:13px;color:var(--dim);padding-top:18px;border-top:1px solid var(--border)}
.fbx-foot span:last-child{display:flex;gap:16px}
.fbx-ask{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));inset-inline-start:calc(20px + env(safe-area-inset-left,0px));z-index:40;display:flex;align-items:center;gap:8px;padding:6px 16px 6px 6px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 12px 30px -12px rgba(17,24,39,.35)}
[dir=rtl] .fbx-ask{padding:6px 6px 6px 16px}
.fbx-ask-dot{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#438DF5,#9367ED);display:grid;place-items:center}
.fbx button:focus-visible,.fbx a:focus-visible{outline:2px solid #438DF5;outline-offset:2px}
@media (max-width:640px){.fbx-hide-sm{display:none}.fbx-head-in{gap:10px}.fbx-nav{order:3;flex-basis:100%}.fbx-bot{width:120px;height:140px}.fbx-stats{margin-top:0}}
@media (prefers-reduced-motion:reduce){.fbx-tool,.fbx-btn,.fbx-big{transition:none}.fbx-tool:hover,.fbx-btn:hover{transform:none}.fbx-skel{animation:none}}
html.light .fbx-week span.has{background:#ddd0fb}
html:not(.light) .fbx-week span.has{background:rgba(147,103,237,.3)}
html:not(.light) .fbx-nav a.on{background:rgba(67,141,245,.16);color:#8FBBFF}
html:not(.light) .fbx-pill{background:rgba(67,141,245,.16);color:#8FBBFF}
html:not(.light) .fbx-bars>span:nth-child(-n+4){opacity:.55}
`;
