import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { encryptSecret, decryptSecret, encryptionConfigured } from "@/lib/tokenCrypto";
import { revokeAdvertiserToken, TikTokAdsError } from "@/services/tiktokAds";

/**
 * ADVERTISER (Marketing API) credential store — SERVER ONLY.
 *
 * Separate from src/lib/tiktokTokens.ts on purpose: that module models the organic account
 * token (1-day access + 1-year refresh, one open_id, refresh lock). An advertiser grant is a
 * single long-term token with no expiry and no refresh token, covering many advertiser_ids.
 *
 * Invariants:
 *   * the token is written to tiktok_ads_authorizations as AES-256-GCM ciphertext;
 *   * tiktok_ads_authorizations has RLS on with ZERO policies — unreadable by the browser;
 *   * a decrypted token is returned only to other SERVER code and never serialized into a
 *     response;
 *   * ad-account metadata lives in tiktok_ad_accounts, which carries no credentials.
 */

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("tiktokAdsTokens is server-only and must never run in the browser");
  }
}

export interface StoreGrantInput {
  userId: string;
  accessToken: string;
  advertiserIds: string[];
  scope: number[];
}

/**
 * Persists a new advertiser grant, replacing any previous active one for that user.
 *
 * Re-authorizing is normal (a new advertiser, a wider scope), and the old token is superseded
 * rather than kept: the partial unique index allows only one active row per user.
 */
export async function storeAdvertiserGrant(input: StoreGrantInput): Promise<string> {
  assertServer();
  if (!encryptionConfigured()) throw new Error("token_encryption_unconfigured");

  // Retire the previous grant first so the partial unique index cannot reject the insert.
  await supabaseAdmin
    .from("tiktok_ads_authorizations")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), access_token: null })
    .eq("user_id", input.userId)
    .eq("status", "active");

  const { data, error } = await supabaseAdmin
    .from("tiktok_ads_authorizations")
    .insert({
      user_id: input.userId,
      access_token: encryptSecret(input.accessToken),
      scope: input.scope,
      advertiser_ids: input.advertiserIds,
      status: "active",
      connected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // PostgREST error messages can echo row values — never surface them.
  if (error || !data) throw new Error("tiktok_ads_grant_store_failed");
  const authorizationId = data.id as string;

  // Mirror the ad accounts as browser-readable metadata (no credentials).
  if (input.advertiserIds.length) {
    await supabaseAdmin.from("tiktok_ad_accounts").upsert(
      input.advertiserIds.map((advertiserId) => ({
        authorization_id: authorizationId,
        user_id: input.userId,
        advertiser_id: advertiserId,
        status: "active",
      })),
      { onConflict: "user_id,advertiser_id" },
    );
  }

  return authorizationId;
}

export interface AdvertiserGrantRow {
  id: string;
  user_id: string;
  scope: number[];
  advertiser_ids: string[];
  status: string;
  connected_at: string;
  revoked_at: string | null;
}

/** Safe metadata for the UI — the token column is never selected. */
export async function getActiveGrant(userId: string): Promise<AdvertiserGrantRow | null> {
  assertServer();
  const { data } = await supabaseAdmin
    .from("tiktok_ads_authorizations")
    .select("id, user_id, scope, advertiser_ids, status, connected_at, revoked_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as AdvertiserGrantRow | null) ?? null;
}

/**
 * Decrypts the advertiser access token for server-side Marketing API calls.
 * SERVER ONLY — the result must never reach a response body.
 */
export async function readAdvertiserToken(userId: string): Promise<string | null> {
  assertServer();
  const { data } = await supabaseAdmin
    .from("tiktok_ads_authorizations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return decryptSecret(data.access_token);
}

export interface DisconnectResult { ok: boolean; remoteRevoked: boolean }

/**
 * Disconnects the advertiser authorization: revokes at TikTok, then destroys the local
 * credential. Local teardown runs even if the remote revoke fails, so no credential survives.
 */
export async function disconnectAdvertiser(userId: string): Promise<DisconnectResult> {
  assertServer();

  const grant = await getActiveGrant(userId);
  if (!grant) return { ok: false, remoteRevoked: false };

  let remoteRevoked = false;
  try {
    const token = await readAdvertiserToken(userId);
    if (token) {
      await revokeAdvertiserToken(token);
      remoteRevoked = true;
    }
  } catch (err) {
    if (err instanceof TikTokAdsError) console.error(err.toLogLine(userId));
  }

  await supabaseAdmin
    .from("tiktok_ads_authorizations")
    .update({ access_token: null, status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", grant.id);

  await supabaseAdmin
    .from("tiktok_ad_accounts")
    .update({ status: "revoked" })
    .eq("authorization_id", grant.id);

  return { ok: true, remoteRevoked };
}
