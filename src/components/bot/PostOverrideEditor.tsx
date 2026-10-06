"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  BannedWordsEditor, ReplyGroupsEditor,
  type BotPalette, type ReplyGroup,
} from "@/components/bot/ReplySettings";

/**
 * The per-item reply editor — one post on Facebook, one video on TikTok.
 *
 * Built from the same group and banned-word editors the account-level settings
 * use, so a rule behaves identically wherever it was written. The live preview is
 * the point of the screen: the owner sees which group would catch a comment
 * before a real customer finds out the hard way.
 */

const GREEN = "#22c55e";

export interface PostOverrideValue {
  public_replies?: string[]; private_reply?: string;
  disabled?: boolean; like?: boolean;
  mode?: "all" | "groups"; groups?: ReplyGroup[]; inherit_groups?: boolean; ai?: boolean;
  banned_words?: string[]; banned_action?: "delete" | "hide" | "ignore";
  mention?: boolean; once_per_user?: boolean;
}

type TF = (ar: string, en: string) => string;

export function PostOverrideEditor({
  initial, onSave, onClose, c, t, accent, unitLabel,
}: {
  initial?: PostOverrideValue;
  onSave: (v: PostOverrideValue) => Promise<void> | void;
  onClose: () => void;
  c: BotPalette; t: TF; accent: string;
  /** What this override is attached to — "المنشور" or "الفيديو". */
  unitLabel: string;
}) {
  const inp: React.CSSProperties = {
    width: "100%", background: c.input, border: `1px solid ${c.border}`,
    borderRadius: 9, padding: "9px 12px", color: c.text, boxSizing: "border-box",
  };

  const [mode, setMode] = useState<"all" | "groups">(
    initial?.mode ?? ((initial?.groups?.length ?? 0) > 0 ? "groups" : "all"));
  const [groups, setGroups] = useState<ReplyGroup[]>(initial?.groups || []);
  const [inheritGroups, setInheritGroups] = useState(initial?.inherit_groups ?? true);
  const [pub, setPub] = useState((initial?.public_replies || []).join("\n"));
  const [priv, setPriv] = useState(initial?.private_reply || "");
  const [useAi, setUseAi] = useState(initial?.ai ?? false);
  const [banned, setBanned] = useState((initial?.banned_words || []).join("، "));
  const [bannedAction, setBannedAction] = useState<"delete" | "hide" | "ignore">(initial?.banned_action ?? "hide");
  const [mention, setMention] = useState(initial?.mention ?? true);
  const [oncePerUser, setOncePerUser] = useState(initial?.once_per_user ?? true);
  const [like, setLike] = useState(initial?.like ?? false);
  const [probe, setProbe] = useState("");
  const [saving, setSaving] = useState(false);

  // Mirrors the engine's normaliser, so the preview agrees with what will happen.
  const norm = (x: string) => (x || "").toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const probeHit = probe.trim()
    ? groups.find((g) => (g.keywords || []).map(norm).filter(Boolean).some((k) => norm(probe).includes(k))) || null
    : null;

  async function save() {
    setSaving(true);
    await onSave({
      mode,
      // A group with no keywords can never match, so it is dropped rather than saved.
      groups: groups
        .map((g) => ({ ...g, keywords: (g.keywords || []).map((k) => k.trim()).filter(Boolean) }))
        .filter((g) => g.keywords.length > 0),
      inherit_groups: inheritGroups,
      public_replies: pub.split("\n").map((x) => x.trim()).filter(Boolean),
      private_reply: priv.trim(),
      ai: useAi,
      banned_words: banned.split(/[،,\n]/).map((x) => x.trim()).filter(Boolean),
      banned_action: bannedAction,
      mention,
      once_per_user: oncePerUser,
      like,
    });
    setSaving(false);
  }

  const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 7, marginTop: 16 };

  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          {t(`ردّ خاص بهذا ${unitLabel}`, "Custom reply for this item")}
        </h3>
        <button onClick={onClose}
          style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", fontSize: 22, lineHeight: 1, fontFamily: "inherit" }}>
          ×
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {([["all", t("رد موحّد لكل التعليقات", "One reply for all")], ["groups", t("رد حسب الكلمات", "Reply by keyword")]] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            style={{ flex: 1, background: mode === m ? `${accent}33` : c.surface, border: `1px solid ${mode === m ? accent : c.border}`, borderRadius: 10, padding: "10px 0", color: c.text, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {mode === "groups" && (
        <div style={{ marginTop: 14 }}>
          <ReplyGroupsEditor groups={groups} onChange={setGroups} c={c} t={t} accent={accent} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5, color: c.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={inheritGroups} onChange={(e) => setInheritGroups(e.target.checked)} />
            {t("استخدم أيضاً المجموعات الافتراضية للحساب", "Also use the account's default groups")}
          </label>
          <div style={{ marginTop: 12 }}>
            <input value={probe} onChange={(e) => setProbe(e.target.value)}
              placeholder={t("جرّب تعليقاً هنا لترى أي مجموعة تلتقطه…", "Try a comment here to see which group catches it…")}
              style={inp} />
            {probe.trim() && (
              <div style={{ fontSize: 12, marginTop: 7, color: probeHit ? GREEN : "#f59e0b", lineHeight: 1.7 }}>
                {probeHit
                  ? `✅ ${t("تلتقطه المجموعة", "Caught by")}: ${probeHit.label || (probeHit.keywords || [])[0]}`
                  : useAi
                    ? `🤖 ${t("لا مجموعة تطابقه — سيرد الذكاء الاصطناعي", "No group matches — AI will answer")}`
                    : `⚠️ ${t("لا مجموعة تطابقه — سيُستخدم الرد الافتراضي أدناه", "No group matches — the default reply below is used")}`}
              </div>
            )}
          </div>
        </div>
      )}

      <label style={lbl}>{mode === "groups"
        ? t("الرد الافتراضي — لمن لا تطابقه أي مجموعة", "Default reply — for comments no group matched")
        : t("الرد العلني — سطر لكل نص للتنويع", "Public reply — one text per line for variety")}</label>
      <textarea value={pub} onChange={(e) => setPub(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />

      <label style={lbl}>{t("الرسالة التفصيلية (السعر/التفاصيل)", "Detailed message (price/details)")}</label>
      <textarea value={priv} onChange={(e) => setPriv(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 11, padding: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t("رد الذكاء الاصطناعي على ما لا تطابقه مجموعة", "Let AI answer comments no group matched")}</div>
          <div style={{ fontSize: 11.5, color: c.muted, marginTop: 3, lineHeight: 1.6 }}>
            {t("يقرأ التعليق ويرد حسبه، معتمداً على كتالوج منتجاتك. متاح في الباقة VIP.",
               "Reads the comment and answers from your product catalog. Available on the VIP plan.")}
          </div>
        </div>
      </label>

      <label style={lbl}>{t("الكلمات المحظورة", "Banned words")}</label>
      <BannedWordsEditor words={banned} action={bannedAction} onWords={setBanned} onAction={setBannedAction} c={c} t={t} />

      <div style={{ marginTop: 16, display: "grid", gap: 9 }}>
        {([
          [mention, setMention, t("ابدأ الرد باسم صاحب التعليق", "Open the reply with the commenter's name")],
          [oncePerUser, setOncePerUser, t("رد واحد لكل شخص هنا", "One reply per person here")],
          [like, setLike, t("إعجاب بالتعليقات هنا", "Like comments here")],
        ] as const).map(([val, set, label], i) => (
          <label key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: c.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={val as boolean} onChange={(e) => (set as (v: boolean) => void)(e.target.checked)} />
            {label as string}
          </label>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        style={{ width: "100%", marginTop: 20, background: `linear-gradient(135deg, ${GREEN}, #16a34a)`, border: "none", borderRadius: 11, padding: "13px 0", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}>
        {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} {t("حفظ", "Save")}
      </button>
    </div>
  );
}
