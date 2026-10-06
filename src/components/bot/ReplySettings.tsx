"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Package, Sparkles, Newspaper } from "lucide-react";

/**
 * The reply-configuration pieces both bots share.
 *
 * Facebook and TikTok answer comments from the same `bot_configs` row and the same
 * catalog, so the screens that edit them live here rather than being written twice.
 * Each takes its colours and its save function from the console that hosts it, which
 * is the only thing that actually differs between the two.
 */

export interface ReplyGroup {
  id?: string; label?: string; keywords: string[];
  public_replies?: string[]; private_reply?: string; like?: boolean;
}

export interface BotPalette {
  text: string; muted: string; dim: string;
  card: string; surface: string; border: string; input: string;
}

type TF = (ar: string, en: string) => string;

const GREEN = "#22c55e";

function inputStyle(c: BotPalette): React.CSSProperties {
  return {
    width: "100%", background: c.input, border: `1px solid ${c.border}`,
    borderRadius: 9, padding: "9px 12px", color: c.text, boxSizing: "border-box",
  };
}

/** Keyword groups: "price" comments get the price, "phone" comments get the numbers. */
export function ReplyGroupsEditor({
  groups, onChange, onSave, c, t, accent, compact,
}: {
  groups: ReplyGroup[];
  onChange: (g: ReplyGroup[]) => void;
  onSave?: () => void;
  c: BotPalette; t: TF; accent: string; compact?: boolean;
}) {
  const inp = inputStyle(c);
  const set = (i: number, p: Partial<ReplyGroup>) =>
    onChange(groups.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div>
      {groups.map((g, i) => (
        <div key={i} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={g.label || ""} onChange={(e) => set(i, { label: e.target.value })}
              placeholder={t("اسم المجموعة (مثال: السعر)", "Group name (e.g. Price)")}
              style={{ ...inp, padding: "8px 11px", fontWeight: 700 }} />
            <button onClick={() => onChange(groups.filter((_, j) => j !== i))}
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, padding: "7px 9px", color: "#ef4444", cursor: "pointer" }}>
              <Trash2 size={14} />
            </button>
          </div>
          <input value={(g.keywords || []).join("، ")} onChange={(e) => set(i, { keywords: e.target.value.split(/[،,]/) })}
            placeholder={t("الكلمات — افصل بفاصلة: سعر، بكم، كم", "Keywords — comma separated: price, how much")}
            style={{ ...inp, marginBottom: 8 }} />
          <textarea value={(g.public_replies || []).join("\n")} onChange={(e) => set(i, { public_replies: e.target.value.split("\n") })}
            rows={2} placeholder={t("الرد العلني — سطر لكل نص", "Public reply — one per line")}
            style={{ ...inp, resize: "vertical", marginBottom: 8 }} />
          {!compact && (
            <textarea value={g.private_reply || ""} onChange={(e) => set(i, { private_reply: e.target.value })}
              rows={2} placeholder={t("الرسالة التفصيلية (السعر/التفاصيل)", "Detailed message (price/details)")}
              style={{ ...inp, resize: "vertical" }} />
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12, color: c.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={g.like !== false} onChange={(e) => set(i, { like: e.target.checked })} />
            {t("إعجاب بتعليقات هذه المجموعة", "Like comments in this group")}
          </label>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onChange([...groups, { keywords: [], public_replies: [], private_reply: "" }])}
          style={{ flex: 1, background: c.surface, border: `1px dashed ${c.border}`, borderRadius: 10, padding: "10px 0", color: c.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Plus size={15} /> {t("أضف مجموعة", "Add group")}
        </button>
        {onSave && (
          <button onClick={onSave}
            style={{ background: `linear-gradient(135deg, ${GREEN}, #16a34a)`, border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {t("حفظ", "Save")}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: c.muted, marginTop: 9, lineHeight: 1.7 }}>
        {t("المجموعات تُجرَّب قبل الذكاء الاصطناعي — فما كتبته بنفسك لا يُستبدل بتخمين.",
           "Groups are tried before AI — what you wrote yourself is never replaced by a guess.")}
      </div>
      <span style={{ display: "none" }}>{accent}</span>
    </div>
  );
}

/** Banned words, and what to do with a comment that trips them. */
export function BannedWordsEditor({
  words, action, onWords, onAction, onSave, c, t,
}: {
  words: string; action: "delete" | "hide" | "ignore";
  onWords: (v: string) => void; onAction: (a: "delete" | "hide" | "ignore") => void;
  onSave?: () => void; c: BotPalette; t: TF;
}) {
  const inp = inputStyle(c);
  return (
    <div>
      <input value={words} onChange={(e) => onWords(e.target.value)} onBlur={onSave}
        placeholder={t("كلمة، كلمة أخرى", "word, another word")} style={inp} />
      <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
        {([["hide", t("إخفاء", "Hide")], ["delete", t("حذف", "Delete")], ["ignore", t("تجاهل", "Ignore")]] as const).map(([a, label]) => (
          <button key={a} type="button" onClick={() => onAction(a)}
            style={{ flex: 1, background: action === a ? "rgba(239,68,68,0.15)" : c.surface, border: `1px solid ${action === a ? "rgba(239,68,68,0.45)" : c.border}`, borderRadius: 9, padding: "9px 0", color: action === a ? "#ef4444" : c.muted, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: c.muted, marginTop: 7, lineHeight: 1.7 }}>
        {t("الإخفاء يُبقي التعليق ظاهراً لصاحبه وحده — لا يستفزّه ولا يُتلف شيئاً. الحذف نهائي.",
           "Hiding leaves the comment visible to its author alone — it neither provokes them nor destroys anything. Deleting is permanent.")}
      </div>
    </div>
  );
}

interface CatalogRow {
  id: string; name: string; aliases: string[] | null; sku: string | null;
  price_text: string | null; images: string[] | null;
  image_hashes: string[] | null; post_ids: string[] | null;
}

/**
 * The smart catalog: which product a comment is about, and that product's price.
 *
 * Identical on both platforms — the signals are the post/video it sits under, a
 * picture, or the name — so it is one component reading one API.
 */
export function CatalogPanel({
  pageId, mode, onMode, c, t, accent, platform,
}: {
  pageId: string;
  mode: string;
  onMode: (m: string) => void;
  c: BotPalette; t: TF; accent: string;
  platform: "meta" | "tiktok";
}) {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [priceList, setPriceList] = useState("");
  const [result, setResult] = useState("");

  const unit = platform === "tiktok" ? t("الفيديو", "video") : t("المنشور", "post");
  const units = platform === "tiktok" ? t("الفيديوهات", "videos") : t("المنشورات", "posts");

  async function load() {
    const d = await fetch(`/api/bot/catalog?pageId=${encodeURIComponent(pageId)}`).then((r) => r.json()).catch(() => null);
    setRows(d?.products || []); setLoading(false);
  }
  useEffect(() => { load(); }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setResult("");
    const d = await fetch("/api/bot/catalog", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, action, ...extra }),
    }).then((r) => r.json()).catch(() => null);
    setBusy("");
    if (!d || d.error) { setResult(d?.error || t("تعذّر التنفيذ", "Failed")); return; }
    if (action === "prices")   setResult(t(`حُدِّث ${d.updated} من ${d.total}`, `Updated ${d.updated} of ${d.total}`));
    if (action === "rehash")   setResult(t(`بُصِمت صور ${d.hashed} منتجاً`, `Fingerprinted ${d.hashed} products`));
    if (action === "autobind") setResult(t(`رُبط ${d.bound} منتجاً`, `Bound ${d.bound} products`));
    await load();
  }

  async function saveAliases(id: string, aliases: string[]) {
    await fetch("/api/bot/catalog", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, items: [{ id, aliases }] }),
    }).catch(() => null);
  }

  const box: React.CSSProperties = { background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 20 };
  const inp = inputStyle(c);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
          <Package size={15} color={accent} /> {t("الرد بسعر المنتج المقصود", "Answer with the right product's price")}
        </div>
        <div style={{ fontSize: 12, color: c.muted, lineHeight: 1.8, marginBottom: 12 }}>
          {t(`حين تنشر ${units} كثيرة لمنتجات مختلفة، يعرف البوت أي منتج يقصده كل تعليق — من ${unit} الذي عُلّق عليه، أو من صورة أرفقها صاحب التعليق، أو من اسم المنتج في النص — ويرسل سعره هو وحده.`,
             `When you post many ${units} for different products, the bot works out which one each comment means — from the ${unit} it sits under, from a picture the commenter attached, or from the product name — and sends that product's price only.`)}
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {([["off", t("متوقف", "Off")], ["post", t(`حسب ${unit}`, "By post")], ["name", t("حسب الاسم", "By name")], ["image", t("حسب الصورة", "By image")], ["all", t("الكل", "All signals")]] as const).map(([m, label]) => (
            <button key={m} onClick={() => onMode(m)}
              style={{ background: mode === m ? `${accent}22` : c.surface, border: `1px solid ${mode === m ? `${accent}77` : c.border}`, borderRadius: 9, padding: "8px 14px", color: mode === m ? c.text : c.muted, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: c.muted, marginTop: 9, lineHeight: 1.7 }}>
          {t("«الكل» يجرّب الترتيب الأرخص أولاً، والذكاء الاصطناعي لا يُستدعى إلا إذا فشل الجميع.",
             "\"All\" tries the cheapest signal first; AI is only called if every one of them fails.")}
        </div>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{t("تحديث الأسعار بالجملة", "Bulk price update")}</div>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 10, lineHeight: 1.8 }}>
          {t("الصق قائمة: اسم المنتج = السعر، سطر لكل منتج. الصور تبقى مربوطة بالمنتج فتتبع السعر الجديد وحدها.",
             "Paste a list: product name = price, one per line. Images stay attached to the product, so they follow the new price on their own.")}
        </div>
        <textarea value={priceList} onChange={(e) => setPriceList(e.target.value)} rows={5}
          placeholder={"iPhone 15 Pro = 5390 د.ل\nسماعة ايربودز = 250 د.ل"}
          style={{ ...inp, resize: "vertical", lineHeight: 1.9 }} />
        <button onClick={() => run("prices", { text: priceList })} disabled={busy === "prices" || !priceList.trim()}
          style={{ marginTop: 10, background: `linear-gradient(135deg, ${GREEN}, #16a34a)`, border: "none", borderRadius: 10, padding: "11px 20px", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, opacity: busy === "prices" || !priceList.trim() ? 0.5 : 1 }}>
          {busy === "prices" ? <Loader2 size={15} className="spin" /> : <Save size={15} />} {t("تحديث الأسعار", "Update prices")}
        </button>
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("تجهيز المطابقة", "Prepare matching")}</div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button onClick={() => run("rehash")} disabled={!!busy}
            style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "11px 16px", color: c.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7 }}>
            {busy === "rehash" ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} color={accent} />} {t("بصمة صور الكتالوج", "Fingerprint catalog images")}
          </button>
          {platform === "meta" && (
            <button onClick={() => run("autobind")} disabled={!!busy}
              style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "11px 16px", color: c.text, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7 }}>
              {busy === "autobind" ? <Loader2 size={15} className="spin" /> : <Newspaper size={15} color={accent} />} {t("اربط المنشورات بالمنتجات تلقائياً", "Auto-bind posts to products")}
            </button>
          )}
        </div>
        {result && <div style={{ fontSize: 12.5, color: GREEN, marginTop: 10, lineHeight: 1.7 }}>{result}</div>}
      </div>

      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("المنتجات", "Products")} ({rows.length})</div>
        {loading ? <Loader2 size={20} className="spin" color={accent} /> : rows.length === 0 ? (
          <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.8 }}>
            {t("لا منتجات بعد — أضفها من «الموظف الذكي» ← الأصناف، أو ارفع ملفاً هناك.",
               "No products yet — add them in AI Employee → Catalog, or upload a file there.")}
          </div>
        ) : rows.map((r) => (
          <div key={r.id} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {r.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.images[0]} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
              ) : <div style={{ width: 44, height: 44, borderRadius: 9, background: c.card, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <div style={{ fontSize: 12, color: c.muted }}>{r.price_text || t("بلا سعر", "no price")}</div>
              </div>
              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "3px 8px", background: (r.image_hashes?.length ?? 0) ? "rgba(34,197,94,0.15)" : c.card, color: (r.image_hashes?.length ?? 0) ? GREEN : c.dim }}>
                  🖼 {r.image_hashes?.length ?? 0}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 100, padding: "3px 8px", background: (r.post_ids?.length ?? 0) ? `${accent}22` : c.card, color: (r.post_ids?.length ?? 0) ? accent : c.dim }}>
                  📌 {r.post_ids?.length ?? 0}
                </span>
              </div>
            </div>
            <input defaultValue={(r.aliases || []).join("، ")}
              onBlur={(e) => saveAliases(r.id, e.target.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean))}
              placeholder={t("مرادفات الاسم — كما يكتبه الزبائن", "Name aliases — how customers write it")}
              style={{ ...inp, padding: "8px 11px", marginTop: 9, fontSize: 12.5 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
