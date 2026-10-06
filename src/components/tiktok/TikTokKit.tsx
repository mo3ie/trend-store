"use client";

import { useState } from "react";
import { Bell, BellRing, ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
  tt, ttCard, ttPrimary, ttTitleAccent, TT_PINK, TT_CYAN,
  type TikTokPalette,
} from "@/lib/tiktokTheme";

/**
 * The pieces every TikTok tool screen shares.
 *
 * The important one is `AccountStrip`, and the reason is the state the product is
 * actually in: nothing can be linked yet, so the unlinked screen is what every user
 * sees FIRST. Treating that as an error state produced a dead marketing page with a
 * button that fails. These components treat it as **prep mode** instead — everything
 * that does not need the TikTok API works and is saved now, and goes live the moment
 * linking opens. So the strip states the truth plainly rather than offering a link
 * button that cannot work.
 */

type TF = (ar: string, en: string) => string;

export interface TikTokAccount {
  handle: string;
  avatarUrl?: string | null;
}

export function AccountStrip({
  account, c, t, rtl, pending, onNotify, notifying,
}: {
  account: TikTokAccount | null;
  c: TikTokPalette; t: TF; rtl: boolean;
  /** True when linking is not available yet — an operator step, not a user one. */
  pending?: boolean;
  onNotify?: () => void;
  notifying?: boolean;
}) {
  return (
    <div style={{
      ...ttCard(c), height: 56, display: "flex", alignItems: "center",
      gap: 11, padding: "0 14px", marginBottom: 14,
    }}>
      {account ? (
        <>
          {account.avatarUrl
            ? <img src={account.avatarUrl} alt="" width={34} height={34} style={{ borderRadius: 999, objectFit: "cover" }} />
            : <div style={{ width: 34, height: 34, borderRadius: 999, background: c.surface2 }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{account.handle}
            </div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: c.muted }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: c.ok }} />
            {t("مرتبط", "Linked")}
          </span>
        </>
      ) : (
        <>
          <div style={{ width: 34, height: 34, borderRadius: 999, border: `1.5px dashed ${c.border}` }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text }}>
              {t("لم يُربط حساب تيك توك بعد", "No TikTok account linked yet")}
            </div>
            {pending && (
              <div style={{ fontSize: 11.5, color: c.muted, marginTop: 2 }}>
                {t("كل ما تضبطه الآن محفوظ ويعمل لحظة التفعيل", "Everything you set now is saved and runs the moment it opens")}
              </div>
            )}
          </div>
          {pending && (
            <span style={{
              background: `${TT_PINK}1f`, border: `1px solid ${TT_PINK}55`, color: c.pinkInk,
              borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
            }}>
              {t("الربط قيد الإعداد", "Linking in setup")}
            </span>
          )}
          {onNotify && (
            <button onClick={onNotify} title={t("نبّهني عند التفعيل", "Notify me when it opens")}
              style={{ background: "none", border: "none", cursor: "pointer", color: notifying ? c.pinkInk : c.muted, padding: 4, display: "flex" }}>
              {notifying ? <BellRing size={17} /> : <Bell size={17} />}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The top tab strip, in TikTok's "For You | Following" idiom: text tabs with a short
 * underline, not the pill row the Facebook consoles use.
 */
export function TabStrip<K extends string>({
  tabs, value, onChange, c,
}: {
  tabs: Array<{ key: K; label: string }>;
  value: K; onChange: (k: K) => void; c: TikTokPalette;
}) {
  return (
    <div style={{
      display: "flex", gap: 20, overflowX: "auto", borderBottom: `1px solid ${c.border}`,
      marginBottom: 18, scrollbarWidth: "none",
    }}>
      {tabs.map((tab) => {
        const on = tab.key === value;
        return (
          <button key={tab.key} onClick={() => onChange(tab.key)}
            style={{
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: "0 0 11px", position: "relative", whiteSpace: "nowrap",
              fontSize: on ? 16 : 15, fontWeight: on ? 800 : 500,
              color: on ? c.text : c.muted,
            }}>
            {tab.label}
            {on && (
              <span style={{
                position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)",
                width: 20, height: 2, background: TT_PINK, borderRadius: 2,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ScreenTitle({ children, c, rtl }: { children: React.ReactNode; c: TikTokPalette; rtl: boolean }) {
  return (
    <h1 style={{ ...ttTitleAccent(rtl), fontSize: 20, fontWeight: 800, lineHeight: 1.3, margin: "0 0 16px", color: c.text }}>
      {children}
    </h1>
  );
}

/**
 * The sticky subscribe bar.
 *
 * Deliberately not a paywall page. The user configures everything for free and only
 * the go-live switch is gated, so what sells the tool is their own rules and their own
 * plan sitting in front of them — not a feature list.
 */
export function SubscribeBar({
  priceLyd, c, t, rtl, onSubscribe, note,
}: {
  priceLyd: number | null; c: TikTokPalette; t: TF; rtl: boolean;
  onSubscribe: () => void; note?: string;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, height: 64,
      background: c.surface, borderTop: `1px solid ${c.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: "0 16px", zIndex: 40,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: c.text }}>
          {t("جاهز للتشغيل", "Ready to run")}
          {priceLyd ? ` · ${t("من", "from")} ${priceLyd.toLocaleString()} ${t("د.ل/شهر", "LYD/mo")}` : ""}
        </div>
        {note && <div style={{ fontSize: 11.5, color: c.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note}</div>}
      </div>
      <button onClick={onSubscribe} style={{ ...ttPrimary(rtl), padding: "10px 18px", fontSize: 14.5 }}>
        {t("اشترك", "Subscribe")}
      </button>
    </div>
  );
}

/**
 * The spend receipt — the trust device for TikTok's high minimum.
 *
 * The platform's share is the hero number and the service fee is small print beside
 * it, because when an advertiser can see that most of the money goes to TikTok, the
 * price reads as reach being bought rather than as a markup. Notably this never
 * mentions another platform's prices: without the comparison there is nothing to feel
 * cheated about.
 */
export function SpendReceipt({
  platformLyd, feeLyd, c, t, perDay,
}: {
  platformLyd: number; feeLyd: number; c: TikTokPalette; t: TF; perDay?: boolean;
}) {
  const total = platformLyd + feeLyd;
  return (
    <div style={{ ...ttCard(c), padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: c.muted }}>
        {t("يذهب إلى تيك توك (إنفاق إعلاني)", "Goes to TikTok (ad spend)")}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 5, color: c.text }}>
        {platformLyd.toLocaleString()} <span style={{ fontSize: 15, fontWeight: 700 }}>{t("د.ل", "LYD")}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 12, fontSize: 14 }}>
        <span style={{ color: c.muted }}>{t("رسوم الخدمة", "Service fee")}</span>
        <span style={{ color: c.text, fontVariantNumeric: "tabular-nums" }}>
          {feeLyd > 0 ? `${feeLyd.toLocaleString()} ${t("د.ل", "LYD")}` : t("لا شيء", "None")}
        </span>
      </div>

      <div style={{ height: 1, background: c.border, margin: "13px 0" }} />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
          {perDay ? t("الإجمالي / يوم", "Total / day") : t("الإجمالي", "Total")}
        </span>
        <span style={{ fontSize: 19, fontWeight: 800, color: c.text, fontVariantNumeric: "tabular-nums" }}>
          {total.toLocaleString()} {t("د.ل", "LYD")}
        </span>
      </div>
    </div>
  );
}

/**
 * The budget slider whose track VISIBLY includes the forbidden zone below TikTok's
 * minimum, drawn as hatching the thumb cannot enter.
 *
 * Hiding the floor and starting the scale at the minimum would make the price look
 * like ours. Showing the wall makes it legible as the platform's rule.
 */
export function BudgetSlider({
  valueUsd, minUsd, maxUsd, onChange, c, t, rtl,
}: {
  valueUsd: number; minUsd: number; maxUsd: number;
  onChange: (v: number) => void; c: TikTokPalette; t: TF; rtl: boolean;
}) {
  // The hatched zone is drawn proportionally from 0, so the wall's position is honest.
  const blockedPct = (minUsd / maxUsd) * 100;
  const hatch = `repeating-linear-gradient(45deg, ${c.surface2} 0 5px, ${c.border} 5px 6px)`;

  return (
    <div>
      <div style={{ position: "relative", height: 34, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", inset: "0 0 auto 0", top: 15, height: 5, borderRadius: 3, background: c.surface2, overflow: "hidden" }}>
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            [rtl ? "right" : "left"]: 0, width: `${blockedPct}%`, background: hatch,
          }} />
        </div>
        <input
          type="range" min={minUsd} max={maxUsd} step={5} value={valueUsd}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: "100%", position: "relative", accentColor: TT_PINK, background: "transparent" }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: c.muted, marginTop: 2 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 13, height: 7, background: hatch, borderRadius: 2, display: "inline-block" }} />
          {t(`حد تيك توك الأدنى ${minUsd}$`, `TikTok minimum $${minUsd}`)}
        </span>
        <span>{maxUsd}$</span>
      </div>
    </div>
  );
}

/** A collapsible "why" disclosure — one per screen, never a wall of explanation. */
export function Disclosure({
  title, children, c,
}: { title: string; children: React.ReactNode; c: TikTokPalette }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: c.pinkInk, textDecoration: "underline", textUnderlineOffset: 3 }}>
        {title}
      </button>
      {open && (
        <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.85, marginTop: 8, background: c.surface2, borderRadius: 10, padding: "11px 13px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** A selectable chip. The only "selected" treatment in the area, so it stays legible. */
export function Chip({
  on, children, onClick, c, grow,
}: { on: boolean; children: React.ReactNode; onClick: () => void; c: TikTokPalette; grow?: boolean }) {
  return (
    <button onClick={onClick} style={{
      flex: grow ? "1 1 auto" : undefined,
      background: on ? `${TT_PINK}1a` : c.surface2,
      border: `1.5px solid ${on ? TT_PINK : "transparent"}`,
      borderRadius: 999, padding: "8px 15px",
      color: on ? c.pinkInk : c.text,
      fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}>
      {on && <Check size={13} />}
      {children}
    </button>
  );
}

/** A tool row for the hub: icon tile, name, live status from the user's own data. */
export function ToolRow({
  icon: Icon, name, status, href, c, rtl, onClick,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  name: string; status: string; href?: string;
  c: TikTokPalette; rtl: boolean; onClick?: () => void;
}) {
  const Chev = rtl ? ChevronLeft : ChevronRight;
  return (
    <a href={href} onClick={onClick} style={{
      ...ttCard(c), display: "flex", alignItems: "center", gap: 13, padding: 14,
      textDecoration: "none", cursor: "pointer",
    }}>
      {/* The icon tile is a miniature stage: black in both themes, with the
          chromatic offset supplied by a cyan edge behind the pink glyph. */}
      <div style={{
        width: 44, height: 44, borderRadius: 11, background: "#000",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: `${rtl ? "-2px" : "2px"} 2px 0 ${TT_CYAN}`,
      }}>
        <Icon size={21} color={TT_PINK} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{name}</div>
        <div style={{ fontSize: 12.5, color: c.muted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {status}
        </div>
      </div>
      <Chev size={19} color={c.muted} />
    </a>
  );
}
