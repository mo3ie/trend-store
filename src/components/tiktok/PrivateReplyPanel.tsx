"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, MessageSquare, Eye, Link2, CheckCircle2 } from "lucide-react";
import { ttCard, ttInput, type TikTokPalette } from "@/lib/tiktokTheme";

/**
 * «الردّ الخاص» — the merchant's whole setup for it, on one screen.
 *
 * The mechanic this serves: a shop hides the price so that learning it costs a
 * comment, and the comments are what lift the video. Facebook supports that with
 * a DM. TikTok gives us no DM, so the price went into the public comment and the
 * mechanic collapsed — everyone could read it without commenting.
 *
 * Here the price goes behind a one-off link instead. The merchant writes three
 * things and nothing else: what the customer gets, what the comment says, and
 * which WhatsApp number takes the order. Everything else has a working default,
 * because a shop owner setting this up on a phone will not read six paragraphs
 * to turn on one feature.
 *
 * The link itself is the one thing they CANNOT write: it is minted per commenter.
 * The preview exists so that is obvious at a glance rather than explained.
 */

type TF = (ar: string, en: string) => string;

export interface PrivateReplyConfig {
  id: string;
  default_private_reply: string | null;
  private_delivery: string | null;
  private_link_text: string | null;
  whatsapp_number: string | null;
  whatsapp_text: string | null;
  private_link_ttl_hours: number | null;
  private_link_max_opens: number | null;
}

interface LinkRow {
  token: string; name: string | null; excerpt: string;
  opens: number; maxOpens: number;
  createdAt: string; openedAt: string | null; whatsappAt: string | null; expired: boolean;
}

