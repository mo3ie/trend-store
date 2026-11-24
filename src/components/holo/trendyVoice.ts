/**
 * Speaks «ترندي»'s replies: Groq Arabic voice via /api/ai/tts, chunked (≤190 chars) and played in order.
 * Falls back to the browser's Arabic voice. Muted state is remembered per device.
 */
const MUTE_KEY = "trendy_voice_off";
// FREE ONLY for now: the browser's built-in Arabic voice. Set NEXT_PUBLIC_TRENDY_TTS=groq (and accept the Groq
// model terms) to switch to the paid Groq Arabic voice later — no other change needed.
const SERVER_TTS = process.env.NEXT_PUBLIC_TRENDY_TTS === "groq";
let current: HTMLAudioElement | null = null;
let token = 0;

export const voiceOn = () => { try { return localStorage.getItem(MUTE_KEY) !== "1"; } catch { return true; } };
export const setVoiceOn = (on: boolean) => { try { localStorage.setItem(MUTE_KEY, on ? "0" : "1"); } catch {} if (!on) stopVoice(); };

export function stopVoice() {
  token++;
  current?.pause(); current = null;
  try { speechSynthesis.cancel(); } catch {}
}

/** Text a person would actually say: no emojis, markdown, links, lists of prices. */
export function speakable(t: string) {
  return t
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|~\[\]()]/g, " ")
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function chunks(t: string, max = 190, limit = 3) {
  const parts = t.split(/(?<=[.!؟?،…\n])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + " " + p).trim().length <= max) cur = (cur + " " + p).trim();
    else { if (cur) out.push(cur); cur = p.length > max ? p.slice(0, max) : p; }
    if (out.length >= limit) break;
  }
  if (cur && out.length < limit) out.push(cur);
  return out;
}

/** Best free Arabic voice on this device (natural/online voices first, male preferred for the robot). */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const all = speechSynthesis.getVoices().filter((x) => /^ar/i.test(x.lang));
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|online|neural|google|premium|enhanced/i.test(v.name) ? 4 : 0) +
    (/hamed|shakir|omar|maged|tarik|naayf|fahad|male|رجل/i.test(v.name) ? 2 : 0) +
    (/^ar-(LY|EG|TN|DZ|MA)/i.test(v.lang) ? 1 : 0);
  return all.sort((a, b) => score(b) - score(a))[0];
}
if (typeof window !== "undefined" && "speechSynthesis" in window) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch {} }

function browserSay(text: string, onEnd: () => void) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || "ar-SA"; u.rate = 0.95; u.pitch = 1.05;
    u.onend = onEnd; u.onerror = onEnd;
    speechSynthesis.speak(u);
  } catch { onEnd(); }
}

/** Speak `text`; callbacks drive the robot's mouth. Returns when finished (or interrupted). */
export async function speak(text: string, on: { start?: () => void; end?: () => void } = {}) {
  if (!voiceOn()) return;
  stopVoice();
  const my = ++token;
  const say = speakable(text);
  if (!say) return;
  on.start?.();
  if (!SERVER_TTS) {
    for (const c of chunks(say, 220, 4)) { if (my !== token) return; await new Promise<void>((res) => browserSay(c, res)); }
    if (my === token) on.end?.();
    return;
  }
  const fetches = chunks(say).map((c) => fetch("/api/ai/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: c }) })
    .then((r) => (r.ok ? r.blob() : null)).catch(() => null));
  for (let i = 0; i < fetches.length; i++) {
    const blob = await fetches[i];
    if (my !== token) return;
    if (!blob) { await new Promise<void>((res) => browserSay(chunks(say).slice(i).join(" "), res)); break; }
    await new Promise<void>((res) => {
      const a = new Audio(URL.createObjectURL(blob));
      current = a;
      a.onended = () => res(); a.onerror = () => res();
      a.play().catch(() => res());
    });
    if (my !== token) return;
  }
  if (my === token) { current = null; on.end?.(); }
}
