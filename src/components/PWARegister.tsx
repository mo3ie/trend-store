"use client";

import { useEffect } from "react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __trendInstall?: BIP | null } }

// Registers the service worker and keeps the browser's install prompt for the «حمّل التطبيق» button.
export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); window.__trendInstall = e as BIP; window.dispatchEvent(new Event("trend:installable")); };
    const onInstalled = () => { window.__trendInstall = null; window.dispatchEvent(new Event("trend:installed")); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}
