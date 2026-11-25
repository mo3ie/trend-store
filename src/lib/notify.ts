import webpush from "web-push";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

/**
 * ONE way to tell a customer something: `notifyUser` writes the in-site notification
 * (the bell) AND pushes it to every phone/browser the customer enabled. Every
 * customer-facing event in the store goes through here — never insert into
 * `notifications` directly, or the phone won't hear about it.
 *
 * Env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (server only), VAPID_SUBJECT.
 * Without the keys the bell still works and push is skipped silently.
 */
export type Notice = { title: string; body?: string; link?: string; type?: string; important?: boolean; tag?: string };

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:trend@trendstore-ly.com", pub, priv);
  return configured;
}
export const pushPublicKey = () => (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();

/** Push only (no bell row). Dead subscriptions (404/410) are removed. */
export async function pushToUser(userId: string, n: Notice): Promise<{ sent: number; failed: number }> {
  if (!userId || !ready()) return { sent: 0, failed: 0 };
  const { data: subs } = await db.from("store_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  if (!subs?.length) return { sent: 0, failed: 0 };
  const payload = JSON.stringify({
    title: n.title, body: n.body || "", url: n.link || "/", tag: n.tag || n.type || "trend", important: !!n.important,
  });
  let sent = 0;
  const dead: string[] = [], ok: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 * 3, urgency: n.important ? "high" : "normal" });
      sent++; ok.push(s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
      else console.error("[push] send failed", code, (e as Error).message?.slice(0, 120));
    }
  }));
  if (dead.length) await db.from("store_push_subscriptions").delete().in("id", dead);
  if (ok.length) await db.from("store_push_subscriptions").update({ last_ok_at: new Date().toISOString() }).in("id", ok);
  return { sent, failed: subs.length - sent };
}

/** Bell + phone. Never throws: a notification must not break the action that caused it. */
export async function notifyUser(userId: string | null | undefined, n: Notice): Promise<void> {
  if (!userId) return;
  try {
    await db.from("notifications").insert({ user_id: userId, type: n.type || "info", title: n.title, body: n.body || null, link: n.link || null });
  } catch (e) { console.error("[notify] bell insert failed", (e as Error).message); }
  try { await pushToUser(userId, n); } catch (e) { console.error("[notify] push failed", (e as Error).message); }
}

const fmt = (n: number) => `${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل`;

/** Wording for the events that had no notification before. */
export const NOTICES = {
  walletTopup: (amount: number, balance?: number | null): Notice => ({
    type: "wallet", title: "💰 تم شحن محفظتك", link: "/account",
    body: `أُضيف ${fmt(amount)} لرصيدك${balance != null ? ` — رصيدك الآن ${fmt(balance)}` : ""}.`,
  }),
  walletReceived: (amount: number, from: string): Notice => ({
    type: "wallet", title: "💸 وصلك تحويل", link: "/account", important: true,
    body: `حوّل لك ${from} مبلغ ${fmt(amount)} على محفظتك.`,
  }),
  walletSent: (amount: number, to: string): Notice => ({
    type: "wallet", title: "تم التحويل", link: "/account", body: `حوّلت ${fmt(amount)} إلى ${to}.`,
  }),
  orderPlaced: (id: string, total: number): Notice => ({
    type: "order", title: "🛍️ وصلنا طلبك", link: "/orders",
    body: `طلب رقم ${id.slice(0, 8)} بقيمة ${fmt(total)} — بنجهّزه ونبلّغك بكل خطوة.`,
  }),
  orderStatus: (id: string, status: string, kind: "store" | "shein" = "store"): Notice | null => {
    const m: Record<string, [string, string]> = {
      processing: ["⚙️ طلبك قيد التجهيز", "بدأنا نجهّز طلبك."],
      shipped: ["🚚 طلبك في الطريق", "طلبك تم شحنه وفي الطريق إليك."],
      delivered: ["✅ تم تسليم طلبك", "استلمت طلبك — شكراً لثقتك في ترند."],
      cancelled: ["طلبك ألغي", "تم إلغاء طلبك. لو عندك سؤال تواصل معنا."],
      paid: ["تم تأكيد الدفع", "استلمنا دفعتك وبنكمّل طلبك."],
    };
    const x = m[status];
    if (!x) return null;
    return { type: "order", title: x[0], body: `${kind === "shein" ? "طلب شي إن" : "طلب"} رقم ${id.slice(0, 8)}: ${x[1]}`, link: "/orders", important: status === "shipped" || status === "delivered" };
  },
  orderPayment: (id: string, status: string): Notice | null => {
    const m: Record<string, [string, string]> = {
      paid: ["💳 تم تأكيد دفعك", "استلمنا قيمة طلبك."],
      failed: ["تعذّر الدفع", "عملية الدفع ما تمّتش — جرّب مرة ثانية أو اختر طريقة دفع أخرى."],
      refunded: ["↩️ تم استرجاع المبلغ", "رجّعنا قيمة طلبك."],
    };
    const x = m[status];
    return x ? { type: "order", title: x[0], body: `طلب رقم ${id.slice(0, 8)}: ${x[1]}`, link: "/orders" } : null;
  },
  maintenance: (id: string, status: string, quote?: number | null): Notice | null => {
    const m: Record<string, [string, string]> = {
      new: ["🛠️ وصلنا طلب الصيانة", "بنفحص جهازك ونرسلك التسعيرة."],
      quoted: ["💬 تسعيرة الصيانة جاهزة", quote != null ? `تكلفة الصيانة ${fmt(quote)}.` : "التسعيرة جاهزة."],
      in_progress: ["🔧 جهازك قيد الصيانة", "الفني بدأ يشتغل على جهازك."],
      ready: ["✅ جهازك جاهز", "جهازك جاهز للاستلام."],
      delivered: ["تم تسليم جهازك", "شكراً لثقتك في صيانة ترند."],
      cancelled: ["أُلغي طلب الصيانة", "تم إلغاء طلب الصيانة."],
    };
    const x = m[status];
    return x ? { type: "maintenance", title: x[0], body: `طلب ${id.slice(0, 8)}: ${x[1]}`, link: `/maintenance/track?id=${id}`, important: status === "ready" || status === "quoted" } : null;
  },
  adPaused: (name?: string | null, platform = "فيسبوك"): Notice => ({
    type: "warning", title: "⏸️ حملتك توقفت", link: platform === "تيك توك" ? "/tiktok-ads/campaigns" : "/ads/campaigns", important: true,
    body: `حملة ${platform}${name ? ` «${name}»` : ""} توقفت مؤقتاً لأن رصيد المحفظة ما يكفيش — اشحن واستأنفها.`,
  }),
};
