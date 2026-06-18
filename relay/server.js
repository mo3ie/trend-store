// Yusor Pay (يسر باي) static-IP relay
// ------------------------------------------------------------------
// Vercel functions have NO fixed outbound IP, so Masarat cannot whitelist
// them. This tiny zero-dependency proxy runs on a server WITH a fixed IPv4
// (whitelisted by Masarat) and forwards our app's calls to the Yusor host:
//
//   Vercel  --x-relay-key-->  THIS relay (fixed IP)  -->  160.19.103.122:40120
//
// It preserves method, path, headers and body exactly, so src/lib/yusor.ts
// only needs YUSOR_BASE_URL repointed at this relay — no other code changes.
//
// Run:  RELAY_KEY=... node server.js     (see relay/README.md)

const http = require("node:http");
const net  = require("node:net");
const { URL } = require("node:url");

const PORT       = Number(process.env.RELAY_PORT || 8080);
const UPSTREAM   = process.env.UPSTREAM_ORIGIN || "http://160.19.103.122:40120";
const RELAY_KEY  = process.env.RELAY_KEY || ""; // shared secret — REQUIRED
const UP_TIMEOUT = Number(process.env.UPSTREAM_TIMEOUT_MS || 25000);

const up      = new URL(UPSTREAM);
const UP_HOST = up.hostname;
const UP_PORT = Number(up.port || (up.protocol === "https:" ? 443 : 80));

function log(...a) { console.log(new Date().toISOString(), ...a); }

if (!RELAY_KEY) {
  console.error("FATAL: RELAY_KEY env var is required (shared secret). Refusing to start as an open proxy.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // --- Health: can THIS box actually TCP-reach the Yusor host? -------------
  // Open (no key) so you can curl it from the VPS to prove reachability
  // BEFORE asking Masarat to whitelist. Leaks nothing sensitive.
  if (req.method === "GET" && (req.url === "/__relay/health" || req.url === "/")) {
    const started = Date.now();
    const sock = net.connect({ host: UP_HOST, port: UP_PORT, timeout: 8000 });
    const done = (reachable, error) => {
      sock.destroy();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        relay: "ok",
        upstream: `${UP_HOST}:${UP_PORT}`,
        reachable,
        ...(error ? { error } : {}),
        ms: Date.now() - started,
      }));
    };
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false, "ETIMEDOUT"));
    sock.once("error",  (e) => done(false, e.code || e.message));
    return;
  }

  // --- Auth: only our app (holding the shared key) may proxy --------------
  if (req.headers["x-relay-key"] !== RELAY_KEY) {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden" }));
    log("403", req.method, req.url, "from", req.socket.remoteAddress);
    return;
  }

  // --- Forward verbatim to the Yusor host --------------------------------
  const headers = { ...req.headers, host: `${UP_HOST}:${UP_PORT}` };
  delete headers["x-relay-key"];

  const proxyReq = http.request(
    { host: UP_HOST, port: UP_PORT, method: req.method, path: req.url, headers, timeout: UP_TIMEOUT },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("timeout", () => proxyReq.destroy(new Error("ETIMEDOUT")));
  proxyReq.on("error", (e) => {
    log("upstream-error", req.method, req.url, e.code || e.message);
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_unreachable", code: e.code || e.message }));
    }
  });
  req.pipe(proxyReq);
});

server.listen(PORT, () => log(`yusor relay on :${PORT} -> ${UP_HOST}:${UP_PORT}`));
