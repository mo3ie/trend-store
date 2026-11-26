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
  /** Extra "how much?" words for this shop. See sql/40. */
  price_keywords: string[] | null;
  /** Post the code as a rendered card (big code + QR) instead of plain text. */
  reply_image: boolean | null;
}

interface LinkRow {
  token: string; name: string | null; excerpt: string;
  opens: number; maxOpens: number;
  createdAt: string; openedAt: string | null; whatsappAt: string | null; expired: boolean;
}

export function PrivateReplyPanel({
  c, t, rtl, config, patch, siteHost, accountId,
}: {
  c: TikTokPalette; t: TF; rtl: boolean;
  config: PrivateReplyConfig;
  /** The screen's single writer, so this panel saves exactly like every other card. */
  patch: (fields: Record<string, unknown>) => Promise<boolean>;
  siteHost: string;
  /** tiktok_accounts.id — needed only by the image probe. */
  accountId?: string | null;
}) {
  const mode = (config.private_delivery || "off") as "off" | "link" | "assist";
  const on = mode !== "off";
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const [body, setBody] = useState(config.default_private_reply || "");
  const [linkText, setLinkText] = useState(config.private_link_text || "");
  const [wa, setWa] = useState(config.whatsapp_number || "");
  const [kw, setKw] = useState((config.price_keywords || []).join("، "));

  const [probing, setProbing] = useState(false);
  const [probeMsg, setProbeMsg] = useState("");
  const [probeOk, setProbeOk] = useState(false);

  /**
   * Asks TikTok the one question its documentation does not answer: may this app
   * upload a comment image? Nothing is posted — see the button's comment.
   *
   * A refusal is reported with TikTok's own code, because that code is the
   * finding. It is the fact missing from every source we have, and it is what we
   * would put in a support ticket.
   */
  async function probeImage() {
    if (!accountId) return;
    setProbing(true); setProbeMsg("");
    try {
      const r = await fetch(`/api/tiktok/bot/test-comment-image?accountId=${encodeURIComponent(accountId)}`);
      const d = await r.json();
      setProbeOk(!!d.ok);
      setProbeMsg(d.ok
        ? t("✅ تيك توك قبلت الصورة — البطاقة والـQR يعملان. شغّل المفتاح أعلاه.",
            "✅ TikTok accepted the image — the card and QR work. Turn the switch on above.")
        : `${t("لم تقبلها تيك توك", "TikTok refused")}: ${d.message || d.stage || ""}${d.tiktokCode ? ` (${d.tiktokCode})` : ""}`);
    } catch {
      setProbeOk(false);
      setProbeMsg(t("تعذّر الاتصال — جرّب مرة أخرى.", "Could not reach the server — try again."));
    }
    setProbing(false);
  }
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

  /*
   * These three must stay identical to src/lib/privateLinks.ts. They are copied
   * rather than imported because that module pulls in supabaseAdmin and this is a
   * client component — and a preview that disagrees with the engine is worse than
   * no preview, which is exactly what happened here: this showed a default of
   * "تم تجهيز ردّك ✅" that the engine has never used, and appended a bare URL
   * while the engine appends a labelled code and a labelled link.
   */
  const DEFAULT_LINK_TEXT = "كودك {code} — افتح الرابط في البايو واكتب الكود لترى السعر 🔑";
  const LABEL_CODE = "كودك: ";
  const LABEL_LINK = "أو افتح: ";
  const SAMPLE = "7UT8S";

  const base = (linkText || DEFAULT_LINK_TEXT).trim();
  const sampleUrl = `https://${siteHost}/r/${SAMPLE}`;
  const previewLine = base.includes("{code}") || base.includes("{link}")
    ? base.split("{code}").join(SAMPLE).split("{link}").join(sampleUrl)
    : `${base}\n${LABEL_CODE}${SAMPLE}\n${LABEL_LINK}${sampleUrl}`;

  const previewLen = [...previewLine].length;

  /*
   * Does the comment tell the customer anything?
   *
   * The live test produced "تم الرد عليك داخل الرابط الخاص 📩" — passive, and it
   * never says the word the commenter typed. Someone who asked "بكم" is shown a
   * sentence about a link, a code and a URL, with no hint that a PRICE is behind
   * any of it. The reply was legible and had no verb.
   *
   * A keyword list cannot judge writing, so this only checks the two facts that
   * are objectively absent or present: does it name what is behind the code, and
   * does it ask for an action. It warns, never blocks — the merchant's words are
   * the merchant's.
   */
  const saysWhat = /سعر|ثمن|تمن|price|سعرها|السعر/i.test(base);
  const saysDo = /افتح|اكتب|ادخل|انسخ|اضغط|زور|open|enter|type|tap|copy/i.test(base);

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

        {/*
          Three modes, not a switch, because they are genuinely different products
          and the merchant has to see the trade before choosing. Each option names
          its own cost: the comments show the price, the customer types a code, or
          someone presses send.
        */}
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {([
            { key: "assist",
              ar: "رسالة خاصة بضغطة — الأقوى",
              en: "Private message, one tap — strongest",
              arSub: "رسالة خاصة حقيقية. البوت يردّ علنياً وحده، وأنت تضغط «إرسال» من تبويب «طابور الرسائل».",
              enSub: "A real DM. The bot answers publicly on its own; you press send from the Queue tab." },
            { key: "link",
              ar: "رابط وكود",
              en: "Link and code",
              arSub: "آلي بالكامل، لكن على الزبون فتح رابط البايو وكتابة الكود.",
              enSub: "Fully automatic, but the customer must open your bio link and type the code." },
            { key: "off",
              ar: "بلا إخفاء",
              en: "No hiding",
              arSub: "السعر يُنشر في التعليقات للجميع.",
              enSub: "The price is posted in the comments for everyone." },
          ] as const).map((opt) => {
            const active = mode === opt.key;
            return (
              <button key={opt.key} onClick={() => { if (!active) save({ private_delivery: opt.key }); }}
                disabled={busy}
                style={{
                  textAlign: rtl ? "right" : "left", padding: "12px 13px", borderRadius: 11,
                  border: `1.5px solid ${active ? c.ok : c.border}`,
                  background: active ? `${c.ok}14` : "transparent",
                  fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {busy && active ? <Loader2 size={14} className="spin" />
                    : active ? <CheckCircle2 size={15} color={c.ok} />
                    : <Lock size={14} color={c.muted} />}
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: active ? c.ok : c.text }}>
                    {t(opt.ar, opt.en)}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: c.muted, lineHeight: 1.7, marginTop: 4 }}>
                  {t(opt.arSub, opt.enSub)}
                </div>
              </button>
            );
          })}
        </div>
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
          {mode === "link" && (<>
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
            {/*
              Three ready sentences. The blank field is what produced the vague
              one: asked to write a comment with no idea what it has to achieve,
              a merchant writes something polite and contentless. Each of these
              names the price and asks for one action, which is the whole job.
            */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
              {[
                t("السعر جاهز لك 👇 اكتب الكود {code} في الرابط بالبايو",
                  "Your price is ready 👇 enter code {code} at the link in our bio"),
                t("كودك {code} — افتح الرابط في البايو واكتب الكود لترى السعر 🔑",
                  "Your code is {code} — open the link in our bio and enter it to see the price 🔑"),
                t("السعر محجوز لك 🔑 الكود {code}، اكتبه في رابط البايو",
                  "Price reserved for you 🔑 code {code}, enter it at our bio link"),
              ].map((s) => (
                <button key={s} onClick={() => { setLinkText(s); save({ private_link_text: s }); }}
                  style={{
                    background: c.stage, border: `1px solid ${c.border ?? "#242c42"}`, borderRadius: 9,
                    padding: "7px 10px", fontSize: 11, color: c.muted, cursor: "pointer",
                    fontFamily: "inherit", textAlign: "start", maxWidth: "100%",
                  }}>
                  {s.length > 44 ? `${s.slice(0, 44)}…` : s}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 10, background: c.stage, borderRadius: 11, padding: "12px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                <div style={{ fontSize: 10.5, color: "#8b8f9e", fontWeight: 700, letterSpacing: ".4px" }}>
                  {t("هكذا سيظهر التعليق", "This is how the comment will look")}
                </div>
                {/* TikTok refuses a comment over 150 characters outright — a silent bot. */}
                <div style={{ fontSize: 10.5, fontWeight: 800, color: previewLen > 150 ? "#ef4444" : "#8b8f9e" }}>
                  {previewLen}/150
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: "#fff", lineHeight: 1.85, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {t("أحمد، ", "Ahmed, ")}{previewLine}
              </div>
            </div>

            {(!saysWhat || !saysDo) && (
              <div style={{ marginTop: 9, fontSize: 11.5, color: "#f59e0b", lineHeight: 1.8 }}>
                {!saysWhat && !saysDo
                  ? t("زبونك سألك عن السعر، وهذا التعليق لا يذكر السعر ولا يطلب منه شيئاً — فسيقرأ كوداً لا يعرف ما هو، ويمضي. اذكر «السعر» واطلب فعلاً واحداً.",
                      "Your customer asked a price, and this comment mentions neither the price nor what to do — so they read a code they cannot place, and scroll on. Name the price and ask for one action.")
                  : !saysWhat
                    ? t("لا يذكر «السعر» — وهو الكلمة التي سأل عنها الزبون.",
                        "It never says \"price\" — the word your customer actually asked about.")
                    : t("لا يطلب فعلاً — قل له ماذا يفعل بالكود بالضبط.",
                        "It asks for no action — tell them exactly what to do with the code.")}
              </div>
            )}
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

          {/* ── 5. Which comments get a code ───────────────────────────────── */}
          <Field
            c={c} n={5}
            title={t("أيّ التعليقات تأخذ كوداً", "Which comments get a code")}
            hint={t("الكود يذهب لمن يسأل عن السعر فقط. أمّا التوصيل والعنوان والضمان والألوان — فيُجاب عنها مباشرةً تحت الفيديو، لأنّ أحداً لن يمشي إلى البايو ليُقال له «نعم نوصّل». والبوت يعرف كلمات السعر بالليبية والعربية والإنجليزية. أضف هنا كلمات زبائنك وحدهم إن وُجدت.",
                    "Only price questions get a code. Delivery, address, warranty and colours are answered straight under the video — nobody walks to the bio to be told \"yes, we deliver\". The bot already knows price words in Libyan, Arabic and English. Add your own customers' words here, if they have any.")}
          >
            <input
              value={kw} onChange={(e) => setKw(e.target.value)}
              onBlur={() => {
                const next = kw.split(/[\n,،]/).map((w) => w.trim()).filter(Boolean);
                const prev = config.price_keywords || [];
                if (next.join("|") !== prev.join("|")) save({ price_keywords: next });
              }}
              placeholder={t("بقديش، كم تجي، شنو تمنها", "e.g. how much does it run, what's it go for")}
              style={ttInput(c)}
            />
            <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.8, marginTop: 8 }}>
              {t("افصل بينها بفاصلة. اتركه فارغاً إن لم تحتج شيئاً.",
                 "Separate them with commas. Leave it empty if you don't need any.")}
            </div>
          </Field>

          {/* ── 6. The card ────────────────────────────────────────────────── */}
          <Field
            c={c} n={6}
            title={t("أرسل الكود كصورة", "Send the code as a picture")}
            hint={t("بدل سطر رماديّ ضائع بين التعليقات: بطاقة بلون متجرك، الكود فيها ضخم، وفي ركنها QR يفتح السعر مباشرةً لمن يشاهد على شاشة أخرى. ولا سعر على البطاقة إطلاقاً — فهي علنيّة مثل التعليق.",
                    "Instead of a grey line lost among the comments: a card in your shop's colour, the code on it huge, and a QR in the corner that opens the price for anyone watching on another screen. The price is never on the card — it is as public as the comment.")}
          >
            <button
              onClick={() => save({ reply_image: !config.reply_image })}
              disabled={busy}
              style={{
                ...ttInput(c), cursor: busy ? "default" : "pointer", textAlign: "start",
                fontWeight: 800,
                color: config.reply_image ? c.ok : c.muted,
                borderColor: config.reply_image ? c.ok : undefined,
              }}
            >
              {config.reply_image ? t("مُفعَّل ✓", "On ✓") : t("مُعطَّل", "Off")}
            </button>
            <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.8, marginTop: 8 }}>
              {t("تيك توك لم توثّق الصلاحية اللازمة لرفع الصور، فقد ترفضها. إن رفضت، يُرسَل الكود نصّاً كالمعتاد ولا يضيع شيء.",
                 "TikTok has not documented the permission image uploads need, so it may refuse. If it does, the code goes out as text as usual and nothing is lost.")}
            </div>

            {/*
              The probe, as a button.

              It existed as an endpoint and the owner was told to open it with an
              accountId he had no way to know — which is not a test he can run, it
              is a test I can run. It uploads one image and posts NOTHING: no
              comment, no code spent, no customer involved. Safe to press twice.
            */}
            {accountId && (
              <>
                <button onClick={probeImage} disabled={probing}
                  style={{ ...ttInput(c), cursor: probing ? "default" : "pointer", marginTop: 9, fontWeight: 700, textAlign: "center" }}>
                  {probing
                    ? t("جارٍ الاختبار…", "Testing…")
                    : t("اختبر الآن — هل تسمح تيك توك بالصور؟", "Test now — does TikTok allow images?")}
                </button>
                {probeMsg && (
                  <div style={{ fontSize: 11.5, lineHeight: 1.8, marginTop: 8, color: probeOk ? c.ok : "#f59e0b" }}>
                    {probeMsg}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: c.muted, lineHeight: 1.75, marginTop: 6 }}>
                  {t("يرفع صورة واحدة ولا ينشر شيئاً — لا تعليق ولا كود ولا زبون.",
                     "Uploads one image and posts nothing — no comment, no code, no customer.")}
                </div>
              </>
            )}
          </Field>

          {/* ── The report ─────────────────────────────────────────────────── */}
          </>)}
          {mode === "link" && (<>
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
          </>)}
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
