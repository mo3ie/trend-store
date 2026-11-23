"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Mood, RobotHandle } from "./robot";

/**
 * A <canvas> that hosts the TREND AI robot. Lazy-loads three.js, sizes itself
 * to its box, makes the head follow the pointer and turns "curious" on hover.
 */
export type RobotApi = { wave: () => void; talk: (on: boolean) => void; setMood: (m: Mood) => void };

const RobotCanvas = forwardRef<RobotApi, { className?: string; onReady?: () => void }>(function RobotCanvas({ className, onReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bot = useRef<RobotHandle | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    wave: () => bot.current?.wave(),
    talk: (on) => bot.current?.talk(on),
    setMood: (m) => bot.current?.setMood(m),
  }), []);

  useEffect(() => {
    let dead = false;
    (async () => {
      const c = canvasRef.current;
      if (!c) return;
      try {
        if (!document.createElement("canvas").getContext("webgl2") && !document.createElement("canvas").getContext("webgl")) return;
        const THREE = await import("three");
        const { buildRobotAsync } = await import("./robot");
        if (dead) return;
        const h = await buildRobotAsync(THREE, c);
        if (dead) { h.dispose(); return; }
        bot.current = h;
        const r = c.getBoundingClientRect();
        h.setSize(Math.max(1, r.width), Math.max(1, r.height));
        setReady(true);
        onReady?.();
        setTimeout(() => h.wave(), 700);
      } catch { /* no WebGL: the page still works without the robot */ }
    })();
    return () => { dead = true; bot.current?.dispose(); bot.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !ready) return;
    const ro = new ResizeObserver(() => {
      const r = c.getBoundingClientRect();
      bot.current?.setSize(Math.max(1, r.width), Math.max(1, r.height));
    });
    ro.observe(c);
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      bot.current?.lookAt((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), (e.clientY - (r.top + r.height * 0.25)) / (window.innerHeight / 2));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, [ready]);

  return <canvas ref={canvasRef} className={`${className || ""} ${ready ? "on" : ""}`} />;
});

export default RobotCanvas;
