"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Bot, MessageSquare, Users, Activity,
  Settings2, Plus, Trash2, Save, AlertTriangle, Upload, X,
  Sparkles, CreditCard, Power,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

const GRADIENT = "linear-gradient(135deg, #0f0f1a 0%, #0d1b2a 100%)";
const BLUE = "#1877f2", GREEN = "#22c55e", CARD = "rgba(255,255,255,0.04)", BORDER = "rgba(255,255,255,0.08)";

interface Attachment { type: "image" | "file"; url: string; }
interface Rule {
  id: string; name: string | null; keywords: string[]; match_type: string;
  public_reply: string | null; private_reply: string | null; attachments: Attachment[];
  enabled: boolean; priority: number;
}
interface Config {
  id: string; enabled: boolean; reply_public: boolean; reply_private: boolean;
  ai_enabled: boolean; ai_persona: string | null; default_public_reply: string | null;
  throttle_per_min: number; webhook_subscribed: boolean;
}
interface Sub { status: string; expires_at: string | null; }
interface Token { id: string; label: string | null; status: string; cooldown_until: string | null; fail_count: number; last_used_at: string | null; }
interface LogRow { id: string; comment_id: string; commenter_name: string | null; comment_message: string | null; public_status: string; private_status: string; matched_rule_id: string | null; error: string | null; created_at: string; }

function subActive(s: Sub | null): boolean {
  return !!s && s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());
}

