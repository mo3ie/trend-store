// MobiCash (موبي كاش) — Wahda Bank card payments, merchant API-key auth
//
// Two-step card flow, same shape as Yusor Pay:
//   1. POST /payments/card            → bank sends an OTP to the customer,
//                                       returns a payment_uuid (valid 5 min)
//   2. POST /payments/card/verify-otp → confirms the sale with that OTP and
//                                       returns the bank reference number
//
// The payment_uuid is the only state carried between the two calls, so the
// caller persists it (on the order / wallet transaction / ad payment row).
// Auth is a single merchant API key sent in the JSON body (the documented
// primary method; X-API-Key / Authorization: ApiKey headers also work).

function cleanEnv(v: string | undefined): string {
  return (v ?? "").replace(/^﻿/, "").trim();
}

// Trailing slashes are stripped so a value like "https://api.wahda.mobi/" —
// the form MobiCash hands out — cannot produce a double-slashed request path.
const BASE_URL = (cleanEnv(process.env.MOBICASH_BASE_URL) || "https://api.wahda.mobi").replace(/\/+$/, "");
const API_KEY  = cleanEnv(process.env.MOBICASH_API_KEY);

// Session lifetime advertised by the API (expires_in, seconds).
const DEFAULT_EXPIRES_IN = 300;

type MobicashResponse<T> = {
  data?: T;
  message?: string;
  error?: string;
  status: "success" | "error";
};

type InitiateContent = {
  amount: number;
  expires_in: number;
  payment_uuid: string;
  status: string; // PENDING
};

type VerifyContent = {
  uuid: string;
  type: string;                   // CARD_PAYMENT
  amount: number;
  currency: string;               // LYD
  status: string;                 // COMPLETED
  description?: string;
  bank_reference_number?: string;
  bank_transaction_date?: string;
  device_info?: string;
};

// The API answers in English; customers read Arabic. Map the documented error
// strings, fall back to the raw message so nothing is swallowed.
function arabicError(raw: string): string {
  const e = (raw || "").toLowerCase();
  // Gateway-side outage. MobiCash wraps its own upstream failures inside the
  // same "failed to get customer details" text, so this must be checked first
  // — otherwise a MobiCash outage is reported to the customer as a bad card.
  if (e.includes("deadline exceeded") || e.includes("timeout") ||
      e.includes("failed to send request") || e.includes("connection refused") ||
      e.includes("no such host") || e.includes("bad gateway"))
    return "خدمة موبي كاش لا تستجيب حاليًا (عطل مؤقت لدى المزوّد) — يرجى المحاولة لاحقًا";
  if (e.includes("failed to get customer details")) return "رقم البطاقة غير صحيح أو غير مفعّل لدى موبي كاش";
  if (e.includes("invalid otp"))                    return "رمز التحقق غير صحيح";
  if (e.includes("maximum verification attempts"))  return "تم تجاوز عدد محاولات إدخال الرمز — يرجى بدء عملية دفع جديدة";
  if (e.includes("no bank reference"))              return "لم يستجب المصرف لعملية الدفع — يرجى المحاولة مجددًا";
  if (e.includes("expired") || e.includes("not found")) return "انتهت صلاحية جلسة الدفع (5 دقائق) — يرجى إعادة المحاولة";
  if (e.includes("insufficient"))                   return "الرصيد غير كافٍ في البطاقة";
  if (e.includes("api key") || e.includes("unauthorized") || e.includes("merchant"))
    return "بيانات تاجر موبي كاش غير صالحة — راجع إعدادات المتجر";
  return raw || "فشلت العملية لدى موبي كاش";
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!API_KEY) throw new Error("مفتاح موبي كاش غير مضبوط (MOBICASH_API_KEY)");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/merchant-api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify({ api_key: API_KEY, ...body }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const code = e.cause?.code || "";
    let msg: string;
    if (e.name === "AbortError")            msg = "انتهت مهلة الاتصال بخدمة موبي كاش — لم يستجب الخادم";
    else if (code === "ETIMEDOUT")          msg = "انتهت مهلة الاتصال بخدمة موبي كاش";
    else if (code === "ECONNREFUSED")       msg = "رُفض الاتصال بخدمة موبي كاش";
    else if (code === "ENOTFOUND" || code === "EAI_AGAIN") msg = "تعذّر العثور على خادم موبي كاش (مشكلة DNS)";
    else                                    msg = `تعذّر الاتصال بخدمة موبي كاش: ${e.cause?.message || e.message}`;
    console.log(`[mobicash:${path}] fetch-error name=${e.name} code=${code || "?"} msg=${e.message}`);
    throw new Error(msg);
  }
  clearTimeout(timer);

  const raw = await res.text();
  // Never log the card number / OTP — only the gateway's own answer.
  console.log(`[mobicash:${path}] http=${res.status} body=${raw.slice(0, 400)}`);

  let json: MobicashResponse<T>;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`تعذّر قراءة رد خدمة موبي كاش (HTTP ${res.status})`);
  }

  if (!res.ok || json.status !== "success" || !json.data) {
    throw new Error(arabicError(json.error || json.message || ""));
  }

  return json.data;
}

// Step 1 — charge a card: the bank sends an OTP to the cardholder and we get
// back the payment_uuid that identifies this attempt. `amount` is in Libyan
// dinars and may carry fils (e.g. 10.5).
export async function initiateCardPayment(opts: {
  cardNumber: string;
  amount: number;
  description?: string;
}): Promise<{ paymentUuid: string; amount: number; expiresIn: number; expiresAt: string }> {
  const cardNumber = String(opts.cardNumber || "").replace(/\D/g, "");
  if (cardNumber.length < 5 || cardNumber.length > 19) {
    throw new Error("رقم البطاقة غير صحيح");
  }

  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (!amount || amount <= 0) throw new Error("المبلغ غير صحيح");

  const data = await call<InitiateContent>("payments/card", {
    card_number: cardNumber,
    amount,
    description: opts.description || "Trend Store payment",
  });

  if (!data.payment_uuid) throw new Error("لم تُرجع خدمة موبي كاش معرّف العملية");

  const expiresIn = Number(data.expires_in) || DEFAULT_EXPIRES_IN;
  return {
    paymentUuid: data.payment_uuid,
    amount: Number(data.amount ?? amount),
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

// Step 2 — confirm the sale with the OTP the cardholder received.
export async function verifyOtp(opts: {
  paymentUuid: string;
  otp: string;
}): Promise<{
  uuid: string;
  status: string;
  amount: number;
  currency: string;
  bankReference: string | null;
  bankTransactionDate: string | null;
}> {
  const otp = String(opts.otp || "").trim();
  if (!otp) throw new Error("رمز التحقق مطلوب");
  if (!opts.paymentUuid) throw new Error("لم تبدأ عملية الدفع");

  const data = await call<VerifyContent>("payments/card/verify-otp", {
    payment_uuid: opts.paymentUuid,
    otp,
  });

  return {
    uuid: data.uuid,
    status: data.status,
    amount: Number(data.amount),
    currency: data.currency || "LYD",
    bankReference: data.bank_reference_number || null,
    bankTransactionDate: data.bank_transaction_date || null,
  };
}

// True once the merchant key is configured — used to hide the method in UIs.
export const mobicashConfigured = Boolean(API_KEY);
