// TikTok API for Business v1.3 — Organic Accounts API client.
//
// Every endpoint, parameter and response field below was verified against the official
// TikTok API for Business v1.3 documentation on 2026-09-16.
// Full field-level spec: docs/TIKTOK_PHASE2.1_API_SPEC.md
//
// Shape of this API:
//  * Base is https://business-api.tiktok.com/open_api/v1.3
//  * Auth is the `Access-Token` HEADER (not a query param, not a Bearer prefix).
//  * Failure is signalled by a NON-ZERO `code` inside an HTTP 200 body — always check it.
//  * `business_id` is the account identifier and is ALWAYS the `open_id` returned by
//    /tt_user/oauth2/token/. There is no other account-id mapping.
//  * The TikTok media id is `item_id` on /business/video/list/ but `video_id` on every
//    comment endpoint. normalizeVideoId() below is the single place that bridges them.
//
// SERVER ONLY. Nothing here may be imported by a client component: it reads the app secret.

import { createHash } from "node:crypto";

const BASE = "https://business-api.tiktok.com/open_api/v1.3";

function cleanEnv(v: string | undefined): string {
  // Strips a UTF-8 BOM that copy-paste from the developer portal can leave behind.
  return (v ?? "").replace(/^﻿/, "").trim();
}

export function tiktokClientId(): string { return cleanEnv(process.env.TIKTOK_CLIENT_ID); }
export function tiktokClientSecret(): string { return cleanEnv(process.env.TIKTOK_CLIENT_SECRET); }

/**
 * The TikTok account holder authorization URL is ISSUED BY THE DEVELOPER PORTAL
 * (My Apps > App Detail > Basic Information). It is never constructed by us: there is no
 * client_key and no scope parameter to append — scopes come from the app's permission set.
 * We only append our opaque `state`.
 */
export function tiktokAuthorizeBaseUrl(): string { return cleanEnv(process.env.TIKTOK_AUTH_URL); }

export function tiktokConfigured(): boolean {
  return !!tiktokClientId() && !!tiktokClientSecret() && !!tiktokAuthorizeBaseUrl();
}

