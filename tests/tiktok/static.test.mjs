// Static contract tests for the TikTok Organic Accounts integration.
//
// These assert the things that must never silently regress: which official endpoints we
// call, that retired/incorrect ones are gone, that secrets cannot reach the browser, and
// that the security invariants from Phase 1 are still in the source.
//
// Run:  node --test tests/tiktok/
//
// They read the source rather than importing it, because the source uses the "@/..." path
// alias that only the Next.js/TypeScript resolver understands. Behavioural coverage of the
// same code lives in live.test.mjs, which drives the real routes over HTTP.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/** Source with comments removed — assertions about behaviour must not match documentation. */
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s+\/\/.*$/gm, "");

const service = read("src/services/tiktok.ts");
const webhookService = read("src/services/tiktokWebhook.ts");
const webhookRoute = read("src/app/api/tiktok/webhook/route.ts");
const callbackRoute = read("src/app/api/tiktok/callback/route.ts");
const connectRoute = read("src/app/api/tiktok/connect/route.ts");
const engine = read("src/services/tiktokEngine.ts");
const tokens = read("src/lib/tiktokTokens.ts");
const siteUrlLib = read("src/lib/siteUrl.ts");
const rateLimitLib = read("src/lib/rateLimit.ts");
const phase1Sql = read("supabase/tiktok-oauth-phase1.sql");
const botSql = read("supabase/bot-tables.sql");
const nextConfig = read("next.config.ts");
const events = read("src/services/tiktokEvents.ts");
const lossless = read("src/lib/losslessJson.ts");
const queueSql = read("supabase/tiktok-webhook-queue.sql");

// ── Official endpoints (verified against TikTok API for Business v1.3) ─────────

test("uses the official Accounts API base", () => {
  assert.match(service, /https:\/\/business-api\.tiktok\.com\/open_api\/v1\.3/);
});

test("all nine organic Accounts endpoints are present", () => {
  for (const path of [
    "tt_user/oauth2/token/",
    "tt_user/oauth2/refresh_token/",
    "tt_user/oauth2/revoke/",
    "tt_user/token_info/get/",
    "business/get/",
    "business/video/list/",
    "business/comment/list/",
    "business/comment/reply/list/",
    "business/comment/create/",
    "business/comment/reply/create/",
    "business/comment/like/",
    "business/comment/hide/",
    "business/comment/delete/",
  ]) {
    assert.ok(service.includes(path), `missing endpoint: ${path}`);
  }
});

