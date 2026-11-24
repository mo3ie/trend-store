import { NextRequest, NextResponse } from "next/server";
import { rateLimited } from "@/lib/catalog";

/**
 * «ترندي» voice — Groq Orpheus Arabic (male voice). Speaks the Libyan-dialect text the assistant writes.
 * One call = one chunk of ≤190 chars (the model's limit is 200); the browser plays chunks in order.
 * Returns audio/wav, or 503 so the browser falls back to its own Arabic voice.
 */
const MODEL = "canopylabs/orpheus-arabic-saudi";
const VOICE = process.env.TRENDY_VOICE || "fahad";

export async function POST(req: NextRequest) {
  const key = process.env.GROQ_API_KEY;
  // Paid voice — off until explicitly enabled (free browser voice is used meanwhile).
  if (process.env.NEXT_PUBLIC_TRENDY_TTS !== "groq" || !key) return NextResponse.json({ error: "no_tts" }, { status: 503 });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "x";
  if (rateLimited(`tts:${ip}`, 40, 10 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const { text } = await req.json().catch(() => ({ text: "" }));
  const input = String(text || "").slice(0, 195).trim();
  if (!input) return NextResponse.json({ error: "empty" }, { status: 400 });
  const r = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, voice: VOICE, input, response_format: "wav" }),
  }).catch(() => null);
  if (!r || !r.ok) {
    const detail = r ? (await r.text().catch(() => "")).slice(0, 300) : "network";
    console.warn("tts failed", r?.status, detail);
    return NextResponse.json({ error: "tts_failed", status: r?.status || 0, detail }, { status: 503 });
  }
  return new NextResponse(await r.arrayBuffer(), { headers: { "content-type": "audio/wav", "cache-control": "private, max-age=3600" } });
}
