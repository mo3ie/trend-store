/**
 * Speaks «ترندي»'s replies: Groq Arabic voice via /api/ai/tts, chunked (≤190 chars) and played in order.
 * Falls back to the browser's Arabic voice. Muted state is remembered per device.
 */
const MUTE_KEY = "trendy_voice_off";
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

function browserSay(text: string, onEnd: () => void) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = speechSynthesis.getVoices().find((x) => /^ar/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = v?.lang || "ar-SA"; u.rate = 1;
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