export default function BotManage() {
  const router = useRouter();
  const params = useParams();
  const pageId = String(params.pageId);
  const { t, rtl } = useLang();
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [loading, setLoading] = useState(true);
  const [pageName, setPageName] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [price, setPrice] = useState(50);
  const [tab, setTab] = useState<"settings" | "rules" | "accounts" | "activity">("rules");
  const [toast, setToast] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    const [cfg, st] = await Promise.all([
      fetch("/api/bot/configs").then((r) => r.json()).catch(() => ({ pages: [] })),
      fetch("/api/bot/settings").then((r) => r.json()).catch(() => ({ monthly_price_lyd: 50 })),
    ]);
    setPrice(Number(st.monthly_price_lyd ?? 50));
    const row = (cfg.pages || []).find((p: { page_id: string }) => p.page_id === pageId);
    if (row) {
      setPageName(row.page_name || pageId);
      setSub(row.subscription);
      if (row.config) setConfig(row.config);
      else {
        // No config yet — create one so the console is usable.
        const created = await fetch("/api/bot/configs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId }),
        }).then((r) => r.json());
        setConfig(created.config);
      }
    }
    setLoading(false);
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  async function patchConfig(patch: Partial<Config>) {
    if (!config) return;
    const res = await fetch("/api/bot/configs", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) { flash(data.message || data.error || t("خطأ", "Error")); return false; }
    setConfig(data.config);
    return true;
  }

  async function subscribe() {
    setSubscribing(true);
    const res = await fetch("/api/bot/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    });
    const data = await res.json();
    setSubscribing(false);
    if (!res.ok) { flash(data.message || t("فشل الاشتراك", "Subscription failed")); return; }
    setSub(data.subscription);
    flash(t("تم الاشتراك بنجاح ✅", "Subscribed ✅"));
  }

  const active = subActive(sub);
  const running = !!config?.enabled && active;

  if (loading) {
    return <div style={{ minHeight: "100vh", background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={34} color={BLUE} className="spin" /></div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: GRADIENT, color: "#fff", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", paddingBottom: 80 }}>
      <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/bot")} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Back size={18} /> {t("رجوع", "Back")}
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Bot size={19} color={BLUE} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pageName}</span>
        </h1>
        <div style={{ marginInlineStart: "auto" }}><LangToggle /></div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px" }}>
        {/* Subscription / power bar */}
        <div style={{ background: running ? `${GREEN}14` : CARD, border: `1px solid ${running ? `${GREEN}44` : BORDER}`, borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Power size={20} color={running ? GREEN : "#64748b"} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {running ? t("البوت يعمل الآن", "Bot is running") : active ? t("مشترك — البوت متوقف", "Subscribed — bot is off") : t("غير مشترك", "Not subscribed")}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
              {active && sub?.expires_at
                ? t(`ينتهي الاشتراك: ${new Date(sub.expires_at).toLocaleDateString("ar-LY")}`, `Renews/expires: ${new Date(sub.expires_at).toLocaleDateString("en-GB")}`)
                : t(`${price} د.ل شهرياً`, `${price} LYD / month`)}
            </div>
          </div>
          {!active ? (
            <button onClick={subscribe} disabled={subscribing}
              style={{ background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 11, padding: "11px 20px", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {subscribing ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />}
              {t(`اشترك — ${price} د.ل`, `Subscribe — ${price} LYD`)}
            </button>
          ) : (
            <Toggle on={!!config?.enabled} onChange={(v) => patchConfig({ enabled: v }).then((ok) => ok && flash(v ? t("تم التشغيل", "Turned on") : t("تم الإيقاف", "Turned off")))} />
          )}
        </div>

        {active && sub?.expires_at && new Date(sub.expires_at).getTime() - Date.now() < 3 * 86400000 && (
          <div style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#fbbf24", display: "flex", gap: 8 }}>
            <AlertTriangle size={16} /> {t("اشتراكك على وشك الانتهاء — جدّد لتفادي توقف البوت", "Your subscription is expiring soon — renew to avoid downtime")}
            <button onClick={subscribe} style={{ marginInlineStart: "auto", background: "none", border: "none", color: "#fde68a", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{t("تجديد", "Renew")}</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto" }}>
          {([
            ["rules", MessageSquare, t("القواعد", "Rules")],
            ["settings", Settings2, t("الإعدادات", "Settings")],
            ["accounts", Users, t("الحسابات", "Accounts")],
            ["activity", Activity, t("النشاط", "Activity")],
          ] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ background: tab === k ? `${BLUE}22` : "transparent", border: `1px solid ${tab === k ? `${BLUE}55` : BORDER}`, borderRadius: 10, padding: "9px 15px", color: tab === k ? "#fff" : "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {config && tab === "rules" && <RulesTab configId={config.id} flash={flash} t={t} />}
        {config && tab === "settings" && <SettingsTab config={config} patch={patchConfig} t={t} />}
        {config && tab === "accounts" && <AccountsTab configId={config.id} t={t} />}
        {config && tab === "activity" && <ActivityTab configId={config.id} t={t} />}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, insetInlineStart: "50%", transform: "translateX(-50%)", background: "#1e293b", border: `1px solid ${BLUE}55`, borderRadius: 12, padding: "12px 22px", fontSize: 14, fontWeight: 700, zIndex: 50, boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>{toast}</div>
      )}
      <style>{`@keyframes spin-anim { to { transform: rotate(360deg); } } .spin { animation: spin-anim 1s linear infinite; } input, textarea, select { font-family: inherit; }`}</style>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 52, height: 30, borderRadius: 20, border: "none", cursor: "pointer", background: on ? GREEN : "#334155", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, insetInlineStart: on ? 25 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .2s" }} />
    </button>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────
type TF = (ar: string, en: string) => string;
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingsTab({ config, patch, t }: { config: Config; patch: (p: Partial<Config>) => Promise<boolean>; t: TF }) {
  const [reply, setReply] = useState(config.default_public_reply || "");
  const [persona, setPersona] = useState(config.ai_persona || "");
  const [throttle, setThrottle] = useState(config.throttle_per_min);

  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "6px 20px" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={box}>
        <Row label={t("الرد العلني على التعليق", "Public reply on the comment")} hint={t("نشر رد ظاهر تحت التعليق", "Post a visible reply under the comment")}>
          <Toggle on={config.reply_public} onChange={(v) => patch({ reply_public: v })} />
        </Row>
        <Row label={t("الرد الخاص (رسالة)", "Private reply (DM)")} hint={t("إرسال السعر والتفاصيل في الخاص", "Send price & details in a private message")}>
          <Toggle on={config.reply_private} onChange={(v) => patch({ reply_private: v })} />
        </Row>
        <Row label={t("الردود الذكية (AI)", "Smart AI replies")} hint={t("رد بالذكاء الاصطناعي عند عدم مطابقة أي قاعدة", "Use AI when no keyword rule matches")}>
          <Toggle on={config.ai_enabled} onChange={(v) => patch({ ai_enabled: v })} />
        </Row>
        <Row label={t("سقف الردود بالدقيقة", "Replies per minute cap")} hint={t("حماية من الحظر عند التعليقات الكثيرة", "Anti-block protection during comment bursts")}>
          <input type="number" min={1} max={60} value={throttle}
            onChange={(e) => setThrottle(Number(e.target.value))}
            onBlur={() => throttle !== config.throttle_per_min && patch({ throttle_per_min: throttle })}
            style={{ width: 70, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 10px", color: "#fff", textAlign: "center" }} />
        </Row>
      </div>

      <div style={{ ...box, padding: 20 }}>
        <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>{t("نص الرد العلني الافتراضي", "Default public reply text")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder={t("تمّت مراسلتك في الخاص ✅", "We've messaged you privately ✅")}
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: "#fff" }} />
          <button onClick={() => patch({ default_public_reply: reply })}
            style={{ background: `${BLUE}22`, border: `1px solid ${BLUE}55`, borderRadius: 9, padding: "0 16px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
            <Save size={15} /> {t("حفظ", "Save")}
          </button>
        </div>
      </div>

      {config.ai_enabled && (
        <div style={{ ...box, padding: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Sparkles size={15} color={BLUE} /> {t("شخصية البوت (للـ AI)", "Bot persona (for AI)")}</label>
          <textarea value={persona} onChange={(e) => setPersona(e.target.value)}
            onBlur={() => persona !== (config.ai_persona || "") && patch({ ai_persona: persona })}
            rows={4} placeholder={t("مثال: أنت مساعد مبيعات لمتجر إلكترونيات، ردودك مختصرة وودّية بالعربية.", "e.g. You are a sales assistant for an electronics store; keep replies short and friendly.")}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: "#fff", boxSizing: "border-box", resize: "vertical" }} />
        </div>
      )}
    </div>
  );
}

// ── Rules tab ────────────────────────────────────────────────────────────────
const MATCH_LABELS = (t: TF): [string, string][] => [
  ["any_contains", t("يحتوي أي كلمة", "Contains any word")],
  ["all_contains", t("يحتوي كل الكلمات", "Contains all words")],
  ["exact", t("مطابقة تامة", "Exact match")],
  ["regex", t("تعبير نمطي", "Regex")],
  ["catch_all", t("يلتقط كل التعليقات", "Catch-all")],
];

function RulesTab({ configId, flash, t }: { configId: string; flash: (m: string) => void; t: TF }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/bot/rules?configId=${configId}`).then((r) => r.json());
    setRules(data.rules || []);
    setLoading(false);
  }, [configId]);
  useEffect(() => { loadRules(); }, [loadRules]);

  function newRule() {
    setEditing({ id: "", name: "", keywords: [], match_type: "any_contains", public_reply: "", private_reply: "", attachments: [], enabled: true, priority: 0 });
  }

  async function del(id: string) {
    if (!confirm(t("حذف هذه القاعدة؟", "Delete this rule?"))) return;
    await fetch(`/api/bot/rules?id=${id}`, { method: "DELETE" });
    setRules((r) => r.filter((x) => x.id !== id));
  }

  if (editing) return <RuleEditor rule={editing} configId={configId} t={t} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadRules(); flash(t("تم الحفظ", "Saved")); }} />;

  return (
    <div>
      <button onClick={newRule}
        style={{ width: "100%", background: `linear-gradient(135deg, ${BLUE}, #6b46c1)`, border: "none", borderRadius: 12, padding: "13px 0", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <Plus size={17} /> {t("قاعدة جديدة", "New rule")}
      </button>

      {loading ? <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}><Loader2 size={24} className="spin" /></div>
        : rules.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            {t("لا قواعد بعد. أنشئ قاعدة: مثلاً كلمة \"السعر\" → رد بالسعر في الخاص.", "No rules yet. Create one: e.g. keyword \"price\" → reply with the price privately.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rules.map((r) => (
              <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name || (r.keywords[0] ?? t("قاعدة", "Rule"))}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.match_type === "catch_all" ? t("كل التعليقات", "All comments") : (r.keywords.join("، ") || "—")}
                    </div>
                  </div>
                  {!r.enabled && <span style={{ fontSize: 11, color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 6 }}>{t("متوقفة", "Off")}</span>}
                  {r.attachments?.length > 0 && <span style={{ fontSize: 11, color: BLUE }}>{r.attachments.length} 📎</span>}
                  <button onClick={() => setEditing(r)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 10px", color: "#cbd5e1", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{t("تعديل", "Edit")}</button>
                  <button onClick={() => del(r.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "6px 8px", color: "#f87171", cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function RuleEditor({ rule, configId, t, onClose, onSaved }: { rule: Rule; configId: string; t: TF; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(rule.name || "");
  const [kwText, setKwText] = useState(rule.keywords.join("، "));
  const [matchType, setMatchType] = useState(rule.match_type);
  const [pub, setPub] = useState(rule.public_reply || "");
  const [priv, setPriv] = useState(rule.private_reply || "");
  const [atts, setAtts] = useState<Attachment[]>(rule.attachments || []);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [priority, setPriority] = useState(rule.priority);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/bot/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.url) setAtts((a) => [...a, { type: data.type, url: data.url }]);
  }

  async function save() {
    setSaving(true);
    const keywords = kwText.split(/[،,\n]/).map((s) => s.trim()).filter(Boolean);
    const payload = { name, keywords, match_type: matchType, public_reply: pub, private_reply: priv, attachments: atts, enabled, priority };
    if (rule.id) {
      await fetch("/api/bot/rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, ...payload }) });
    } else {
      await fetch("/api/bot/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ configId, ...payload }) });
    }
    setSaving(false);
    onSaved();
  }

  const inp: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "11px 14px", color: "#fff", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 7, marginTop: 16 };

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{rule.id ? t("تعديل القاعدة", "Edit rule") : t("قاعدة جديدة", "New rule")}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={20} /></button>
      </div>

      <label style={lbl}>{t("اسم القاعدة (اختياري)", "Rule name (optional)")}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder={t("استفسار السعر", "Price inquiry")} />

      <label style={lbl}>{t("نوع المطابقة", "Match type")}</label>
      <select value={matchType} onChange={(e) => setMatchType(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
        {MATCH_LABELS(t).map(([v, l]) => <option key={v} value={v} style={{ background: "#0f172a" }}>{l}</option>)}
      </select>

      {matchType !== "catch_all" && (
        <>
          <label style={lbl}>{t("الكلمات المفتاحية (افصل بفاصلة)", "Keywords (comma-separated)")}</label>
          <input value={kwText} onChange={(e) => setKwText(e.target.value)} style={inp} placeholder={t("السعر، بكم، كم سعر، متوفر", "price, how much, available")} />
        </>
      )}

      <label style={lbl}>{t("الرد العلني (اختياري — يستبدل الافتراضي)", "Public reply (optional — overrides default)")}</label>
      <input value={pub} onChange={(e) => setPub(e.target.value)} style={inp} placeholder={t("تمّت مراسلتك في الخاص ✅", "We've DMed you ✅")} />

      <label style={lbl}>{t("الرسالة الخاصة (السعر/التفاصيل)", "Private message (price/details)")}</label>
      <textarea value={priv} onChange={(e) => setPriv(e.target.value)} rows={4} style={{ ...inp, resize: "vertical" }} placeholder={t("السعر 250 د.ل، متوفر، للطلب أرسل عنوانك 📦", "Price is 250 LYD, in stock. Send your address to order 📦")} />

      <label style={lbl}>{t("مرفقات (صور/ملفات)", "Attachments (images/files)")}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {atts.map((a, i) => (
          <div key={i} style={{ position: "relative" }}>
            {a.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover", border: `1px solid ${BORDER}` }} />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 10, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#94a3b8" }}>PDF</div>
            )}
            <button onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}
              style={{ position: "absolute", top: -6, insetInlineEnd: -6, background: "#ef4444", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
          </div>
        ))}
        <label style={{ width: 60, height: 60, borderRadius: 10, border: `1px dashed ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8" }}>
          {uploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <Toggle on={enabled} onChange={setEnabled} /> {t("مفعّلة", "Enabled")}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginInlineStart: "auto" }}>
          {t("الأولوية", "Priority")}
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} style={{ width: 60, ...inp, padding: "8px 10px", textAlign: "center" }} />
        </label>
      </div>

      <button onClick={save} disabled={saving}
        style={{ width: "100%", marginTop: 20, background: `linear-gradient(135deg, ${GREEN}, #16a34a)`, border: "none", borderRadius: 11, padding: "13px 0", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} {t("حفظ القاعدة", "Save rule")}
      </button>
    </div>
  );
}

// ── Accounts (rotation pool) tab ─────────────────────────────────────────────
function AccountsTab({ configId, t }: { configId: string; t: TF }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/bot/tokens?configId=${configId}`).then((r) => r.json());
    setTokens(data.tokens || []);
    setLoading(false);
  }, [configId]);
  useEffect(() => { loadTokens(); }, [loadTokens]);

  async function toggle(tk: Token) {
    const status = tk.status === "dead" ? "active" : "dead";
    await fetch("/api/bot/tokens", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tk.id, status }) });
    loadTokens();
  }
  async function remove(id: string) {
    if (!confirm(t("إزالة هذا الحساب من المجموعة؟", "Remove this account from the pool?"))) return;
    await fetch(`/api/bot/tokens?id=${id}`, { method: "DELETE" });
    setTokens((x) => x.filter((tk) => tk.id !== id));
  }

  const statusColor: Record<string, string> = { active: GREEN, cooldown: "#fbbf24", dead: "#94a3b8" };
  const statusLabel = (s: string) => s === "active" ? t("نشط", "Active") : s === "cooldown" ? t("تبريد مؤقت", "Cooling down") : t("موقوف", "Disabled");

  return (
    <div>
      <div style={{ background: `${BLUE}12`, border: `1px solid ${BLUE}33`, borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "#cbd5e1", lineHeight: 1.8 }}>
        {t(
          "اربط عدة حسابات فيسبوك (كلها مشرفة على نفس الصفحة) ليوزّع البوت الردود بينها ويبدّل تلقائياً عند حدوث حظر مؤقت — حماية من إيقاف الحساب عند كثرة التعليقات.",
          "Link several Facebook accounts (all admins of the same Page) so the bot spreads replies across them and auto-switches on a temporary block — protection against getting blocked during comment bursts.",
        )}
      </div>

      <button onClick={() => { window.location.href = "/ads/connect"; }}
        style={{ width: "100%", background: `linear-gradient(135deg, ${BLUE}, #1565c0)`, border: "none", borderRadius: 12, padding: "13px 0", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <Plus size={17} /> {t("ربط حساب فيسبوك إضافي", "Link another Facebook account")}
      </button>

      {loading ? <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}><Loader2 size={24} className="spin" /></div>
        : tokens.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            {t("لا حسابات في المجموعة بعد", "No accounts in the pool yet")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tokens.map((tk) => (
              <div key={tk.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor[tk.status] || "#94a3b8", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tk.label || t("حساب", "Account")}</div>
                  <div style={{ fontSize: 12, color: statusColor[tk.status] || "#94a3b8", marginTop: 3 }}>
                    {statusLabel(tk.status)}{tk.fail_count > 0 ? ` · ${t("إخفاقات", "fails")}: ${tk.fail_count}` : ""}
                  </div>
                </div>
                <button onClick={() => toggle(tk)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", color: "#cbd5e1", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  {tk.status === "dead" ? t("تفعيل", "Enable") : t("إيقاف", "Disable")}
                </button>
                <button onClick={() => remove(tk.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "6px 8px", color: "#f87171", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Activity tab ─────────────────────────────────────────────────────────────
function ActivityTab({ configId, t }: { configId: string; t: TF }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<{ total: number; public_sent: number; private_sent: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bot/logs?configId=${configId}`).then((r) => r.json()).then((d) => {
      setLogs(d.logs || []); setStats(d.stats || null); setLoading(false);
    });
  }, [configId]);

  const badge = (s: string) => {
    const c = s === "sent" ? GREEN : s === "failed" ? "#ef4444" : "#64748b";
    const l = s === "sent" ? t("أُرسل", "sent") : s === "failed" ? t("فشل", "failed") : t("تخطّي", "skip");
    return <span style={{ fontSize: 11, color: c, background: `${c}18`, padding: "2px 7px", borderRadius: 6 }}>{l}</span>;
  };

  if (loading) return <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}><Loader2 size={24} className="spin" /></div>;

  return (
    <div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[[t("ردود خاصة", "DMs sent"), stats.private_sent, GREEN], [t("ردود علنية", "Public replies"), stats.public_sent, BLUE], [t("إخفاقات", "Failures"), stats.failed, "#ef4444"]].map(([l, v, c], i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v as number}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{l as string}</div>
            </div>
          ))}
        </div>
      )}
      {logs.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          {t("لا نشاط بعد — سيظهر هنا كل تعليق يرد عليه البوت", "No activity yet — every comment the bot replies to will appear here")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {logs.map((l) => (
            <div key={l.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{l.commenter_name || t("زائر", "Visitor")}</span>
                <span style={{ marginInlineStart: "auto", display: "flex", gap: 6 }}>{badge(l.public_status)}{badge(l.private_status)}</span>
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.comment_message || "—"}</div>
              {l.error && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{l.error}</div>}
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{new Date(l.created_at).toLocaleString(t("ar-LY", "en-GB"))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
