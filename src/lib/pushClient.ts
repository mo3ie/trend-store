"use client";
/**
 * Browser side of phone notifications. Permission is NOT a subscription: every
 * call re-checks the actual subscription and repairs it if the browser dropped it.
 */
let keyCache: string | null = null;
async function publicKey(): Promise<string | null> {
  if (keyCache) return keyCache;
  try { const r = await fetch("/api/push", { cache: "no-store" }); keyCache = (await r.json()).key || null; } catch { keyCache = null; }
  return keyCache;
}
const toBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const pushPermission = (): NotificationPermission | "unsupported" => (pushSupported() ? Notification.permission : "unsupported");

/** Make sure this device is subscribed and saved for the signed-in user (no prompt). */
export async function syncPush(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const key = await publicKey();
  if (!key) return false;
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }));
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
    const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    return r.ok;
  } catch (e) {
    console.warn("[push] sync failed", e);
    return false;
  }
}

/** Ask permission (from a tap), then subscribe. */
export async function enablePush(): Promise<"on" | "denied" | "unsupported" | "ios-install" | "failed"> {
  if (!pushSupported()) return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "default") {
    const p = await Notification.requestPermission();
    if (p !== "granted") return "denied";
  }
  if (Notification.permission !== "granted") return "denied";
  return (await syncPush()) ? "on" : "failed";
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
  } catch { /* nothing to undo */ }
}
