// TikTok API for Business — account connect + organic comment management.
//
// Two important differences from Meta, which shape this whole track:
//  1. There is NO comment webhook. New comments must be POLLED
//     (/api/tiktok/cron/poll) — hence the cursor/dedup logic here.
//  2. Auth is a header (`Access-Token`), not a query param, and the account is
//     identified by `business_id` (the TikTok Business account), not a page id.
//
// The app must be approved for the Business/Comment scopes in the TikTok developer
// portal before any of these calls succeed — the same App Review gate as Meta.

function cleanEnv(v: string | undefined): string {
  return (v ?? "").replace(/^﻿/, "").trim();
}

const BASE       = "https://business-api.tiktok.com/open_api/v1.3";
const AUTH_BASE  = "https://www.tiktok.com/v2/auth/authorize";
const CLIENT_KEY = cleanEnv(process.env.TIKTOK_CLIENT_KEY);
const CLIENT_SEC = cleanEnv(process.env.TIKTOK_CLIENT_SECRET);

// TikTok returns HTTP 200 with a non-zero `code` on failure — always check the body.
async function tt<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST",
  token: string,
  payload?: Record<string, unknown>
): Promise<T> {
  const isGet = method === "GET";
  const qs = isGet && payload
    ? "?" + new URLSearchParams(
        Object.entries(payload).map(([k, v]) => [
          k, typeof v === "object" ? JSON.stringify(v) : String(v),
        ])
      )
    : "";

  const res = await fetch(`${BASE}/${path}${qs}`, {
    method,
    headers: { "Content-Type": "application/json", "Access-Token": token },
    body: !isGet && payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message || `TikTok API error (code ${data.code})`);
  return (data.data ?? {}) as T;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function buildTikTokOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_key:    CLIENT_KEY,
    response_type: "code",
    redirect_uri:  redirectUri,
    state,
    // Organic account + comment management. Must match the scopes approved for the app.
    scope: "user.info.basic,video.list,comment.list,comment.list.manage",
  });
  return `${AUTH_BASE}/?${params}`;
}

export interface TikTokAuth {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  openId:       string;
}

export async function exchangeTikTokCode(code: string, redirectUri: string): Promise<TikTokAuth> {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/token/", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     CLIENT_KEY,
      client_secret: CLIENT_SEC,
      grant_type:    "authorization_code",
      auth_code:     code,
      redirect_uri:  redirectUri,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message || "TikTok OAuth failed");
  const d = data.data || {};
  return {
    accessToken:  d.access_token,
    refreshToken: d.refresh_token,
    expiresIn:    d.expires_in,
    openId:       d.open_id,
  };
}

// Access tokens are short-lived — refresh before polling when close to expiry.
export async function refreshTikTokToken(refreshToken: string): Promise<TikTokAuth> {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/refresh_token/", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     CLIENT_KEY,
      client_secret: CLIENT_SEC,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message || "TikTok token refresh failed");
  const d = data.data || {};
  return {
    accessToken:  d.access_token,
    refreshToken: d.refresh_token ?? refreshToken,
    expiresIn:    d.expires_in,
    openId:       d.open_id,
  };
}

// ── Account ───────────────────────────────────────────────────────────────────

export interface TikTokAccount {
  businessId:  string;
  username:    string;
  displayName: string;
  avatarUrl?:  string;
}

export async function getTikTokAccount(token: string, businessId: string): Promise<TikTokAccount> {
  const data = await tt<{ username?: string; display_name?: string; profile_image?: string }>(
    "business/get/", "GET", token,
    { business_id: businessId, fields: ["username", "display_name", "profile_image"] }
  );
  return {
    businessId,
    username:    data.username ?? "",
    displayName: data.display_name ?? data.username ?? "",
    avatarUrl:   data.profile_image,
  };
}

// ── Videos & comments (organic) ───────────────────────────────────────────────

export interface TikTokVideo { id: string; caption: string; createTime: number; }

export async function getTikTokVideos(token: string, businessId: string, limit = 10): Promise<TikTokVideo[]> {
  const data = await tt<{ videos?: Array<{ item_id: string; caption?: string; create_time?: number }> }>(
    "business/video/list/", "GET", token,
    { business_id: businessId, fields: ["item_id", "caption", "create_time"], max_count: limit }
  );
  return (data.videos || []).map((v) => ({
    id:         v.item_id,
    caption:    v.caption ?? "",
    createTime: v.create_time ?? 0,
  }));
}

export interface TikTokComment {
  id:          string;
  videoId:     string;
  text:        string;
  username:    string;
  createTime:  number;
  replied:     boolean;
}

// Lists comments on one video. Polled on a schedule — TikTok has no comment webhook.
export async function getTikTokComments(
  token: string, businessId: string, videoId: string, limit = 30
): Promise<TikTokComment[]> {
  const data = await tt<{ comments?: Array<{
    comment_id: string; text?: string; username?: string; create_time?: number; owner_replied?: boolean;
  }> }>(
    "business/comment/list/", "GET", token,
    { business_id: businessId, video_id: videoId, max_count: limit }
  );
  return (data.comments || []).map((c) => ({
    id:         c.comment_id,
    videoId,
    text:       c.text ?? "",
    username:   c.username ?? "",
    createTime: c.create_time ?? 0,
    replied:    !!c.owner_replied,
  }));
}

// Posts a public reply under a comment (the TikTok equivalent of replyToComment).
// TikTok has no private-reply/DM API for organic comments, so the bot answers
// publicly there — the reply text itself carries the price/details.
export async function replyToTikTokComment(
  token: string, businessId: string, videoId: string, commentId: string, text: string
): Promise<void> {
  await tt("business/comment/reply/create/", "POST", token, {
    business_id: businessId,
    video_id:    videoId,
    comment_id:  commentId,
    text,
  });
}

export async function hideTikTokComment(
  token: string, businessId: string, commentId: string, hidden = true
): Promise<void> {
  await tt("business/comment/status/update/", "POST", token, {
    business_id: businessId,
    comment_ids: [commentId],
    action:      hidden ? "HIDE" : "UNHIDE",
  });
}