/** Appends our opaque state to the portal-issued authorization URL. Nothing else is added. */
export function buildTikTokAuthorizeUrl(state: string): string {
  const base = tiktokAuthorizeBaseUrl();
  if (!base) throw new TikTokError("tiktok_not_configured", "TIKTOK_AUTH_URL is not set");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}state=${encodeURIComponent(state)}`;
}

// ── Errors & transport ────────────────────────────────────────────────────────

/**
 * A TikTok failure, carrying only what is safe to log: endpoint, HTTP status, TikTok code
 * and request_id. Never the token, the auth code or the secret.
 */
export class TikTokError extends Error {
  constructor(
    public readonly kind: string,
    message: string,
    public readonly endpoint?: string,
    public readonly httpStatus?: number,
    public readonly ttCode?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "TikTokError";
  }
  /** Safe one-line server log. Contains no secret material by construction. */
  toLogLine(accountId?: string): string {
    return [
      `tiktok_error kind=${this.kind}`,
      this.endpoint ? `endpoint=${this.endpoint}` : "",
      this.httpStatus ? `http=${this.httpStatus}` : "",
      this.ttCode !== undefined ? `tt_code=${this.ttCode}` : "",
      this.requestId ? `request_id=${this.requestId}` : "",
      accountId ? `account=${accountId}` : "",
    ].filter(Boolean).join(" ");
  }
}

interface Envelope<T> { code: number; message?: string; request_id?: string; data?: T; }

async function call<T>(
  path: string,
  method: "GET" | "POST",
  opts: { token?: string; query?: Record<string, unknown>; body?: Record<string, unknown> },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Access-Token"] = opts.token;

  let url = `${BASE}/${path}`;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      // Array params (`fields`, `comment_ids`) go as a JSON array string — per the docs' examples.
      qs.set(k, Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === "POST" && opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new TikTokError("network_error", "TikTok request failed", path);
  }

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new TikTokError("bad_response", "TikTok returned a non-JSON response", path, res.status);
  }

  if (json.code !== 0) {
    throw new TikTokError(
      "api_error",
      json.message || `TikTok API error (code ${json.code})`,
      path, res.status, json.code, json.request_id,
    );
  }
  return (json.data ?? ({} as T));
}

// ── OAuth / tokens ────────────────────────────────────────────────────────────

export interface TikTokTokenSet {
  accessToken: string;
  refreshToken: string;
  /** Seconds. Documented as 86400 (1 day). */
  expiresIn: number;
  /** Seconds. Documented as 31536000 (1 year). */
  refreshExpiresIn: number;
  /** Account identifier — this value IS the business_id for every organic endpoint. */
  openId: string;
  /** Comma-separated scope list granted to this token. */
  scope: string;
  tokenType: string;
}

interface RawTokenData {
  access_token: string; refresh_token: string; expires_in: number;
  refresh_token_expires_in: number; open_id: string; scope?: string; token_type?: string;
}

function toTokenSet(d: RawTokenData): TikTokTokenSet {
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresIn: Number(d.expires_in ?? 0),
    refreshExpiresIn: Number(d.refresh_token_expires_in ?? 0),
    openId: String(d.open_id ?? ""),
    scope: d.scope ?? "",
    tokenType: d.token_type ?? "Bearer",
  };
}

/**
 * POST /tt_user/oauth2/token/ — exchange the single-use auth_code (valid 10 minutes).
 * `redirectUri` must be byte-identical to the URL registered in the developer portal.
 */
export async function exchangeAuthCode(authCode: string, redirectUri: string): Promise<TikTokTokenSet> {
  const data = await call<RawTokenData>("tt_user/oauth2/token/", "POST", {
    body: {
      client_id: tiktokClientId(),
      client_secret: tiktokClientSecret(),
      grant_type: "authorization_code",
      auth_code: authCode,
      redirect_uri: redirectUri,
    },
  });
  return toTokenSet(data);
}

/** POST /tt_user/oauth2/refresh_token/ — renew a 1-day access token with the 1-year refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<TikTokTokenSet> {
  const data = await call<RawTokenData>("tt_user/oauth2/refresh_token/", "POST", {
    body: {
      client_id: tiktokClientId(),
      client_secret: tiktokClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
  });
  return toTokenSet(data);
}

/** POST /tt_user/oauth2/revoke/ — revoke an access token at TikTok (used on disconnect). */
export async function revokeAccessToken(accessToken: string): Promise<void> {
  await call<Record<string, never>>("tt_user/oauth2/revoke/", "POST", {
    body: {
      client_id: tiktokClientId(),
      client_secret: tiktokClientSecret(),
      access_token: accessToken,
    },
  });
}

/**
 * POST /tt_user/token_info/get/ — introspect a token's granted scopes.
 * Note the parameter is `app_id` here while the oauth2 endpoints call the same value
 * `client_id`; that inconsistency is in the official documentation.
 */
export async function getTokenInfo(accessToken: string): Promise<{ scope: string; openId?: string }> {
  const data = await call<{ scope?: string; open_id?: string }>("tt_user/token_info/get/", "POST", {
    body: { app_id: tiktokClientId(), access_token: accessToken },
  });
  return { scope: data.scope ?? "", openId: data.open_id };
}

// ── Identifiers ───────────────────────────────────────────────────────────────

/**
 * The ONLY account-id rule in this integration: business_id === open_id.
 * Documented on every organic endpoint as "Pass the value of the open_id field returned in
 * the response of /tt_user/oauth2/token/".
 */
export function businessIdFromOpenId(openId: string): string { return openId; }

/**
 * /business/video/list/ returns `item_id`; every comment endpoint takes `video_id`.
 * They are the same post — this is the one place that bridges the two names, and everything
 * downstream is a string (TikTok ids exceed Number.MAX_SAFE_INTEGER).
 */
export function normalizeVideoId(itemId: string | number): string { return String(itemId); }

/** Webhook payloads type ids as numbers; the REST API types them as strings. Always store strings. */
export function normalizeId(id: string | number | null | undefined): string | null {
  if (id === null || id === undefined || id === "") return null;
  return String(id);
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface TikTokProfile {
  businessId: string;
  username: string;
  displayName: string;
  profileImage?: string;
}

/**
 * GET /business/get/ — profile fields only. Analytics fields are deliberately not requested:
 * each response field is scope-gated and we only need identity for the UI.
 * Permission: Get Business User Basic Info (scope `user.info.basic`).
 */
export async function getProfile(token: string, businessId: string): Promise<TikTokProfile> {
  const data = await call<{ username?: string; display_name?: string; profile_image?: string }>(
    "business/get/", "GET",
    { token, query: { business_id: businessId, fields: ["username", "display_name", "profile_image"] } },
  );
  return {
    businessId,
    username: data.username ?? "",
    displayName: data.display_name ?? data.username ?? "",
    profileImage: data.profile_image,
  };
}

// ── Videos ────────────────────────────────────────────────────────────────────

export interface TikTokVideo {
  /** Already normalized: use this as `video_id` on the comment endpoints. */
  videoId: string;
  caption: string;
  createTime: number;
  thumbnailUrl?: string;
}

export interface Page<T> { items: T[]; cursor?: number; hasMore: boolean; }

/** Max page size accepted by the comment endpoints (documented). */
export const MAX_PAGE_SIZE = 30;

/**
 * GET /business/video/list/ — owned posts. `fields` must include "item_id" when requesting
 * more than the default. Permission: Business Media (scope `video.list`).
 * No filter fields are sent: their schema is not verified, and guessing is not allowed.
 */
export async function listVideos(
  token: string, businessId: string, opts: { cursor?: number; maxCount?: number } = {},
): Promise<Page<TikTokVideo>> {
  const data = await call<{
    videos?: Array<{ item_id: string | number; caption?: string; create_time?: number; thumbnail_url?: string }>;
    cursor?: number; has_more?: boolean;
  }>("business/video/list/", "GET", {
    token,
    query: {
      business_id: businessId,
      fields: ["item_id", "caption", "create_time", "thumbnail_url"],
      cursor: opts.cursor,
      max_count: opts.maxCount ? Math.min(opts.maxCount, MAX_PAGE_SIZE) : undefined,
    },
  });
  return {
    items: (data.videos || []).map((v) => ({
      videoId: normalizeVideoId(v.item_id),
      caption: v.caption ?? "",
      createTime: Number(v.create_time ?? 0),
      thumbnailUrl: v.thumbnail_url,
    })),
    cursor: data.cursor,
    hasMore: !!data.has_more,
  };
}

// ── Organic comments ──────────────────────────────────────────────────────────

export interface TikTokComment {
  commentId: string;
  videoId: string;
  parentCommentId: string | null;
  text: string;
  createTime: number;
  likes: number;
  replies: number;
  /** True when the video owner wrote this comment — used to skip our own replies. */
  owner: boolean;
  liked: boolean;
  pinned: boolean;
  status: string;
  username: string;
  displayName: string;
  profileImage?: string;
  /** Stable cross-API identity of the commenter. Prefer this over the deprecated user_id. */
  uniqueIdentifier: string | null;
}

interface RawComment {
  comment_id: string | number; video_id?: string | number; parent_comment_id?: string | number;
  text?: string; create_time?: string | number; likes?: number; replies?: number;
  owner?: boolean; liked?: boolean; pinned?: boolean; status?: string;
  username?: string; display_name?: string; profile_image?: string; unique_identifier?: string;
}

function toComment(c: RawComment, fallbackVideoId: string): TikTokComment {
  return {
    commentId: String(c.comment_id),
    videoId: normalizeId(c.video_id) ?? fallbackVideoId,
    parentCommentId: normalizeId(c.parent_comment_id),
    text: c.text ?? "",
    createTime: Number(c.create_time ?? 0),
    likes: Number(c.likes ?? 0),
    replies: Number(c.replies ?? 0),
    owner: !!c.owner,
    liked: !!c.liked,
    pinned: !!c.pinned,
    status: c.status ?? "",
    username: c.username ?? "",
    displayName: c.display_name ?? "",
    profileImage: c.profile_image,
    uniqueIdentifier: c.unique_identifier ?? null,
  };
}

export interface ListCommentsOptions {
  cursor?: number;
  maxCount?: number;
  commentIds?: string[];
  includeReplies?: boolean;
  status?: "PUBLIC" | "ALL";
  sortField?: "likes" | "replies" | "create_time";
  sortOrder?: "asc" | "desc";
}

/**
 * GET /business/comment/list/ — comments (and optionally replies) on ONE owned video.
 * Returns both public and hidden comments. Permission: Get Business Comment (`comment.list`).
 */
export async function listComments(
  token: string, businessId: string, videoId: string, opts: ListCommentsOptions = {},
): Promise<Page<TikTokComment>> {
  const data = await call<{ comments?: RawComment[]; cursor?: number; has_more?: boolean }>(
    "business/comment/list/", "GET", {
      token,
      query: {
        business_id: businessId,
        video_id: videoId,
        comment_ids: opts.commentIds?.length ? opts.commentIds.slice(0, 30) : undefined,
        include_replies: opts.includeReplies,
        status: opts.status,
        sort_field: opts.sortField,
        sort_order: opts.sortOrder,
        cursor: opts.cursor,
        max_count: Math.min(opts.maxCount ?? 20, MAX_PAGE_SIZE),
      },
    });
  return {
    items: (data.comments || []).map((c) => toComment(c, videoId)),
    cursor: data.cursor,
    hasMore: !!data.has_more,
  };
}

/** GET /business/comment/reply/list/ — replies under one comment. Permission: `comment.list`. */
export async function listCommentReplies(
  token: string, businessId: string, videoId: string, commentId: string,
  opts: { cursor?: number; maxCount?: number; status?: "PUBLIC" | "ALL" } = {},
): Promise<Page<TikTokComment>> {
  const data = await call<{ comments?: RawComment[]; cursor?: number; has_more?: boolean }>(
    "business/comment/reply/list/", "GET", {
      token,
      query: {
        business_id: businessId,
        video_id: videoId,
        comment_id: commentId,
        status: opts.status,
        cursor: opts.cursor,
        max_count: Math.min(opts.maxCount ?? 20, MAX_PAGE_SIZE),
      },
    });
  return {
    items: (data.comments || []).map((c) => toComment(c, videoId)),
    cursor: data.cursor,
    hasMore: !!data.has_more,
  };
}

/**
 * POST /business/comment/reply/create/ — THE bot reply operation.
 * Permission: Manage Business Comment (`comment.list.manage`).
 */
export async function replyToComment(
  token: string, businessId: string, videoId: string, commentId: string, text: string,
): Promise<{ commentId: string | null }> {
  const data = await call<{ comment_id?: string | number }>(
    "business/comment/reply/create/", "POST", {
      token,
      body: { business_id: businessId, video_id: videoId, comment_id: commentId, text },
    });
  return { commentId: normalizeId(data.comment_id) };
}

/** POST /business/comment/create/ — a new top-level comment on an owned video. */
export async function createComment(
  token: string, businessId: string, videoId: string, text: string,
): Promise<{ commentId: string | null }> {
  const data = await call<{ comment_id?: string | number }>(
    "business/comment/create/", "POST", {
      token, body: { business_id: businessId, video_id: videoId, text },
    });
  return { commentId: normalizeId(data.comment_id) };
}

/**
 * POST /business/comment/like/ — uses an `action` field, not a status field.
 * The unlike action is not documented; the signature accepts it so it can be enabled the day
 * TikTok documents it, without changing any caller.
 */
export async function likeComment(
  token: string, businessId: string, commentId: string, action: "like" | "unlike" = "like",
): Promise<void> {
  await call<Record<string, never>>("business/comment/like/", "POST", {
    token, body: { business_id: businessId, comment_id: commentId, action },
  });
}

/**
 * POST /business/comment/hide/ — note this one ALSO needs video_id (like/delete do not).
 * Replaces the old, incorrect /business/comment/status/update/ call.
 */
export async function hideComment(
  token: string, businessId: string, videoId: string, commentId: string, hidden = true,
): Promise<void> {
  await call<Record<string, never>>("business/comment/hide/", "POST", {
    token,
    body: { business_id: businessId, comment_id: commentId, video_id: videoId, action: hidden ? "HIDE" : "UNHIDE" },
  });
}

/** POST /business/comment/delete/ — owned comments only (comments this account created). */
export async function deleteComment(token: string, businessId: string, commentId: string): Promise<void> {
  await call<Record<string, never>>("business/comment/delete/", "POST", {
    token, body: { business_id: businessId, comment_id: commentId },
  });
}

// ── Webhook configuration (APP-LEVEL — one config for the whole developer app) ─

export type WebhookEventType = "COMMENT" | "VIDEO";

export interface WebhookConfig { appId: string; callbackUrl: string; eventType: string; }

/**
 * POST /business/webhook/update/ — create or update the app's webhook configuration.
 * This is app-level: ONE configuration serves every connected customer account.
 * `item_list` may restrict events to specific posts; we subscribe to all posts.
 */
export async function updateWebhookConfig(
  eventType: WebhookEventType, callbackUrl: string, itemList?: string[],
): Promise<WebhookConfig> {
  const data = await call<{ app_id?: string; callback_url?: string; event_type?: string }>(
    "business/webhook/update/", "POST", {
      body: {
        app_id: tiktokClientId(),
        secret: tiktokClientSecret(),
        event_type: eventType,
        callback_url: callbackUrl,
        ...(itemList?.length ? { item_list: itemList } : {}),
      },
    });
  return {
    appId: data.app_id ?? tiktokClientId(),
    callbackUrl: data.callback_url ?? callbackUrl,
    eventType: data.event_type ?? eventType,
  };
}

/** GET /business/webhook/list/ — the app's current webhook configurations. */
export async function listWebhookConfigs(): Promise<WebhookConfig[]> {
  const data = await call<{ list?: Array<{ app_id?: string; callback_url?: string; event_type?: string }> }>(
    "business/webhook/list/", "GET",
    { query: { app_id: tiktokClientId(), secret: tiktokClientSecret() } },
  );
  return (data.list || []).map((w) => ({
    appId: w.app_id ?? tiktokClientId(),
    callbackUrl: w.callback_url ?? "",
    eventType: w.event_type ?? "",
  }));
}

/** POST /business/webhook/delete/ — remove a webhook configuration. */
export async function deleteWebhookConfig(eventType: WebhookEventType): Promise<void> {
  await call<Record<string, never>>("business/webhook/delete/", "POST", {
    body: { app_id: tiktokClientId(), secret: tiktokClientSecret(), event_type: eventType },
  });
}

/** Stable, non-reversible fingerprint of a scope string, for logging which scopes changed. */
export function scopeFingerprint(scope: string): string {
  return createHash("sha256").update(scope).digest("hex").slice(0, 12);
}
