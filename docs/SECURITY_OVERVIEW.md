# Security & Data Protection Overview

**Company:** محل ترند (TREND STORE) — Trend Electronics
**Product:** Trend Store — storefront and social-marketing tools
**Website:** https://www.trendstore-ly.com
**Headquarters:** Benghazi, Libya
**Contact:** trend@trendstore-ly.com
**Prepared for:** TikTok / ByteDance Third-Party Due Diligence Questionnaire (DSPR DDQ)
**Date:** 2026-10-08

> This document describes controls that are implemented and in production today. Where
> a control is partial, planned, or absent, it says so plainly rather than implying
> coverage we do not have. Section 10 lists those gaps.

---

## 1. What the product does, and what it touches

Trend Store is a single-tenant-per-customer SaaS for small businesses in Libya. A
business owner connects their own social accounts and the product replies to comments
on their behalf, drafts content plans, and runs ad campaigns.

The TikTok surface is:

| Capability | Scope used | Data touched |
|---|---|---|
| Read the owner's videos | `video.list`, `video.insights` | Video ids, captions, thumbnails, counts |
| Read and reply to comments | `comment.list`, `comment.list.manage` | Comment text, comment id, display name |
| Publish a video the owner uploaded | `video.publish` | Video URL supplied by the owner |
| Promote an existing video | `biz.spark.auth` | Ad campaign settings |
| Account profile | `user.info.*` | Display name, avatar, account type |
| **Business Messaging (applied for)** | — | Conversation id, message text |

**What we never access:** comments or messages on accounts the owner has not connected,
any other TikTok user's private data, and any content outside the connected account.

---

## 2. Data inventory

| Data | Purpose | Retention |
|---|---|---|
| OAuth access/refresh tokens | Calling TikTok on the owner's behalf | Until disconnect; destroyed on revoke |
| Comment text + comment id | Generating the reply, preventing duplicate replies, showing the owner an activity log | Retained for the activity log; deletable on request |
| Commenter display name | Addressing the reply and the once-per-person rule | With the log row |
| Conversation id + message text (if granted) | Replying inside a conversation | With the log row |
| Owner's business profile and product catalog | Generating replies and content | Until the owner deletes it |

We do **not** collect: payment card data (gateways handle it directly), commenter
contact details, location data, or any data from non-connected accounts.

---

## 3. Credential protection

* Tokens are encrypted **at rest with AES-256-GCM** before being written to the
  database (`src/lib/tokenCrypto.ts`). The key lives only in the server environment.
* The encryption function **refuses to store a credential in plaintext**: with no key,
  or a key that is not exactly 32 bytes, it throws rather than degrading. There is no
  silent fallback path.
* Tokens **never reach the browser**. The API routes that return account metadata
  select explicit column lists that exclude the token column.
* Tokens are never written to any log line. Error logging carries endpoint, HTTP
  status, the platform's error code and request id only.
* The app secret is read server-side from the environment and is never accepted from a
  request body.
* Refreshing is guarded by a database-level lock so concurrent serverless instances
  cannot race and invalidate each other's tokens.

---

## 4. Authentication and authorisation

* Customer authentication is handled by Supabase Auth (JWT, HTTP-only cookies).
* Every API route that reads or writes **customer data** resolves the caller first and
  scopes its query to that user id. Ownership is re-verified on the row: an account or
  configuration is only operated on after confirming it belongs to the authenticated
  user.
* Routes that are not user-authenticated are so by design, and each has its own gate:
  * **Payment-provider callbacks** — verified against the provider.
  * **Platform webhooks** — signature-verified (§5).
  * **Scheduled jobs and internal hops** — shared secret, fail closed.
  * **Public reference data** (the price list, geo and interest lookups) — contains no
    customer data.
* Administrative endpoints — webhook registration, pricing — are gated on an
  explicit admin role, not on a client-supplied flag.
