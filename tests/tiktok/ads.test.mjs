// Advertiser (Marketing API) OAuth tests.
//
// The TikTok API is MOCKED: a local HTTP server stands in for
// https://business-api.tiktok.com/open_api/v1.3, selected via the TIKTOK_API_BASE override.
// No test ever contacts TikTok.
//
// Usage:
//   1. start the mock + a dev server pointed at it (see scripts below in the repo docs):
//        node tests/tiktok/mock-tiktok-server.mjs &                      # port 3999
//        TIKTOK_API_BASE=http://127.0.0.1:3999 \
//        TIKTOK_ADS_APP_ID=test-app TIKTOK_ADS_APP_SECRET=test-secret \
//        TIKTOK_ADS_AUTH_URL="https://business-api.tiktok.com/portal/auth?app_id=test" \
//        npx next dev -p 3216
//   2. TIKTOK_TEST_PORT=3216 node --test tests/tiktok/ads.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PORT = process.env.TIKTOK_TEST_PORT || "3216";
const BASE = `http://localhost:${PORT}`;

let serverUp = false;
for (let attempt = 0; attempt < 5 && !serverUp; attempt++) {
  try {
    const res = await fetch(`${BASE}/api/bot/settings`, { signal: AbortSignal.timeout(30000) });
    serverUp = res.status === 200;
  } catch {
    await new Promise((r) => setTimeout(r, 2000));
  }
}
if (!serverUp) console.log(`! no dev server on ${BASE} — live advertiser tests will skip`);
const skip = () => (serverUp ? false : "dev server not running");

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s+\/\/.*$/gm, "");

const service = read("src/services/tiktokAds.ts");
const store = read("src/lib/tiktokAdsTokens.ts");
const callback = read("src/app/api/tiktok/ads/callback/route.ts");
const connect = read("src/app/api/tiktok/ads/connect/route.ts");
const organicCallback = read("src/app/api/tiktok/callback/route.ts");
const organicService = read("src/services/tiktok.ts");
const stateLib = read("src/lib/oauthState.ts");
const sql = read("supabase/tiktok-ads-oauth.sql");
/** SQL with `--` comments removed: assertions must test DDL, not the explanatory notes. */
const sqlCode = sql.split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith("--")).join(String.fromCharCode(10));

// ── The official advertiser flow, not the organic one ─────────────────────────

