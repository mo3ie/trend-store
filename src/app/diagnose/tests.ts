/**
 * Browser-side device checks for «افحص جهازك».
 *
 * What a web page can honestly measure is limited (Apple blocks system access
 * from Safari: no battery health, no logs, no part serials). So every check
 * here is either MEASURED (numbers from the browser) or CONFIRMED by the
 * customer (they see/hear it and answer). Nothing is guessed or invented.
 */
export type Status = "ok" | "warn" | "fail" | "skip";
export type Result = { status: Status; value?: string; note?: string };

export type DeviceInfo = {
  platform: "ios" | "android" | "desktop" | "other";
  os: string;
  osVersion: string;
  browser: string;
  model: string;
  screen: string;
  dpr: number;
  cores: number | null;
  memoryGb: number | null;
  gpu: string;
  touchPoints: number;
  lang: string;
  connection: string;
};

export function readDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ios = /iPhone|iPod/.test(ua) || isIpad;
  const android = /Android/.test(ua);
  let osVersion = "";
  if (ios) {
    const m = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/) || ua.match(/Version\/(\d+)\.(\d+)/);
    if (m) osVersion = [m[1], m[2], m[3]].filter(Boolean).join(".");
  } else if (android) {
    osVersion = (ua.match(/Android ([\d.]+)/) || [])[1] || "";
  }
  let model = ios ? (isIpad ? "iPad" : "iPhone") : "";
  if (android) model = ((ua.match(/Android [\d.]+; ([^;)]+)/) || [])[1] || "Android").replace(/ Build.*/, "").trim();
  const browser = /CriOS|Chrome/.test(ua) && !/Edg/.test(ua) ? "Chrome" : /Edg/.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "متصفح آخر";

  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    gpu = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : gl ? "WebGL" : "غير مدعوم";
  } catch { gpu = "غير معروف"; }

  // iPhone screen size narrows the model family (Safari hides the exact model).
  if (ios && !isIpad) {
    const w = Math.min(screen.width, screen.height), h = Math.max(screen.width, screen.height);
    const fam: Record<string, string> = {
      "375x667": "iPhone 6/7/8/SE", "414x736": "iPhone Plus (6–8)", "375x812": "iPhone X/XS/11 Pro/12-13 mini",
      "414x896": "iPhone XR/XS Max/11/11 Pro Max", "390x844": "iPhone 12/13/14", "428x926": "iPhone 12/13 Pro Max, 14 Plus",
      "393x852": "iPhone 14 Pro/15/15 Pro/16", "430x932": "iPhone 14 Pro Max/15 Plus/15 Pro Max/16 Plus",
      "402x874": "iPhone 16 Pro / 17", "440x956": "iPhone 16 Pro Max / 17 Pro Max", "420x912": "iPhone Air",
    };
    model = fam[`${w}x${h}`] || "iPhone";
  }

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; type?: string } };
  return {
    platform: ios ? "ios" : android ? "android" : /Windows|Mac|Linux/.test(ua) ? "desktop" : "other",
    os: ios ? (isIpad ? "iPadOS" : "iOS") : android ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : "Linux/أخرى",
    osVersion,
    browser,
    model,
    screen: `${screen.width}×${screen.height}`,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    cores: navigator.hardwareConcurrency || null,
    memoryGb: nav.deviceMemory ?? null,
    gpu,
    touchPoints: navigator.maxTouchPoints || 0,
    lang: navigator.language,
    connection: nav.connection?.effectiveType || nav.connection?.type || "",
  };
}

/** Frames per second over ~1.2s (60 normal, 120 ProMotion). */
export function measureFps(): Promise<number> {
  return new Promise((res) => {
    let n = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      n++;
      if (t - t0 < 1200) requestAnimationFrame(step);
      else res(Math.round((n * 1000) / (t - t0)));
    };
    requestAnimationFrame(step);
  });
}

