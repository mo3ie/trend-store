// Adfali web service — direct integration with مصرف التجارة و التنمية
// Endpoint: http://62.240.55.2:6187/BCDUssd/NewEdfali.asmx

const ADFALI_URL = "http://62.240.55.2:6187/BCDUssd/NewEdfali.asmx";
const PW = "123@xdsr$#!!";

const ERROR_MESSAGES: Record<string, string> = {
  PW1:   "خطأ في إعداد الخدمة",
  PW:    "خطأ في إعداد الخدمة",
  Limit: "المبلغ خارج الحدود المسموح بها",
  ACC:   "رقم الهاتف غير مسجل في ادفع لي",
  Bal:   "تعذّر إتمام العملية",
};

function extractXml(xml: string): string {
  return xml.match(/<string[^>]*>([^<]*)<\/string>/)?.[1]?.trim() ?? "";
}

// Normalize Libyan phone to +218XXXXXXXXX format (13 chars)
export function normalizePhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("218")) d = d.slice(3);
  if (d.startsWith("0"))   d = d.slice(1);
  return `+218${d}`;
}

// Step 1 — initiates charge: sends OTP SMS to customer, returns sessionID
export async function doPTrans(customerPhone: string, amount: number): Promise<string> {
  const mobile  = process.env.EDFALI_MOBILE!;
  const pin     = process.env.EDFALI_PIN!;
  const cmobile = normalizePhone(customerPhone);

  const url = new URL(`${ADFALI_URL}/DoPTrans`);
  url.searchParams.set("Mobile",        mobile);
  url.searchParams.set("Pin",           pin);
  url.searchParams.set("Cmobile",       cmobile);
  url.searchParams.set("decimalAmount", String(amount));
  url.searchParams.set("PW",            PW);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const xml = await res.text();
  const value = extractXml(xml);

  if (!value)              throw new Error("لم يتم الاتصال بخدمة ادفع لي");
  if (ERROR_MESSAGES[value]) throw new Error(ERROR_MESSAGES[value]);

  return value; // sessionID
}

// Step 2 — confirm with customer OTP; returns true on "OK"
export async function onlineConfTrans(sessionId: string, customerOtp: string): Promise<void> {
  const mobile = process.env.EDFALI_MOBILE!;

  const url = new URL(`${ADFALI_URL}/OnlineConfTrans`);
  url.searchParams.set("Mobile",    mobile);
  url.searchParams.set("Pin",       customerOtp);
  url.searchParams.set("sessionID", sessionId);
  url.searchParams.set("PW",        PW);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const xml = await res.text();
  const value = extractXml(xml);

  if (value !== "OK") throw new Error("رمز التحقق غير صحيح أو انتهت صلاحيته");
}
