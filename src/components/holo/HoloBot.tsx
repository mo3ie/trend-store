"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import RobotCanvas, { type RobotApi } from "./RobotCanvas";
import TrendyChat, { type ChatState } from "./TrendyChat";

/**
 * TREND AI as a small floating companion on the store's inner pages.
 * The homepage has the full robot inside its hero card instead.
 * It can be DRAGGED anywhere (mouse or finger); the spot is remembered per device.
 * A short tap still opens the chat.
 */
const HIDE_ON = [/^\/$/, /^\/admin/, /^\/diagnose/, /^\/login/, /^\/register/, /^\/moamalat-pay/, /^\/r\//, /^\/studio/, /^\/tiktok/, /^\/facebook/, /^\/ads/, /^\/bot/, /^\/subscriptions/];
const KEY = "trend_holo_pos";

export default function HoloBot() {
  const pathname = usePathname() || "/";
  const bot = useRef<RobotApi>(null);
  const box = useRef<HTMLDivElement>(null);
  const [chat, setChat] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // px from left/top
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [roam, setRoam] = useState<"" | "right" | "left">("");
  const restUntil = useRef(0); // after a drag the robot stays where it was put for a while

  // Free roaming: every few seconds glide to a random spot on the screen (not while chatting or being dragged).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>, stop: ReturnType<typeof setTimeout>;
    const step = () => {
      t = setTimeout(() => {
        if (!chat && !drag.current && Date.now() > restUntil.current && document.visibilityState === "visible" && box.current) {
          const w = box.current.offsetWidth || 90, h = box.current.offsetHeight || 110;
          const cur = box.current.getBoundingClientRect();
          const target = clamp({ x: 8 + Math.random() * (window.innerWidth - w - 16), y: 90 + Math.random() * (window.innerHeight - h - 110) });
          setRoam(target.x < cur.left ? "left" : "right");
          setPos(target);
          if (Math.random() < 0.35) bot.current?.setMood("happy");
          stop = setTimeout(() => { setRoam(""); if (Math.random() < 0.4) bot.current?.wave(); bot.current?.setMood("neutral"); }, 3300);
        }
        step();
      }, 6500 + Math.random() * 6000);
    };
    step();
    return () => { clearTimeout(t); clearTimeout(stop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);

  useEffect(() => {
    try { const p = JSON.parse(localStorage.getItem(KEY) || "null"); if (p && typeof p.x === "number") setPos(clamp(p)); } catch {}
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (HIDE_ON.some((r) => r.test(pathname))) return null;

  function clamp(p: { x: number; y: number }) {
    const w = box.current?.offsetWidth || 90, h = box.current?.offsetHeight || 110;
    return { x: Math.max(4, Math.min(window.innerWidth - w - 4, p.x)), y: Math.max(60, Math.min(window.innerHeight - h - 4, p.y)) };
  }

  const onDown = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    setRoam("");
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 6) return; // still a tap
    d.moved = true;
    setPos(clamp({ x: d.ox + dx, y: d.oy + dy }));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) { restUntil.current = Date.now() + 25000; setPos((p) => { try { if (p) localStorage.setItem(KEY, JSON.stringify(p)); } catch {} return p; }); return; }
    setChat((c) => !c); bot.current?.wave(); bot.current?.setMood("listening");
  };

  const onState = (s: ChatState) => {
    if (s === "thinking") bot.current?.setMood("thinking");
    else if (s === "speaking") { bot.current?.setMood("happy"); bot.current?.talk(true); }
    else { bot.current?.talk(false); bot.current?.setMood("listening"); }
  };

  return (
    <>
      <div ref={box} className={`holo holo-mini ${pos ? "placed" : ""} ${roam ? `roam ${roam}` : ""}`} style={pos ? { left: pos.x, top: pos.y, bottom: "auto", right: "auto" } : undefined}>
        <button className="holo-stage" aria-label="TREND AI — اسأل ترندي (اسحبه لتحريكه)" title="اضغط للمحادثة — اسحب لتحريكه"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }}
          style={{ touchAction: "none", cursor: "grab" }}>
          <RobotCanvas ref={bot} className="holo-canvas" />
        </button>
      </div>
      <TrendyChat open={chat} onClose={() => { setChat(false); bot.current?.setMood("neutral"); }} onState={onState} />
    </>
  );
}
