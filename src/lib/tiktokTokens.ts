import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptSecret, decryptSecret, encryptionConfigured } from "@/lib/tokenCrypto";
import { refreshAccessToken, revokeAccessToken, TikTokError } from "@/services/tiktok";

/**
 * TikTok credential store — SERVER ONLY.
 *
 * This is the credential + concurrency layer for the TikTok Accounts API. Tokens live here
 * and nowhere else: bot_page_tokens and connected_pages are the Meta store and must not be
 * used for TikTok.
 *
 * Invariants:
 *   * tokens are written to `tiktok_tokens` as AES-256-GCM ciphertext, never plaintext;
 *   * a decrypted token is only ever returned to other SERVER code — no route may put a
 *     value from here into a JSON response;
 *   * `tiktok_tokens` has RLS on with zero policies, so even a leaked anon key cannot
 *     read it;
 *   * exactly one refresher at a time per account (see claimRefreshLock).
 */

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("tiktokTokens is server-only and must never run in the browser");
  }
}

export interface TikTokAccountRow {
  id: string;
  user_id: string;
  /** open_id from the token response. business_id (DB-generated) is always the same value. */
  tiktok_account_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  granted_scopes: string[];
  connected_at: string;
  revoked_at: string | null;
}

/** Safe account metadata for the UI. Contains no credentials by construction. */
export async function listTikTokAccounts(userId: string): Promise<TikTokAccountRow[]> {
  assertServer();
  const { data } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, user_id, tiktok_account_id, username, display_name, avatar_url, granted_scopes, connected_at, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("connected_at", { ascending: true });
  return (data as TikTokAccountRow[] | null) ?? [];
}

export interface StoreTokensInput {
  accountId: string;
  accessToken: string;
  refreshToken?: string | null;
  accessExpiresAt?: Date | null;
  refreshExpiresAt?: Date | null;
}

/**
 * Upserts the credential row for an account (one row per account).
 * Throws when TOKEN_ENCRYPTION_KEY is absent — we never downgrade to plaintext storage.
 */
export async function storeTikTokTokens(input: StoreTokensInput): Promise<void> {
  assertServer();
  if (!encryptionConfigured()) {
    throw new Error("token_encryption_unconfigured");
  }

  const { error } = await supabaseAdmin.from("tiktok_tokens").upsert(
    {
      account_id: input.accountId,
      access_token: encryptSecret(input.accessToken),
      refresh_token: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      access_expires_at: input.accessExpiresAt?.toISOString() ?? null,
      refresh_expires_at: input.refreshExpiresAt?.toISOString() ?? null,
      status: "active",
      last_refreshed_at: new Date().toISOString(),
      refresh_lock_at: null,
    },
    { onConflict: "account_id" },
  );
  // The error message from PostgREST can echo row values — log a fixed string instead.
  if (error) throw new Error("tiktok_token_store_failed");
}

export interface DecryptedTokens {
  accessToken: string | null;
  refreshToken: string | null;
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
  status: string;
}

/**
 * Reads and decrypts an account's credentials.
 * SERVER ONLY — the result must never be serialized into an API response.
 */
export async function readTikTokTokens(accountId: string): Promise<DecryptedTokens | null> {
  assertServer();
  const { data } = await supabaseAdmin
    .from("tiktok_tokens")
    .select("access_token, refresh_token, access_expires_at, refresh_expires_at, status")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data) return null;

  return {
    accessToken: decryptSecret(data.access_token),
    refreshToken: decryptSecret(data.refresh_token),
    accessExpiresAt: data.access_expires_at ? new Date(data.access_expires_at) : null,
    refreshExpiresAt: data.refresh_expires_at ? new Date(data.refresh_expires_at) : null,
    status: data.status,
  };
}

/** A token needing refresh within this margin is treated as expiring. */
export const REFRESH_MARGIN_MS = 5 * 60_000;
/** A lock older than this is considered abandoned (crashed refresher) and reclaimable. */
export const REFRESH_LOCK_TTL_MS = 60_000;

