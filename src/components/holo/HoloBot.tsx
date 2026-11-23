"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, ChevronLeft, Box } from "lucide-react";
import TrendyChat from "./TrendyChat";
import type { RobotHandle } from "./robot";

type Pick = { id: string; name: string; price: number; image_url: string | null; line: string; tag: string; has3d: boolean };

/**
 * The homepage hologram: a 3D robot projected from a glowing floor ring. It
 * walks between spots on the screen, presents real offers/products one by one
 * (from /api/ai/picks), follows the cursor with its head, waves, and opens the
 * «ترندي» AI chat. On other store pages it shrinks to a small hologram button.
 */
const SPOTS_DESKTOP = [
  { x: 0.84, y: 0.62 }, { x: 0.12, y: 0.66 }, { x: 0.86, y: 0.3 }, { x: 0.1, y: 0.34 }, { x: 0.5, y: 0.7 },
];
const HIDE_ON = [/^\/admin/, /^\/diagnose/, /^\/login/, /^\/register/, /^\/moamalat-pay/, /^\/r\//, /^\/studio/, /^\/tiktok/, /^\/facebook/, /^\/ads/, /^\/bot/];

export default function HoloBot() {
  const pathname = usePathname() || "/";
  const home = pathname === "/";
  const hidden = HIDE_ON.some((r) => r.test(pathname));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const botRef = useRef<RobotHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [chat, setChat] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [idx, setIdx] = useState(0);
  const [spot, setSpot] = useState(0);
  const [bubble, setBubble] = useState(true);
  const [phone, setPhone] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Layout mode
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 880px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => { setPhone(mq.matches); setReduced(rm.matches); };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Build the 3D robot (lazy-loads three.js)
  useEffect(() => {
    if (hidden) return;
    let dead = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const test = document.createElement("canvas").getContext("webgl");
        if (!test) return;
        const THREE = await import("three");
        const { buildRobot } = await import("./robot");
        if (dead) return;
        const h = buildRobot(THREE, canvas);
        botRef.current = h;
        const r = canvas.getBoundingClientRect();
        h.setSize(Math.max(1, r.width), Math.max(1, r.height));
        setReady(true);
        setTimeout(() => h.wave(), 900);
      } catch { /* no WebGL → the button still works */ }
    })();
    return () => { dead = true; botRef.current?.dispose(); botRef.current = null; setReady(false); };
  }, [hidden, home, phone]);

  // Resize with its box
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !ready) return;
    const ro = new ResizeObserver(() => {
      const r = c.getBoundingClientRect();
      botRef.current?.setSize(Math.max(1, r.width), Math.max(1, r.height));
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [ready]);

  // Head follows the pointer
  useEffect(() => {
    if (!ready) return;
    const onMove = (e: PointerEvent) => {
      const c = canvasRef.current?.getBoundingClientRect();
      if (!c) return;
      botRef.current?.lookAt((e.clientX - (c.left + c.width / 2)) / (window.innerWidth / 2), (e.clientY - (c.top + c.height / 3)) / (window.innerHeight / 2));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [ready]);

  // Offers
  useEffect(() => {
    if (!home || hidden) return;
    fetch("/api/ai/picks").then((r) => r.json()).then((d) => setPicks(Array.isArray(d.picks) ? d.picks : [])).catch(() => {});
  }, [home, hidden]);

  // Cycle offers; move to a new spot every few offers (desktop homepage)
  useEffect(() => {
    if (!home || hidden || chat || picks.length === 0) return;
    const t = setInterval(() => {
      setIdx((i) => {
        const n = (i + 1) % picks.length;
        if (!phone && !reduced && n % 2 === 0) {
          setBubble(false);
          setSpot((s) => (s + 1) % SPOTS_DESKTOP.length);
          setTimeout(() => { setBubble(true); botRef.current?.wave(); }, 1500);
        }
        return n;
      });
      botRef.current?.talk(true);
      setTimeout(() => botRef.current?.talk(false), 1400);
    }, 7000);
    return () => clearInterval(t);
  }, [home, hidden, chat, picks.length, phone, reduced]);

  if (hidden) return null;

  const pick = picks[idx];
  const big = home && !phone;
  const sp = SPOTS_DESKTOP[spot];
  const style: React.CSSProperties = big
    ? { left: `calc(${sp.x * 100}vw - 95px)`, top: `calc(${sp.y * 100}vh - 130px)` }
    : {};
  const bubbleSide = big && sp.x > 0.5 ? "left" : "right";

  return (
    <>
      <div className={`holo ${big ? "holo-big" : home ? "holo-phone" : "holo-mini"} ${ready ? "on" : ""}`} style={style}>
        {home && bubble && pick && !chat && (
          <div className={`holo-bubble ${bubbleSide}`} key={pick.id}>
            <span className="holo-tag">{pick.has3d ? <><Box size={11} /> 3D</> : pick.tag}</span>
            <p>{pick.line}</p>
            <a href={`/products/${pick.id}`} className="holo-card">
              {pick.image_url && <img src={pick.image_url} alt="" />}
              <span><b>{pick.name}</b><em>{pick.price} د.ل</em></span>
              <ChevronLeft size={16} />
            </a>
            <button className="holo-ask" onClick={() => setChat(true)}><MessageCircle size={14} /> اسأل ترندي</button>
          </div>
        )}
        <button className="holo-stage" onClick={() => { setChat((c) => !c); botRef.current?.wave(); }} aria-label="ترندي — المساعد الذكي">
          <canvas ref={canvasRef} className="holo-canvas" />
          {!ready && <span className="holo-fallback"><MessageCircle size={22} /></span>}
        </button>
      </div>
      <TrendyChat open={chat} onClose={() => setChat(false)} onTalk={(on) => botRef.current?.talk(on)} />
    </>
  );
}
