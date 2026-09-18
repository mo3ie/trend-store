import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Small database-backed fixed-window rate limiter (no new npm dependency).
 *
 * Hits are INSERTed and counted, rather than incrementing a counter row, so parallel
 * serverless invocations cannot lose increments. Backed by `security_rate_limits`
 * (service-role only — see supabase/security-rate-limits.sql).
 *
 * Deliberately FAILS OPEN on infrastructure errors: a limiter outage must not lock users
 * out of connecting their account. Auth checks are never delegated to this module.
 */

export interface RateLimitRule {
  /** Logical route name, e.g. "tiktok_oauth_start". */
  bucket: string;
  /** Max requests allowed per identifier inside the window. */
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Best-effort client IP for anonymous callers (Vercel sets x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

/** Identifier preference: the signed-in user, else the caller IP. */
export function identifierFor(req: NextRequest, userId?: string | null): string {
  return userId ? `user:${userId}` : `ip:${clientIp(req)}`;
}

export async function checkRateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - rule.windowSec * 1000).toISOString();

  try {
    const { count, error } = await supabaseAdmin
      .from("security_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("bucket", rule.bucket)
      .eq("identifier", identifier)
      .gte("created_at", windowStart);

    // Table missing / DB unreachable → fail open (see module note).
    if (error) return { allowed: true, remaining: rule.limit, retryAfterSec: 0 };

    const used = count ?? 0;
    if (used >= rule.limit) {
      return { allowed: false, remaining: 0, retryAfterSec: rule.windowSec };
    }

    await supabaseAdmin.from("security_rate_limits").insert({ bucket: rule.bucket, identifier });

    // Opportunistic cleanup — keeps the table small without a scheduled job.
    if (Math.random() < 0.02) {
      await supabaseAdmin
        .from("security_rate_limits")
        .delete()
        .lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
    }

    return { allowed: true, remaining: rule.limit - used - 1, retryAfterSec: 0 };
  } catch {
    return { allowed: true, remaining: rule.limit, retryAfterSec: 0 };
  }
}

/** Standard 429 JSON response (bilingual message, matching the other API routes). */
export function rateLimitedJson(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "rate_limited", message: "محاولات كثيرة — حاول بعد قليل" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec || 60) } },
  );
}

/**
 * Application-wide TikTok budget.
 *
 * TikTok enforces TWO limits: 40 QPM per authorized account per endpoint, AND a ceiling for
 * all Accounts API endpoints combined **per developer app** (600 QPM on the Basic tier).
 * The app-wide ceiling is shared by every customer, so a per-account throttle alone cannot
 * protect it — this limiter is deliberately independent of any customer account.
 *
 * Set conservatively below the documented Basic ceiling to leave headroom for bursts.
 */
export const TIKTOK_APP_QPM = Number(process.env.TIKTOK_APP_QPM || 400);

/** Per authorized account, per endpoint (documented limit is 40 QPM). */
export const TIKTOK_ACCOUNT_QPM = Number(process.env.TIKTOK_ACCOUNT_QPM || 30);

/**
 * App-wide check — ONE shared bucket for every TikTok Accounts call the app makes.
 * TikTok's app ceiling covers all Accounts endpoints combined, so the bucket is deliberately
 * not split per endpoint or per customer. `endpoint` is accepted for call-site clarity only.
 */
export async function checkAppRateLimit(endpoint: string): Promise<RateLimitResult> {
  void endpoint; // accepted for call-site clarity; the bucket is intentionally global
  return checkRateLimit({ bucket: "tiktok_app", limit: TIKTOK_APP_QPM, windowSec: 60 }, "app:all");
}

/** Per-account, per-endpoint check mirroring TikTok's 40 QPM rule. */
export async function checkAccountRateLimit(accountId: string, endpoint: string): Promise<RateLimitResult> {
  return checkRateLimit(
    { bucket: `tiktok_acct:${endpoint}`, limit: TIKTOK_ACCOUNT_QPM, windowSec: 60 },
    `acct:${accountId}`,
  );
}

/** Rules for the TikTok surface. Tight on OAuth, looser on ordinary config reads/writes. */
export const RATE_RULES = {
  tiktokOauthStart: { bucket: "tiktok_oauth_start", limit: 10, windowSec: 600 },
  tiktokOauthCallback: { bucket: "tiktok_oauth_callback", limit: 20, windowSec: 600 },
  tiktokConfigWrite: { bucket: "tiktok_config_write", limit: 60, windowSec: 600 },
} as const satisfies Record<string, RateLimitRule>;
