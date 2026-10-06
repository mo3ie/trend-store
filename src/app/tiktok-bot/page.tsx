"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Settings2, Plus, Trash2, Save,
  AlertCircle, CheckCircle, Radio, Video,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import { tt, ttCard, ttPrimary, ttSecondary, ttInput } from "@/lib/tiktokTheme";
import {
  AccountStrip, ScreenTitle, TabStrip, SubscribeBar, Chip,
} from "@/components/tiktok/TikTokKit";
import { ReplySimulator, ReplyThread, type ThreadValue } from "@/components/tiktok/ReplyThread";

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
  bot: { configured: boolean; enabled: boolean; rules: number; priceLyd: number | null };
}

interface Rule { id: string; keywords: string[]; public_reply: string | null; enabled: boolean; priority: number }

interface Config {
  id: string; enabled: boolean;
  default_public_reply: string | null;
  public_replies: string[] | null;
  like_comments: boolean;
  mention_author: boolean;
  once_per_user: boolean;
  banned_words: string[] | null;
  banned_action: string | null;
  catalog_match: string | null;
}

function TikTokBotInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = tt(light);
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [st, setSt] = useState<Status | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"try" | "rules" | "settings">("try");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  // Simulator
  const [probe, setProbe] = useState("");
  const [simReply, setSimReply] = useState<string | null>(null);
  const [simSource, setSimSource] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  // Default reply, as a thread
  const [thread, setThread] = useState<ThreadValue>({ variants: [""], like: false });
  const [saving, setSaving] = useState(false);

  const pageId = st?.account?.openId || "";
  const handle = st?.account?.handle || t("حسابك", "your account");

  const load = useCallback(async () => {
    const s = await fetch("/api/tiktok/status").then((r) => (r.status === 401 ? null : r.json()));
    if (!s) { router.push("/login?next=/tiktok-bot"); return; }
    if (!s.error) setSt(s);

    const d = await fetch("/api/tiktok/configs").then((r) => r.json()).catch(() => ({}));
    const cfg: Config | null = (d.accounts || []).map((a: { config: Config | null }) => a.config).find(Boolean) ?? null;
    if (cfg) {
      setConfig(cfg);
      setThread({
        variants: (cfg.public_replies?.length ? cfg.public_replies : [cfg.default_public_reply || ""]).slice(0, 3),
        like: !!cfg.like_comments,
      });
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
  // Shown only once an active plan gives this product a price — otherwise there is
  // nothing to buy and the bar would invite a purchase that cannot complete.
  const sellable = st?.bot.priceLyd !== null && st?.bot.priceLyd !== undefined;

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

        <TabStrip
          c={c} value={tab} onChange={setTab}
          tabs={[
            { key: "try" as const,      label: t("التجربة والردّ", "Try it & reply") },
            { key: "rules" as const,    label: `${t("القواعد", "Rules")}${rules.length ? ` (${rules.length})` : ""}` },
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

            {st?.account && (
              <button onClick={() => router.push(`/tiktok-bot/${st.account!.id}`)}
                style={{ ...ttSecondary(c), width: "100%", marginTop: 12 }}>
                <Video size={16} /> {t("ردود مخصّصة لكل فيديو", "Per-video custom replies")}
              </button>
            )}
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

        {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
        {tab === "settings" && (
          <div style={{ ...ttCard(c), padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Settings2 size={16} color={c.pinkInk} /> {t("الإعدادات", "Settings")}
            </div>
            {config ? (
              <div style={{ display: "grid", gap: 12 }}>
                {([
                  ["mention_author", t("ابدأ الردّ باسم صاحب التعليق", "Open the reply with the commenter's name")],
                  ["once_per_user", t("ردّ واحد لكل شخص في الفيديو", "One reply per person per video")],
                  ["enabled", t("البوت يعمل", "Bot is running")],
                ] as const).map(([k, label]) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!config[k as keyof Config]}
                      onChange={async (e) => {
                        const next = { ...config, [k]: e.target.checked } as Config;
                        setConfig(next);
                        const res = await fetch("/api/tiktok/configs", {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: config.id, [k]: e.target.checked }),
                        }).catch(() => null);
                        // Turning the bot ON needs an active subscription, so a
                        // refused toggle must snap back rather than lie about state.
                        if (!res || !res.ok) {
                          const d = await res?.json().catch(() => ({}));
                          setConfig(config);
                          setError(d?.message || t("تعذّر التغيير", "Could not change that"));
                        }
                      }} />
                    {label}
                  </label>
                ))}
                <div style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.7, marginTop: 4 }}>
                  {t("يتهدّأ البوت تلقائياً بين الردود حتى لا يُحظر الحساب — لا يحتاج ضبطاً.",
                     "The bot paces itself between replies so the account isn't blocked — nothing to configure.")}
                </div>
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
