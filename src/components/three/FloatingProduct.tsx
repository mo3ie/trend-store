"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Product photo that "pops out": the plain studio background is removed in
 * the browser, then the product floats above a soft contact shadow, tilts in
 * 3D toward the pointer / finger, and catches a moving glare — so it reads as
 * a real object you could pick up.
 *
 * Background removal only runs when the photo's border is a near-uniform
 * colour (white/grey studio shots). Lifestyle photos with a real scene are
 * kept whole (rounded, still floating and tilting) instead of being cut badly.
 */
const cache = new Map<string, string | null>();

async function cutout(src: string): Promise<string | null> {
  if (cache.has(src)) return cache.get(src)!;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  try { await img.decode(); } catch { cache.set(src, null); return null; }

  const MAX = 1000;
  const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) { cache.set(src, null); return null; }
  ctx.drawImage(img, 0, 0, w, h);
  let data: ImageData;
  try { data = ctx.getImageData(0, 0, w, h); } catch { cache.set(src, null); return null; } // CORS-tainted
  const d = data.data;

  // Already transparent (PNG cut-out)? Use as is.
  let transparentEdge = 0, edgeCount = 0;
  const border: number[] = [];
  for (let x = 0; x < w; x += 3) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 3) border.push(y * w, y * w + w - 1);
  for (const p of border) { edgeCount++; if (d[p * 4 + 3] < 20) transparentEdge++; }
  if (transparentEdge / edgeCount > 0.6) { cache.set(src, src); return src; }

  // Is the border a uniform backdrop?
  const cols = border.map((p) => [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]);
  const med = [0, 1, 2].map((i) => { const v = cols.map((c) => c[i]).sort((a, b) => a - b); return v[v.length >> 1]; });
  const dist = (i: number) => Math.hypot(d[i] - med[0], d[i + 1] - med[1], d[i + 2] - med[2]);
  const near = border.filter((p) => dist(p * 4) < 28).length / border.length;
  if (near < 0.82) { cache.set(src, null); return null; } // real scene → don't cut

  const TOL = 44;
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const p of border) if (dist(p * 4) < TOL) { bg[p] = 1; stack.push(p); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    if (x > 0 && !bg[p - 1] && dist((p - 1) * 4) < TOL) { bg[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !bg[p + 1] && dist((p + 1) * 4) < TOL) { bg[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !bg[p - w] && dist((p - w) * 4) < TOL) { bg[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !bg[p + w] && dist((p + w) * 4) < TOL) { bg[p + w] = 1; stack.push(p + w); }
  }
  for (let p = 0; p < w * h; p++) if (!bg[p] && dist(p * 4) < 16) bg[p] = 1;
  let minX = w, minY = h, maxX = 0, maxY = 0, kept = 0;
  for (let p = 0; p < w * h; p++) {
    if (bg[p]) { d[p * 4 + 3] = 0; continue; }
    const x = p % w, y = (p / w) | 0;
    kept++;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    const edge = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
    if (edge) d[p * 4 + 3] = Math.min(255, Math.round((dist(p * 4) / (TOL * 1.7)) * 255));
  }
  // Nothing (or almost everything) left → the cut failed; keep the photo.
  if (kept < w * h * 0.04 || kept > w * h * 0.97) { cache.set(src, null); return null; }
  ctx.putImageData(data, 0, 0);
  const pad = 6;
  const cw = maxX - minX + 1 + pad * 2, ch = maxY - minY + 1 + pad * 2;
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d")!.drawImage(c, minX - pad, minY - pad, cw, ch, 0, 0, cw, ch);
  const url = out.toDataURL("image/png");
  cache.set(src, url);
  return url;
}

export default function FloatingProduct({ src, alt }: { src: string; alt: string }) {
  const [cut, setCut] = useState<string | null | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 30 });

  useEffect(() => {
    let dead = false;
    setCut(undefined);
    cutout(src).then((u) => { if (!dead) setCut(u); }).catch(() => { if (!dead) setCut(null); });
    return () => { dead = true; };
  }, [src]);

  const move = (cx: number, cy: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const nx = (cx - r.left) / r.width - 0.5, ny = (cy - r.top) / r.height - 0.5;
    setTilt({ x: -ny * 18, y: nx * 22, gx: 50 + nx * 80, gy: 30 + ny * 70 });
  };
  const reset = () => setTilt({ x: 0, y: 0, gx: 50, gy: 30 });

  const isCut = !!cut;
  const shown = cut || src;
  const style = {
    "--rx": `${tilt.x}deg`, "--ry": `${tilt.y}deg`, "--gx": `${tilt.gx}%`, "--gy": `${tilt.gy}%`,
    ...(isCut ? { "--mask": `url(${shown})` } : {}),
  } as React.CSSProperties;

  return (
    <div ref={box} className={`fp ${isCut ? "fp-cut" : "fp-photo"} ${cut === undefined ? "fp-wait" : ""}`} style={style}
      onPointerMove={(e) => move(e.clientX, e.clientY)} onPointerLeave={reset} onPointerUp={reset}>
      <span className="fp-shadow" aria-hidden />
      <div className="fp-float">
        <div className="fp-tilt">
          <img src={shown} alt={alt} draggable={false} />
          <span className="fp-glare" aria-hidden />
        </div>
      </div>
    </div>
  );
}
