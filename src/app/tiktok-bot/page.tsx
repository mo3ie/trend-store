"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Settings2, Plus, Trash2, Save,
  AlertCircle, CheckCircle, Radio, Video, Sparkles, ShieldBan, Package, Power,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import {
  tt, ttCard, ttPrimary, ttSecondary, ttInput, ttStage, TT_SCRIM, TT_PINK,
} from "@/lib/tiktokTheme";
import {
  AccountStrip, ScreenTitle, TabStrip, SubscribeBar, Chip,
} from "@/components/tiktok/TikTokKit";
import { ReplySimulator, ReplyThread, type ThreadValue } from "@/components/tiktok/ReplyThread";
import {
  BannedWordsEditor, CatalogPanel, ReplyGroupsEditor, type ReplyGroup,
} from "@/components/bot/ReplySettings";
import { PostOverrideEditor, type PostOverrideValue } from "@/components/bot/PostOverrideEditor";
import { botColors } from "@/lib/botTheme";

/**
 * The comment auto-reply bot, for TikTok.
 *
 * Rewritten around the live simulator. Before, with nothing linked, this screen was a
 * marketing hero, a price, and a link button that cannot work — a dead end dressed as
 * a product page. Now the first thing above the fold answers a comment using the
 * owner's real rules and real catalog prices, which proves the tool works before
 * linking and before payment. The rules the owner writes here are saved and run the
 * moment linking opens.
 */

interface Status {
  linking: { organic: boolean };
  account: { id: string; openId: string; handle: string; avatarUrl: string | null } | null;
  bot: {
    configured: boolean; enabled: boolean; rules: number; entitled: boolean;
    subscription: { status: string; expiresAt: string | null } | null;
    entitledWithoutSub: boolean;
    priceLyd: number | null;
  };
}

interface LogRow {
  id: string; comment_message: string | null; commenter_name: string | null;
  public_status: string | null; error: string | null; sent_at: string | null;
  match_signal: string | null;
}

interface VideoRow { id: string; caption: string; thumbnail: string | null; createdTime: number | null }

interface Rule { id: string; keywords: string[]; public_reply: string | null; enabled: boolean; priority: number }

interface Config {
  id: string; enabled: boolean;
  page_id: string;
  default_public_reply: string | null;
  public_replies: string[] | null;
  like_comments: boolean;
  mention_author: boolean;
  once_per_user: boolean;
  banned_words: string[] | null;
  banned_action: string | null;
  catalog_match: string | null;
  catalog_ambiguous_reply: string | null;
  post_overrides: Record<string, PostOverrideValue> | null;
  reply_groups: ReplyGroup[] | null;
  ai_enabled: boolean;
  ai_persona: string | null;
  reply_public: boolean;
  throttle_per_min: number | null;
  min_delay_sec: number | null;
  max_delay_sec: number | null;
}

function TikTokBotInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = tt(light);
  // The shared reply editors take the bot palette; map it from the same theme flag
  // so they sit inside TikTok cards without a second theme toggle.
  const bot = botColors(light);
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [st, setSt] = useState<Status | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"try" | "videos" | "rules" | "smart" | "activity" | "settings">("try");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [webhook, setWebhook] = useState<{ subscribed: boolean; last_event_at: string | null } | null>(null);
  const [hooking, setHooking] = useState(false);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosMsg, setVideosMsg] = useState("");
  const [editingVideo, setEditingVideo] = useState<VideoRow | null>(null);
  const [videosCursor, setVideosCursor] = useState<number | null>(null);
  const [videosMore, setVideosMore] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [draft, setDraft] = useState(false);
  const [linking, setLinking] = useState(false);

  // Simulator
  const [probe, setProbe] = useState("");
  const [simReply, setSimReply] = useState<string | null>(null);
  const [simSource, setSimSource] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  // Default reply, as a thread
  const [thread, setThread] = useState<ThreadValue>({ variants: [""], like: false });
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<ReplyGroup[]>([]);
  const [banned, setBanned] = useState("");
  const [bannedAction, setBannedAction] = useState<"delete" | "hide" | "ignore">("hide");

  const pageId = st?.account?.openId || "";
  const handle = st?.account?.handle || t("حسابك", "your account");

  const load = useCallback(async () => {
    const s = await fetch("/api/tiktok/status").then((r) => (r.status === 401 ? null : r.json()));
    if (!s) { router.push("/login?next=/tiktok-bot"); return; }
    if (!s.error) setSt(s);

    const d = await fetch("/api/tiktok/configs").then((r) => r.json()).catch(() => ({}));
    let cfg: Config | null = (d.accounts || []).map((a: { config: Config | null }) => a.config).find(Boolean) ?? null;
    if (d.webhook) setWebhook(d.webhook);

    // No linked account yet → work on a draft, so the whole editor surface is usable
    // now and moves onto the real account the moment it links.
    if (!cfg) {
      const p = await fetch("/api/tiktok/bot/prep", { method: "POST" })
        .then((r) => r.json()).catch(() => ({}));
      cfg = (p.config as Config | null) ?? null;
      setDraft(!!p.draft);
    }

    if (cfg) {
      setConfig(cfg);
      setThread({
        variants: (cfg.public_replies?.length ? cfg.public_replies : [cfg.default_public_reply || ""]).slice(0, 3),
        like: !!cfg.like_comments,
      });
      setGroups((cfg.reply_groups as ReplyGroup[] | null) || []);
      setBanned((cfg.banned_words || []).join("، "));
      setBannedAction((cfg.banned_action as "delete" | "hide" | "ignore") || "hide");
      const r = await fetch(`/api/bot/rules?configId=${cfg.id}`).then((x) => x.json()).catch(() => ({}));
      setRules(r.rules || []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
    if (params.get("success") === "1") setFlash(t("تم ربط حساب تيك توك", "TikTok account linked"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced so the simulator does not fire a request per keystroke.
  useEffect(() => {
    if (!probe.trim()) { setSimReply(null); setSimSource(null); return; }
    setSimBusy(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch("/api/tiktok/bot/simulate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: pageId || undefined, text: probe }),
        });
        const d = await r.json();
        setSimReply(d.reply ?? d.message ?? null);
        setSimSource(d.source ?? null);
      } catch { /* leave the previous answer standing */ }
      setSimBusy(false);
    }, 350);
    return () => clearTimeout(id);
  }, [probe, pageId]);

  // Loaded when the tab is opened rather than on mount: it is a live TikTok call, and
  // an owner who never opens the tab should not pay for it on every page view.
  useEffect(() => {
    if (tab !== "videos" || !st?.account?.id || videos.length || videosLoading) return;
    setVideosLoading(true); setVideosMsg("");
    fetch(`/api/tiktok/videos?accountId=${encodeURIComponent(st.account.id)}`)
      .then((r) => r.json())
      .then((d) => {
        setVideos(d.videos || []);
        setVideosCursor(d.cursor ?? null);
        setVideosMore(!!d.hasMore);
        if (d.message) setVideosMsg(d.message);
      })
      .catch(() => setVideosMsg(t("تعذّر الاتصال", "Connection failed")))
      .finally(() => setVideosLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, st?.account?.id]);

  useEffect(() => {
    if (tab !== "activity" || !config?.id || logs.length || logsLoading) return;
    setLogsLoading(true);
    fetch(`/api/bot/logs?configId=${config.id}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, config?.id]);

  /**
   * Turns on the real-time path. Without it the bot only sees comments on the daily
   * sweep; with it TikTok pushes each comment as it is posted and the reply goes out
   * in seconds. It is an app-level registration, so one call serves every account.
   */
  async function enableInstant() {
    setHooking(true); setError("");
    try {
      const r = await fetch("/api/tiktok/admin/webhook", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setWebhook({ subscribed: true, last_event_at: null });
        setFlash(t("فُعّل الردّ الفوري", "Instant replies enabled"));
        setTimeout(() => setFlash(""), 2000);
      } else {
        setError(d.message || d.error || t("تعذّر التفعيل", "Could not enable"));
      }
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setHooking(false);
  }

  async function loadMoreVideos() {
    if (!st?.account?.id || videosLoading) return;
    setVideosLoading(true);
    try {
      const q = new URLSearchParams({ accountId: st.account.id });
      if (videosCursor !== null) q.set("cursor", String(videosCursor));
      const d = await fetch(`/api/tiktok/videos?${q}`).then((r) => r.json());
      // Appended, not replaced — and de-duplicated, because a cursor page can overlap.
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...((d.videos || []) as VideoRow[]).filter((v) => !seen.has(v.id))];
      });
      setVideosCursor(d.cursor ?? null);
      setVideosMore(!!d.hasMore);
    } catch { /* keep what is already shown */ }
    setVideosLoading(false);
  }

  async function saveVideoOverride(videoId: string, v: PostOverrideValue) {
    const overrides = { ...((config?.post_overrides as Record<string, PostOverrideValue>) || {}) };
    overrides[videoId] = v;
    const ok = await patch({ post_overrides: overrides });
    if (ok) setEditingVideo(null);
  }

  async function saveThread() {
    if (!config) {
      setError(t("لم تُنشأ إعدادات بعد — أضف قاعدة أولاً.", "No settings yet — add a rule first."));
      return;
    }
    setSaving(true); setError("");
    const variants = thread.variants.map((v) => v.trim()).filter(Boolean);
    const r = await fetch("/api/tiktok/configs", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: config.id,
        public_replies: variants,
        default_public_reply: variants[0] || "",
        like_comments: thread.like,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!r || !r.ok) {
      setError(t("تعذّر الحفظ — حاول مجدداً", "Could not save — try again"));
      return;
    }
    setFlash(t("حُفظ", "Saved"));
    setTimeout(() => setFlash(""), 1800);
  }


  /**
   * Starts TikTok's authorization. The portal issues the URL, so the only thing this
   * adds is our opaque state — and a failure here is almost always configuration, not
   * something the owner can fix by pressing again, so it says which.
   */
  async function startLink() {
    setLinking(true); setError("");
    try {
      const r = await fetch("/api/tiktok/connect");
      const d = await r.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      setError(
        d.error === "tiktok_not_configured" || r.status === 503
          ? t("ربط حسابات تيك توك قيد التفعيل حالياً.", "TikTok account linking is being activated.")
          : (d.message || d.error || t("تعذّر بدء الربط", "Could not start linking")),
      );
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setLinking(false);
  }

  /** One writer for every editor on this screen, draft or live. */
  async function patch(fields: Record<string, unknown>): Promise<boolean> {
    if (!config) return false;
    const r = await fetch("/api/tiktok/configs", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, ...fields }),
    }).catch(() => null);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => ({}));
      setError(d?.message || t("تعذّر الحفظ", "Could not save"));
      return false;
    }
    setConfig({ ...config, ...(fields as Partial<Config>) });
    setFlash(t("حُفظ", "Saved"));
    setTimeout(() => setFlash(""), 1500);
    return true;
  }

  async function addRule() {
    if (!config) return;
    await fetch("/api/bot/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId: config.id, keywords: [""], public_reply: "", enabled: true, priority: 0 }),
    }).catch(() => {});
    const r = await fetch(`/api/bot/rules?configId=${config.id}`).then((x) => x.json()).catch(() => ({}));
    setRules(r.rules || []);
  }

  async function saveRule(rule: Rule) {
    await fetch("/api/bot/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, configId: config?.id }),
    }).catch(() => {});
    setFlash(t("حُفظ", "Saved"));
    setTimeout(() => setFlash(""), 1500);
  }

  async function deleteRule(id: string) {
    await fetch(`/api/bot/rules?id=${id}`, { method: "DELETE" }).catch(() => {});
    setRules(rules.filter((r) => r.id !== id));
  }

  const linkingPending = !!st && !st.linking.organic;
  // Shown only when there is something to buy AND the owner cannot already run the
  // tool. Admins and trial users pass the entitlement check, so offering them a
  // subscription was both pointless and — since the purchase then failed — misleading.
  const sellable =
    st?.bot.priceLyd !== null && st?.bot.priceLyd !== undefined && !st?.bot.entitled;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} className="spin" color={c.pinkInk} />
      </div>
    );
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.bg, color: c.text, paddingBottom: sellable ? 84 : 32 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 32px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/tiktok")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 14 }}>
            <Back size={18} /> {t("أدوات تيك توك", "TikTok tools")}
          </button>
          <LangToggle />
        </div>

        <div style={{ marginTop: 14 }}>
          <ScreenTitle c={c} rtl={rtl}>{t("الرد الآلي على التعليقات", "Comment auto-reply")}</ScreenTitle>
        </div>

        <AccountStrip
          account={st?.account ? { handle: st.account.handle, avatarUrl: st.account.avatarUrl } : null}
          c={c} t={t} rtl={rtl} pending={linkingPending}
          onLink={startLink} linking={linking}
        />

        {flash && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: `${c.ok}18`, border: `1px solid ${c.ok}55`, borderRadius: 11, padding: "10px 13px", marginBottom: 13, fontSize: 13 }}>
            <CheckCircle size={16} color={c.ok} /> {flash}
          </div>
        )}
        {error && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: `${c.danger}18`, border: `1px solid ${c.danger}55`, borderRadius: 11, padding: "10px 13px", marginBottom: 13, fontSize: 13, lineHeight: 1.6 }}>
            <AlertCircle size={16} color={c.danger} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        {/*
          The two facts an owner checks before anything else: am I subscribed, and is
          it running. They were buried in a tab, so neither was visible on arrival.
        */}
        {config && (
          <div style={{ ...ttCard(c), padding: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Power size={18} color={config.enabled ? c.ok : c.muted} />
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                {st?.bot.entitledWithoutSub
                  ? t("وصول مفتوح", "Full access")
                  : st?.bot.subscription?.status === "active"
                    ? t("مشترك", "Subscribed")
                    : t("غير مشترك", "Not subscribed")}
                {" — "}
                <span style={{ color: config.enabled ? c.ok : c.muted }}>
                  {config.enabled ? t("البوت يعمل", "bot is running") : t("البوت متوقف", "bot is stopped")}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: c.muted, marginTop: 3 }}>
                {st?.bot.entitledWithoutSub
                  ? t("حسابك يملك كل الأدوات بلا اشتراك", "Your account has every tool without a subscription")
                  : st?.bot.subscription?.expiresAt
                    ? `${t("ينتهي الاشتراك", "Expires")}: ${new Date(st.bot.subscription.expiresAt).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}`
                    : t("فعّل البوت ليبدأ الردّ على التعليقات", "Turn the bot on to start answering comments")}
              </div>
            </div>
            <button
              onClick={() => patch({ enabled: !config.enabled })}
              aria-label={config.enabled ? t("أوقف البوت", "Stop the bot") : t("شغّل البوت", "Start the bot")}
              style={{
                width: 52, height: 30, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
                background: config.enabled ? c.ok : c.surface2, position: "relative", flexShrink: 0,
                transition: "background .15s",
              }}>
              <span style={{
                position: "absolute", top: 3, insetInlineStart: config.enabled ? 25 : 3,
                width: 24, height: 24, borderRadius: "50%", background: "#fff",
                transition: "inset-inline-start .15s",
              }} />
            </button>
          </div>
        )}

        <TabStrip
          c={c} value={tab} onChange={setTab}
          tabs={[
            { key: "try" as const,      label: t("التجربة والردّ", "Try it & reply") },
            { key: "videos" as const,   label: t("الفيديوهات", "Videos") },
            { key: "rules" as const,    label: `${t("القواعد", "Rules")}${rules.length ? ` (${rules.length})` : ""}` },
            { key: "smart" as const,    label: t("الردّ الذكي", "Smart reply") },
            { key: "activity" as const, label: t("النشاط", "Activity") },
            { key: "settings" as const, label: t("الإعدادات", "Settings") },
          ]}
        />

        {/* ── TRY + the default reply ──────────────────────────────────────── */}
        {tab === "try" && (
          <>
            <ReplySimulator
              c={c} t={t} rtl={rtl} handle={handle}
              onProbe={setProbe} reply={simReply} source={simSource} busy={simBusy}
            />

            <div style={{ ...ttCard(c), padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                {t("الردّ الافتراضي", "The default reply")}
              </div>
              <ReplyThread
                value={thread} onChange={setThread}
                c={c} t={t} rtl={rtl}
                handle={handle} avatarUrl={st?.account?.avatarUrl}
                triggerComment={probe}
                hasProduct={config?.catalog_match !== "off"}
                onInsertPrice={() => {
                  const v = [...thread.variants];
                  const i = 0;
                  v[i] = `${(v[i] || "").trim()} {السعر}`.trim();
                  setThread({ ...thread, variants: v });
                }}
              />
              <button onClick={saveThread} disabled={saving}
                style={{ ...ttPrimary(rtl, saving), width: "100%", marginTop: 16 }}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {t("حفظ", "Save")}
              </button>
            </div>

            {/*
              The per-video editor used to live on a second screen reached from here.
              It is a tab now, so this button is gone: two doors to the same room read
              as two different rooms, which is exactly how it was reported.
            */}
          </>
        )}

        {/* ── RULES ────────────────────────────────────────────────────────── */}
        {tab === "rules" && (
          <div>
            <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.75, margin: "0 0 14px" }}>
              {t("كل قاعدة: كلمات يبحث عنها البوت في التعليق، وردّ علني يُنشره تحته.",
                 "Each rule: words the bot looks for in a comment, and the public reply it posts under it.")}
            </p>
            {rules.length === 0 ? (
              <div style={{ ...ttCard(c), padding: 24, textAlign: "center" }}>
                <Radio size={22} color={c.muted} />
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 10 }}>{t("لا قواعد بعد", "No rules yet")}</div>
                <div style={{ fontSize: 12.5, color: c.muted, marginTop: 6, lineHeight: 1.7 }}>
                  {t("ابدأ بقاعدة واحدة: «بكم، السعر، كم» ← السعر.",
                     "Start with one rule: \"how much, price\" → the price.")}
                </div>
                <button onClick={addRule} disabled={!config} style={{ ...ttPrimary(rtl, !config), marginTop: 14 }}>
                  <Plus size={16} /> {t("أضف قاعدة", "Add a rule")}
                </button>
                {!config && (
                  <div style={{ fontSize: 11.5, color: c.muted, marginTop: 10, lineHeight: 1.65 }}>
                    {t("تُنشأ الإعدادات تلقائياً عند ربط حساب تيك توك.",
                       "Settings are created automatically once a TikTok account is linked.")}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} c={c} t={t} rtl={rtl}
                    onSave={saveRule} onDelete={() => deleteRule(rule.id)} />
                ))}
                <button onClick={addRule} style={{ ...ttSecondary(c), width: "100%" }}>
                  <Plus size={16} /> {t("أضف قاعدة", "Add a rule")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY: what the bot actually did ────────────────── */}
        {tab === "activity" && (
          <div>
            <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.75, margin: "0 0 12px" }}>
              {t("كل تعليق وصل، وماذا فعل البوت به ولماذا.",
                 "Every comment that arrived, what the bot did with it and why.")}
            </p>
            {logsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
                <Loader2 size={20} className="spin" color={c.pinkInk} />
              </div>
            ) : logs.length === 0 ? (
              <div style={{ ...ttCard(c), padding: 22, textAlign: "center", fontSize: 12.5, color: c.muted, lineHeight: 1.8 }}>
                {t("لا نشاط بعد. يبدأ التسجيل فور تشغيل البوت ووصول أول تعليق.",
                   "No activity yet. Logging starts once the bot is running and the first comment arrives.")}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {logs.slice(0, 50).map((l) => {
                  const sent = l.public_status === "sent";
                  const failed = l.public_status === "failed";
                  const tone = sent ? c.ok : failed ? c.danger : c.muted;
                  return (
                    <div key={l.id} style={{ ...ttCard(c), padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 9 }}>
                        <span style={{ fontSize: 12.5, color: c.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {l.comment_message || "—"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: tone, whiteSpace: "nowrap" }}>
                          {sent ? t("رُدّ", "replied") : failed ? t("فشل", "failed") : t("تُخطّي", "skipped")}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: c.muted, marginTop: 5 }}>
                        {l.commenter_name || t("مشاهد", "viewer")}
                        {l.sent_at ? ` · ${new Date(l.sent_at).toLocaleString(rtl ? "ar-LY" : "en-GB")}` : ""}
                        {l.error ? ` · ${l.error}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
        {/* ── VIDEOS: a reply of its own for each video ─────────────── */}
        {tab === "videos" && (
          <>
            {!st?.account ? (
              <div style={{ ...ttCard(c), padding: 24, textAlign: "center" }}>
                <Video size={22} color={c.muted} />
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 10 }}>
                  {t("اربط حسابك لتظهر فيديوهاتك", "Link your account to see your videos")}
                </div>
                <div style={{ fontSize: 12.5, color: c.muted, marginTop: 6, lineHeight: 1.7 }}>
                  {t("بعدها يمكنك إعطاء كل فيديو ردّاً خاصاً به.",
                     "Then you can give each video a reply of its own.")}
                </div>
              </div>
            ) : videosLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 34 }}>
                <Loader2 size={22} className="spin" color={c.pinkInk} />
              </div>
            ) : videos.length === 0 ? (
              <div style={{ ...ttCard(c), padding: 24, textAlign: "center" }}>
                <Video size={22} color={c.muted} />
                <div style={{ fontSize: 13, color: c.muted, marginTop: 10, lineHeight: 1.8 }}>
                  {videosMsg || t("لا توجد فيديوهات بعد.", "No videos yet.")}
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.75, margin: "0 0 12px" }}>
                  {t("اضغط فيديو لتكتب له ردّاً خاصاً. الفيديو بلا ردّ خاص يأخذ الردّ الافتراضي.",
                     "Tap a video to write a reply just for it. A video without one uses the default reply.")}
                </p>
                {/* A TikTok profile grid: three columns, hairline gutters. */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
                  {videos.map((v) => {
                    const o = (config?.post_overrides || {})[v.id];
                    const custom = !!o && !o.disabled && (
                      (o.groups?.length ?? 0) > 0 ||
                      (o.public_replies?.some((x) => (x || "").trim()) ?? false) ||
                      !!o.ai
                    );
                    return (
                      <button key={v.id} onClick={() => setEditingVideo(v)}
                        style={{ ...ttStage(), borderRadius: 4, padding: 0, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        {v.thumbnail
                          ? <img src={v.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ position: "absolute", inset: 0, padding: 7, fontSize: 10, color: "rgba(255,255,255,.72)", textAlign: "start" }}>{v.caption.slice(0, 50)}</div>}
                        <div style={{ position: "absolute", inset: 0, background: TT_SCRIM }} />
                        {custom && (
                          <span style={{ position: "absolute", top: 5, insetInlineEnd: 5, display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,.55)", borderRadius: 3, padding: "2px 5px", fontSize: 8.5, fontWeight: 800, color: "#fff" }}>
                            <span style={{ width: 5, height: 5, borderRadius: 999, background: TT_PINK }} />
                            {t("ردّ خاص", "Custom")}
                          </span>
                        )}
                        {v.caption && (
                          <span style={{ position: "absolute", bottom: 5, insetInlineStart: 5, insetInlineEnd: 5, fontSize: 9.5, color: "#fff", textShadow: "0 1px 2px #000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>
                            {v.caption}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {videosMore && (
                  <button onClick={loadMoreVideos} disabled={videosLoading}
                    style={{ ...ttSecondary(c), width: "100%", marginTop: 12 }}>
                    {videosLoading ? <Loader2 size={15} className="spin" /> : null}
                    {t("حمّل المزيد", "Load more")}
                  </button>
                )}
              </>
            )}

            {/*
              A sheet over the grid rather than a block appended to the page. Tapping a
              video and then having to scroll to the bottom to find its settings is the
              kind of thing that makes an owner give up on the feature.
            */}
            {editingVideo && (
              <div
                onClick={() => setEditingVideo(null)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 80, display: "flex", alignItems: "flex-end" }}>
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: c.surface, borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 680, margin: "0 auto", maxHeight: "88vh", overflowY: "auto", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                    <div style={{ ...ttStage(), width: 46, flexShrink: 0, borderRadius: 7 }}>
                      {editingVideo.thumbnail && (
                        <img src={editingVideo.thumbnail} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, fontSize: 13, color: c.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {editingVideo.caption || t("فيديو", "Video")}
                    </div>
                  </div>
                  <PostOverrideEditor
                    initial={(config?.post_overrides || {})[editingVideo.id]}
                    onSave={(v) => saveVideoOverride(editingVideo.id, v)}
                    onClose={() => setEditingVideo(null)}
                    c={bot} t={t} accent={c.pinkInk}
                    unitLabel={t("الفيديو", "video")}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SMART REPLY: keyword groups, banned words, catalog, AI ─────── */}
        {tab === "smart" && config && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Keyword groups: different answers for different questions. */}
            <div style={{ ...ttCard(c), padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {t("مجموعات الكلمات", "Keyword groups")}
              </div>
              <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7, margin: "0 0 12px" }}>
                {t("ردّ مختلف لكل نوع سؤال: من يسأل عن السعر يأخذ السعر، ومن يسأل عن الفرع يأخذ العنوان.",
                   "A different answer per kind of question: price questions get the price, location questions get the address.")}
              </p>
              <ReplyGroupsEditor
                groups={groups} onChange={setGroups}
                c={bot} t={t} accent={c.pinkInk}
              />
              <button onClick={() => patch({ reply_groups: groups })}
                style={{ ...ttSecondary(c), width: "100%", marginTop: 12 }}>
                <Save size={15} /> {t("حفظ المجموعات", "Save groups")}
              </button>
            </div>

            {/* Moderation. */}
            <div style={{ ...ttCard(c), padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <ShieldBan size={16} color={c.pinkInk} /> {t("الكلمات المحظورة", "Banned words")}
              </div>
              <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7, margin: "0 0 12px" }}>
                {t("التعليق الذي يحتوي إحداها لا يُردّ عليه — يُخفى أو يُحذف حسب اختيارك.",
                   "A comment containing one of these is never answered — it is hidden or deleted, as you choose.")}
              </p>
              <BannedWordsEditor
                words={banned} action={bannedAction}
                onWords={setBanned} onAction={setBannedAction}
                c={bot} t={t}
              />
              <button
                onClick={() => patch({
                  banned_words: banned.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean),
                  banned_action: bannedAction,
                })}
                style={{ ...ttSecondary(c), width: "100%", marginTop: 12 }}>
                <Save size={15} /> {t("حفظ", "Save")}
              </button>
            </div>

            {/* The catalog: the free, deterministic answer that runs before the AI. */}
            <div style={{ ...ttCard(c), padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Package size={16} color={c.pinkInk} /> {t("مطابقة المنتجات", "Product matching")}
              </div>
              <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7, margin: "0 0 12px" }}>
                {t("يتعرّف على المنتج من اسمه في التعليق أو من صورة الفيديو، فيردّ بسعره مباشرة — بلا تكلفة وبلا ذكاء اصطناعي.",
                   "It recognises the product from its name in the comment or the video's image and answers with its price — free, and without the AI.")}
              </p>
              <CatalogPanel
                pageId={config.page_id}
                platform="tiktok"
                mode={config.catalog_match || "off"}
                onMode={(m) => patch({ catalog_match: m })}
                c={bot} t={t} accent={c.pinkInk}
              />
            </div>

            {/* The AI, last — and said to be last, because that is what keeps it cheap. */}
            <div style={{ ...ttCard(c), padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Sparkles size={16} color={c.cyanInk} /> {t("ردّ الذكاء الاصطناعي", "AI reply")}
              </div>
              <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7, margin: "0 0 12px" }}>
                {t("يُستدعى أخيراً فقط: بعد المجموعات والقواعد والمنتجات. فما تجيب عنه الإعدادات مجاناً لا يُستهلك فيه ذكاء اصطناعي.",
                   "Called last only: after the groups, the rules and the products. Anything your settings answer for free never reaches it.")}
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={!!config.ai_enabled}
                  onChange={(e) => patch({ ai_enabled: e.target.checked })} />
                {t("فعّل الردّ الذكي لما لا تطابقه أي قاعدة", "Let AI answer what no rule matched")}
              </label>
              {config.ai_enabled && (
                <>
                  <div style={{ fontSize: 12, color: c.muted, margin: "13px 0 6px" }}>
                    {t("شخصية الردّ (اختياري)", "Reply persona (optional)")}
                  </div>
                  <textarea
                    defaultValue={config.ai_persona || ""}
                    onBlur={(e) => patch({ ai_persona: e.target.value })}
                    rows={2}
                    placeholder={t("مثال: ردّ بلهجة ليبية ودودة ومختصرة", "e.g. reply in warm, brief Libyan Arabic")}
                    style={{ ...ttInput(c), resize: "vertical" }} />
                </>
              )}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div style={{ ...ttCard(c), padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Settings2 size={16} color={c.pinkInk} /> {t("الإعدادات", "Settings")}
            </div>
            {/*
              Real-time delivery is registered automatically when an account links —
              it is app-level and benefits every account, so making each owner find a
              switch for it was the wrong default. This reports the state, and only
              offers a button when the automatic registration did not take.
            */}
            <div style={{ background: webhook?.subscribed ? `${c.ok}14` : `${c.warn}14`, border: `1px solid ${webhook?.subscribed ? `${c.ok}55` : `${c.warn}55`}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700 }}>
                <Radio size={15} color={webhook?.subscribed ? c.ok : c.warn} />
                {webhook?.subscribed
                  ? t("الردّ الفوري مُفعّل تلقائياً", "Instant replies are on")
                  : t("الردّ الفوري غير مُفعّل", "Instant replies are off")}
              </div>
              <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.75, margin: "8px 0 0" }}>
                {webhook?.subscribed
                  ? t("يصل التعليق لحظة نشره فيردّ البوت خلال ثوانٍ. لا يحتاج أي ضبط منك.",
                       "A comment reaches us the moment it is posted and the bot answers within seconds. Nothing for you to set.")
                  : t("تعذّر التفعيل التلقائي. المسح اليومي يغطّيك مؤقتاً — أعد المحاولة لتعود الردود فورية.",
                       "Automatic setup did not take. The daily sweep covers you meanwhile — retry to get replies back to seconds.")}
              </p>
              {!webhook?.subscribed && (
                <button onClick={enableInstant} disabled={hooking}
                  style={{ ...ttPrimary(rtl, hooking), width: "100%", marginTop: 12, padding: "10px 0", fontSize: 14 }}>
                  {hooking ? <Loader2 size={15} className="spin" /> : <Radio size={15} />}
                  {t("أعد المحاولة", "Retry")}
                </button>
              )}
            </div>

            {config ? (
              <div style={{ display: "grid", gap: 12 }}>
                {/*
                  Pacing. These exist in the engine and always have, but nothing could
                  set them — so every account ran on the defaults. They are the
                  anti-block controls, which is why they are stated in those terms
                  rather than as bare numbers.
                */}
                <div style={{ background: c.surface2, borderRadius: 12, padding: 13 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    {t("التهدئة — الحماية من الحظر", "Pacing — anti-block protection")}
                  </div>
                  <p style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.7, margin: "0 0 11px" }}>
                    {t("الردّ الفوري على عشرات التعليقات دفعةً واحدة هو ما يوقف الحسابات. البوت ينتظر قليلاً بين ردّ وآخر، ويتوقّف عند سقف الدقيقة.",
                       "Answering dozens of comments at once is what gets accounts stopped. The bot waits a little between replies and stops at the per-minute cap.")}
                  </p>
                  <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                    <label style={{ flex: "1 1 92px", fontSize: 11.5, color: c.muted }}>
                      {t("أقلّ انتظار (ثانية)", "Min wait (s)")}
                      <input type="number" min={0} max={60} defaultValue={config.min_delay_sec ?? 2}
                        onBlur={(e) => patch({ min_delay_sec: Number(e.target.value) })}
                        style={{ ...ttInput(c), marginTop: 5 }} />
                    </label>
                    <label style={{ flex: "1 1 92px", fontSize: 11.5, color: c.muted }}>
                      {t("أكثر انتظار (ثانية)", "Max wait (s)")}
                      <input type="number" min={0} max={120} defaultValue={config.max_delay_sec ?? 6}
                        onBlur={(e) => patch({ max_delay_sec: Number(e.target.value) })}
                        style={{ ...ttInput(c), marginTop: 5 }} />
                    </label>
                    <label style={{ flex: "1 1 110px", fontSize: 11.5, color: c.muted }}>
                      {t("سقف الردود بالدقيقة", "Replies per minute")}
                      <input type="number" min={1} max={60} defaultValue={config.throttle_per_min ?? 20}
                        onBlur={(e) => patch({ throttle_per_min: Number(e.target.value) })}
                        style={{ ...ttInput(c), marginTop: 5 }} />
                    </label>
                  </div>
                </div>

                {/* Each switch says what it DOES, not just what it is called — the
                    difference between "likes comments" and knowing the bot will
                    publicly like every comment it answers. */}
                {([
                  ["reply_public",
                    t("الردّ العلني على التعليق", "Public reply on the comment"),
                    t("ينشر ردّاً ظاهراً تحت التعليق", "Posts a visible reply under the comment")],
                  ["like_comments",
                    t("الإعجاب بالتعليق", "Like the comment"),
                    t("يضيف إعجاباً على كل تعليق يردّ عليه", "Likes every comment it answers")],
                  ["mention_author",
                    t("ابدأ الردّ باسم صاحب التعليق", "Open with the commenter's name"),
                    t("يجعل الردّ شخصياً بدل أن يبدو آلياً", "Makes the reply personal instead of robotic")],
                  ["once_per_user",
                    t("ردّ واحد لكل شخص في الفيديو", "One reply per person per video"),
                    t("من يعلّق خمس مرات يأخذ ردّاً واحداً", "Someone who comments five times gets one reply")],
                ] as const).map(([k, label, hint]) => (
                  <label key={k} style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!config[k as keyof Config]}
                      style={{ marginTop: 3, flexShrink: 0 }}
                      onChange={(e) => patch({ [k]: e.target.checked })} />
                    <span>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: c.text }}>{label}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: c.muted, marginTop: 2, lineHeight: 1.6 }}>{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7 }}>
                {t("تظهر الإعدادات بعد ربط حساب تيك توك.", "Settings appear once a TikTok account is linked.")}
              </div>
            )}
          </div>
        )}
      </div>

      {sellable && (
        <SubscribeBar
          priceLyd={st?.bot.priceLyd ?? null} c={c} t={t} rtl={rtl}
          onSubscribe={() => router.push("/subscriptions?product=tiktok_bot")}
          note={t("القواعد والتجربة مجاناً — تشغيل البوت بالاشتراك",
                  "Rules and the try-out are free — running the bot needs a subscription")}
        />
      )}
    </div>
  );
}

function RuleCard({
  rule, c, t, rtl, onSave, onDelete,
}: {
  rule: Rule; c: ReturnType<typeof tt>; t: (a: string, e: string) => string; rtl: boolean;
  onSave: (r: Rule) => void; onDelete: () => void;
}) {
  const [kw, setKw] = useState((rule.keywords || []).join("، "));
  const [reply, setReply] = useState(rule.public_reply || "");

  return (
    <div style={{ ...ttCard(c), padding: 14 }}>
      <label style={{ display: "block", fontSize: 11.5, color: c.muted, marginBottom: 5 }}>
        {t("الكلمات (افصل بفاصلة)", "Keywords (comma separated)")}
      </label>
      <input value={kw} onChange={(e) => setKw(e.target.value)} style={ttInput(c)} />

      <label style={{ display: "block", fontSize: 11.5, color: c.muted, margin: "11px 0 5px" }}>
        {t("الردّ العلني", "Public reply")}
      </label>
      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2}
        style={{ ...ttInput(c), resize: "vertical" }} />

      <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
        <button
          onClick={() => onSave({
            ...rule,
            keywords: kw.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean),
            public_reply: reply,
          })}
          style={{ ...ttSecondary(c), flex: 1, padding: "9px 0", fontSize: 13 }}>
          <Save size={14} /> {t("حفظ", "Save")}
        </button>
        <button onClick={onDelete} aria-label={t("حذف", "Delete")}
          style={{ background: "transparent", border: `1.5px solid ${c.border}`, borderRadius: 10, padding: "9px 13px", color: c.danger, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function TikTokBotPage() {
  return (
    <Suspense fallback={null}>
      <TikTokBotInner />
    </Suspense>
  );
}
