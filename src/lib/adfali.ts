// Adfali web service — مصرف التجارة و التنمية
// Endpoint: http://62.240.55.2:6187/BCDUssd/NewEdfali.asmx
// Protocol: SOAP 1.1 (HTTP GET is disabled on this server)

const ADFALI_ENDPOINT = "http://62.240.55.2:6187/BCDUssd/NewEdfali.asmx";
const PW = "123@xdsr$#!!";

const ERROR_MESSAGES: Record<string, string> = {
  LIMIT: "المبلغ خارج الحدود المسموح بها — تواصل مع البنك لتعديل الحدود",
  PW1:   "خطأ في إعداد الخدمة",
  PW:    "خطأ في إعداد الخدمة",
  ACC:   "تعذّر معالجة الطلب — تحقق من إعدادات حساب ادفع لي التاجر",
  BAL:   "تعذّر إتمام العملية",
};

function extractResult(xml: string, method: string): string {
  const tag = `${method}Result`;
  return xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim() ?? "";
}

function soapBody(method: string, params: Record<string, string | number>): string {
  const fields = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><${method} xmlns="http://tempuri.org/">${fields}</${method}></soap:Body>
</soap:Envelope>`;
}

async function soapCall(method: string, params: Record<string, string | number>): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(ADFALI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction":   `http://tempuri.org/${method}`,
      },
      body: soapBody(method, params),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("انتهت مهلة الاتصال بخدمة ادفع لي");
    throw new Error(`تعذّر الاتصال بخدمة ادفع لي: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`خدمة ادفع لي أعادت خطأ: ${res.status}`);

  const xml = await res.text();
  const value = extractResult(xml, method);
  if (!value) console.error(`[adfali] empty result for ${method}, xml:`, xml.slice(0, 500));
  return value;
}

// Normalize phone for Edfali: strip leading 0 (no +218 prefix needed)
// e.g. 0918621511 → 918621511
export function normalizePhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("218")) d = d.slice(3);
  if (d.startsWith("0"))   d = d.slice(1);
  return d;
}

// Step 1 — DoPTrans: initiates charge, sends OTP SMS to customer, returns sessionID
export async function doPTrans(customerPhone: string, amount: number): Promise<string> {
  if (!process.env.EDFALI_MOBILE || !process.env.EDFALI_PIN) {
    throw new Error("إعدادات ادفع لي غير مكتملة — تواصل مع الدعم");
  }

  const value = await soapCall("DoPTrans", {
    Mobile:  process.env.EDFALI_MOBILE,
    Pin:     process.env.EDFALI_PIN,
    Cmobile: normalizePhone(customerPhone),
    Amount:  amount,
    PW,
  });

  if (!value) throw new Error("لم يستجب سيرفر ادفع لي — حاول مرة أخرى أو تواصل مع الدعم");
  const upper = value.toUpperCase();
  if (ERROR_MESSAGES[upper]) throw new Error(ERROR_MESSAGES[upper]);

  return value; // sessionID
}

// Step 2 — OnlineConfTrans: confirms customer OTP, throws on failure
export async function onlineConfTrans(sessionId: string, customerOtp: string): Promise<void> {
  const value = await soapCall("OnlineConfTrans", {
    Mobile:    process.env.EDFALI_MOBILE!,
    Pin:       customerOtp,
    sessionID: sessionId,
    PW,
  });

  if (value.toUpperCase() !== "OK") throw new Error("رمز التحقق غير صحيح أو انتهت صلاحيته");
}