* Scheduled jobs are protected by a shared secret and **fail closed**: a missing
  secret returns 503 rather than leaving the endpoint open.
* The internal "campaign is paid, now create it" hop leaves the process and returns
  over the public network, so it carries the same shared secret. Its other gate — the
  campaign's own paid status — establishes that a launch is legitimate, not who asked
  for it.

---

## 5. Webhook integrity

* Every inbound TikTok webhook delivery is **signature-verified** before it is parsed
  or acted on; an invalid signature is rejected with 401 and never acknowledged as
  success.
* Deliveries are deduplicated by a `UNIQUE(comment_id)` constraint, so an at-least-once
  delivery can never produce a duplicate reply.
* Large numeric identifiers are parsed losslessly. TikTok sends 19-digit ids as JSON
  numbers, which a naive parse silently rounds; a dedicated parser preserves the exact
  source text so an id is never corrupted.

---

## 6. Abuse and rate-limit controls

These exist to protect the *customer's* account as much as the platform:

* A configurable per-minute reply cap, counted durably so it holds across serverless
  instances.
* A randomised human-like pause between replies.
* A hard ceiling of 25 replies per video per hour, as a circuit breaker.
* A one-reply-per-person-per-video rule.
* Self-reply detection: the id of every comment we create is stored, and an inbound
  event matching one is dropped — the bot can never answer itself.
* App-level and per-account rate limiters in front of the TikTok API.

**Anti-spam commitment:** the product replies to comments on the owner's own content,
and messages only within a conversation the platform permits. It never sends bulk
messages, never sends unsolicited promotion, and never contacts anyone who has not
engaged with the owner's account. This is stated in our published Terms.

---

## 7. Infrastructure and sub-processors

| Provider | Role | Location | What it receives |
|---|---|---|---|
| Supabase | Database, auth, storage | EU (Ireland) | All application data |
| Vercel | Application hosting | Global edge | Request traffic |
| Groq | Smart-reply text generation (optional) | US | Comment text + the owner's published product details |
| Local payment gateways | Payment processing | Libya | Payment data only |

**The AI provider is never sent personal data or access tokens** — only the comment
text and the owner's own published catalog entries, which is what is needed to compose
a reply. No customer data is used to train any model.

All traffic is HTTPS only. Database access from the application uses a service
credential held server-side; the browser uses a restricted anonymous key governed by
row-level security.

---

## 8. Deletion and customer control

* Disconnecting an account **revokes the token with TikTok first**, then destroys the
  local credential. Local teardown runs even if the remote revoke fails, so no
  credential survives a disconnect.
* Turning the bot off halts all processing immediately.
* A deletion request to trend@trendstore-ly.com is honoured within 30 days.
* The owner can revoke our access directly from their TikTok settings at any time,
  without involving us.

---

## 9. Security review history

An independent security review of the application was carried out in June 2026
covering authentication, authorisation, credential handling and injection surfaces;
the findings were remediated and deployed. A further internal hardening pass in
September 2026 covered the TikTok integration specifically — OAuth CSRF design, token
storage, webhook signature verification and refresh locking — and is documented in
`TIKTOK_AUDIT_FOR_REVIEW.md`.

---

## 10. Known gaps — stated plainly

We are a small business, not an enterprise vendor, and these are not in place:

* **No ISO 27001 or SOC 2 certification.** We hold neither.
* **No formal 24/7 security operations centre** or on-call rotation.
* **No formal penetration test by an accredited third party.** The June 2026 review was
  a structured security review, not a certified engagement.
* **No bug bounty programme.**
* Logging is operational rather than a full SIEM; we retain error logs and an
  application activity log, not centralised security event correlation.

We would rather state these accurately than overstate our posture. The controls in
sections 3–8 are implemented and verifiable in the running product.

---

## 11. Contact

Security and data-protection enquiries: **trend@trendstore-ly.com**
We respond within 30 days, and sooner for anything flagged as urgent.
