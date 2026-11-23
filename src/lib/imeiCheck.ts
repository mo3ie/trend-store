import { aiComplete, hasAI, parseJsonReply } from "@/services/ai";

/**
 * IMEI / serial check through a paid lookup provider (iCloud/FMI lock, blacklist
 * (lost/stolen), carrier/SIM lock, warranty, purchase date, model, refurbished…).
 *
 * Configure with env:
 *   IMEI_PROVIDER = "sickw" | "imeicheck" | "generic"
 *   IMEI_API_KEY  = provider key
 *   IMEI_SERVICE  = provider service id (which report to run)
 *   IMEI_API_URL  = only for "generic": URL with {imei} {key} {service} placeholders
 * Providers answer in different formats (HTML-ish text or JSON), so the raw
 * answer is normalised by the AI into the fields below — values are only taken
 * from the provider's text, never invented.
 */
export type ImeiFacts = {
  imeiMasked: string;
  model?: string; color?: string; storage?: string;
  icloud?: "on" | "off"; blacklist?: "clean" | "lost" | "stolen" | "blocked";
  simLock?: "locked" | "unlocked"; carrier?: string;
  warranty?: string; purchaseDate?: string; refurbished?: boolean; replaced?: boolean;
  provider: string;
};

export const imeiEnabled = () => !!(process.env.IMEI_API_KEY || "").trim() && !!(process.env.IMEI_PROVIDER || "").trim();

/** 15-digit IMEI with a valid Luhn check digit, or an Apple-style serial (10–12 alphanumerics). */
export function validId(raw: string): string | null {
  const v = raw.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{15}$/.test(v)) {
    let sum = 0;
    for (let i = 0; i < 15; i++) { let d = Number(v[14 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    return sum % 10 === 0 ? v : null;
  }
  return /^[A-Z0-9]{10,12}$/.test(v) ? v : null;
}

async function fetchRaw(id: string): Promise<string> {
  const key = process.env.IMEI_API_KEY!.trim(), svc = (process.env.IMEI_SERVICE || "").trim();
  const p = (process.env.IMEI_PROVIDER || "").trim().toLowerCase();
  let r: Response;
  if (p === "sickw") {
    r = await fetch(`https://sickw.com/api.php?format=json&key=${encodeURIComponent(key)}&imei=${id}&service=${encodeURIComponent(svc || "demo")}`, { cache: "no-store" });
  } else if (p === "imeicheck") {
    r = await fetch("https://api.imeicheck.net/v1/checks", {
      method: "POST", cache: "no-store",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ deviceId: id, serviceId: Number(svc) || svc }),
    });
  } else {
    const url = (process.env.IMEI_API_URL || "").replace("{imei}", id).replace("{key}", encodeURIComponent(key)).replace("{service}", encodeURIComponent(svc));
    if (!url) throw new Error("IMEI_API_URL missing");
    r = await fetch(url, { cache: "no-store" });
  }
  const text = await r.text();
  if (!r.ok) throw new Error(`imei_http_${r.status}`);
  return text.slice(0, 8000);
}

export async function checkImei(raw: string): Promise<ImeiFacts | { error: string }> {
  const id = validId(raw);
  if (!id) return { error: "رقم IMEI غير صحيح — اطلب ‎*#06#‎ وانسخ الرقم (15 رقم)" };
  if (!imeiEnabled()) return { error: "imei_not_configured" };
  let text: string;
  try { text = await fetchRaw(id); } catch (e) { return { error: (e as Error).message }; }
  const base: ImeiFacts = { imeiMasked: `${id.slice(0, 2)}•••••••••${id.slice(-4)}`, provider: process.env.IMEI_PROVIDER || "provider" };
  if (!hasAI()) return base;
  try {
    const out = await aiComplete({
      system: `You convert an IMEI-check provider response into JSON. Use ONLY values present in the text; omit anything not stated. Return JSON only:
{"model":"","color":"","storage":"","icloud":"on|off","blacklist":"clean|lost|stolen|blocked","simLock":"locked|unlocked","carrier":"","warranty":"","purchaseDate":"","refurbished":false,"replaced":false}`,
      user: text, maxTokens: 400, temperature: 0,
    });
    const j = parseJsonReply<Record<string, unknown>>(out);
    const s = (v: unknown, n = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
    const pick = <T extends string>(v: unknown, ok: T[]) => (ok.includes(String(v) as T) ? (String(v) as T) : undefined);
    return {
      ...base,
      model: s(j.model), color: s(j.color, 30), storage: s(j.storage, 20),
      icloud: pick(j.icloud, ["on", "off"]), blacklist: pick(j.blacklist, ["clean", "lost", "stolen", "blocked"]),
      simLock: pick(j.simLock, ["locked", "unlocked"]), carrier: s(j.carrier, 50), warranty: s(j.warranty, 80), purchaseDate: s(j.purchaseDate, 30),
      refurbished: typeof j.refurbished === "boolean" ? j.refurbished : undefined, replaced: typeof j.replaced === "boolean" ? j.replaced : undefined,
    };
  } catch { return base; }
}
