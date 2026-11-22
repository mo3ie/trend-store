"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX, Sparkles, Sun, Moon } from "lucide-react";
import { isGlassPath } from "@/lib/uiGlass";

/**
 * TREND Glass — sound + motion layer for the storefront.
 *
 * Sounds are synthesized with Web Audio (no files to download). Browsers only
 * allow audio after the visitor's first click, so nothing plays on page load.
 * Pages trigger specific sounds with window events:
 *   window.dispatchEvent(new Event("trend:add"))      — added to cart
 *   window.dispatchEvent(new Event("trend:success"))  — order / top-up done
 * Every click on a button or link plays a soft tap; route changes play a
 * whoosh and sweep a band of light across the screen.
 *
 * Motion is ON by default even when the OS asks to reduce motion (Windows
 * "Animation effects" off silently killed every animation for real visitors);
 * the panel lets anyone switch to "follow my device".
 */
type Kind = "tap" | "nav" | "add" | "success" | "toggle";

let ctx: AudioContext | null = null;

function play(kind: Kind) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const C = ctx;
    const t = C.currentTime;
    const master = C.createGain();
    master.gain.value = 0.9;
    master.connect(C.destination);
    const tone = (f: number, st: number, d: number, v: number, type: OscillatorType = "sine", f2?: number) => {
      const o = C.createOscillator();
      const g = C.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t + st);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + st + d);
      g.gain.setValueAtTime(0.0001, t + st);
      g.gain.exponentialRampToValueAtTime(v, t + st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + st + d);
      o.connect(g);
      g.connect(master);
      o.start(t + st);
      o.stop(t + st + d + 0.05);
    };
    const air = (st: number, d: number, f1: number, f2: number, v: number) => {
      const n = C.createBuffer(1, Math.floor(C.sampleRate * d), C.sampleRate);
      const ch = n.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / ch.length);
      const src = C.createBufferSource();
      src.buffer = n;
      const bp = C.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(f1, t + st);
      bp.frequency.exponentialRampToValueAtTime(f2, t + st + d);
      const g = C.createGain();
      g.gain.value = v;
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(t + st);
    };
    if (kind === "tap") tone(1250, 0, 0.07, 0.035, "sine", 900);
    else if (kind === "nav") { air(0, 0.42, 380, 3400, 0.16); tone(740, 0.05, 0.22, 0.03, "sine", 1110); }
    else if (kind === "add") { tone(880, 0, 0.16, 0.06); tone(1320, 0.09, 0.3, 0.055); tone(1760, 0.18, 0.35, 0.03); }
    else if (kind === "success") { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.1, 0.6, 0.06)); air(0.35, 0.6, 2000, 6000, 0.05); }
    else if (kind === "toggle") tone(560, 0, 0.06, 0.05, "triangle", 760);
  } catch {
    /* audio unavailable — the page works the same without it */
  }
}

function read(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export default function UiFx() {
  const pathname = usePathname() || "/";
  const glass = isGlassPath(pathname);
  const [sound, setSound] = useState(true);
  const [motion, setMotion] = useState<"full" | "auto">("full");
  const [open, setOpen] = useState(false);
  const [sweep, setSweep] = useState(0);
  const soundRef = useRef(true);
  const first = useRef(true);

  useEffect(() => {
    const s = read("ui-sound", "1") === "1";
    // localStorage only exists after mount; reading it here avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSound(s);
    soundRef.current = s;
    setMotion(read("ui-motion", "full") === "auto" ? "auto" : "full");
  }, []);

  // Keep <html data-ui> right on client-side navigation between the store and
  // the excluded tools.
  useEffect(() => {
    const d = document.documentElement;
    if (glass) d.setAttribute("data-ui", "glass"); else d.removeAttribute("data-ui");
  }, [glass]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!isGlassPath(pathname)) return;
    // A route change is an external event; the sweep must replay for each one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSweep((n) => n + 1);
    if (soundRef.current) play("nav");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!soundRef.current || !document.documentElement.hasAttribute("data-ui")) return;
      const el = e.target as Element | null;
      if (el && el.closest && el.closest("button,a,[role=button],label")) play("tap");
    };
    const onAdd = () => {
      if (soundRef.current) play("add");
      document.querySelectorAll<HTMLElement>("[data-cart-icon]").forEach((n) => {
        n.classList.remove("ui-bump");
        void n.offsetWidth; // restart the animation
        n.classList.add("ui-bump");
      });
    };
    const onSuccess = () => { if (soundRef.current) play("success"); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("trend:add", onAdd);
    window.addEventListener("trend:success", onSuccess);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("trend:add", onAdd);
      window.removeEventListener("trend:success", onSuccess);
    };
  }, []);

  const [light, setLight] = useState(false);
  useEffect(() => {
    const d = document.documentElement;
    const sync = () => setLight(d.classList.contains("light"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(d, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  const toggleTheme = () => {
    const n = !light;
    document.documentElement.classList.toggle("light", n);
    try { localStorage.setItem("theme", n ? "light" : "dark"); } catch {}
  };
  if (!glass) return null;

  const toggleSound = () => {
    const n = !sound;
    setSound(n);
    soundRef.current = n;
    try { localStorage.setItem("ui-sound", n ? "1" : "0"); } catch {}
    if (n) play("toggle");
  };
  const toggleMotion = () => {
    const n = motion === "full" ? "auto" : "full";
    setMotion(n);
    document.documentElement.classList.toggle("mo-auto", n === "auto");
    try { localStorage.setItem("ui-motion", n); } catch {}
  };

  return (
    <>
      {sweep > 0 && (
        <div key={sweep} aria-hidden="true" className="ui-sweep"><span /></div>
      )}
      <div className="ui-fx-ctl">
        {open && (
          <div className="ui-fx-panel" role="dialog" aria-label="الصوت والحركة">
            <button onClick={toggleSound}>
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{sound ? "الأصوات: تعمل" : "الأصوات: مكتومة"}</span>
            </button>
            <button onClick={toggleMotion}>
              <Sparkles size={16} />
              <span>{motion === "full" ? "الحركة: كاملة" : "الحركة: حسب الجهاز"}</span>
            </button>
            <button onClick={toggleTheme}>
              {light ? <Moon size={16} /> : <Sun size={16} />}
              <span>{light ? "الوضع: فاتح" : "الوضع: زجاجي داكن"}</span>
            </button>
          </div>
        )}
        <button className="ui-fx-btn" aria-label="الصوت والحركة" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>
    </>
  );
}
