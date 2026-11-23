"use client";

import { createElement, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Real 3D model viewer (.glb) with rotate/zoom and "view in your room" AR:
 * iPhone opens it in AR Quick Look, Android in Scene Viewer.
 * Google's <model-viewer> is loaded from a CDN only when a model is shown.
 */
const SRC = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";
let loading: Promise<void> | null = null;
function loadViewer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("model-viewer")) return Promise.resolve();
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.type = "module"; s.src = SRC;
      s.onload = () => customElements.whenDefined("model-viewer").then(() => res());
      s.onerror = () => { loading = null; rej(new Error("viewer")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export default function Model3D({ src, poster, alt = "" }: { src: string; poster?: string | null; alt?: string }) {
  const [ready, setReady] = useState(false);
  const [fail, setFail] = useState(false);
  useEffect(() => { loadViewer().then(() => setReady(true)).catch(() => setFail(true)); }, []);

  if (fail) return <div className="m3d m3d-msg">تعذّر تحميل عارض 3D</div>;
  if (!ready) return <div className="m3d m3d-msg"><Loader2 className="animate-spin" /></div>;
  return createElement(
    "model-viewer",
    {
      class: "m3d", src, poster: poster || undefined, alt,
      "camera-controls": "", "auto-rotate": "", "auto-rotate-delay": "800", "rotation-per-second": "24deg",
      "shadow-intensity": "1", exposure: "1.05", "environment-image": "neutral", "touch-action": "pan-y",
      ar: "", "ar-modes": "webxr scene-viewer quick-look", "interaction-prompt": "auto",
    },
    createElement("button", { slot: "ar-button", className: "m3d-ar" }, "شوفه في مكانك (AR)"),
  );
}
