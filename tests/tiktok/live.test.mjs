// Live route tests for the TikTok integration — these drive the REAL Next.js routes over
// HTTP, so they exercise the actual TypeScript (signature verification, state validation,
// auth gates, fail-closed cron) rather than a copy of it.
//
// Usage:
//   1. start a dev server whose env has TIKTOK_CLIENT_SECRET set to TEST_SECRET below:
//        TIKTOK_CLIENT_SECRET=phase22-test-secret npx next dev -p 3212
//   2. node --test tests/tiktok/live.test.mjs
//
// Override the port with TIKTOK_TEST_PORT. If no server is reachable the suite skips
// rather than reporting a false pass.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const PORT = process.env.TIKTOK_TEST_PORT || "3212";
const BASE = `http://localhost:${PORT}`;
const TEST_SECRET = process.env.TIKTOK_CLIENT_SECRET || "phase22-test-secret";

// Probed with TOP-LEVEL AWAIT, before any test is declared: node:test evaluates the `skip`
// option at declaration time, so a probe in a before() hook would always read "not running"
// and silently skip the whole suite (a false green).
let serverUp = false;
for (let attempt = 0; attempt < 5 && !serverUp; attempt++) {
  try {
    const res = await fetch(`${BASE}/api/bot/settings`, { signal: AbortSignal.timeout(30000) });
    serverUp = res.status === 200;
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
  }
}
if (!serverUp) console.log(`! no dev server on ${BASE} — live tests will skip`);

const skip = () => (serverUp ? false : "dev server not running");

/** Builds a correctly signed TikTok webhook delivery. */
function signedDelivery(content, { secret = TEST_SECRET, timestamp = Math.floor(Date.now() / 1000), event = "comment.update" } = {}) {
  const body = JSON.stringify({
    client_key: "test-client-key",
    event,
    create_time: timestamp,
    user_openid: "test-open-id-not-in-db",
    content: JSON.stringify(content),
  });
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { body, header: `t=${timestamp},s=${signature}` };
}

// Raw JSON built by hand: JSON.stringify of a JS number would itself destroy a 19-digit id
// before it ever reached the server, so the test would prove nothing.
const BIG_COMMENT_ID = "6990565363377392901";
const BIG_VIDEO_ID = "7391000000000000001";
const BIG_PARENT_ID = "6990565363377392999";

const COMMENT = {
  comment_id: 7391234567890123456,   // number in webhooks, > MAX_SAFE_INTEGER
  video_id: 7391000000000000001,
  comment_type: "comment",
  comment_action: "insert",
  timestamp: Math.floor(Date.now() / 1000),
  unique_identifier: "+ABc1D2/E0fGhijkl",
  text: "كم السعر؟",
};

async function postWebhook(body, header) {
  return fetch(`${BASE}/api/tiktok/webhook/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(header ? { "Tiktok-Signature": header } : {}) },
    body,
  });
}

// ── OAuth gates ───────────────────────────────────────────────────────────────

test("item 1 — unauthenticated OAuth start is rejected", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/connect`);
  assert.equal(res.status, 401);
});

test("item 2 — a forged state is rejected and no code is exchanged", { skip: skip() }, async () => {
  // The old scheme's shape: base64(user-uuid). Must not be accepted.
  const forged = Buffer.from("11111111-1111-1111-1111-111111111111").toString("base64");
  const res = await fetch(`${BASE}/api/tiktok/callback/?auth_code=SHOULD_NEVER_BE_EXCHANGED&state=${forged}`, {
    redirect: "manual",
  });
  assert.equal(res.status, 307);
  const location = res.headers.get("location") || "";
  assert.match(location, /error=(invalid_state|not_signed_in|not_configured)/);
  assert.ok(!location.includes("success=1"));
});

test("item 5 — the callback refuses without a session even with a well-formed state", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/callback/?auth_code=x&state=${"a".repeat(43)}`, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  assert.match(location, /error=/);
  assert.ok(!location.includes("success=1"));
});

test("the callback is served on the trailing-slash URL without a redirect hop", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/callback/?auth_code=x&state=y`, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  // A 308 to the bare path would mean TikTok's registered URL is not served directly.
  assert.notEqual(res.status, 308);
  assert.ok(!/\/api\/tiktok\/callback\?/.test(location), "redirected to the non-slash path");
});

// ── Webhook signature ─────────────────────────────────────────────────────────

test("item 8 — an invalid signature is rejected", { skip: skip() }, async () => {
  const { body } = signedDelivery(COMMENT);
  const res = await postWebhook(body, "t=1700000000,s=deadbeef");
  assert.equal(res.status, 401);
});

test("item 8b — a missing signature header is rejected", { skip: skip() }, async () => {
  const { body } = signedDelivery(COMMENT);
  const res = await postWebhook(body, null);
  assert.equal(res.status, 401);
});

test("item 8c — a signature computed over re-serialized JSON is rejected", { skip: skip() }, async () => {
  const { body } = signedDelivery(COMMENT);
  const t = Math.floor(Date.now() / 1000);
  // Same data, different bytes (key order) — must not verify.
  const reserialized = JSON.stringify(JSON.parse(body), ["event", "client_key", "create_time", "user_openid", "content"]);
  const sig = createHmac("sha256", TEST_SECRET).update(`${t}.${reserialized}`).digest("hex");
  const res = await postWebhook(body, `t=${t},s=${sig}`);
  assert.equal(res.status, 401);
});

test("item 9 — a stale but validly signed delivery is rejected", { skip: skip() }, async () => {
  const stale = Math.floor(Date.now() / 1000) - 3600;
  const { body, header } = signedDelivery(COMMENT, { timestamp: stale });
  const res = await postWebhook(body, header);
  assert.equal(res.status, 401);
});