/** CPU score: math ops in a fixed time slice, split into chunks to stay responsive. */
export async function cpuScore(): Promise<number> {
  let ops = 0;
  const end = performance.now() + 900;
  while (performance.now() < end) {
    let x = 0;
    for (let i = 0; i < 20000; i++) x += Math.sqrt(i * 1.0001) * Math.sin(i);
    ops += 20000 + (x > 1e12 ? 1 : 0);
    await new Promise((r) => setTimeout(r, 0));
  }
  return Math.round(ops / 10000);
}

/** Download speed (Mbps) + latency (ms) against our own server. */
export async function networkTest(): Promise<{ mbps: number; pingMs: number }> {
  const pings: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t = performance.now();
    await fetch(`/api/diagnose/speed?bytes=1&r=${Math.random()}`, { cache: "no-store" });
    pings.push(performance.now() - t);
  }
  pings.sort((a, b) => a - b);
  const bytes = 3_000_000;
  const t0 = performance.now();
  const r = await fetch(`/api/diagnose/speed?bytes=${bytes}&r=${Math.random()}`, { cache: "no-store" });
  const buf = await r.arrayBuffer();
  const sec = (performance.now() - t0) / 1000;
  return { mbps: Math.round(((buf.byteLength * 8) / sec / 1e6) * 10) / 10, pingMs: Math.round(pings[1]) };
}

export async function batteryInfo(): Promise<{ level: number; charging: boolean } | null> {
  const n = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
  if (!n.getBattery) return null;
  try { const b = await n.getBattery(); return { level: Math.round(b.level * 100), charging: b.charging }; } catch { return null; }
}

/** Plays a short tone on one side (pan -1 left … 1 right). */
export function playTone(pan: number, freq = 660, ms = 900) {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
  if (p) { p.pan.value = pan; osc.connect(gain).connect(p).connect(ctx.destination); } else osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + ms / 1000 + 0.05);
  setTimeout(() => ctx.close().catch(() => {}), ms + 300);
}

/** Peak mic level 0..100 while listening for `ms`. */
export async function micPeak(ms = 3000, onLevel?: (v: number) => void): Promise<number> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const data = new Uint8Array(an.fftSize);
  let peak = 0;
  const end = performance.now() + ms;
  await new Promise<void>((res) => {
    const tick = () => {
      an.getByteTimeDomainData(data);
      let m = 0;
      for (const v of data) m = Math.max(m, Math.abs(v - 128));
      const lvl = Math.min(100, Math.round((m / 128) * 140));
      peak = Math.max(peak, lvl);
      onLevel?.(lvl);
      if (performance.now() < end) requestAnimationFrame(tick); else res();
    };
    tick();
  });
  stream.getTracks().forEach((t) => t.stop());
  ctx.close().catch(() => {});
  return peak;
}

/** Motion sensors: iOS needs an explicit permission tap first. */
export async function motionTest(): Promise<Result> {
  const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
  if (!DM) return { status: "skip", note: "الجهاز لا يدعم الحساسات" };
  try {
    if (typeof DM.requestPermission === "function") {
      const p = await DM.requestPermission();
      if (p !== "granted") return { status: "skip", note: "لم يتم السماح بالوصول للحساسات" };
    }
  } catch { return { status: "skip", note: "لم يتم السماح بالوصول للحساسات" }; }
  return new Promise((res) => {
    let got = false;
    let gyro = false;
    const on = (e: DeviceMotionEvent) => {
      if (e.accelerationIncludingGravity?.x != null) got = true;
      if (e.rotationRate?.alpha != null) gyro = true;
    };
    window.addEventListener("devicemotion", on);
    setTimeout(() => {
      window.removeEventListener("devicemotion", on);
      if (!got) res({ status: "fail", value: "لا توجد قراءة", note: "حساس الحركة لم يرسل أي قراءة" });
      else res({ status: gyro ? "ok" : "warn", value: gyro ? "التسارع + الجيروسكوب" : "التسارع فقط", note: gyro ? undefined : "الجيروسكوب لم يستجب" });
    }, 2000);
  });
}
