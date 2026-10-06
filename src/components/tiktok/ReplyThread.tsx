"use client";

import { useState } from "react";
import { Heart, Plus, Trash2, AlertCircle, Wand2 } from "lucide-react";
import {
  tt, TT_PINK, TT_CYAN, TT_COMMENT_MAX, type TikTokPalette,
} from "@/lib/tiktokTheme";

/**
 * The reply composer, drawn as the TikTok comment section itself.
 *
 * On Facebook the equivalent screen has two fields: a public reply and a private
 * message carrying the price. TikTok has no automated DM, so there is one field — and
 * a label saying "this is public" is the weak way to convey that. Instead the owner
 * types *into* a rendered comment thread, under a sample viewer comment, beside their
 * own avatar and a "Creator" pill. The fact never needs explaining because they can
 * see where the text lands.
 *
 * The slot Facebook spends on the DM becomes **reply variants**. That is not filler:
 * an identical reply under every comment looks like spam to viewers and to TikTok's
 * own moderation, so the bot rotates between them. A platform without DMs needs the
 * rotation more, not less.
 */

type TF = (ar: string, en: string) => string;

export interface ThreadValue {
  /** The rotation. Index 0 is the primary reply. */
  variants: string[];
  like: boolean;
}

const SAMPLE_VIEWERS = [
  ["ناصر", "روعة 😍"],
  ["سارة", "وين الفرع؟"],
];

