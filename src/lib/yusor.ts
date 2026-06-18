// Yusor Pay (يسر باي) — Online Payment — MITF / مسارات
// Direct bank-linked card payment. Customer enters their bank card identity
// number, an OTP is sent to them, and the transaction is confirmed with it.
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

const BASE_URL = cleanEnv(process.env.YUSOR_BASE_URL) ||
  "http://160.19.103.122:40120/YusorOnline";

// authUserType: 0 = main merchant (تاجر رئيسي), 1 = point of sale (نقطة بيع)
const USER_ID        = Number(cleanEnv(process.env.YUSOR_USER_ID));
const PIN            = cleanEnv(process.env.YUSOR_PIN);
const PROVIDER_ID    = Number(cleanEnv(process.env.YUSOR_PROVIDER_ID));
const AUTH_USER_TYPE = Number(cleanEnv(process.env.YUSOR_AUTH_USER_TYPE) || "0");

const ONLINE_OPERATION_SELL    = 1;
const ONLINE_OPERATION_RECOVER = 2;

// type field in every response: 1 = Success, 2 = Failed, 3 = Unknown
type YusorEnvelope<T> = {
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

function msgOf(env: YusorEnvelope<unknown>, fallback: string): string {
  const m = (env?.messages || []).filter(Boolean).join(" — ");
  return m || fallback;
}

async function call<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<YusorEnvelope<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // When YUSOR_BASE_URL points at our static-IP relay (relay/), this shared
  // secret authorises the proxy hop. Ignored when calling Yusor directly.
  const relayKey = cleanEnv(process.env.YUSOR_RELAY_KEY);
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
      msg = "انتهت مهلة الاتصال بخدمة يسر باي (20 ث) — الخادم لم يستجب (غالبًا IP خادمنا غير مضاف في قائمة مسارات)";
    } else if (code === "ETIMEDOUT") {
      msg = "انتهت مهلة الاتصال — IP خادمنا غير مسموح به في قائمة مسارات (whitelist)";
    } else if (code === "ECONNREFUSED") {
      msg = "رُفض الاتصال بخدمة يسر باي — المنفذ مغلق أو الاتصال مرفوض من جهة الخادم";
    } else if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      msg = "تعذّر العثور على خادم يسر باي (مشكلة DNS في عنوان الخدمة)";
    } else {
      msg = `تعذّر الاتصال بخدمة يسر باي: ${e.cause?.message || e.message}`;
    }
    console.log(
      `[yusor:${path}] fetch-error name=${e.name} msg=${e.message} ` +
      `cause.code=${code || "?"} cause.msg=${e.cause?.message || "?"} ` +
      `addr=${e.cause?.address || "?"}:${e.cause?.port || "?"}`,
    );
    throw new Error(msg);
  }
  clearTimeout(timer);

  const raw = await res.text();
  console.log(`[yusor:${path}] http=${res.status} body=${raw.slice(0, 500)}`);

  if (!res.ok) {
    // Try to surface a server message even on non-2xx
    let serverMsg = "";
    try { serverMsg = msgOf(JSON.parse(raw), ""); } catch { /* ignore */ }
    throw new Error(serverMsg || `خدمة يسر باي أعادت خطأ HTTP ${res.status}`);
  }

  let env: YusorEnvelope<T>;
  try {
    env = JSON.parse(raw);
  } catch {
    throw new Error("تعذّر قراءة رد خدمة يسر باي");
  }

  if (env.type !== 1) {
    throw new Error(msgOf(env, "فشلت العملية لدى خدمة يسر باي"));
  }

  return env;
}

// Step 0 — authenticate the merchant, returns the bearer token + its expiry
export async function signin(): Promise<{ token: string; validTo: string }> {
  if (!USER_ID || !PIN || !PROVIDER_ID) {
    throw new Error("متغيرات بيئة يسر باي ناقصة (YUSOR_USER_ID / YUSOR_PIN / YUSOR_PROVIDER_ID)");
  }

  const env = await call<SigninContent>("Signin", {
    userId: USER_ID,
    pin: PIN,
    providerId: PROVIDER_ID,
    authUserType: AUTH_USER_TYPE,
  });

  const token = env.content?.value;
  if (!token) throw new Error("لم تُرجع خدمة يسر باي رمز الدخول");

  return { token, validTo: env.content.validTo };
}

// Step 1 — request a sale; bank sends an OTP to the customer's phone.
// amount is in whole Libyan dinars (integer per the API spec).
// identityCard: 9 digits (card number + prefix) for most banks,
//               10 digits (card number only) for Trade & Development Bank.
export async function openSession(
  token: string,
  opts: { amount: number; identityCard: string; transactionId: string },
): Promise<void> {
  const amount = Math.round(Number(opts.amount));
  if (!amount || amount <= 0) throw new Error("المبلغ غير صحيح");

  const identityCard = opts.identityCard.replace(/\D/g, "");
  if (identityCard.length < 9 || identityCard.length > 10) {
    throw new Error("رقم البطاقة يجب أن يكون 9 أرقام (أو 10 لمصرف التجارة والتنمية)");
  }

  await call<unknown>("OpenSession", {
    amount,
    identityCard,
    transactionId: opts.transactionId,
    onlineOperation: ONLINE_OPERATION_SELL,
  }, token);
}

// Step 2 — confirm the sale with the OTP the customer received.
export async function completeSession(token: string, otp: string): Promise<void> {
  const code = (otp || "").trim();
  if (!code) throw new Error("رمز التحقق مطلوب");

  await call<unknown>("CompleteSession", { otp: code }, token);
}

export { ONLINE_OPERATION_SELL, ONLINE_OPERATION_RECOVER };