/**
 * Tries to become the single refresher for an account.
 *
 * One atomic UPDATE stamps refresh_lock_at, filtered to rows whose lock is null or stale.
 * Postgres serializes the row write, so concurrent callers cannot both get a row back —
 * the loser sees zero rows and must wait for the winner instead of refreshing in parallel
 * (a parallel refresh can invalidate the winner's fresh token).
 */
export async function claimRefreshLock(accountId: string): Promise<boolean> {
  assertServer();
  const staleBefore = new Date(Date.now() - REFRESH_LOCK_TTL_MS).toISOString();

  const { data } = await supabaseAdmin
    .from("tiktok_tokens")
    .update({ refresh_lock_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .or(`refresh_lock_at.is.null,refresh_lock_at.lt.${staleBefore}`)
    .select("id");

  return !!data && data.length > 0;
}

export async function releaseRefreshLock(accountId: string): Promise<void> {
  assertServer();
  await supabaseAdmin.from("tiktok_tokens").update({ refresh_lock_at: null }).eq("account_id", accountId);
}

export async function markTokenStatus(accountId: string, status: "active" | "expired" | "revoked" | "error"): Promise<void> {
  assertServer();
  await supabaseAdmin.from("tiktok_tokens").update({ status }).eq("account_id", accountId);
}

/**
 * Returns a usable access token for server-side TikTok calls, refreshing under the lock when
 * it is close to expiry.
 *
 * Access tokens live 1 day and refresh tokens 1 year (both documented), so the refresh path
 * runs constantly in production — the lock is what stops two concurrent serverless
 * invocations from refreshing the same account and invalidating each other's token.
 *
 * SERVER ONLY. The returned value must never be serialized into an API response.
 */
export async function getValidAccessToken(accountId: string): Promise<string | null> {
  assertServer();
  const tokens = await readTikTokTokens(accountId);
  if (!tokens || tokens.status !== "active" || !tokens.accessToken) return null;

  const expiring =
    !!tokens.accessExpiresAt && tokens.accessExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;
  if (!expiring) return tokens.accessToken;
  if (!tokens.refreshToken) return tokens.accessToken; // nothing to refresh with

  // Refresh token itself expired → only re-authorization can recover.
  if (tokens.refreshExpiresAt && tokens.refreshExpiresAt.getTime() <= Date.now()) {
    await markTokenStatus(accountId, "expired");
    return null;
  }

  const gotLock = await claimRefreshLock(accountId);
  if (!gotLock) {
    // Another invocation is refreshing right now — use the current token rather than racing
    // it. The caller retries on a 401 from the API.
    return tokens.accessToken;
  }

  try {
    const fresh = await refreshAccessToken(tokens.refreshToken);
    await storeTikTokTokens({
      accountId,
      accessToken: fresh.accessToken,
      // TikTok returns a new refresh token on renewal; keep the old one if it ever omits it.
      refreshToken: fresh.refreshToken || tokens.refreshToken,
      accessExpiresAt: new Date(Date.now() + fresh.expiresIn * 1000),
      refreshExpiresAt: fresh.refreshExpiresIn
        ? new Date(Date.now() + fresh.refreshExpiresIn * 1000)
        : tokens.refreshExpiresAt,
    });
    return fresh.accessToken;
  } catch (err) {
    // A rejected refresh token means the user revoked us or it expired: require re-auth
    // instead of hammering TikTok on every poll.
    if (err instanceof TikTokError && err.kind === "api_error") {
      await markTokenStatus(accountId, "expired");
      console.error(err.toLogLine(accountId));
      return null;
    }
    // Network/transport problem — keep the current token and try again next time.
    if (err instanceof TikTokError) console.error(err.toLogLine(accountId));
    return tokens.accessToken;
  } finally {
    await releaseRefreshLock(accountId);
  }
}

export type DisconnectResult = {
  ok: boolean;
  /** True once the official remote revoke is wired up and succeeds. */
  remoteRevoked: boolean;
};

/**
 * Disconnects a TikTok account: local credentials are destroyed and the account is
 * marked revoked. Ownership is enforced by the caller passing the session user id.
 *
 * ⚠️ PHASE 2 — the remote call to TikTok's official authorization-revoke endpoint is not
 * made yet (no app, no credentials). Local teardown happens regardless, so no credential
 * survives a disconnect even before the remote step exists. `remoteRevoked` reports
 * honestly which half ran.
 */
export async function disconnectTikTokAccount(accountId: string, userId: string): Promise<DisconnectResult> {
  assertServer();

  const { data: account } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!account) return { ok: false, remoteRevoked: false };

  // Revoke at TikTok first, but never let a remote failure stop the local teardown:
  // a credential we cannot revoke remotely must still be destroyed locally.
  let remoteRevoked = false;
  try {
    const tokens = await readTikTokTokens(accountId);
    if (tokens?.accessToken) {
      await revokeAccessToken(tokens.accessToken);
      remoteRevoked = true;
    }
  } catch (err) {
    if (err instanceof TikTokError) console.error(err.toLogLine(accountId));
  }

  // Destroy the local credentials first — if the status write below failed, we would
  // rather have an orphaned account row than a live token.
  await supabaseAdmin
    .from("tiktok_tokens")
    .update({ access_token: null, refresh_token: null, status: "revoked", refresh_lock_at: null })
    .eq("account_id", accountId);

  await supabaseAdmin
    .from("tiktok_accounts")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", userId);

  return { ok: true, remoteRevoked };
}

// ── Account records ───────────────────────────────────────────────────────────

export interface UpsertAccountInput {
  userId: string;
  /** open_id from /tt_user/oauth2/token/. business_id is generated from it in the database. */
  openId: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  /** Comma-separated scope string exactly as TikTok returned it. */
  scope?: string | null;
}

/** Splits TikTok's comma-separated scope string into the text[] column. */
export function parseScopes(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return scope.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Creates or refreshes the account row for (user, open_id) and returns its id.
 * Re-connecting an account that was disconnected clears revoked_at.
 */
export async function upsertTikTokAccount(input: UpsertAccountInput): Promise<string> {
  assertServer();
  const { data, error } = await supabaseAdmin
    .from("tiktok_accounts")
    .upsert(
      {
        user_id: input.userId,
        tiktok_account_id: input.openId,
        username: input.username ?? null,
        display_name: input.displayName ?? null,
        avatar_url: input.avatarUrl ?? null,
        granted_scopes: parseScopes(input.scope),
        revoked_at: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tiktok_account_id" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error("tiktok_account_upsert_failed");
  return data.id as string;
}

/** Resolves the account a webhook delivery belongs to, from its user_openid. */
export async function findAccountByOpenId(openId: string): Promise<TikTokAccountRow | null> {
  assertServer();
  const { data } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, user_id, tiktok_account_id, username, display_name, avatar_url, granted_scopes, connected_at, revoked_at")
    .eq("tiktok_account_id", openId)
    .is("revoked_at", null)
    .maybeSingle();
  return (data as TikTokAccountRow | null) ?? null;
}

/** One account by id, scoped to its owner. */
export async function getTikTokAccount(accountId: string, userId: string): Promise<TikTokAccountRow | null> {
  assertServer();
  const { data } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, user_id, tiktok_account_id, username, display_name, avatar_url, granted_scopes, connected_at, revoked_at")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as TikTokAccountRow | null) ?? null;
}

/** Credential health for the UI — status and expiry only, never the token itself. */
export async function tokenStatusFor(accountId: string): Promise<{ status: string; accessExpiresAt: string | null } | null> {
  assertServer();
  const { data } = await supabaseAdmin
    .from("tiktok_tokens")
    .select("status, access_expires_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data) return null;
  return { status: data.status as string, accessExpiresAt: (data.access_expires_at as string | null) ?? null };
}