export function ReplyThread({
  value, onChange, c, t, rtl, handle, avatarUrl, triggerComment, hasProduct, onInsertPrice,
}: {
  value: ThreadValue;
  onChange: (v: ThreadValue) => void;
  c: TikTokPalette; t: TF; rtl: boolean;
  handle: string; avatarUrl?: string | null;
  /** The comment the reply is answering — the owner's own probe text when they type one. */
  triggerComment: string;
  /** Whether a product/price is in play, which is what makes the price lint meaningful. */
  hasProduct?: boolean;
  onInsertPrice?: () => void;
}) {
  const [active, setActive] = useState(0);
  const variants = value.variants.length ? value.variants : [""];
  const current = variants[Math.min(active, variants.length - 1)] ?? "";

  const setVariant = (i: number, text: string) => {
    const next = [...variants];
    next[i] = text.slice(0, TT_COMMENT_MAX);
    onChange({ ...value, variants: next });
  };

  const addVariant = () => {
    if (variants.length >= 3) return;
    onChange({ ...value, variants: [...variants, ""] });
    setActive(variants.length);
  };

  const removeVariant = (i: number) => {
    if (variants.length <= 1) return;
    const next = variants.filter((_, n) => n !== i);
    onChange({ ...value, variants: next });
    setActive(Math.max(0, i - 1));
  };

  // The one place the absence of DMs is ever mentioned, and only as a reason: when a
  // product is in play and no variant carries a price, the price has nowhere else to go.
  const noPrice = !!hasProduct && !variants.some((v) => /\{السعر\}|\{price\}|\d/.test(v));

  const avatar = (url: string | null | undefined, size: number, fallback: string) =>
    url
      ? <img src={url} alt="" width={size} height={size} style={{ borderRadius: 999, objectFit: "cover", flexShrink: 0 }} />
      : <div style={{ width: size, height: size, borderRadius: 999, background: c.surface2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700, color: c.muted }}>{fallback}</div>;

  return (
    <div>
      <div style={{ fontSize: 11.5, color: c.muted, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
        👁 {t("يراه كل من يشاهد الفيديو", "Visible to everyone who watches the video")}
      </div>

      <div style={{ background: c.surface2, borderRadius: 12, padding: 13 }}>
        {/* Other viewers, dimmed: this is a busy comment section, not an empty form. */}
        {SAMPLE_VIEWERS.map(([name, text]) => (
          <div key={name} style={{ display: "flex", gap: 9, opacity: 0.5, marginBottom: 11 }}>
            {avatar(null, 28, name[0])}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: c.muted }}>{name}</div>
              <div style={{ fontSize: 13, color: c.text, marginTop: 2 }}>{text}</div>
            </div>
          </div>
        ))}

        {/* The comment being answered. */}
        <div style={{ display: "flex", gap: 9 }}>
          {avatar(null, 28, "؟")}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11.5, color: c.muted }}>{t("مشاهد", "A viewer")}</div>
            <div style={{ fontSize: 13, color: c.text, marginTop: 2 }}>
              {triggerComment.trim() || t("بكم هذا؟", "How much is this?")}
            </div>

            {/* The reply, threaded under it. The text IS the editable field. */}
            <div style={{ display: "flex", gap: 9, marginTop: 11, [rtl ? "paddingRight" : "paddingLeft"]: 11, borderInlineStart: `2px solid ${c.border}` }}>
              {avatar(avatarUrl, 26, handle[0]?.toUpperCase() || "T")}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, color: c.muted }}>@{handle}</span>
                  <span style={{ background: `${TT_PINK}22`, color: c.pinkInk, borderRadius: 4, padding: "1px 5px", fontSize: 9.5, fontWeight: 800 }}>
                    {t("صانع المحتوى", "Creator")}
                  </span>
                </div>
                <textarea
                  value={current}
                  onChange={(e) => setVariant(active, e.target.value)}
                  rows={2}
                  placeholder={t("اكتب الردّ… ضع السعر هنا", "Write the reply… put the price here")}
                  style={{
                    width: "100%", background: "transparent", border: "none", outline: "none",
                    color: c.text, fontSize: 13.5, lineHeight: 1.7, fontFamily: "inherit",
                    resize: "none", padding: "3px 0 0", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 13, fontSize: 11, color: c.muted }}>
                  <button type="button" onClick={() => onChange({ ...value, like: !value.like })}
                    title={t("إعجاب بالتعليق", "Like the comment")}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4, color: value.like ? c.pinkInk : c.muted, fontFamily: "inherit", fontSize: 11 }}>
                    <Heart size={12} fill={value.like ? TT_PINK : "none"} />
                    {value.like ? t("يُعجب", "Likes") : t("بدون إعجاب", "No like")}
                  </button>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: current.length > TT_COMMENT_MAX - 20 ? c.warn : c.muted }}>
                    {current.length}/{TT_COMMENT_MAX}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The rotation. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: c.muted }}>{t("صيغ بديلة", "Reply variants")}</span>
        {variants.map((v, i) => (
          <button key={i} type="button" onClick={() => setActive(i)}
            style={{
              width: active === i ? 22 : 9, height: 9, borderRadius: 999,
              background: active === i ? TT_PINK : c.border,
              border: "none", cursor: "pointer", padding: 0, transition: "width .12s",
            }}
            title={v.slice(0, 40) || t("فارغة", "empty")} />
        ))}
        {variants.length < 3 && (
          <button type="button" onClick={addVariant}
            style={{ background: "none", border: "none", cursor: "pointer", color: c.pinkInk, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: 0 }}>
            <Plus size={13} /> {t("أضف", "Add")}
          </button>
        )}
        {variants.length > 1 && (
          <button type="button" onClick={() => removeVariant(active)}
            style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, display: "inline-flex", alignItems: "center", fontFamily: "inherit", padding: 0, marginInlineStart: "auto" }}
            title={t("احذف هذه الصيغة", "Delete this variant")}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: c.muted, marginTop: 6, lineHeight: 1.65 }}>
        {t("يدوّر البوت بين الصيغ، فلا تظهر ردوده متطابقة تحت كل تعليق.",
           "The bot rotates between them, so its replies don't appear identical under every comment.")}
      </div>

      {/* Variable chips. */}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {["{السعر}", "{اسم المنتج}", "{رابط الطلب}", "{اسم المعلّق}"].map((tok) => (
          <button key={tok} type="button"
            onClick={() => setVariant(active, `${current}${current && !current.endsWith(" ") ? " " : ""}${tok}`)}
            style={{ background: c.surface2, border: `1px solid ${c.border}`, borderRadius: 999, padding: "5px 10px", fontSize: 11.5, color: c.cyanInk, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {tok}
          </button>
        ))}
      </div>

      {noPrice && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, background: `${TT_PINK}12`, border: `1px solid ${TT_PINK}44`, borderRadius: 10, padding: "10px 12px" }}>
          <AlertCircle size={15} color={c.pinkInk} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: c.text, lineHeight: 1.65 }}>
              {t("لا توجد رسائل خاصة على تيك توك — ضع السعر في الردّ نفسه.",
                 "There are no private messages on TikTok — put the price in the reply itself.")}
            </div>
            {onInsertPrice && (
              <button type="button" onClick={onInsertPrice}
                style={{ background: "none", border: "none", padding: 0, marginTop: 6, cursor: "pointer", color: c.pinkInk, fontSize: 12, fontWeight: 800, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Wand2 size={12} /> {t("أضف السعر", "Add the price")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The live simulator: a black panel where the owner types a comment as a viewer and
 * sees the bot's actual reply, using their own rules and catalog prices.
 *
 * This is the unlinked screen's real job. It proves the product works before linking
 * and before payment, which no amount of marketing copy does.
 */
export function ReplySimulator({
  c, t, rtl, onProbe, reply, source, busy, handle,
}: {
  c: TikTokPalette; t: TF; rtl: boolean;
  onProbe: (text: string) => void;
  reply: string | null;
  /** Which part of the configuration answered — the owner needs to know WHY. */
  source: string | null;
  busy?: boolean;
  handle: string;
}) {
  const [text, setText] = useState("");

  const SOURCE_LABELS: Record<string, [string, string]> = {
    group:   ["مجموعة كلمات", "Keyword group"],
    flat:    ["ردّ هذا الفيديو", "This video's reply"],
    rule:    ["قاعدة", "Rule"],
    catalog: ["مطابقة المنتج", "Product match"],
    ai:      ["الذكاء الاصطناعي", "AI"],
    default: ["الردّ الافتراضي", "Default reply"],
  };
  const label = source ? SOURCE_LABELS[source] : null;

  return (
    <div style={{ background: "#000", borderRadius: 14, padding: 15, minHeight: 200 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: TT_CYAN, letterSpacing: 0.4 }}>
        {t("تجربة مباشرة", "LIVE TRY-OUT")}
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); onProbe(e.target.value); }}
          placeholder={t("اكتب تعليقاً كمشاهد… مثلاً: بكم؟", "Type a comment as a viewer… e.g. how much?")}
          style={{
            width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 999, padding: "10px 14px", color: "#fff", fontSize: 13.5,
            fontFamily: "inherit", boxSizing: "border-box", outline: "none",
          }}
        />
      </div>

      {text.trim() ? (
        <div style={{ marginTop: 14, display: "flex", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(255,255,255,.14)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
            {handle[0]?.toUpperCase() || "T"}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)" }}>@{handle}</span>
              <span style={{ background: `${TT_PINK}33`, color: "#ff8fb0", borderRadius: 4, padding: "1px 5px", fontSize: 9.5, fontWeight: 800 }}>
                {t("صانع المحتوى", "Creator")}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: "#fff", lineHeight: 1.7, marginTop: 4, minHeight: 20 }}>
              {busy
                ? <span style={{ color: "rgba(255,255,255,.45)" }}>…</span>
                : reply || <span style={{ color: "rgba(255,255,255,.45)" }}>{t("لا ردّ مطابق — أضف قاعدة أو ردّاً افتراضياً.", "No match — add a rule or a default reply.")}</span>}
            </div>
            {label && (
              <div style={{ fontSize: 10.5, color: TT_CYAN, marginTop: 6, fontWeight: 700 }}>
                {t(label[0], label[1])}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 16, lineHeight: 1.7 }}>
          {t("اكتب أعلاه لترى ردّ البوت فوراً — بقواعدك وأسعارك الحقيقية، قبل الربط وقبل الاشتراك.",
             "Type above to see the bot's reply instantly — with your own rules and prices, before linking and before subscribing.")}
        </div>
      )}
    </div>
  );
}
