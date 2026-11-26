"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- the tools are separate full pages */

import { useEffect, useState, type ReactNode } from "react";
import { Megaphone, Home, Moon, Sun, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "@/components/NotificationBell";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import { fbPalette, FB_FONT } from "@/lib/fbTheme";

export type FbSection = "home" | "pages" | "ads" | "bot" | "studio" | "billing";

/**
 * The one top bar of every «أدوات فيسبوك» screen. On phones the section links hide
 * because AdsBottomNav already carries them (no button twice on one screen);
 * `mobileNav` keeps them for screens without the bottom bar (the hub).
 */
export default function FbHeader({ active, mobileNav = false }: { active: FbSection; mobileNav?: boolean }) {
  const { t } = useLang();
  const { dark } = useTheme();
  const P = fbPalette(!dark);
  const [initial, setInitial] = useState("؟");
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setSigned(!!u);
      const name = (u?.user_metadata?.full_name as string) || (u?.user_metadata?.name as string) || u?.email || "";
      if (name) setInitial(name.trim().slice(0, 1).toUpperCase());
    });
  }, []);

  const toggleTheme = () => {
    const nextLight = dark;
    document.documentElement.classList.toggle("light", nextLight);
    try { localStorage.setItem("theme", nextLight ? "light" : "dark"); } catch {}
  };

  const links: [FbSection, string, string][] = [
    ["home", t("الرئيسية", "Home"), "/facebook"],
    ["pages", t("صفحاتي", "My Pages"), "/facebook/pages"],
    ["ads", t("الإعلانات", "Ads"), "/ads"],
    ["bot", t("الرد الآلي", "Auto-Reply"), "/bot"],
    ["studio", t("الموظف الذكي", "AI Employee"), "/studio"],
    ["billing", t("الاشتراكات", "Subscriptions"), "/subscriptions"],
  ];

  return (
    <header className={`fbh ${mobileNav ? "fbh-mnav" : ""}`} style={{ background: P.surface, borderBottom: `1px solid ${P.border}`, color: P.text, fontFamily: FB_FONT, ["--fbh-muted" as string]: P.muted, ["--fbh-border" as string]: P.border, ["--fbh-soft" as string]: P.soft, ["--fbh-on" as string]: P.chipBlue, ["--fbh-ontext" as string]: P.blueText }}>
      <style>{CSS}</style>
      <div className="fbh-in">
        <a href="/facebook" className="fbh-brand" aria-label={t("أدوات فيسبوك", "Facebook Tools")}>
          <span className="fbh-logo"><Megaphone size={18} color="#fff" /></span>
          <span><b>{t("أدوات فيسبوك", "Facebook Tools")}</b><small>{t("من محل ترند", "by Trend Store")}</small></span>
        </a>
        <nav className="fbh-nav" aria-label={t("الأدوات", "Tools")}>
          {links.map(([k, label, href]) => <a key={k} href={href} className={k === active ? "on" : ""} aria-current={k === active ? "page" : undefined}>{label}</a>)}
        </nav>
        <div className="fbh-tools">
          <a href="/" className="fbh-ghost" title={t("العودة إلى المتجر", "Back to the store")}><Home size={16} /> <span className="fbh-hide-sm">{t("المتجر", "Store")}</span></a>
          <LangToggle />
          <button type="button" className="fbh-icon" onClick={toggleTheme} aria-label={t("تبديل الوضع الداكن", "Toggle dark mode")}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <span className="fbh-icon fbh-bell"><NotificationBell /></span>
          <a href={signed ? "/account" : "/login"} className="fbh-avatar" aria-label={t("حسابي", "My account")}>{initial}<ChevronDown size={13} /></a>
        </div>
      </div>
    </header>
  );
}

/** Breadcrumb + title + description + this screen's own actions (never the section links again). */
export function FbPageHead({ crumbs, icon, title, desc, actions, accent = "#438DF5" }: {
  crumbs?: { label: string; href?: string }[]; icon?: ReactNode; title: string; desc?: string; actions?: ReactNode; accent?: string;
}) {
  const { t, rtl } = useLang();
  const { dark } = useTheme();
  const P = fbPalette(!dark);
  const Sep = rtl ? ChevronLeft : ChevronRight;
  return (
    <div className="fbph" style={{ fontFamily: FB_FONT, color: P.text }}>
      <style>{PH_CSS}</style>
      <nav className="fbph-crumbs" aria-label={t("مسار التنقل", "Breadcrumb")} style={{ color: P.muted }}>
        <a href="/facebook">{t("أدوات فيسبوك", "Facebook Tools")}</a>
        {(crumbs || []).map((c, i) => (
          <span key={i} className="fbph-crumb"><Sep size={14} />{c.href ? <a href={c.href}>{c.label}</a> : <span aria-current="page" style={{ color: P.text, fontWeight: 600 }}>{c.label}</span>}</span>
        ))}
      </nav>
      <div className="fbph-row">
        <div className="fbph-title">
          {icon && <span className="fbph-ic" style={{ background: `${accent}1f`, color: accent }}>{icon}</span>}
          <div style={{ minWidth: 0 }}>
            <h1>{title}</h1>
            {desc && <p style={{ color: P.muted }}>{desc}</p>}
          </div>
        </div>
        {actions && <div className="fbph-actions">{actions}</div>}
      </div>
    </div>
  );
}

