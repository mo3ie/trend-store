# TikTok integration — Phase 1 (security hardening)

Status: **hardening only.** No TikTok developer app exists, no credentials are configured,
and no call is made to TikTok. Phase 1 prepares the ground so Phase 2 can be a small,
reviewable change.

---

## 1. Migration order

Run in the Supabase SQL editor, in this order. Both are additive and idempotent.

| # | File | Creates |
|---|------|---------|
| 1 | `supabase/security-rate-limits.sql` | `security_rate_limits` (+2 indexes), RLS on, no policies |
| 2 | `supabase/tiktok-oauth-phase1.sql` | `tiktok_oauth_states`, `tiktok_accounts`, `tiktok_tokens`, `set_updated_at()` trigger fn, indexes, constraints, RLS |

Not to be run yet (needs cross-app verification first — see the header inside the file):

| File | Purpose |
|------|---------|
| `supabase/PROPOSED-token-column-lockdown.sql` | Revokes browser `select` on `bot_page_tokens.access_token / refresh_token` and `connected_pages.page_access_token` |

**No TikTok data migration is required.** Verified on the live database:
`bot_configs where platform = 'tiktok'` → **0 rows** (Meta: 7 configs, 30 `bot_page_tokens`,
87 `connected_pages`). The new tables therefore start empty and nothing has to be copied or
deleted. Re-check before Phase 2 with:

```sql
select platform, count(*) from bot_configs group by platform;
select count(*) from bot_page_tokens t
  join bot_configs c on c.id = t.config_id where c.platform = 'tiktok';
```

If that ever returns rows, they must be **re-linked through OAuth**, not copied: tokens in
`bot_page_tokens` are plaintext, while `tiktok_tokens` stores ciphertext, and SQL cannot
encrypt them (the key lives only in the app). A copy would defeat the encryption.

## 2. Environment variables

| Name | Purpose | Set? |
|------|---------|------|
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64 AES-256-GCM key for credentials at rest. Server-only — never `NEXT_PUBLIC_*` | ❌ required before Phase 2 |
| `TIKTOK_CLIENT_KEY` | TikTok app key | ❌ Phase 2 |
| `TIKTOK_CLIENT_SECRET` | TikTok app secret | ❌ Phase 2 |
| `NEXT_PUBLIC_BASE_URL` | Currently **empty** in Vercel production | ⚠️ see §3 |
| `CRON_SECRET` | Already set; cron routes now fail closed without it | ✅ |

Generate the encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Canonical URL

`https://trendstore-ly.com/*` returns **308 → `https://www.trendstore-ly.com/*`** (verified
2026-09-16), so **`https://www.trendstore-ly.com` is canonical**. `NEXT_PUBLIC_BASE_URL` is
an empty string in Vercel production, so every `process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com"`
fallback resolves to the non-canonical apex.

`src/lib/siteUrl.ts` pins the canonical origin for the TikTok routes only. The Meta/ads and
payment routes keep their existing fallback untouched — changing a live redirect URI would
require re-registering it with those providers first.

## 4. Route consolidation plan

| Route | Today | After Phase 2 |
|-------|-------|---------------|
| `GET /api/tiktok/connect` | hardened; called by `src/app/tiktok-bot/page.tsx:68` | thin 308 → `/api/tiktok/oauth/start`, then removed once the UI is updated |
| `GET /api/tiktok/callback` | hardened; registered redirect URI | canonical, or kept as the registered URI while `/api/tiktok/oauth/callback` becomes the implementation |

Callers (complete list, verified by grep):

- `src/app/tiktok-bot/page.tsx` → `/api/tiktok/connect`, `/api/tiktok/configs`
- `src/app/tiktok-bot/[accountId]/page.tsx` → `/api/tiktok/configs`
- TikTok itself → `/api/tiktok/callback` (the registered redirect URI)
- external cron → `/api/tiktok/cron/poll`

Because the redirect URI is registered with TikTok and matched exactly, **the URI must be
changed in exactly one place at one time**: register the new URI in the portal first, deploy
the new route, then retire the old one. Until the developer app exists, keeping
`/api/tiktok/callback` as the single registered URI is the lower-risk option.

## 5. What Phase 2 must do

1. Re-derive every endpoint in `src/services/tiktok.ts` from the current official TikTok API
   for Business documentation — the file is marked `UNVERIFIED` at the top and none of its
   shapes may be assumed correct.
2. Switch the callback's storage from `bot_configs` + `bot_page_tokens` to
   `tiktok_accounts` + `tiktok_tokens` via `src/lib/tiktokTokens.ts`.
3. Fill the two `PHASE 2 PLUG-IN POINT` blocks in `src/lib/tiktokTokens.ts`
   (token refresh under the existing lock; official remote revoke on disconnect).
4. Wire `disconnectTikTokAccount()` into the disconnect endpoint.
5. Apply `PROPOSED-token-column-lockdown.sql` after the cross-app check.
