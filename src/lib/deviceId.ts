"use client";

/**
 * Browser-side device signal for anti-fraud: a random id kept in localStorage
 * plus a light fingerprint (UA, screen, timezone, language, GPU). Sent as the
 * `x-trend-device` header; the server only stores a salted hash of it.
 */
export function deviceSignal(): string {
  let id = "";
  try { id = localStorage.getItem("trend_dev") || ""; if (!id) { id = crypto.randomUUID(); localStorage.setItem("trend_dev", id); } } catch { id = "nolocal"; }
  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    gpu = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  } catch {}
  const fp = [navigator.userAgent, `${screen.width}x${screen.height}x${devicePixelRatio}`, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, gpu].join("|");
  return `${id}|${fp}`.slice(0, 200);
}

export const deviceHeaders = (): Record<string, string> => ({ "x-trend-device": deviceSignal() });