const CSS = `
.fbh{position:sticky;top:env(safe-area-inset-top,0px);z-index:40}
.fbh a{color:inherit;text-decoration:none}
.fbh-in{max-width:1240px;margin:0 auto;padding:8px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));min-height:66px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.fbh-brand{display:flex;align-items:center;gap:10px;flex:none}
.fbh-brand b{display:block;font-size:16px;line-height:1.2}.fbh-brand small{display:block;font-size:11.5px;color:var(--fbh-muted)}
.fbh-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#438DF5,#9367ED);display:grid;place-items:center}
.fbh-nav{display:flex;gap:2px;flex:1 1 380px;min-width:0;overflow-x:auto;scrollbar-width:none}
.fbh-nav a{padding:9px 12px;border-radius:10px;font-size:14px;font-weight:500;color:var(--fbh-muted);white-space:nowrap}
.fbh-nav a:hover{background:var(--fbh-soft)}
.fbh-nav a.on{background:var(--fbh-on);color:var(--fbh-ontext);font-weight:700}
.fbh-tools{display:flex;align-items:center;gap:6px;flex:none;margin-inline-start:auto}
.fbh-ghost{height:40px;padding:0 10px;border-radius:12px;display:flex;align-items:center;gap:6px;font-size:13.5px;color:var(--fbh-muted)}
.fbh-icon{height:40px;min-width:40px;border-radius:12px;border:1px solid var(--fbh-border);background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer}
.fbh-bell{padding:0 10px}
.fbh-avatar{height:40px;padding:0 8px;border-radius:12px;border:1px solid var(--fbh-border);display:flex;align-items:center;gap:4px;font-weight:700;font-size:14px}
.fbh button:focus-visible,.fbh a:focus-visible{outline:2px solid #438DF5;outline-offset:2px}
@media (max-width:640px){.fbh-hide-sm{display:none}.fbh-nav{display:none}.fbh-mnav .fbh-nav{display:flex;order:3;flex-basis:100%}.fbh-in{gap:8px;min-height:58px;flex-wrap:nowrap}.fbh-mnav .fbh-in{flex-wrap:wrap}.fbh-tools{gap:5px}.fbh-icon,.fbh-ghost{height:36px;min-width:36px;padding:0}.fbh-ghost{justify-content:center}.fbh-bell{padding:0}.fbh-avatar{height:36px;padding:0 6px}}
@media (max-width:480px){.fbh-brand>span:last-child{display:none}}
`;
const PH_CSS = `
.fbph{max-width:1240px;margin:0 auto;padding:20px max(16px,env(safe-area-inset-right,0px)) 4px max(16px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;gap:12px}
.fbph a{color:inherit;text-decoration:none}.fbph a:hover{color:#438DF5}
.fbph-crumbs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13.5px}
.fbph-crumb{display:inline-flex;align-items:center;gap:6px}
.fbph-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px}
.fbph-title{display:flex;align-items:center;gap:14px;min-width:0}
.fbph-ic{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;flex:none}
.fbph h1{margin:0;font-size:clamp(22px,3vw,28px);font-weight:700;line-height:1.3}
.fbph p{margin:2px 0 0;font-size:15px;line-height:1.7}
.fbph-actions{display:flex;gap:8px;flex-wrap:wrap}
`;

/** Numbered steps of a flow (e.g. connect → create → pay) so the customer always knows where they are. */
export function FbSteps({ steps, current, accent = "#438DF5" }: { steps: { label: string; href?: string }[]; current: number; accent?: string }) {
  const { t } = useLang();
  const { dark } = useTheme();
  const P = fbPalette(!dark);
  return (
    <ol aria-label={t("خطوات العملية", "Steps")} style={{ listStyle: "none", maxWidth: 1240, margin: "0 auto", padding: "10px max(16px,env(safe-area-inset-right,0px)) 2px max(16px,env(safe-area-inset-left,0px))", display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", fontFamily: FB_FONT }}>
      {steps.map((s, i) => {
        const done = i < current, on = i === current;
        const inner = (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px 6px 9px", borderRadius: 999, whiteSpace: "nowrap", border: `1px solid ${on ? accent : P.border}`, background: on ? `${accent}14` : P.surface, color: on ? accent : done ? P.text : P.muted, fontSize: 13.5, fontWeight: on ? 700 : 600 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, background: on || done ? accent : P.soft, color: on || done ? "#fff" : P.muted }}>{done ? "✓" : i + 1}</span>
            {s.label}
          </span>
        );
        return <li key={i} style={{ flex: "none" }} aria-current={on ? "step" : undefined}>{done && s.href ? <a href={s.href} style={{ textDecoration: "none" }}>{inner}</a> : inner}</li>;
      })}
    </ol>
  );
}
