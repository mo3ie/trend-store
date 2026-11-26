"use client";

import type { BotPalette } from "@/components/bot/ReplySettings";

export type PriceDelivery = "default" | "code" | "queue" | "public";

type TF = (ar: string, en: string) => string;

/**
 * "How does this price reach the customer?" — asked in every place a price is
 * written, instead of once for the whole account.
 *
 * ## Why it is repeated rather than central
 *
 * It used to be a single account-wide setting, and that is what made the screen
 * feel arbitrary: a merchant chose "behind a code" once, while looking at one
 * product, and every video and every keyword he wrote afterwards silently
 * inherited a decision taken about something else. He could see the consequence
 * and not the cause.
 *
 * A shop does not want one mechanism. A cheap accessory can have its price said
 * out loud; a phone should cost a comment and a code; a made-to-order item is
 * worth a human. So the question is asked next to the answer it applies to, and
 * "default" — follow the account — stays available for everyone who does not care.
 *
 * ## Why each option states its cost
 *
 * Every one of these trades something. The code lifts the video and asks the
 * customer to walk; the queue is private and needs a human; public is instant and
 * gives the price to every competitor reading the comments. A picker that lists
 * four names without their costs is a picker that gets chosen by position.
 */
export function PriceDeliveryPicker({
  value, onChange, c, t, accountDefault, compact,
}: {
  value: PriceDelivery | undefined | null;
  onChange: (v: PriceDelivery) => void;
  c: BotPalette;
  t: TF;
  /**
   * What "default" currently resolves to, named so the option is not a mystery.
   * An owner reading "follow the account" should not have to leave to find out
   * what the account says.
   */
  accountDefault?: "off" | "link" | "assist" | string | null;
  /** Drops the explanatory lines, for use inside an already-dense list. */
  compact?: boolean;
}) {
  const current = value || "default";

  const resolved =
    accountDefault === "link" ? t("كود ورابط", "code + link")
    : accountDefault === "assist" ? t("طابور", "queue")
    : t("علني", "public");

  const options: { key: PriceDelivery; label: string; cost: string }[] = [
    {
      key: "default",
      label: t(`الافتراضي — ${resolved}`, `Default — ${resolved}`),
      cost: t("يتبع إعداد الحساب. غيّره من «الردّ الخاص» ويتغيّر هنا معه.",
              "Follows the account setting. Change it in Private reply and this changes with it."),
    },
    {
      key: "code",
      label: t("كود + QR", "Code + QR"),
      cost: t("لا يظهر السعر لأحد. الزبون يأخذ كوداً ويكتبه في الرابط، أو يقرأ الـQR. يكلّفه خطوة — وهذه الخطوة هي التعليق الذي يرفع الفيديو.",
              "Nobody sees the price. The customer gets a code and types it at your link, or scans the QR. It costs them a step — and that step is the comment that lifts the video."),
    },
    {
      key: "queue",
      label: t("طابور الرسائل", "Message queue"),
      cost: t("أخصّ طريقة: رسالة حقيقية في الخاص. لكنها تحتاجك أنت — تضغط «إرسال» من الطابور.",
              "The most private: a real DM. But it needs you — you press Send from the queue."),
    },
    {
      key: "public",
      label: t("علناً في التعليق", "Out loud in the comment"),
      cost: t("أسرع شيء للزبون، ويراه كل من يقرأ التعليقات — ومنافسوك منهم.",
              "Fastest for the customer, and read by everyone in the comments — competitors included."),
    },
  ];

  return (
    <div style={{ display: "grid", gap: 7 }}>
      {options.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key} type="button" onClick={() => onChange(o.key)}
            style={{
              textAlign: "start", background: active ? "rgba(34,197,94,.10)" : c.surface,
              border: `1px solid ${active ? "#22c55e" : c.border}`,
              borderRadius: 11, padding: compact ? "9px 11px" : "11px 13px",
              cursor: "pointer", fontFamily: "inherit", color: c.text,
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? "#22c55e" : c.text }}>
              {active ? "● " : "○ "}{o.label}
            </div>
            {!compact && (
              <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.7, marginTop: 4 }}>
                {o.cost}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * What the customer will actually see, spelled out before anything is sent.
 *
 * The operator asked for exactly this: "الكيو ار يظهر ماللذي يحتويه مفروض و الكود
 * ايضا ماذا يحتوي". He was being asked to trust three mechanisms he could not
 * look inside — a code, a QR and a queue — and to type a price into a box without
 * being shown where it would come out.
 *
 * So this renders the whole journey from the two things he typed: the comment
 * that gets posted, and what sits behind the code. No live data and no API call
 * — it is the same text the engine composes, so it stays honest as he edits.
 */
export function PriceDeliveryPreview({
  delivery, commentText, priceText, codeExample, host, c, t,
}: {
  delivery: PriceDelivery;
  /** The merchant's public comment template, with {code} still in it. */
  commentText: string;
  /** The private text — the thing actually being protected. */
  priceText: string;
  codeExample: string;
  host: string;
  c: BotPalette;
  t: TF;
}) {
  const comment = (commentText || "").trim()
    .split("{code}").join(codeExample)
    .split("{link}").join(`${host}/r/${codeExample}`);

  const row = (k: string, v: string, mono?: boolean) => (
    <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginTop: 7 }}>
      <div style={{ fontSize: 10.5, color: c.muted, fontWeight: 800, minWidth: 74, flexShrink: 0 }}>{k}</div>
      <div style={{
        fontSize: 12, color: c.text, lineHeight: 1.75, wordBreak: "break-word",
        fontFamily: mono ? "ui-monospace, Menlo, Consolas, monospace" : "inherit",
      }}>{v}</div>
    </div>
  );

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 13, marginTop: 11 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: c.muted, letterSpacing: ".4px", marginBottom: 3 }}>
        {t("ما سيراه الزبون بالضبط", "Exactly what the customer will see")}
      </div>

      {delivery === "public" ? (
        <>
          {row(t("في التعليق", "In the comment"), priceText.trim() || t("(اكتب السعر أعلاه)", "(write the price above)"))}
          <div style={{ fontSize: 11, color: "#f59e0b", lineHeight: 1.7, marginTop: 9 }}>
            {t("السعر نفسه يُنشر تحت الفيديو. لا كود، ولا رابط، ولا إخفاء.",
               "The price itself is posted under the video. No code, no link, nothing hidden.")}
          </div>
        </>
      ) : delivery === "queue" ? (
        <>
          {row(t("في التعليق", "In the comment"), comment || t("تم تجهيز ردّك — تفقّد رسائلك ✉️", "Your reply is ready — check your messages ✉️"))}
          {row(t("في الطابور", "In the queue"), priceText.trim() || t("(اكتب السعر أعلاه)", "(write the price above)"))}
          <div style={{ fontSize: 11, color: "#f59e0b", lineHeight: 1.7, marginTop: 9 }}>
            {t("لا يصل الزبون شيء حتى تضغط «إرسال» من تبويب الطابور.",
               "The customer gets nothing until you press Send in the Queue tab.")}
          </div>
        </>
      ) : (
        <>
          {row(t("في التعليق", "In the comment"), comment)}
          {row(t("الكود", "The code"), codeExample, true)}
          {row(t("يفتح", "It opens"), `${host}/r/${codeExample}`, true)}
          {row(t("الـQR يحمل", "The QR carries"), `${host}/r/${codeExample}`, true)}
          {row(t("وخلفه", "Behind it"), priceText.trim() || t("(اكتب السعر أعلاه)", "(write the price above)"))}
          <div style={{ fontSize: 11, color: c.muted, lineHeight: 1.7, marginTop: 9 }}>
            {t("الكود والـQR يحملان نفس الرابط ويستهلكان نفس الفتحة الواحدة. كود جديد لكل زبون، صالح ٢٤ ساعة.",
               "The code and the QR carry the same link and spend the same single open. A new code for every customer, valid 24 hours.")}
          </div>
        </>
      )}
    </div>
  );
}
