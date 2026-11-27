"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Site activity for the admin reports (/admin/reports).
 * Records: page opened ("view"), how long it stayed open ("__leave" with duration),
 * and the visible text of buttons/links pressed ("click"). Never reads what people type.
 * Batched: sent every 10 s and when the tab is hidden (sendBeacon). Admin pages skipped.
 */
type Ev = { id: string; k: "view" | "click" | "event"; p: string; l?: string; t?: string; d?: number; at: number };

// Events wait in localStorage until the server confirms them; whatever a closing tab
// could not deliver is re-sent on the next page (the server ignores duplicates by id).
const STORE = "trend_evq";
const queue: Ev[] = [];
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
function persist() { try { localStorage.setItem(STORE, JSON.stringify(queue.slice(-200))); } catch { /* ignore */ } }
function push(e: Omit<Ev, "id">) { queue.push({ ...e, id: newId() }); persist(); }
const inflight = new Set<string>();
let sid = "";
let ref: string | null = null;

function getSid(): string {
  if (sid) return sid;
  try {
    sid = localStorage.getItem("trend_sid") || "";
    if (!sid) { sid = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)); localStorage.setItem("trend_sid", sid); }
  } catch { sid = sid || Math.random().toString(36).slice(2) + Date.now().toString(36); }
  return sid;
}

function flush(beacon = false) {
  const events = queue.filter((e) => !inflight.has(e.id)).slice(0, 60);
  if (!events.length) return;
  const ids = new Set(events.map((e) => e.id));
  ids.forEach((id) => inflight.add(id));
  const body = JSON.stringify({ sid: getSid(), ref, events });
  ref = null;
  const done = (ok: boolean) => {
    ids.forEach((id) => inflight.delete(id));
    if (!ok) return;
    for (let i = queue.length - 1; i >= 0; i--) if (ids.has(queue[i].id)) queue.splice(i, 1);
    persist();
  };
  // keepalive fetch survives navigation/tab close; sendBeacon only as a fallback.
  try {
    fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } })
      .then((r) => done(r.ok))
      .catch(() => {
        done(false);
        if (beacon) try { navigator.sendBeacon?.("/api/track", new Blob([body], { type: "text/plain" })); } catch { /* ignore */ }
      });
  } catch {
    try { navigator.sendBeacon?.("/api/track", new Blob([body], { type: "text/plain" })); } catch { /* never break the page */ }
  }
}

const skip = (p: string) => p.startsWith("/admin") || p.startsWith("/api");
// Long digit runs (card codes, phone numbers) never leave the browser.
const clean = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\d{5,}/g, "…").slice(0, 60);

export default function ActivityTracker() {
  const pathname = usePathname() || "/";
  const cur = useRef<{ p: string; start: number; visibleMs: number; shownAt: number | null } | null>(null);

  // one-time: leftovers, referrer, click capture, flush timers
  useEffect(() => {
    try {
      const old = JSON.parse(localStorage.getItem(STORE) || "[]") as Ev[];
      const fresh = Array.isArray(old) ? old.filter((e) => e && e.id && e.at > Date.now() - 6 * 3600_000) : [];
      if (fresh.length) { queue.unshift(...fresh.filter((e) => !queue.some((q) => q.id === e.id))); persist(); setTimeout(() => flush(), 1500); }
    } catch { /* ignore */ }
    try {
      if (!sessionStorage.getItem("trend_ref_sent")) {
        sessionStorage.setItem("trend_ref_sent", "1");
        const r = document.referrer ? new URL(document.referrer).host : "";
        if (r && r !== location.host) ref = r;
      }
    } catch { /* ignore */ }

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("a,button,[role=button],summary") as HTMLElement | null;
      if (!el || el.closest("[data-notrack]")) return;
      const p = location.pathname;
      if (skip(p)) return;
      const label = clean(el.getAttribute("aria-label") || el.getAttribute("title") || (el.innerText || "").split("\n")[0] || "");
      let t: string | undefined;
      const href = el instanceof HTMLAnchorElement ? el.getAttribute("href") : null;
      if (href) { try { const u = new URL(href, location.href); t = u.host === location.host ? u.pathname : u.host; } catch { /* ignore */ } }
      if (!label && !t) return;
      push({ k: "click", p, l: label || undefined, t, at: Date.now() });
      // a link may unload the page right now — send before it does
      if (href) {
        const c = cur.current;
        if (c && !skip(c.p)) {
          const ms = c.visibleMs + (c.shownAt != null ? Date.now() - c.shownAt : 0);
          if (ms > 500) { push({ k: "event", p: c.p, l: "__leave", d: ms, at: Date.now() }); c.visibleMs = 0; c.shownAt = document.visibilityState === "visible" ? Date.now() : null; }
        }
        flush(true);
      }
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });

    const onVis = () => {
      const c = cur.current;
      if (document.visibilityState === "hidden") {
        if (c && c.shownAt != null) { c.visibleMs += Date.now() - c.shownAt; c.shownAt = null; }
        // closing/switching away: report time so far as the leave
        if (c && !skip(c.p) && c.visibleMs > 500) { push({ k: "event", p: c.p, l: "__leave", d: c.visibleMs, at: Date.now() }); c.visibleMs = 0; }
        flush(true);
      } else if (c && c.shownAt == null) c.shownAt = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", () => flush(true));
    const id = window.setInterval(() => flush(), 10000);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("visibilitychange", onVis); window.clearInterval(id); };
  }, []);

  // page views + time on page
  useEffect(() => {
    const now = Date.now();
    const prev = cur.current;
    if (prev && !skip(prev.p)) {
      const ms = prev.visibleMs + (prev.shownAt != null ? now - prev.shownAt : 0);
      if (ms > 500) push({ k: "event", p: prev.p, l: "__leave", d: ms, at: now });
    }
    const p = pathname + (typeof location !== "undefined" ? location.search : "");
    cur.current = { p, start: now, visibleMs: 0, shownAt: document.visibilityState === "visible" ? now : null };
    if (!skip(pathname)) {
      push({ k: "view", p, at: now });
      // first view of a visit goes out right away so "live now" is accurate
      if (queue.length <= 2) flush();
    }
  }, [pathname]);

  return null;
}