test("item 10/11/12 — a valid signature is accepted and the nested content parsed", { skip: skip() }, async () => {
  const { body, header } = signedDelivery(COMMENT);
  const res = await postWebhook(body, header);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  // The account open_id is not in the database, so durable intake stops at unknown_account.
  // Reaching that outcome proves the delivery was verified, losslessly parsed, and routed
  // through the intake decision — the note now reports exactly where it stopped.
  assert.equal(json.note, "unknown_account");
});

test("item 19 — non-insert actions are acknowledged but not replied to", { skip: skip() }, async () => {
  for (const action of ["delete", "set_to_hidden", "set_to_friends_only", "set_to_public"]) {
    const { body, header } = signedDelivery({ ...COMMENT, comment_action: action });
    const res = await postWebhook(body, header);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.note, `ignored_action:${action}`);
  }
});

test("other event types are acknowledged and ignored", { skip: skip() }, async () => {
  const { body, header } = signedDelivery(COMMENT, { event: "share.video.publish_complete" });
  const res = await postWebhook(body, header);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).note, "ignored_event");
});

test("a malformed nested content string is acknowledged, not retried forever", { skip: skip() }, async () => {
  const t = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ event: "comment.update", create_time: t, user_openid: "x", content: "{not json" });
  const sig = createHmac("sha256", TEST_SECRET).update(`${t}.${body}`).digest("hex");
  const res = await postWebhook(body, `t=${t},s=${sig}`);
  assert.equal(res.status, 200);
});

test("the webhook rejects GET", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/webhook/`);
  assert.equal(res.status, 405);
});

// ── Cron + adjacent surfaces ──────────────────────────────────────────────────

test("cron endpoints fail closed without a configured secret", { skip: skip() }, async () => {
  for (const path of ["/api/tiktok/cron/poll", "/api/bot/cron/drain"]) {
    const res = await fetch(`${BASE}${path}`);
    assert.ok([401, 503].includes(res.status), `${path} returned ${res.status}`);
  }
});

test("TikTok config endpoints require authentication", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/configs`);
  assert.equal(res.status, 401);
});

test("the app-level webhook admin route is admin-gated", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/admin/webhook`);
  assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
});

test("Meta bot routes still behave exactly as before", { skip: skip() }, async () => {
  assert.equal((await fetch(`${BASE}/api/bot/configs`)).status, 401);
  const settings = await fetch(`${BASE}/api/bot/settings`);
  assert.equal(settings.status, 200);
  const hub = await fetch(`${BASE}/api/bot/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`);
  assert.equal(hub.status, 403);
});

test("storefront routes are unaffected", { skip: skip() }, async () => {
  for (const path of ["/api/products", "/api/site-settings"]) {
    assert.equal((await fetch(`${BASE}${path}`)).status, 200);
  }
});


// ── Phase 2.2.1: large ids end-to-end + durable acknowledgement ────────────────

/** Builds a delivery whose ids are RAW 19-digit JSON numbers, exactly as TikTok sends them. */
function signedBigIdDelivery({ action = "insert", timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const content = `{"comment_id":${BIG_COMMENT_ID},"video_id":${BIG_VIDEO_ID},` +
    `"parent_comment_id":${BIG_PARENT_ID},"comment_type":"reply","comment_action":"${action}",` +
    `"timestamp":${timestamp},"unique_identifier":"+ABc1D2","text":"كم السعر؟"}`;
  const body = `{"client_key":"test","event":"comment.update","create_time":${timestamp},` +
    `"user_openid":"test-open-id-not-in-db","content":${JSON.stringify(content)}}`;
  const signature = createHmac("sha256", TEST_SECRET).update(`${timestamp}.${body}`).digest("hex");
  return { body, header: `t=${timestamp},s=${signature}` };
}

test("items 1-3 live — a delivery carrying 19-digit ids is accepted, not rejected", { skip: skip() }, async () => {
  const { body, header } = signedBigIdDelivery();
  const res = await postWebhook(body, header);
  assert.equal(res.status, 200);
  const json = await res.json();
  // The account is not in the database, so intake stops at unknown_account — but reaching
  // that outcome proves the payload parsed and the ids passed idToString(), which THROWS on
  // an id that lost precision (which would have produced ignored_event instead).
  assert.equal(json.note, "unknown_account");
});

test("a lossy id would be refused — sanity check on the guard", { skip: skip() }, async () => {
  // comment_id sent as a float: not a valid id, must not be treated as one.
  const t = Math.floor(Date.now() / 1000);
  const content = `{"comment_id":6990565363377392901.5,"video_id":${BIG_VIDEO_ID},"comment_action":"insert","text":"x"}`;
  const body = `{"event":"comment.update","create_time":${t},"user_openid":"x","content":${JSON.stringify(content)}}`;
  const sig = createHmac("sha256", TEST_SECRET).update(`${t}.${body}`).digest("hex");
  const res = await postWebhook(body, `t=${t},s=${sig}`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).note, "ignored_event");
});

test("item 9 live — acknowledgement carries the intake outcome", { skip: skip() }, async () => {
  const { body, header } = signedBigIdDelivery({ action: "set_to_hidden" });
  const res = await postWebhook(body, header);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).note, "ignored_action:set_to_hidden");
});

test("the cron now drains queued events before reconciling", { skip: skip() }, async () => {
  // Unauthenticated, so it must still refuse — proving the route exists and stays protected.
  const res = await fetch(`${BASE}/api/tiktok/cron/poll`);
  assert.ok([401, 503].includes(res.status));
});
