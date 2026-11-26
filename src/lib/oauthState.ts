import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomToken, sha256, safeEqualHex } from "@/lib/tokenCrypto";

/**
 * CSRF-safe OAuth state for the TikTok connect flow.
 *
 * The original scheme was `state = base64(user.id)` — guessable, forgeable, reusable and
 * never expiring, so anyone could bind a TikTok account to another user's Trend account.
 *
 * This replaces it with three independent checks, ALL of which must pass in the callback:
 *   1. the `state` query param hashes to a row that is unconsumed and unexpired,
 *   2. the HttpOnly cookie set at start hashes to that same row's binding_hash,
 *   3. the Supabase session user equals the row's user_id.
 *
 * Neither the state nor the binding value is stored — only sha256 of each — so a dump of
 * tiktok_oauth_states cannot be replayed. The state carries no user id in any form.
 */

export const OAUTH_STATE_COOKIE = "tt_oauth_binding";

/**
 * The ADVERTISER flow gets its own cookie, and this is not a tidiness point —
 * sharing one name was a real, reproducible bug.
 *
 * Both flows wrote `tt_oauth_binding`, and every TikTok screen can start the
 * organic one: /tiktok, /tiktok-bot, /tiktok-studio and /tiktok-ads itself all
 * call /api/tiktok/connect. So with the tools open in several tabs — which is
 * exactly how someone sets this up — any organic link started between pressing
 * "ربط حساب الإعلانات" and returning from TikTok silently overwrote the
 * advertiser's binding.
 *
 * The symptom was perfect: TikTok said "Authorized success", and we sent the
 * operator back to `?ads_error=invalid_state`. The state row was found, claimed
 * and valid; only the cookie belonged to a different state. Twice.
 *
 * The failing callback also cleared the shared cookie, so a first failure
 * sabotaged the retry as well.
 *
 * Two names cannot collide. The organic cookie keeps its name so that any link
 * in flight right now still completes.
 */
export const ADS_OAUTH_STATE_COOKIE = "tt_ads_oauth_binding";
export const OAUTH_STATE_TTL_SEC = 600; // 10 minutes — long enough to consent, short enough to matter
const COOKIE_PATH = "/api/tiktok";

export interface CreatedState {
  /** Opaque value for the `state` query param (32 random bytes, base64url). */
  state: string;
  /** Value for the HttpOnly cookie — must come back on the callback request. */
  binding: string;
  expiresAt: Date;
}

export interface StartStateInput {
  userId: string;
  /** In-app path to return to after the callback. Must be relative. */
  redirectPath?: string;
  scopes?: string[];
  flow?: OAuthFlow;
}

/**
 * Which flow a state belongs to. The organic (account-holder) and advertiser (Marketing API)
 * flows share this hardened state machinery but must never share a state: the callback
 * declares the flow it expects, so an organic state cannot be replayed against the advertiser
 * callback or vice versa.
 */
export type OAuthFlow =
  | "connect" | "reconnect" | "scope_upgrade"
  | "advertiser_connect" | "advertiser_reconnect";

/** Cookie options shared by set + clear, so they always match (or the clear no-ops). */
export function stateCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // must survive TikTok's top-level GET redirect back to us
    path: COOKIE_PATH,
    maxAge,
  };
}

/** Creates and persists a pending OAuth state. Returns the values the route must send. */
export async function createOAuthState(input: StartStateInput): Promise<CreatedState> {
  const state = randomToken(32);
  const binding = randomToken(32);
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_SEC * 1000);

  const redirectPath =
    input.redirectPath && input.redirectPath.startsWith("/") ? input.redirectPath : null;

  const { error } = await supabaseAdmin.from("tiktok_oauth_states").insert({
    state_hash: sha256(state),
    binding_hash: sha256(binding),
    user_id: input.userId,
    provider: "tiktok",
    flow: input.flow ?? "connect",
    redirect_path: redirectPath,
    scopes: input.scopes ?? [],
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`oauth_state_insert_failed: ${error.message}`);

  // Opportunistic sweep of old rows (cheap, keeps the table from growing unbounded).
  if (Math.random() < 0.05) {
    await supabaseAdmin
      .from("tiktok_oauth_states")
      .delete()
      .lt("expires_at", new Date(Date.now() - 86_400_000).toISOString());
  }

  return { state, binding, expiresAt };
}

export type ConsumeFailure =
  | "missing_state"
  | "missing_binding"
  | "unknown_or_used_state"
  | "expired_state"
  | "binding_mismatch"
  | "user_mismatch"
  | "flow_mismatch"
  | "not_signed_in";

export type ConsumeResult =
  | { ok: true; userId: string; redirectPath: string | null; flow: string }
  | { ok: false; reason: ConsumeFailure };

export interface ConsumeInput {
  state: string | null;
  binding: string | null | undefined;
  /** The user resolved from the Supabase server-side session — NOT from the state. */
  sessionUserId: string | null;
  /**
   * The flow this callback serves. When given, a state created for a different flow is
   * rejected — this is what keeps the organic and advertiser callbacks isolated.
   */
  expectedFlows?: readonly OAuthFlow[];
}

/**
 * Validates and single-use-consumes a state.
 *
 * The consume is one atomic UPDATE filtered on `consumed_at is null`, so two concurrent
 * callbacks with the same state cannot both win: the loser gets zero rows back.
 */
export async function consumeOAuthState(input: ConsumeInput): Promise<ConsumeResult> {
  if (!input.state) return { ok: false, reason: "missing_state" };
  if (!input.binding) return { ok: false, reason: "missing_binding" };
  if (!input.sessionUserId) return { ok: false, reason: "not_signed_in" };

  const { data: rows, error } = await supabaseAdmin
    .from("tiktok_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state_hash", sha256(input.state))
    .is("consumed_at", null)
    .select("user_id, binding_hash, redirect_path, flow, expires_at");

  if (error || !rows || rows.length === 0) return { ok: false, reason: "unknown_or_used_state" };
  const row = rows[0];

  // Expiry is checked after the claim so an expired state is also burned, not replayable.
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired_state" };
  if (!safeEqualHex(row.binding_hash, sha256(input.binding))) return { ok: false, reason: "binding_mismatch" };
  if (row.user_id !== input.sessionUserId) return { ok: false, reason: "user_mismatch" };
  if (input.expectedFlows && !input.expectedFlows.includes(row.flow as OAuthFlow)) {
    return { ok: false, reason: "flow_mismatch" };
  }

  return { ok: true, userId: row.user_id, redirectPath: row.redirect_path ?? null, flow: row.flow };
}