test("item 15 — the bot reply uses /business/comment/reply/create/", () => {
  assert.match(service, /replyToComment[\s\S]{0,400}business\/comment\/reply\/create\//);
});

test("item 14 — hide uses /business/comment/hide/ with an action field, not status/update", () => {
  assert.ok(!code(service).includes("business/comment/status/update/"), "retired endpoint still called");
  assert.match(service, /hideComment[\s\S]{0,400}business\/comment\/hide\//);
  assert.match(service, /action: hidden \? "HIDE" : "UNHIDE"/);
  // hide is the only comment mutation that also needs video_id
  assert.match(service, /business\/comment\/hide\/[\s\S]{0,300}video_id/);
});

test("the Ad Comments family is never called from the organic service", () => {
  for (const adEndpoint of ['"comment/list/"', '"comment/status/update/"', '"comment/reference/"']) {
    assert.ok(!service.includes(adEndpoint), `ad-comments endpoint referenced: ${adEndpoint}`);
  }
});

test("Login Kit shapes are gone", () => {
  assert.ok(!service.includes("www.tiktok.com/v2/auth/authorize"), "Login Kit authorize URL still present");
  assert.ok(!service.includes("client_key:"), "client_key still sent as a request parameter");
  assert.ok(!/scope:\s*"user\.info\.basic/.test(service), "scope is still constructed by us");
});

test("the authorization URL comes from the portal and only gains our state", () => {
  assert.match(service, /TIKTOK_AUTH_URL/);
  assert.match(service, /buildTikTokAuthorizeUrl/);
  assert.match(connectRoute, /buildTikTokAuthorizeUrl/);
});

test("token exchange sends exactly the documented fields", () => {
  const block = service.slice(service.indexOf("exchangeAuthCode"), service.indexOf("refreshAccessToken"));
  for (const f of ["client_id", "client_secret", "grant_type", "auth_code", "redirect_uri"]) {
    assert.ok(block.includes(f), `token exchange missing ${f}`);
  }
  assert.ok(!block.includes("client_key"), "token exchange uses client_key");
});

test("token_info uses app_id (documented inconsistency with client_id)", () => {
  const block = service.slice(service.indexOf("getTokenInfo"));
  assert.match(block, /app_id: tiktokClientId\(\)/);
});

// ── Identifiers ───────────────────────────────────────────────────────────────

test("business_id is derived from open_id and nowhere else", () => {
  assert.match(service, /export function businessIdFromOpenId/);
  assert.match(callbackRoute, /businessIdFromOpenId\(tokens\.openId\)/);
});

test("ids are normalized to strings at the service boundary", () => {
  assert.match(service, /export function normalizeId/);
  assert.match(service, /return String\(id\)/);
  assert.match(service, /export function normalizeVideoId/);
});

test("max page size never exceeds the documented 30", () => {
  assert.match(service, /MAX_PAGE_SIZE = 30/);
  assert.match(service, /Math\.min\(opts\.maxCount \?\? 20, MAX_PAGE_SIZE\)/);
});

// ── Redirect + webhook URLs ───────────────────────────────────────────────────

test("item 2 — the registered redirect URI keeps its trailing slash", () => {
  assert.match(siteUrlLib, /TIKTOK_REDIRECT_PATH = "\/api\/tiktok\/callback\/"/);
  assert.match(siteUrlLib, /TIKTOK_WEBHOOK_PATH = "\/api\/tiktok\/webhook\/"/);
  assert.match(siteUrlLib, /https:\/\/www\.trendstore-ly\.com/);
});

test("trailing-slash URLs are served directly, not via a redirect", () => {
  assert.match(nextConfig, /skipTrailingSlashRedirect: true/);
  assert.match(nextConfig, /source: "\/api\/tiktok\/callback\/"/);
  assert.match(nextConfig, /source: "\/api\/tiktok\/webhook\/"/);
});

// ── Webhook security ──────────────────────────────────────────────────────────

test("item 8/18 — signature is verified over the RAW body, before any JSON.parse", () => {
  // Compare CALL SITES, not imports.
  const rawIdx = webhookRoute.indexOf("await req.text()");
  const verifyIdx = webhookRoute.indexOf("verifyWebhookSignature(rawBody");
  const parseIdx = webhookRoute.indexOf("parseCommentUpdate(rawBody");
  assert.ok(rawIdx > -1, "route does not read the raw body");
  assert.ok(rawIdx < verifyIdx, "signature verified before the raw body is read");
  assert.ok(verifyIdx < parseIdx, "payload parsed before the signature is verified");
  assert.ok(!webhookRoute.includes("req.json()"), "route parses JSON directly");
});

test("signature uses HMAC-SHA256 over `t + '.' + rawBody` with constant-time compare", () => {
  assert.match(webhookService, /createHmac\("sha256", secret\)\.update\(`\$\{parsed\.t\}\.\$\{rawBody\}`\)/);
  assert.match(webhookService, /timingSafeEqual/);
});

test("item 9 — stale timestamps are rejected", () => {
  assert.match(webhookService, /stale_timestamp/);
  assert.match(webhookService, /DEFAULT_TOLERANCE_SEC/);
});

test("webhook fails closed without the app secret", () => {
  assert.match(webhookRoute, /if \(!secret\)[\s\S]{0,240}status: 503/);
});

test("item 19 — only comment.update inserts drive the bot", () => {
  assert.match(webhookService, /COMMENT_UPDATE_EVENT = "comment.update"/);
  assert.match(webhookService, /isReplyableEvent[\s\S]{0,120}action === "insert"/);
});

// ── Deduplication + engine ────────────────────────────────────────────────────

test("item 13 — both paths claim through the UNIQUE(comment_id) log", () => {
  assert.match(botSql, /comment_id\s+text not null unique/);
  // Webhook path: the durable enqueue IS the claim.
  assert.match(events, /from\("bot_reply_log"\)\s*\.insert/);
  // Reconciliation path: its own claim against the same constraint.
  assert.match(engine, /async function claimComment/);
  const reconcileIdx = engine.indexOf("async function reconcileAccount");
  assert.ok(engine.slice(reconcileIdx, reconcileIdx + 2500).includes("claimComment"));
});

test("there is exactly one rule engine — the TikTok path reuses matchRule", () => {
  assert.match(engine, /import \{ matchRule, type BotRule \} from "@\/services\/botEngine"/);
});

test("item 23 — polling is documented as the reconciliation backstop", () => {
  assert.match(engine, /BACKSTOP/);
  assert.match(read("src/app/api/tiktok/cron/poll/route.ts"), /RECONCILIATION BACKSTOP/);
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

test("item 24 — both the app-wide and per-account limiters exist and are used", () => {
  assert.match(rateLimitLib, /export async function checkAppRateLimit/);
  assert.match(rateLimitLib, /export async function checkAccountRateLimit/);
  assert.match(rateLimitLib, /TIKTOK_APP_QPM/);
  assert.match(engine, /checkAppRateLimit\(/);
  assert.match(engine, /checkAccountRateLimit\(/);
  // the app bucket must not be keyed by customer
  assert.match(rateLimitLib, /"app:all"/);
});

// ── Token lifecycle ───────────────────────────────────────────────────────────

test("item 16 — refresh happens under an atomic lock claim", () => {
  assert.match(tokens, /claimRefreshLock/);
  assert.match(tokens, /refresh_lock_at/);
  assert.match(tokens, /if \(!gotLock\)/);
  assert.match(tokens, /releaseRefreshLock\(accountId\)/);
  // lock released in finally so a throw cannot wedge the account
  assert.match(tokens, /finally \{[\s\S]{0,120}releaseRefreshLock/);
});

test("item 17 — disconnect revokes at TikTok, then always tears down locally", () => {
  assert.match(tokens, /revokeAccessToken\(tokens\.accessToken\)/);
  const disconnectBlock = tokens.slice(tokens.indexOf("export async function disconnectTikTokAccount"));
  assert.match(disconnectBlock, /access_token: null, refresh_token: null, status: "revoked"/);
  assert.match(disconnectBlock, /revoked_at/);
});

test("credentials are encrypted at rest and never stored in plaintext", () => {
  assert.match(tokens, /encryptSecret\(input\.accessToken\)/);
  assert.match(tokens, /if \(!encryptionConfigured\(\)\)[\s\S]{0,140}throw/);
});

test("TikTok credentials never go to the Meta token tables", () => {
  assert.ok(!code(callbackRoute).includes("bot_page_tokens"), "callback still writes bot_page_tokens");
  assert.ok(!code(engine).includes("bot_page_tokens"), "engine still reads bot_page_tokens");
  assert.ok(!code(callbackRoute).includes("connected_pages"));
});

// ── Secrets ───────────────────────────────────────────────────────────────────

test("no secret is read from a NEXT_PUBLIC_ variable", () => {
  for (const [name, src] of Object.entries({ service, tokens, webhookService, webhookRoute })) {
    assert.ok(!/NEXT_PUBLIC_[A-Z_]*(SECRET|KEY|TOKEN)/.test(src), `${name} reads a public secret var`);
  }
});

test("secret material is never logged", () => {
  const all = [service, tokens, webhookRoute, callbackRoute, engine].join("\n");
  // no console.* call that interpolates a token/code/secret
  assert.ok(!/console\.[a-z]+\([^)]*(accessToken|refreshToken|auth_code|authCode|client_secret|rawBody)/.test(all));
});

test("Phase 1 security invariants are still in the callback", () => {
  assert.match(callbackRoute, /consumeOAuthState/);
  assert.match(callbackRoute, /getAuthUser/);
  assert.match(callbackRoute, /sessionUserId: user\?\.id \?\? null/);
  // the auth code is only exchanged after the state check — compare CALL SITES, not imports
  assert.ok(
    callbackRoute.indexOf("consumeOAuthState({") < callbackRoute.indexOf("exchangeAuthCode(code"),
    "auth code exchanged before the state is validated",
  );
});

// ── Database ──────────────────────────────────────────────────────────────────

test("item 7 — token and state tables have RLS on with zero policies", () => {
  assert.match(phase1Sql, /alter table tiktok_tokens enable row level security/);
  assert.match(phase1Sql, /alter table tiktok_oauth_states enable row level security/);
  assert.ok(!/create policy[^;]*on tiktok_tokens/.test(phase1Sql), "a policy exists on tiktok_tokens");
  assert.ok(!/create policy[^;]*on tiktok_oauth_states/.test(phase1Sql), "a policy exists on tiktok_oauth_states");
});

test("open_id and business_id are database-generated from one stored identifier", () => {
  const sql = read("supabase/tiktok-phase2-2.sql");
  assert.match(sql, /open_id text generated always as \(tiktok_account_id\) stored/);
  assert.match(sql, /business_id text generated always as \(tiktok_account_id\) stored/);
});


// ── Phase 2.2.1: large-integer safety + durable intake ────────────────────────

test("item 1/2/3 — TikTok payloads are never parsed with a plain JSON.parse", () => {
  const webhookCode = code(webhookService);
  assert.ok(!/JSON\.parse\s*\(/.test(webhookCode), "webhook parsing still uses JSON.parse");
  assert.match(webhookService, /parseJsonLossless<WebhookEnvelope>/);
  assert.match(webhookService, /parseJsonLossless<Record<string, unknown>>\(envelope\.content/);
});

test("the lossless parser is scoped to TikTok and replaces nothing globally", () => {
  // Only the TikTok webhook path may import it.
  const importers = ["src/services/tiktokWebhook.ts"];
  for (const f of importers) assert.match(read(f), /losslessJson/);
  assert.ok(!read("src/services/botEngine.ts").includes("losslessJson"), "Meta engine was changed");
  assert.match(lossless, /TIKTOK_ID_FIELDS/);
});

test("ids that already lost precision are refused, not silently stringified", () => {
  assert.match(lossless, /unsafe_integer_id/);
  assert.match(webhookService, /idToString\(content\.comment_id\)/);
});

test("item 5/6 — the durable record IS the deduplication claim (one authority)", () => {
  // The webhook enqueue inserts the same bot_reply_log row the poll competes for.
  assert.match(events, /from\("bot_reply_log"\)\s*\.insert/);
  assert.match(events, /UNIQUE_VIOLATION = "23505"/);
  assert.match(events, /outcome: "duplicate"/);
  // and no second unique constraint was introduced for TikTok comments
  assert.ok(!/create unique index/i.test(queueSql), "a second uniqueness rule was added");
  assert.ok(!/add constraint.*unique/i.test(queueSql), "a second uniqueness rule was added");
});

test("item 9/10 — the route acknowledges only after durable intake", () => {
  const enqueueIdx = webhookRoute.indexOf("await enqueueCommentEvent(event)");
  const ackIdx = webhookRoute.lastIndexOf("return respond(ackFor(result.outcome))");
  assert.ok(enqueueIdx > -1 && ackIdx > enqueueIdx, "ack does not follow the durable enqueue");
  assert.match(webhookRoute, /storage_unavailable[\s\S]{0,160}return respond/);
});

test("background work is not the reliability mechanism", () => {
  // the cron drains queued rows, so a killed invocation cannot lose an event
  assert.match(read("src/app/api/tiktok/cron/poll/route.ts"), /drainQueuedTikTokEvents/);
  assert.match(events, /export async function drainQueuedTikTokEvents/);
  // the drain claims atomically before processing
  assert.match(events, /\.eq\("public_status", "queued"\)[\s\S]{0,120}\.select\("comment_id"\)/);
});

test("item 11 — no token material is written into a queue row", () => {
  const enqueueBlock = events.slice(events.indexOf("export async function enqueueCommentEvent"), events.indexOf("export async function processQueuedComment"));
  for (const forbidden of ["access_token", "refresh_token", "client_secret", "Access-Token"]) {
    assert.ok(!enqueueBlock.includes(forbidden), `queue row may contain ${forbidden}`);
  }
});

test("item 12 — webhook and poll converge on one processing step", () => {
  assert.match(engine, /export async function processClaimedComment/);
  assert.match(events, /processClaimedComment/);
  // the reconciliation path calls the same function rather than duplicating the logic
  const reconcile = engine.slice(engine.indexOf("async function reconcileAccount"));
  assert.match(reconcile, /processClaimedComment\(/);
});

test("Meta's deferred drain cannot see TikTok queue rows", () => {
  assert.match(read("src/services/botEngine.ts"), /\.eq\("public_status", "deferred"\)/);
  assert.match(events, /public_status: "queued"/);
  assert.match(queueSql, /drainDeferred\(\) selects strictly/);
});
