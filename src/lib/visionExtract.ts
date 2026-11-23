/**
 * Reads phone SETTINGS SCREENSHOTS with a vision model and returns structured
 * facts for the deep-scan certificate:
 *   iPhone  : Battery Health (max capacity %, peak performance / service notice),
 *             About (model, capacity, iOS, cycle count on iOS 17.4+),
 *             «Parts & Service History» (genuine / unknown part per component)
 *   Android : About phone, Battery info / health (Samsung, Pixel…)
 * Only what is visibly written on the screenshots is returned — never guessed.
 */
export type VisionFacts = {
  platform?: "ios" | "android";
  device: { model?: string; storage?: string; os?: string };
  battery: { healthPct?: number; cycles?: number; peakPerformanceOk?: boolean; serviceWarning?: boolean; note?: string };
  parts: { part: string; status: "genuine" | "unknown" | "replaced" | "used" | "not_shown"; note?: string }[];
  warnings: string[];
  screensRead: number;
};

const MODELS = [
  process.env.GROQ_VISION_MODEL,
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.2-90b-vision-preview",
  "llama-3.2-11b-vision-preview",
].filter(Boolean) as string[];

const PROMPT = `You read screenshots of a phone's Settings app (Arabic or English, iPhone or Android).
Extract ONLY values that are clearly visible. Never guess. Missing = omit the field.
Look for: Battery Health / Maximum Capacity % / صحة البطارية / السعة القصوى; cycle count / عدد الدورات;
peak performance capability message; "Service" / "صيانة" battery warning; model name, capacity (GB), iOS/Android version;
"Parts and Service History" / "سجل القطع والصيانة": each part (Battery, Display, Camera, Face ID, Back glass…) with "Genuine Apple Part" (genuine),
"Unknown Part" / "قطعة غير معروفة" (unknown), "Used" (used), or a repair/replacement entry (replaced).
Return JSON only:
{"platform":"ios|android","device":{"model":"","storage":"","os":""},"battery":{"healthPct":0,"cycles":0,"peakPerformanceOk":true,"serviceWarning":false,"note":""},"parts":[{"part":"Battery","status":"genuine|unknown|replaced|used","note":""}],"warnings":[""]}`;

export async function readScreenshots(images: string[]): Promise<VisionFacts | { error: string }> {
  const key = (process.env.GROQ_API_KEY || "").trim();
  if (!key) return { error: "no_vision" };
  const content = [{ type: "text", text: PROMPT }, ...images.slice(0, 5).map((url) => ({ type: "image_url", image_url: { url } }))];
  let lastStatus = 0, lastErr = "";
  for (const model of MODELS) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", cache: "no-store",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 900, messages: [{ role: "user", content }] }),
    });
    if (!r.ok) { lastStatus = r.status; lastErr += ` | ${model}: ${(await r.text().catch(() => "")).slice(0, 220)}`; if ([400, 403, 404].includes(r.status)) continue; break; }
    const d = await r.json().catch(() => ({}));
    const raw = String(d.choices?.[0]?.message?.content || "");
    let j: Partial<VisionFacts> & Record<string, unknown>;
    try { j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch { return { error: "bad_json" }; }
    const num = (v: unknown, lo: number, hi: number) => { const x = Number(v); return isFinite(x) && x >= lo && x <= hi && x !== 0 ? Math.round(x) : undefined; };
    const str = (v: unknown, n = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
    const b = (j.battery || {}) as Record<string, unknown>;
    const dv = (j.device || {}) as Record<string, unknown>;
    const STAT = ["genuine", "unknown", "replaced", "used"];
    return {
      platform: j.platform === "android" ? "android" : j.platform === "ios" ? "ios" : undefined,
      device: { model: str(dv.model), storage: str(dv.storage, 20), os: str(dv.os, 30) },
      battery: {
        healthPct: num(b.healthPct, 30, 100), cycles: num(b.cycles, 1, 5000),
        peakPerformanceOk: typeof b.peakPerformanceOk === "boolean" ? b.peakPerformanceOk : undefined,
        serviceWarning: b.serviceWarning === true ? true : undefined, note: str(b.note, 160),
      },
      parts: (Array.isArray(j.parts) ? j.parts : []).slice(0, 12)
        .map((p: { part?: unknown; status?: unknown; note?: unknown }) => ({ part: str(p.part, 30) || "", status: (STAT.includes(String(p.status)) ? p.status : "not_shown") as VisionFacts["parts"][number]["status"], note: str(p.note, 100) }))
        .filter((p) => p.part && p.status !== "not_shown"),
      warnings: (Array.isArray(j.warnings) ? j.warnings : []).map((w) => str(w, 140)).filter(Boolean) as string[],
      screensRead: Math.min(images.length, 5),
    };
  }
  // Diagnostics: which models does this account actually have?
  const ms = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${key}` } }).then((r) => r.json()).catch(() => ({}));
  const ids = ((ms as { data?: { id: string }[] }).data || []).map((m) => m.id).join(",");
  return { error: `vision_http_${lastStatus} models=[${ids}]` };
}

export const visionUseful = (v: VisionFacts) => v.battery.healthPct !== undefined || v.battery.cycles !== undefined || v.parts.length > 0 || !!v.device.model;
