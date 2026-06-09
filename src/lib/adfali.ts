// Edfali (ادفع لي) — مصرف التجارة والتنمية
// SOAP 1.1 — endpoint only reachable from whitelisted IPs (Vercel)
// Method 1: DoPTrans   → sends OTP to customer, returns sessionID
// Method 2: OnlineConfTrans → confirms OTP, returns "OK" on success

const ENDPOINT = "http://62.240.55.2:6187/BCDUssd/NewEdfali.asmx";
const SYS_PW   = "123@xdsr$#!!";

const ERRORS: Record<string, string> = {
  PW:    "كلمة مرور الخدمة خاطئة",
  PW1:   "كلمة مرور الخدمة خاطئة",
  ACC:   "الحساب التاجر غير مفعّل",
  LIMIT: "المبلغ خارج الحدود المسموح بها",
  BAL:   "رصيد غير كافٍ لدى العميل",
  NO:    "رقم الهاتف غير مسجل في ادفع لي",
};

function buildSoap(method: string, params: Record<string, string | number>): string {
  const fields = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
xmlns:xsd="http://www.w3.org/2001/XMLSchema" \
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
<soap:Body><${method} xmlns="http://tempuri.org/">${fields}</${method}></soap:Body>\
</soap:Envelope>`;
}

function extractResult(xml: string, method: string): string {
  return xml.match(new RegExp(`<${method}Result>([^<]*)<\/${method}Result>`))?.[1]?.trim() ?? "";
}

async function soapCall(method: string, params: Record<string, string | number>): Promise<string> {
  const body = buildSoap(method, params);
  console.log(`[edfali] → ${method}`, JSON.stringify(params));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method:  "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction":   `"http://tempuri.org/${method}"`,
      },
      body,
      cache:  "no-store",
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new Error("انتهت مهلة الاتصال بسيرفر ادفع لي (20 ث)");
    throw new Error(`تعذّر الاتصال بسيرفر ادفع لي: ${err.message}`);
  }
  clearTimeout(timer);

  const xml = await res.text();
  console.log(`[edfali] ← ${method} HTTP ${res.status} | raw:`, xml);

  if (!res.ok) throw new Error(`سيرفر ادفع لي أعاد خطأ HTTP ${res.status}`);

  const value = extractResult(xml, method);
  if (!value) throw new Error("رقم الهاتف غير مسجل في ادفع لي أو تعذّر إرسال رمز التحقق");

  console.log(`[edfali] result for ${method}:`, value);
  return value;
}

// Normalize: strip leading 0 — e.g. 0918621511 → 918621511
export function normalizePhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("218")) d = d.slice(3);
  if (d.startsWith("0"))   d = d.slice(1);
  return d;
}

// Step 1 — sends OTP to customer, returns sessionID string
export async function doPTrans(customerPhone: string, amountLYD: number): Promise<string> {
  if (!process.env.EDFALI_MOBILE || !process.env.EDFALI_PIN)
    throw new Error("متغيرات البيئة EDFALI_MOBILE / EDFALI_PIN غير موجودة");

  const normalized = normalizePhone(customerPhone);
  const amount     = Math.round(amountLYD);

  console.log(`[edfali] DoPTrans — merchant: ${process.env.EDFALI_MOBILE}, customer: ${normalized}, amount: ${amount}`);

  const value = await soapCall("DoPTrans", {
    Mobile:  process.env.EDFALI_MOBILE,
    Pin:     process.env.EDFALI_PIN,
    Cmobile: normalized,
    Amount:  amount,
    PW:      SYS_PW,
  });

  const upper = value.toUpperCase();
  const errMsg = ERRORS[upper];
  if (errMsg) throw new Error(`[${upper}] ${errMsg}`);

  return value; // sessionID
}

// Step 2 — confirms OTP, throws on failure
export async function onlineConfTrans(sessionId: string, customerOtp: string): Promise<void> {
  if (!process.env.EDFALI_MOBILE)
    throw new Error("متغير البيئة EDFALI_MOBILE غير موجود");

  const value = await soapCall("OnlineConfTrans", {
    Mobile:    process.env.EDFALI_MOBILE,
    Pin:       customerOtp,
    sessionID: sessionId,
    PW:        SYS_PW,
  });

  if (value.toUpperCase() !== "OK")
    throw new Error(`[${value}] رمز التحقق خاطئ أو انتهت صلاحيته`);
}