export function PrivateReplyPanel({
  c, t, rtl, config, patch, siteHost,
}: {
  c: TikTokPalette; t: TF; rtl: boolean;
  config: PrivateReplyConfig;
  /** The screen's single writer, so this panel saves exactly like every other card. */
  patch: (fields: Record<string, unknown>) => Promise<boolean>;
  siteHost: string;
}) {
  const on = (config.private_delivery || "off") === "link";
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const [body, setBody] = useState(config.default_private_reply || "");
  const [linkText, setLinkText] = useState(config.private_link_text || "");
  const [wa, setWa] = useState(config.whatsapp_number || "");
  const [waText, setWaText] = useState(config.whatsapp_text || "");

  const [stats, setStats] = useState<{ sent: number; opened: number; whatsapp: number } | null>(null);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loadingReport, setLoadingReport] = useState(true);

  /*
   * The report, loaded once per config.
   *
   * `alive` is not ceremony: an owner with two linked accounts can switch between
   * them faster than this request returns, and without the guard the slower reply
   * would paint one account's customers under the other account's name.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await fetch(`/api/tiktok/bot/private-links?configId=${config.id}`)
        .then((r) => r.json()).catch(() => ({}));
      if (!alive) return;
      setStats(d.stats ?? null);
      setRows(d.links ?? []);
      setLoadingReport(false);
    })();
    return () => { alive = false; };
  }, [config.id]);

  async function save(fields: Record<string, unknown>) {
    setBusy(true);
    const ok = await patch(fields);
    setBusy(false);
    if (ok) { setSaved(t("حُفظ", "Saved")); setTimeout(() => setSaved(""), 1800); }
  }

  const DEFAULT_LINK_TEXT = "تم تجهيز ردّك ✅";
  const previewLine = (linkText || DEFAULT_LINK_TEXT).includes("{link}")
    ? (linkText || DEFAULT_LINK_TEXT).replace("{link}", `${siteHost}/r/A7K2M9Q`)
    : `${linkText || DEFAULT_LINK_TEXT}\n${siteHost}/r/A7K2M9Q`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ── The switch, with the reason it exists ───────────────────────────── */}
      <div style={{ ...ttCard(c), padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Lock size={17} color={c.pinkInk} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              {t("الردّ الخاص برابط", "Private reply by link")}
            </div>
            <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.8, margin: "7px 0 0" }}>
              {t("تيك توك لا يتيح لنا الرسائل الخاصة، فكان السعر يُنشر في التعليقات ويراه الجميع. بتفعيل هذا الخيار يذهب السعر خلف رابط خاص، ولا يظهر في التعليقات إطلاقاً — فمن يريد السعر عليه أن يعلّق.",
                 "TikTok gives us no private messages, so the price was posted in the comments for everyone to read. With this on, the price goes behind a one-off link and never appears in the comments — so anyone who wants it has to comment.")}
            </p>
          </div>
        </div>

        <button
          onClick={() => save({ private_delivery: on ? "off" : "link" })}
          disabled={busy}
          style={{
            width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 11,
            border: `1.5px solid ${on ? c.ok : c.border}`,
            background: on ? `${c.ok}1a` : "transparent",
            color: on ? c.ok : c.text, fontSize: 14, fontWeight: 800,
            fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {busy ? <Loader2 size={15} className="spin" /> : on ? <CheckCircle2 size={16} /> : <Lock size={15} />}
          {on ? t("مُفعّل — السعر مخفي", "On — the price is hidden") : t("مُعطّل — السعر يظهر في التعليقات", "Off — the price shows in comments")}
        </button>
      </div>

      {on && (
        <>
          {/* ── 1. What the customer receives ──────────────────────────────── */}
          <Field
            c={c} n={1}
            title={t("السعر الافتراضي — لكل الفيديوهات", "The default price — for every video")}
            hint={t("هذا ما يُرسل حين لا يكون للفيديو سعره الخاص. إن كنت تبيع منتجات مختلفة، اكتب سعر كل فيديو من تبويب «الفيديوهات» — وهو ما سيُرسل لمن يعلّق تحته.",
                    "This is what gets sent when a video has no price of its own. If you sell different products, write each video’s price in the Videos tab — that is what whoever comments under it will receive.")}
          >
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              onBlur={() => body !== (config.default_private_reply || "") && save({ default_private_reply: body })}
              rows={4}
              placeholder={t("السعر ٣٢٠ د.ل\nمتوفر بالأسود والفضي\nالتوصيل خلال يومين", "Price 320 LYD\nAvailable in black and silver\nDelivery in two days")}
              style={{ ...ttInput(c), resize: "vertical", lineHeight: 1.8 }}
            />

            {/*
              The three levels, shown as a ladder.

              The per-video price already worked -- the engine has always preferred a
              video override over the account default -- but nothing on this screen
              said so, so a shop with twenty products looked like it could only quote
              one. A capability nobody can find is a capability that does not exist.
            */}
            <div style={{ marginTop: 11, background: c.surface2, borderRadius: 11, padding: "11px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: c.muted, marginBottom: 8, letterSpacing: ".3px" }}>
                {t("أي سعر يُرسل؟ الأعلى أولاً", "Which price is sent? Top one wins")}
              </div>
              {[
                { n: "1", ar: "سعر الفيديو نفسه", en: "The video’s own price", ar2: "تبويب الفيديوهات ← اضغط على فيديو", en2: "Videos tab → tap a video" },
                { n: "2", ar: "سعر الكلمة المفتاحية", en: "A keyword’s price", ar2: "تبويب القواعد", en2: "Rules tab" },
                { n: "3", ar: "السعر الافتراضي أعلاه", en: "The default above", ar2: "لكل ما سواه", en2: "everything else" },
              ].map((x) => (
                <div key={x.n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: c.pinkInk, minWidth: 12 }}>{x.n}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: c.text }}>{t(x.ar, x.en)}</span>
                  <span style={{ fontSize: 11, color: c.muted, marginInlineStart: "auto" }}>{t(x.ar2, x.en2)}</span>
                </div>
              ))}
            </div>
          </Field>

          {/* ── 2. The public comment ──────────────────────────────────────── */}
          <Field
            c={c} n={2}
            title={t("ما يُكتب في التعليقات", "What is posted in the comments")}
            hint={t("جملتك فقط — الرابط يُضاف تلقائياً لأنه مختلف لكل زبون. إن أردت وضعه داخل الجملة اكتب {link} في مكانه.",
                    "Your sentence only — the link is appended automatically because it differs for every customer. To place it inside the sentence, write {link} where you want it.")}
          >
            <input
              value={linkText} onChange={(e) => setLinkText(e.target.value)}
              onBlur={() => linkText !== (config.private_link_text || "") && save({ private_link_text: linkText })}
              placeholder={DEFAULT_LINK_TEXT}
              style={ttInput(c)}
            />
            <div style={{ marginTop: 10, background: c.stage, borderRadius: 11, padding: "12px 13px" }}>
              <div style={{ fontSize: 10.5, color: "#8b8f9e", fontWeight: 700, marginBottom: 7, letterSpacing: ".4px" }}>
                {t("هكذا سيظهر التعليق", "This is how the comment will look")}
              </div>
              <div style={{ fontSize: 13.5, color: "#fff", lineHeight: 1.85, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {t("أحمد، ", "Ahmed, ")}{previewLine}
              </div>
            </div>
          </Field>

          {/* ── 3. WhatsApp ────────────────────────────────────────────────── */}
          <Field
            c={c} n={3}
            title={t("زر الطلب على واتساب (اختياري)", "The WhatsApp order button (optional)")}
            hint={t("يظهر زر أخضر أسفل السعر يفتح محادثة معك مباشرة. رقمك العادي يكفي — لا يحتاج أي ربط أو إعداد.",
                    "A green button under the price opens a chat with you. Your ordinary number is enough — no connection or setup needed.")}
          >
            <input
              value={wa} onChange={(e) => setWa(e.target.value)}
              onBlur={() => wa !== (config.whatsapp_number || "") && save({ whatsapp_number: wa })}
              inputMode="tel" placeholder="0912345678"
              style={{ ...ttInput(c), direction: "ltr", textAlign: rtl ? "right" : "left" }}
            />
            <input
              value={waText} onChange={(e) => setWaText(e.target.value)}
              onBlur={() => waText !== (config.whatsapp_text || "") && save({ whatsapp_text: waText })}
              placeholder={t("الرسالة الجاهزة: مرحباً، أريد الاستفسار عن هذا المنتج", "Pre-typed message: Hello, I'd like to ask about this product")}
              style={{ ...ttInput(c), marginTop: 9 }}
            />
          </Field>

          {/* ── 4. Limits ──────────────────────────────────────────────────── */}
          <Field
            c={c} n={4}
            title={t("حدود الرابط", "Link limits")}
            hint={t("الافتراضي: فتحة واحدة خلال ٢٤ ساعة — فمن أراد السعر مرة أخرى عليه أن يعلّق من جديد، وهذا بالضبط ما تريده. تحديث الصفحة لا يستهلك الفتحة، فلن يضيع السعر على زبونك بالخطأ.",
                    "The default is one open within 24 hours — so anyone who wants the price again has to comment again, which is exactly what you want. Refreshing the page does not spend the open, so your customer cannot lose the price by accident.")}
          >
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 120px", fontSize: 11.5, color: c.muted }}>
                {t("مدة الصلاحية (ساعة)", "Valid for (hours)")}
                <input type="number" min={1} max={720} defaultValue={config.private_link_ttl_hours ?? 24}
                  onBlur={(e) => save({ private_link_ttl_hours: Number(e.target.value) })}
                  style={{ ...ttInput(c), marginTop: 5 }} />
              </label>
              <label style={{ flex: "1 1 120px", fontSize: 11.5, color: c.muted }}>
                {t("عدد مرات الفتح", "Times it can open")}
                <input type="number" min={1} max={50} defaultValue={config.private_link_max_opens ?? 1}
                  onBlur={(e) => save({ private_link_max_opens: Number(e.target.value) })}
                  style={{ ...ttInput(c), marginTop: 5 }} />
              </label>
            </div>
          </Field>

          {/* ── The report ─────────────────────────────────────────────────── */}
          <div style={{ ...ttCard(c), padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
              {t("التقرير", "Report")}
            </div>
            <p style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.75, margin: "0 0 13px" }}>
              {t("كم شخصاً وصله السعر، كم فتحه فعلاً، وكم انتقل ليطلب. هذا ما يخبرك إن كانت المشكلة في السعر أم في الوصول.",
                 "How many were sent the price, how many actually opened it, and how many went on to order. This is what tells you whether the problem is the price or the reach.")}
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <Stat c={c} icon={<Link2 size={14} />} label={t("أُرسل", "Sent")} value={stats?.sent ?? 0} tone={c.muted} />
              <Stat c={c} icon={<Eye size={14} />} label={t("فُتح", "Opened")} value={stats?.opened ?? 0} tone={c.cyanInk}
                    sub={pct(stats?.opened, stats?.sent)} />
              <Stat c={c} icon={<MessageSquare size={14} />} label={t("طلب", "Ordered")} value={stats?.whatsapp ?? 0} tone={c.ok}
                    sub={pct(stats?.whatsapp, stats?.sent)} />
            </div>

            <div style={{ marginTop: 14 }}>
              {loadingReport ? (
                <div style={{ textAlign: "center", padding: 18 }}><Loader2 size={17} className="spin" color={c.muted} /></div>
              ) : rows.length === 0 ? (
                <div style={{ fontSize: 12.5, color: c.muted, textAlign: "center", padding: "18px 10px", lineHeight: 1.8 }}>
                  {t("لم يُرسل أي رابط بعد. سيظهر هنا كل زبون علّق وما حدث بعدها.",
                     "No links sent yet. Every customer who comments will appear here, with what happened next.")}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 7 }}>
                  {rows.map((l) => (
                    <div key={l.token} style={{ background: c.surface2, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>
                          {l.name || t("زبون", "Customer")}
                        </span>
                        <span style={{ fontSize: 10.5, color: c.muted, fontFamily: "monospace" }}>{l.token}</span>
                        <span style={{ marginInlineStart: "auto", fontSize: 10.5, color: c.muted }}>
                          {when(l.createdAt, t)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: c.muted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.excerpt}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                        <Tag tone={l.whatsappAt ? c.ok : l.openedAt ? c.cyanInk : c.muted}>
                          {l.whatsappAt ? t("طلب على واتساب", "Ordered on WhatsApp")
                            : l.openedAt ? t("فتح السعر", "Opened the price")
                            : l.expired ? t("لم يفتحه", "Never opened")
                            : t("بانتظار الفتح", "Waiting")}
                        </Tag>
                        <Tag tone={c.muted}>{l.opens}/{l.maxOpens}</Tag>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {saved && (
        <div style={{ textAlign: "center", fontSize: 12, color: c.ok, fontWeight: 700 }}>{saved}</div>
      )}
    </div>
  );
}

/** A numbered step. Numbering them is what makes a six-field form feel like three decisions. */
function Field({
  c, n, title, hint, children,
}: { c: TikTokPalette; n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ ...ttCard(c), padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
        <span style={{
          width: 21, height: 21, borderRadius: 999, background: c.surface2, color: c.text,
          fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>{n}</span>
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</span>
      </div>
      <p style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.75, margin: "0 0 11px" }}>{hint}</p>
      {children}
    </div>
  );
}

function Stat({
  c, icon, label, value, tone, sub,
}: { c: TikTokPalette; icon: React.ReactNode; label: string; value: number; tone: string; sub?: string }) {
  return (
    <div style={{ flex: 1, background: c.surface2, borderRadius: 11, padding: "11px 10px", textAlign: "center" }}>
      <div style={{ color: tone, display: "flex", justifyContent: "center", marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: c.text, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: c.muted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: tone, fontWeight: 700, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Tag({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, color: tone, background: `${tone}18`,
      border: `1px solid ${tone}44`, borderRadius: 999, padding: "2px 8px",
    }}>{children}</span>
  );
}

function pct(part: number | undefined, whole: number | undefined): string | undefined {
  if (!whole || part === undefined) return undefined;
  return `${Math.round((part / whole) * 100)}%`;
}

function when(iso: string, t: TF): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t("الآن", "now");
  if (mins < 60) return t(`قبل ${mins} د`, `${mins}m ago`);
  const h = Math.floor(mins / 60);
  if (h < 24) return t(`قبل ${h} س`, `${h}h ago`);
  return t(`قبل ${Math.floor(h / 24)} يوم`, `${Math.floor(h / 24)}d ago`);
}
