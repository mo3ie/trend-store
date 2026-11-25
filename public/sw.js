// محل ترند — service worker: "almost offline" for speed, ONLINE for anything personal or money.
//
//  • /_next/static/* (content-hashed, immutable)      → cache-first (never re-downloaded)
//  • icons, logo, fonts, 3D/CDN libraries              → cache-first
//  • product & banner images (own + Supabase storage)  → stale-while-revalidate (instant, refreshed in background)
//  • public catalogue APIs (products, settings, cards list, catalog of services)
//                                                      → stale-while-revalidate (shows last list instantly)
//  • page navigations                                  → network-first (3.5 s) → cached copy → /offline
//  • EVERYTHING ELSE under /api (wallet, orders, auth, payments, cards/utilities purchases, admin…)
//    and every non-GET request                         → straight to the network, never cached.
const V = "v7";
const STATIC = `trend-static-${V}`, PAGES = `trend-pages-${V}`, IMG = `trend-img-${V}`, API = `trend-api-${V}`;
const PRECACHE = ["/", "/offline", "/icon-192.png", "/icon-512.png", "/apple-icon.png", "/brand/trend-logo.png", "/manifest.webmanifest"];

// Public, user-independent GET endpoints that are safe to show from cache first.
const SWR_API = [/^\/api\/products(\/[^/]+)?$/, /^\/api\/site-settings$/, /^\/api\/cards$/, /^\/api\/categories/, /^\/api\/banners/];
// Pages that must always be live (money / personal / admin) — no cached fallback except the offline page.
const LIVE_PAGES = /^\/(admin|cart|checkout|account|orders|wallet|login|register|auth|moamalat-pay|cards\/orders|market\/(me|order|sell)|deep-scan|studio|ads|bot|subscriptions|r\/)/;
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const SUPA_IMG = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/(object|render\/image)\/public\//;

self.addEventListener("install", (e) => e.waitUntil((async () => {
  const c = await caches.open(STATIC);
  await Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
  await self.skipWaiting();
})()));

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  const keep = new Set([STATIC, PAGES, IMG, API]);
  await Promise.all((await caches.keys()).filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
  if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
  await self.clients.claim();
})()));

async function trim(name, max) {
  const c = await caches.open(name), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
const okToStore = (res) => res && res.ok && res.type !== "opaque";   // never keep opaque (unreadable, quota-heavy) copies

async function cacheFirst(req, name, max) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (okToStore(res)) { const c = await caches.open(name); c.put(req, res.clone()).then(() => max && trim(name, max)).catch(() => {}); }
  return res;
}

async function staleWhileRevalidate(event, req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => {
    if (okToStore(res)) c.put(req, res.clone()).then(() => trim(name, max)).catch(() => {});
    return res;
  }).catch(() => hit);
  if (hit) { event.waitUntil(net); return hit; }
  return (await net) || new Response("", { status: 504 });
}

async function page(event) {
  const req = event.request, path = new URL(req.url).pathname;
  const live = LIVE_PAGES.test(path);
  try {
    const net = Promise.resolve(event.preloadResponse).then((pre) => pre || fetch(req));
    const res = await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), live ? 15000 : 3500))]);
    if (!live && res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()).then(() => trim(PAGES, 40))).catch(() => {});
    return res;
  } catch {
    if (!live) { const hit = await caches.match(req, { ignoreSearch: false }); if (hit) { event.waitUntil(fetch(req).then((r) => r.ok && caches.open(PAGES).then((c) => c.put(req, r))).catch(() => {})); return hit; } }
    return (await caches.match("/offline")) || new Response("أنت غير متصل بالإنترنت", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // money / forms → network only
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const p = url.pathname;
    if (p.startsWith("/api/")) {
      // Admin screens always read live data (so edits/deletes show immediately).
      const fromAdmin = (() => { try { return new URL(req.referrer).pathname.startsWith("/admin"); } catch { return false; } })();
      if (!fromAdmin && req.cache !== "no-store" && SWR_API.some((r) => r.test(p))) event.respondWith(staleWhileRevalidate(event, req, API, 60));
      return;                                              // every other API: live, untouched
    }
    if (req.mode === "navigate") return event.respondWith(page(event));
    if (p.startsWith("/_next/static/") || /\.(?:woff2?|ttf|otf)$/.test(p)) return event.respondWith(cacheFirst(req, STATIC, 400));
    if (p.startsWith("/_next/image") || /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/.test(p)) return event.respondWith(staleWhileRevalidate(event, req, IMG, 300));
    if (/\.(?:glb|gltf|usdz)$/.test(p)) return event.respondWith(cacheFirst(req, IMG, 300));
    return;                                                // RSC/data requests etc. → network
  }
  // Supabase images are fetched by the worker in CORS mode so the cached copy stays READABLE
  // (the floating product cut-out reads pixels; an opaque/no-cors copy would block it).
  if (SUPA_IMG.test(req.url)) return event.respondWith(staleWhileRevalidate(event, new Request(req.url, { mode: "cors", credentials: "omit" }), IMG, 300));
  if (CDN.test(req.url)) return event.respondWith(cacheFirst(new Request(req.url, { mode: "cors", credentials: "omit" }), STATIC, 400));
});

self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

// ── Phone notifications (Web Push) — arrive even with the site closed ─────────
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "محل ترند", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    dir: "rtl", lang: "ar",
    tag: d.tag || "trend",
    renotify: true,
    vibrate: [90, 40, 90],
    requireInteraction: !!d.important,
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) {   // site already open → bring it to the front and go there
        await w.focus();
        if ("navigate" in w) await w.navigate(target).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
