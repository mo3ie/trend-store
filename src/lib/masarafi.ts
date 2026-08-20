// مصرفي باي (Masarafi Pay) — مصرف الجمهورية — Online Payment — MITF / مسارات
// Direct bank-linked card payment for Jumhouria Bank cards. SAME method and
// API shape as Yusor Pay (يسر باي) but a COMPLETELY SEPARATE service: different
// bank, merchant credentials, mTLS client certificate, host and port.
// Kept as its own module (a copy of yusor.ts) so the two never share state.
//
// Flow:
//   1. Signin          → authenticate the merchant, returns a bearer token
//   2. OpenSession     → request a sale, bank sends an OTP to the customer
//   3. CompleteSession → confirm the sale with the customer's OTP
//
// The same merchant token must be reused between OpenSession and
// CompleteSession, so the caller persists it (on the order row) between the
// two HTTP requests.

function cleanEnv(v: string | undefined): string {
  return (v ?? "").replace(/^﻿/, "").trim();
}

// Production endpoint: https://musrefypay-online.mitflink.ly:40110/JUMOnline
// In production MUSRFY_BASE_URL points at our static-IP mTLS relay (relay/),
// whose path is forwarded verbatim, so it must also end in /JUMOnline.
const BASE_URL = cleanEnv(process.env.MUSRFY_BASE_URL) ||
  "https://musrefypay-online.mitflink.ly:40110/JUMOnline";

// authUserType: 0 = main merchant (تاجر رئيسي), 1 = point of sale (نقطة بيع)
const USER_ID        = Number(cleanEnv(process.env.MUSRFY_USER_ID));
const PIN            = cleanEnv(process.env.MUSRFY_PIN);
const PROVIDER_ID    = Number(cleanEnv(process.env.MUSRFY_PROVIDER_ID));
const AUTH_USER_TYPE = Number(cleanEnv(process.env.MUSRFY_AUTH_USER_TYPE) || "0");

const ONLINE_OPERATION_SELL    = 1;
const ONLINE_OPERATION_RECOVER = 2;

// type field in every response: 1 = Success, 2 = Failed, 3 = Unknown
type MusrfyEnvelope<T> = {
  content: T;
  type: number;
  messages: string[] | null;
  traceId: string;
};

type SigninContent = {
  validTo: string;
  refreshToken: string;
  systemIdentity: string;
  creds: number;
  tag: number;
  value: string; // bearer token used to authenticate subsequent calls
};

function msgOf(env: MusrfyEnvelope<unknown>, fallback: string): string {
  const m = (env?.messages || []).filter(Boolean).join(" — ");
  return m || fallback;
}

async function call<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<MusrfyEnvelope<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // When MUSRFY_BASE_URL points at our static-IP relay (relay/), this shared
  // secret authorises the proxy hop. Ignored when calling Masarafi directly.
  const relayKey = cleanEnv(process.env.MUSRFY_RELAY_KEY);
  if (relayKey) headers["x-relay-key"] = relayKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/OnlinePaymentServices/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = err as Error & {
      cause?: { code?: string; errno?: number; message?: string; address?: string; port?: number };
    };
    const code = e.cause?.code || "";
    let msg: string;
    if (e.name === "AbortError") {
      msg = "انتهت مهلة الاتصال بخدمة مصرفي باي (20 ث) — الخادم لم يستجب (غالبًا IP خادمنا غير مضاف في قائمة مسارات)";
    } else if (code === "ETIMEDOUT") {
      msg = "انتهت مهلة الاتصال — IP خادمنا غير مسموح به في قائمة مسارات (whitelist)";
    } else if (code === "ECONNREFUSED") {
      msg = "رُفض الاتصال بخدمة مصرفي باي — المنفذ مغلق أو الاتصال مرفوض من جهة الخادم";
    } else if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      msg = "تعذّر العثور على خادم مصرفي باي (مشكلة DNS في عنوان الخدمة)";
    } else {
      msg = `تعذّر الاتصال بخدمة مصرفي باي: ${e.cause?.message || e.message}`;
    }
    console.log(
      `[masarafi:${path}] fetch-error name=${e.name} msg=${e.message} ` +
      `cause.code=${code || "?"} cause.msg=${e.cause?.message || "?"} ` +
      `addr=${e.cause?.address || "?"}:${e.cause?.port || "?"}`,
    );
    throw new Error(msg);
  }
  clearTimeout(timer);

  const raw = await res.text();
  console.log(`[masarafi:${path}] http=${res.status} body=${raw.slice(0, 500)}`);

  if (!res.ok) {
    // Try to surface a server message even on non-2xx
    let serverMsg = "";
    try { serverMsg = msgOf(JSON.parse(raw), ""); } catch { /* ignore */ }
    throw new Error(serverMsg || `خدمة مصرفي باي أعادت خطأ HTTP ${res.status}`);
  }

  let env: MusrfyEnvelope<T>;
  try {
    env = JSON.parse(raw);
  } catch {
    throw new Error("تعذّر قراءة رد خدمة مصرفي باي");
  }

  if (env.type !== 1) {
    throw new Error(msgOf(env, "فشلت العملية لدى خدمة مصرفي باي"));
  }

  return env;
}

