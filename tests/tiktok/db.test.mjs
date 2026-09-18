// Database-level security tests — these run against the REAL Supabase project and prove the
// properties that could only be asserted statically before the migrations were applied:
// Phase 2.2 items 3 (expired state), 4 (reused state) and 7 (token columns unreadable by the
// browser), plus the deduplication constraint and the generated identifier columns.
//
// Every row this suite creates is clearly marked and deleted again in the same run.
// It never touches Meta data.
//
// Run: node --test tests/tiktok/db.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function env(name) {
  const file = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const line = file.split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const URL_BASE = env("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE = env("SUPABASE_SERVICE_ROLE_KEY");

/** PostgREST call as a given role. `anon` is exactly what a browser client can do. */
async function rest(path, { key = SERVICE, method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 has no body */ }
  return { status: res.status, json };
}

const TAG = `phase221-dbtest-${Date.now()}`;
let testUserId = null;
let accountId = null;

before(async () => {
  assert.ok(URL_BASE && ANON && SERVICE, ".env.local must provide the Supabase URL and keys");
  // Any existing user satisfies the auth.users foreign key; no user data is modified.
  const { json } = await rest("profiles?select=id&limit=1");
  testUserId = json?.[0]?.id ?? null;
});

after(async () => {
  // Clean up in dependency order. tiktok_tokens cascades from tiktok_accounts.
  if (accountId) await rest(`tiktok_accounts?id=eq.${accountId}`, { method: "DELETE" });
  await rest(`tiktok_oauth_states?state_hash=like.${TAG}*`, { method: "DELETE" });
  await rest(`bot_reply_log?comment_id=like.${TAG}*`, { method: "DELETE" });
  await rest(`security_rate_limits?identifier=eq.${TAG}`, { method: "DELETE" });
});

// ── Item 7: credentials must be unreadable by the browser ─────────────────────

test("item 7 — the anon role cannot read tiktok_tokens", async () => {
  const { status, json } = await rest("tiktok_tokens?select=access_token,refresh_token", { key: ANON });
  // RLS with zero policies: PostgREST returns an empty set or a permission error, never rows.
  const rows = Array.isArray(json) ? json : [];
  assert.equal(rows.length, 0, `anon read ${rows.length} token rows (status ${status})`);
});

test("item 7b — the anon role cannot read tiktok_oauth_states", async () => {
  const { json } = await rest("tiktok_oauth_states?select=state_hash,binding_hash", { key: ANON });
  assert.equal(Array.isArray(json) ? json.length : 0, 0);
});

test("item 7c — the anon role cannot read security_rate_limits", async () => {
  const { json } = await rest("security_rate_limits?select=identifier", { key: ANON });
  assert.equal(Array.isArray(json) ? json.length : 0, 0);
});

test("the anon role cannot INSERT a token row either", async () => {
  const { status } = await rest("tiktok_tokens", {
    key: ANON, method: "POST",
    body: { account_id: "00000000-0000-0000-0000-000000000000", access_token: "x" },
  });
  assert.ok(status >= 400, `anon insert into tiktok_tokens returned ${status}`);
});

test("the service role CAN read the credential table (server path works)", async () => {
  const { status } = await rest("tiktok_tokens?select=id&limit=1");
  assert.equal(status, 200);
});

// ── Items 3 & 4: OAuth state expiry and single use ────────────────────────────

/** Mirrors the atomic claim in src/lib/oauthState.ts: update … where consumed_at is null. */
async function claimState(stateHash) {
  const { json } = await rest(
    `tiktok_oauth_states?state_hash=eq.${stateHash}&consumed_at=is.null`,
    { method: "PATCH", body: { consumed_at: new Date().toISOString() }, prefer: "return=representation" },
  );
  return Array.isArray(json) ? json : [];
}

test("item 4 — a state can be consumed exactly once", async () => {
  const stateHash = `${TAG}-reuse`.padEnd(64, "0").slice(0, 64);
  const { status } = await rest("tiktok_oauth_states", {
    method: "POST",
    body: {
      state_hash: stateHash,
      binding_hash: "b".repeat(64),
      user_id: testUserId,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    },
  });
  assert.ok(status < 300, `could not insert state (${status})`);

  const first = await claimState(stateHash);
  assert.equal(first.length, 1, "the first claim must win");

  const second = await claimState(stateHash);
  assert.equal(second.length, 0, "a reused state must claim nothing");
});

test("item 3 — an expired state is detectable and is burned by the claim", async () => {
  const stateHash = `${TAG}-expired`.padEnd(64, "0").slice(0, 64);
  // The TTL constraint is `expires_at > created_at and expires_at < created_at + 1 hour`, so
  // an already-expired row cannot be created with created_at = now(); that is the constraint
  // doing its job. A row expires in production by the CLOCK MOVING ON, which is reproduced
  // here by backdating created_at — still satisfying the constraint.
  const createdAt = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { status } = await rest("tiktok_oauth_states", {
    method: "POST",
    body: {
      state_hash: stateHash,
      binding_hash: "b".repeat(64),
      user_id: testUserId,
      created_at: createdAt,
      expires_at: new Date(Date.now() - 2 * 3600_000 + 600_000).toISOString(), // created_at + 10 min
    },
  });
  assert.ok(status < 300, `could not insert a backdated state (${status})`);

  const claimed = await claimState(stateHash);
  assert.equal(claimed.length, 1, "the claim should still burn the row");
  // …and the application rejects it because it is past expiry (the check in consumeOAuthState).
  assert.ok(new Date(claimed[0].expires_at).getTime() <= Date.now(), "row is not actually expired");
});

test("the TTL constraint refuses a state that would live longer than an hour", async () => {
  const { status } = await rest("tiktok_oauth_states", {
    method: "POST",
    body: {
      state_hash: `${TAG}-ttl`.padEnd(64, "0").slice(0, 64),
      binding_hash: "b".repeat(64),
      user_id: testUserId,
      expires_at: new Date(Date.now() + 7 * 3600_000).toISOString(),
    },
  });
  assert.ok(status >= 400, `a 7-hour TTL was accepted (${status})`);
});

// ── Deduplication: the real constraint, on the real table ─────────────────────

test("items 5/6 — a duplicate comment_id is rejected by the database", async () => {
  const commentId = `${TAG}-6990565363377392901`;
  const row = { page_id: "phase221-test", comment_id: commentId, public_status: "queued" };

  const first = await rest("bot_reply_log", { method: "POST", body: row });
  assert.ok(first.status < 300, `first insert failed (${first.status})`);

  const second = await rest("bot_reply_log", { method: "POST", body: row });
  assert.ok(second.status >= 400, "a duplicate comment_id was accepted");
  assert.equal(second.json?.code, "23505", `expected a unique violation, got ${second.json?.code}`);
});

test("a 19-digit comment_id round-trips through the database unchanged", async () => {
  const commentId = `${TAG}-big-6990565363377392901`;
  await rest("bot_reply_log", { method: "POST", body: { page_id: "phase221-test", comment_id: commentId, public_status: "queued" } });
  const { json } = await rest(`bot_reply_log?comment_id=eq.${commentId}&select=comment_id`);
  assert.equal(json?.[0]?.comment_id, commentId);
  assert.ok(json[0].comment_id.endsWith("6990565363377392901"));
});

// ── Generated identifier columns ──────────────────────────────────────────────

test("open_id and business_id are generated from the stored identifier", async () => {
  const openId = `${TAG}-openid`;
  const { status, json } = await rest("tiktok_accounts", {
    method: "POST",
    body: { user_id: testUserId, tiktok_account_id: openId },
    prefer: "return=representation",
  });
  assert.ok(status < 300, `insert failed (${status}): ${JSON.stringify(json)?.slice(0, 200)}`);
  accountId = json[0].id;

  assert.equal(json[0].open_id, openId);
  assert.equal(json[0].business_id, openId);
  assert.equal(json[0].business_id, json[0].open_id, "business_id must equal open_id");
});

test("business_id cannot be set independently — no second identifier can exist", async () => {
  const { status } = await rest("tiktok_accounts", {
    method: "POST",
    body: { user_id: testUserId, tiktok_account_id: `${TAG}-x`, business_id: "something-else" },
  });
  assert.ok(status >= 400, "a generated column accepted a direct write");
});

// ── Webhook config singleton ──────────────────────────────────────────────────

test("the app-level webhook config row exists and starts unsubscribed", async () => {
  const { json } = await rest("tiktok_webhook_config?select=id,event_type,subscribed");
  assert.equal(json.length, 1, "expected exactly one configuration row");
  assert.equal(json[0].id, 1);
  assert.equal(json[0].event_type, "COMMENT");
  assert.equal(json[0].subscribed, false);
});

// ── The live Meta bot must be untouched ───────────────────────────────────────

test("Meta data is intact after the migrations", async () => {
  // These migrations are additive, so the invariant is "nothing was REMOVED". Exact counts
  // cannot be asserted: this is a live database and another workstream connects Pages daily
  // (bot_page_tokens grew from 30 to 75 during this work — growth, never loss).
  const configs = await rest("bot_configs?platform=eq.meta&select=id");
  assert.equal(configs.json.length, 7, "Meta bot configs changed");

  const tokens = await rest("bot_page_tokens?select=id");
  assert.ok(tokens.json.length >= 30, `Meta page tokens shrank to ${tokens.json.length}`);

  const pages = await rest("connected_pages?select=id");
  assert.ok(pages.json.length >= 87, `connected pages shrank to ${pages.json.length}`);

  // The Meta columns the bot depends on must all still be present.
  const cols = await rest("bot_reply_log?select=comment_id,public_status,private_status,sent_at,config_id&limit=1");
  assert.equal(cols.status, 200, "bot_reply_log lost a column the Meta bot reads");
});

test("Meta's deferred drain query still returns only its own rows", async () => {
  const { json } = await rest("bot_reply_log?public_status=eq.deferred&select=comment_id");
  // Our test rows use 'queued', so they must not appear here.
  assert.ok(Array.isArray(json));
  assert.ok(!json.some((r) => String(r.comment_id).startsWith(TAG)), "a TikTok queue row leaked into Meta's drain");
});