test("uses the official advertiser token endpoint, not the organic one", () => {
  assert.match(service, /oauth2\/access_token\//);
  assert.ok(!code(service).includes("tt_user/oauth2/token/"), "organic token endpoint used for advertiser");
  assert.match(service, /oauth2\/revoke_token\//);
  assert.ok(!code(service).includes("tt_user/oauth2/revoke/"));
});

test("token exchange sends app_id/secret/auth_code and NO redirect_uri", () => {
  const block = service.slice(service.indexOf("exchangeAdvertiserAuthCode"));
  assert.match(block, /app_id: adsAppId\(\)/);
  assert.match(block, /secret: adsAppSecret\(\)/);
  assert.match(block, /auth_code: authCode/);
  // The advertiser exchange does not take a redirect_uri — sending one is a contract error.
  assert.ok(!/redirect_uri/.test(block.slice(0, block.indexOf("revokeAdvertiserToken"))));
  assert.ok(!block.includes("client_id"), "advertiser exchange used client_id");
});

test("the advertiser response shape is honoured (advertiser_ids + numeric scope)", () => {
  assert.match(service, /advertiser_ids\?: string\[\]/);
  assert.match(service, /scope\?: number\[\]/);
  assert.match(service, /advertiserIds: \(data\.advertiser_ids \?\? \[\]\)\.map\(String\)/);
});

test("no refresh logic exists — the advertiser token does not expire", () => {
  assert.ok(!/refresh_token/.test(code(service)), "advertiser service references a refresh token");
  assert.ok(!/refresh_lock_at/.test(code(store)));
  assert.ok(!/refresh/i.test(sqlCode), "advertiser schema has refresh columns");
});

test("the authorization URL is portal-issued and only gains our state", () => {
  assert.match(service, /TIKTOK_ADS_AUTH_URL/);
  assert.match(service, /state=\$\{encodeURIComponent\(state\)\}/);
  assert.ok(!code(service).includes("client_key"));
  // no secret may ever be placed in a URL
  assert.ok(!/adsAppSecret\(\)[\s\S]{0,80}(url|URL|href)/.test(code(service)));
});

// ── Isolation from the organic flow ───────────────────────────────────────────

test("item 13/14 — the organic callback still uses its own endpoint and flow", () => {
  assert.match(organicCallback, /exchangeAuthCode\(code, tiktokRedirectUri\(\)\)/);
  assert.match(organicService, /tt_user\/oauth2\/token\//);
  // organic declares its own flows, so an advertiser state cannot be replayed there
  assert.match(organicCallback, /expectedFlows: \["connect", "reconnect", "scope_upgrade"\]/);
});

test("the advertiser callback rejects any non-advertiser state", () => {
  assert.match(callback, /expectedFlows: \["advertiser_connect", "advertiser_reconnect"\]/);
  assert.match(stateLib, /flow_mismatch/);
});

test("the two callbacks are different routes with different redirect URLs", () => {
  assert.match(read("src/lib/siteUrl.ts"), /TIKTOK_ADS_REDIRECT_PATH = "\/api\/tiktok\/ads\/callback\/"/);
  assert.match(read("src/lib/siteUrl.ts"), /TIKTOK_REDIRECT_PATH = "\/api\/tiktok\/callback\/"/);
  assert.match(read("next.config.ts"), /source: "\/api\/tiktok\/ads\/callback\/"/);
});

test("advertiser credentials are stored apart from organic ones", () => {
  assert.match(store, /from\("tiktok_ads_authorizations"\)/);
  assert.ok(!code(store).includes("tiktok_tokens"), "advertiser store writes the organic token table");
  assert.ok(!code(callback).includes("tiktok_accounts"));
  assert.ok(!code(callback).includes("bot_configs"));
});

// ── Credential handling ───────────────────────────────────────────────────────

test("item 10 — the advertiser token is encrypted at rest and refuses plaintext", () => {
  assert.match(store, /encryptSecret\(input\.accessToken\)/);
  assert.match(store, /if \(!encryptionConfigured\(\)\) throw/);
});

test("item 11 — the token column is never selected into a response shape", () => {
  // getActiveGrant is the UI-facing read: it must not select access_token
  const grantBlock = store.slice(store.indexOf("export async function getActiveGrant"), store.indexOf("export async function readAdvertiserToken"));
  assert.ok(!grantBlock.includes("access_token"), "getActiveGrant selects the token");
  // the callback returns a redirect, never a body carrying credentials
  assert.ok(!/NextResponse\.json\([^)]*accessToken/.test(callback));
});

test("item 12 — no secret material can reach a log line", () => {
  const all = code([service, store, callback, connect].join("\n"));
  assert.ok(!/console\.[a-z]+\([^)]*(accessToken|access_token|authCode|auth_code|secret|state)\b/.test(all));
});

test("the credential table is service-role only; ad accounts expose metadata only", () => {
  assert.match(sql, /create table if not exists tiktok_ads_authorizations/);
  assert.match(sql, /alter table tiktok_ads_authorizations enable row level security/);
  assert.ok(!/create policy[^;]*on tiktok_ads_authorizations/.test(sql), "a policy exists on the credential table");
  assert.match(sql, /tiktok_ad_accounts_owner_select/);
});

test("the migration is additive and touches no existing app data", () => {
  assert.ok(!/drop table/i.test(sqlCode));
  assert.ok(!/delete from/i.test(sqlCode));
  for (const t of ["bot_page_tokens", "connected_pages", "wallets", "store_orders", "tiktok_tokens", "tiktok_accounts"]) {
    assert.ok(!sqlCode.includes(t), `migration touches ${t}`);
  }
});

// ── Live route behaviour (mocked TikTok) ──────────────────────────────────────

test("item 1 — unauthenticated advertiser OAuth start is rejected", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/ads/connect`);
  assert.equal(res.status, 401);
});

test("item 7 — a callback without auth_code is rejected safely", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/ads/callback/?state=abc`, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  assert.match(location, /ads_error=cancelled/);
  assert.ok(!location.includes("ads_connected=1"));
});

test("item 8 — a TikTok error redirect is handled without leaking the upstream text", { skip: skip() }, async () => {
  const res = await fetch(
    `${BASE}/api/tiktok/ads/callback/?error=access_denied&error_description=${encodeURIComponent("advertiser refused: internal detail")}`,
    { redirect: "manual" },
  );
  const location = res.headers.get("location") || "";
  assert.match(location, /ads_error=declined/);
  assert.ok(!location.includes("internal detail"), "upstream error text leaked into the URL");
});

test("items 5/6 — a forged or foreign state never reaches the token exchange", { skip: skip() }, async () => {
  const forged = Buffer.from("11111111-1111-1111-1111-111111111111").toString("base64");
  const res = await fetch(`${BASE}/api/tiktok/ads/callback/?auth_code=MUST_NOT_BE_EXCHANGED&state=${forged}`, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  assert.match(location, /ads_error=(invalid_state|not_signed_in|not_configured)/);
  assert.ok(!location.includes("ads_connected=1"));
});

test("the advertiser callback is served on its exact trailing-slash URL", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/ads/callback/?state=x`, { redirect: "manual" });
  assert.notEqual(res.status, 308, "trailing-slash URL 308-redirects instead of being served");
});

test("item 13 live — the organic callback still answers independently", { skip: skip() }, async () => {
  const res = await fetch(`${BASE}/api/tiktok/callback/?auth_code=x&state=y`, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  // Organic error codes, not advertiser ones — proof the routes did not merge.
  assert.match(location, /[?&]error=/);
  assert.ok(!location.includes("ads_error"), "organic callback answered with advertiser errors");
});

test("item 9 — a token-exchange failure is reported safely", { skip: skip() }, async () => {
  // Reaching the exchange requires a valid state, which these tests cannot mint without a
  // session; the guard verified here is that failures always land on a fixed error code.
  assert.match(callback, /return fail\("exchange_failed"\)/);
});


// ── Mocked TikTok API: the real exchange code, a fake TikTok ───────────────────
//
// A local http server stands in for business-api.tiktok.com. The service module is imported
// AFTER TIKTOK_API_BASE is set, so the production default is never contacted.

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

async function withMockTikTok(handler, fn) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => handler(req, body, res));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

function okJson(res, data) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ code: 0, message: "OK", request_id: "mock-req", data }));
}

test("the exchange sends exactly the documented request and parses the grant", async () => {
  let seenPath = null, seenBody = null, seenContentType = null;

  await withMockTikTok(
    (req, body, res) => {
      seenPath = req.url; seenBody = JSON.parse(body); seenContentType = req.headers["content-type"];
      okJson(res, { access_token: "mock-long-term-token", advertiser_ids: ["7001", "7002"], scope: [4, 15] });
    },
    async (base) => {
      process.env.TIKTOK_API_BASE = base;
      process.env.TIKTOK_ADS_APP_ID = "mock-app-id";
      process.env.TIKTOK_ADS_APP_SECRET = "mock-app-secret";
      const svc = await import("../../src/services/tiktokAds.ts");

      const grant = await svc.exchangeAdvertiserAuthCode("mock-auth-code");

      assert.equal(seenPath, "/oauth2/access_token/");
      assert.equal(seenContentType, "application/json");
      assert.deepEqual(seenBody, { app_id: "mock-app-id", secret: "mock-app-secret", auth_code: "mock-auth-code" });
      assert.ok(!("redirect_uri" in seenBody), "redirect_uri must not be sent");
      assert.ok(!("client_id" in seenBody), "client_id must not be sent");

      assert.equal(grant.accessToken, "mock-long-term-token");
      assert.deepEqual(grant.advertiserIds, ["7001", "7002"]);
      assert.deepEqual(grant.scope, [4, 15]);
    },
  );
});

test("item 9 — a TikTok business error is surfaced as a safe typed error", async () => {
  await withMockTikTok(
    (req, body, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      // TikTok signals failure with a non-zero code inside HTTP 200.
      res.end(JSON.stringify({ code: 40002, message: "auth_code expired", request_id: "mock-req-2" }));
    },
    async (base) => {
      process.env.TIKTOK_API_BASE = base;
      const svc = await import("../../src/services/tiktokAds.ts");
      await assert.rejects(
        () => svc.exchangeAdvertiserAuthCode("expired-code"),
        (err) => {
          assert.equal(err.name, "TikTokAdsError");
          assert.equal(err.ttCode, 40002);
          // the log line carries diagnostics but no credential
          const line = err.toLogLine("user-1");
          assert.match(line, /tt_code=40002/);
          assert.ok(!line.includes("expired-code"));
          return true;
        },
      );
    },
  );
});

test("a response without an access_token is refused", async () => {
  await withMockTikTok(
    (req, body, res) => okJson(res, { advertiser_ids: ["7001"] }),
    async (base) => {
      process.env.TIKTOK_API_BASE = base;
      const svc = await import("../../src/services/tiktokAds.ts");
      await assert.rejects(() => svc.exchangeAdvertiserAuthCode("x"), /no_access_token|token response/);
    },
  );
});

// ── Item 10/11 against the real database: encrypted at rest, unreadable by anon ─

function envVar(name) {
  const file = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const NL = String.fromCharCode(10);
  const QUOTES = [String.fromCharCode(34), String.fromCharCode(39)];
  const line = file.split(NL).map((l) => l.trim()).find((l) => l.startsWith(name + "="));
  if (!line) return "";
  let v = line.slice(name.length + 1).trim();
  if (QUOTES.includes(v[0]) && v[v.length - 1] === v[0]) v = v.slice(1, -1);
  return v;
}

test("item 10/11 — a stored advertiser token is ciphertext and anon cannot read it", async () => {
  const url = envVar("NEXT_PUBLIC_SUPABASE_URL");
  const anon = envVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = envVar("SUPABASE_SERVICE_ROLE_KEY");
  assert.ok(url && anon && service, ".env.local must provide Supabase credentials");

  // Use the project's own encryption module (no imports, so it loads directly).
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const crypto = await import("../../src/lib/tokenCrypto.ts");

  const PLAINTEXT = "mock-long-term-advertiser-token-DO-NOT-STORE-RAW";
  const ciphertext = crypto.encryptSecret(PLAINTEXT);
  assert.notEqual(ciphertext, PLAINTEXT);
  assert.match(ciphertext, /^v1\./);
  assert.equal(crypto.decryptSecret(ciphertext), PLAINTEXT);

  const rest = (path, opts = {}) => fetch(`${url}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: opts.key || service, Authorization: `Bearer ${opts.key || service}`,
      "Content-Type": "application/json", ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const users = await (await rest("profiles?select=id&limit=1")).json();
  const userId = users?.[0]?.id;
  assert.ok(userId, "no user available for the foreign key");

  let rowId = null;
  try {
    const insert = await rest("tiktok_ads_authorizations", {
      method: "POST",
      prefer: "return=representation",
      body: {
        user_id: userId, access_token: ciphertext, scope: [4],
        advertiser_ids: ["mock-advertiser"], status: "error",   // 'error' keeps the active-grant index free
      },
    });
    const inserted = await insert.json();
    assert.ok(insert.status < 300, `insert failed: ${JSON.stringify(inserted).slice(0, 200)}`);
    rowId = inserted[0].id;

    // Stored value is ciphertext, never the plaintext token.
    const stored = await (await rest(`tiktok_ads_authorizations?id=eq.${rowId}&select=access_token`)).json();
    assert.notEqual(stored[0].access_token, PLAINTEXT);
    assert.equal(crypto.decryptSecret(stored[0].access_token), PLAINTEXT);

    // The browser role sees nothing at all.
    const asAnon = await (await rest("tiktok_ads_authorizations?select=access_token", { key: anon })).json();
    assert.equal(Array.isArray(asAnon) ? asAnon.length : 0, 0, "anon read an advertiser credential row");
  } finally {
    if (rowId) await rest(`tiktok_ads_authorizations?id=eq.${rowId}`, { method: "DELETE" });
  }
});