// Step 0 — authenticate the merchant, returns the bearer token + its expiry
export async function signin(): Promise<{ token: string; validTo: string }> {
  if (!USER_ID || !PIN || !PROVIDER_ID) {
    throw new Error("متغيرات بيئة مصرفي باي ناقصة (MUSRFY_USER_ID / MUSRFY_PIN / MUSRFY_PROVIDER_ID)");
  }

  const env = await call<SigninContent>("Signin", {
    userId: USER_ID,
    pin: PIN,
    providerId: PROVIDER_ID,
    authUserType: AUTH_USER_TYPE,
  });

  const token = env.content?.value;
  if (!token) throw new Error("لم تُرجع خدمة مصرفي باي رمز الدخول");

  return { token, validTo: env.content.validTo };
}

// Step 1 — request a sale; bank sends an OTP to the customer's phone.
// amount is in whole Libyan dinars (integer per the API spec).
// identityCard: 9 digits (card number + prefix) for most banks,
//               10 digits (card number only) for Trade & Development Bank.
//
// IMPORTANT: OpenSession returns its OWN bearer token (content.value), scoped to
// this sale session. CompleteSession MUST be authenticated with THIS token, not
// the Signin token — using the Signin token there returns HTTP 403 (confirmed
// with Masarat). So we return it for the caller to persist until CompleteSession.
export async function openSession(
  token: string,
  opts: { amount: number; identityCard: string; transactionId: string },
): Promise<{ token: string; validTo: string }> {
  const amount = Math.round(Number(opts.amount));
  if (!amount || amount <= 0) throw new Error("المبلغ غير صحيح");

  const identityCard = opts.identityCard.replace(/\D/g, "");
  if (identityCard.length < 9 || identityCard.length > 10) {
    throw new Error("رقم البطاقة يجب أن يكون 9 أرقام (أو 10 لمصرف التجارة والتنمية)");
  }

  const env = await call<SigninContent>("OpenSession", {
    amount,
    identityCard,
    transactionId: opts.transactionId,
    onlineOperation: ONLINE_OPERATION_SELL,
  }, token);

  const sessionToken = env.content?.value;
  if (!sessionToken) throw new Error("لم تُرجع خدمة مصرفي باي رمز الجلسة");

  return { token: sessionToken, validTo: env.content.validTo };
}

// Step 2 — confirm the sale with the OTP the customer received.
// `token` MUST be the token returned by openSession (not the signin token).
export async function completeSession(token: string, otp: string): Promise<void> {
  const code = (otp || "").trim();
  if (!code) throw new Error("رمز التحقق مطلوب");

  await call<unknown>("CompleteSession", { otp: code }, token);
}

export { ONLINE_OPERATION_SELL, ONLINE_OPERATION_RECOVER };
