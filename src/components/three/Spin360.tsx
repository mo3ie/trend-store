"use client";

import { useEffect, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";

/**
 * 360° product spin from a sequence of photos (background already removed).
 * Drag / swipe to turn it; it turns slowly on its own until touched.
 */
export default function Spin360({ frames, alt = "" }: { frames: string[]; alt?: string }) {
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [touched, setTouched] = useState(false);
  const drag = useRef<{ x: number; i: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const n = frames.length;

  // Preload every frame so turning never flickers.
  useEffect(() => {
    let c = 0;
    frames.forEach((src) => { const im = new Image(); im.onload = im.onerror = () => setLoaded(++c); im.src = src; });
  }, [frames]);

  useEffect(() => {
    if (touched || loaded < n || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 110);
    return () => clearInterval(t);
  }, [touched, loaded, n]);

  const onDown = (e: React.PointerEvent) => {
    setTouched(true);
    drag.current = { x: e.clientX, i };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const w = box.current?.clientWidth || 300;
    const dx = e.clientX - drag.current.x;
    const step = Math.round((dx / w) * n * 1.3);
    setI(((drag.current.i - step) % n + n) % n);
  };
  const onUp = () => { drag.current = null; };

  if (!n) return null;
  return (
    <div ref={box} className="s360" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <img src={frames[i]} alt={alt} draggable={false} />
      {loaded < n && <span className="s360-load"><i style={{ width: `${(loaded / n) * 100}%` }} /></span>}
      {!touched && loaded >= n && <span className="s360-hint"><MoveHorizontal size={15} /> اسحب لتدوير المنتج</span>}
      <span className="s360-badge">360°</span>
    </div>
  );
}
