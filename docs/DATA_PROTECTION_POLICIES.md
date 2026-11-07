# Data Protection & Security Policies — Trend Store

**Organisation:** محل ترند (TREND STORE) · Benghazi, Libya
**Scope:** the Trend Store platform and its integrations (Facebook/Meta, TikTok),
including any TikTok Business Messaging data should access be granted.
**Owner:** Jomaa Mohamed Alorofi, proprietor
**Approved by:** Jomaa Mohamed Alorofi, proprietor — the senior decision-maker of
the business
**Version 1.0 · 7 November 2026 · next review 7 November 2027**

---

## How to read this document

It answers, point by point, the requirements published at
*TikTok for Business → Business Messaging API → Data security and privacy review*.
Each section below maps to one heading on that page.

Two things are stated up front, because a questionnaire answered with borrowed
enterprise language is worse than one answered honestly:

1. **We are a small business, not an enterprise vendor.** The proprietor is the
   only person with production access. Where a large company would name a team,
   this document names one person — that is the truth, and for a company of this
   size it is also a stronger control than a long access list.
2. **Section 11 lists what we do not have.** It is deliberate. An overstated
   control discredits every other answer in the file.

Companion document: `SECURITY_OVERVIEW.md` describes the implemented technical
controls (credential storage, authentication, webhook integrity, rate limiting,
sub-processors, deletion). This document covers the *policies* behind them.

---

## 1. Dedicated roles & responsibilities

| Responsibility | Holder |
|---|---|
| Data protection / privacy compliance | Jomaa Mohamed Alorofi |
| Security incidents | Jomaa Mohamed Alorofi |
| Access approval and review | Jomaa Mohamed Alorofi |
| Point of contact for privacy enquiries | `trend@trendstore-ly.com` |

The proprietor is the accountable individual for all four. A separate Data
Protection Officer is not appointed: Libya has no statutory DPO requirement, and
the business has no employees with production data access. Should we begin
processing EEA or UK personal data, or employ staff with such access, a DPO will
be appointed before that processing begins.

All privacy enquiries reach `trend@trendstore-ly.com`, which is monitored daily.

---

## 2. Privacy notice

Published at **https://www.trendstore-ly.com/privacy**, in Arabic and English.

It states, for each category of data: **what** is collected, **why**, **how** it
is used, **where** it is transferred, **how** it is protected, and **how long**
it is kept.

Platform data obtained through Meta or TikTok is described as belonging to the
account owner, processed by us on their behalf and for their stated purpose
only. The notice is revised whenever a new integration or data category is
added, and the revision date is shown on the page.

---

## 3. Data subject rights

Individuals may **access, download, correct and delete** their data. Requests go
to `trend@trendstore-ly.com`.

| Right | How it is served |
|---|---|
| Access & download | An export of the person's records is produced and sent |
| Correction | Most fields are self-service in the account screen; the rest on request |
| Deletion | Account and associated records are deleted |
| Withdraw platform consent | Self-service: disconnect in our app, or revoke directly in Facebook/TikTok settings |

**Service level: 30 days**, and sooner where local law requires it or the
request is urgent. Identity is verified before any export or deletion, so that a
request cannot be used to extract somebody else's data.

Where we process data **on behalf of a business customer**, a request we receive
directly is forwarded to that customer and we assist them in answering it.

---

## 4. Data retention

Personal data is **not kept longer than the purpose requires**.

| Data | Retention |
|---|---|
| Account profile | While the account exists; deleted on request |
| Orders and payments | Retained while required for commercial and tax records |
| Platform access tokens | Until disconnection or revocation, then destroyed |
| Direct-message content (if access granted) | Only as long as needed to deliver the reply, then deleted; never archived for analytics |
| Bot reply log | Operational record of what was sent — retained to prevent duplicate replies, not message bodies |
| Login events | Rolling operational log |

**On deauthorisation the deletion is immediate, not scheduled.** Disconnecting an
account revokes the token with the platform first, then destroys the local
credential; local teardown runs even if the remote revoke fails, so no credential
survives a disconnect.

---

## 5. Data minimisation

We request the **minimum** data and the **minimum** scopes that the feature needs.

In practice: the comment bot reads comments and writes replies, and does not
request video analytics it does not display; the ads tools request ad scopes and
not messaging scopes. Scopes are requested per product rather than as one broad
grant, and a scope that stops being used is removed at the next authorisation
change rather than left in place.

If Business Messaging access is granted, we will read a conversation only to
answer it. We will not bulk-export message history, and will not use message
content to train models or to build profiles.

---

## 6. Information security policy

This document **is** the information security framework for the business. It is
reviewed at least annually, revised whenever the architecture or a data category
changes, and approved by the proprietor, who is the senior decision-maker.

The operating baselines it sets:

* Secrets live only in the hosting provider's encrypted environment store, never
  in source control, never in client-side code, and are never transmitted over
  chat or email.
* Service-role database credentials are used only in server-side code paths.
* Every data-touching API route authenticates the caller and scopes queries to
  that caller.
* Changes reach production through version control, so every change is
  attributable and revertible.

---

## 7. Network security

The platform is **serverless**, hosted on Vercel with a managed Supabase
(PostgreSQL) database — there is no self-managed server estate to segment.

* Environments are separated: production and development hold distinct
  credentials and distinct databases-of-record; no developer machine holds a
  production service-role key in a shared location.
* All inbound traffic terminates at the hosting provider's edge, which provides
  TLS termination, DDoS protection and WAF filtering.
* The database is not exposed to the public internet for direct connection;
  access is via the provider's authenticated API layer with row-level security.
* The one self-hosted component is a payment relay that exists solely to present
  a static IP to a bank gateway. It runs a single-purpose Node process behind a
  Cloudflare tunnel — **no inbound ports are open to the internet** — and
  forwards only requests carrying a shared secret.
* Network intrusion detection is provided by the hosting platforms, not operated
  by us. See section 11.

---

## 8. Endpoint protection and security baselines

Verified on the production workstation on 7 November 2026. Each row says how it
was checked, so a reviewer can repeat it rather than take our word.

| Control | Status | Evidence |
|---|---|---|
| Anti-virus / host protection | ✅ Microsoft Defender — real-time protection on, tamper protection on, signatures same-day, quick scan within 7 days | `Get-MpComputerStatus` |
| Operating-system patching | ✅ Automatic, no policy override; security updates applied 15, 28 and 30 October 2026 | `Get-HotFix`, AU policy key absent |
| Screen auto-lock | ⚠️ **Being remediated.** Found unconfigured on 7 November 2026 and corrected the same day: display off and lock after 15 minutes, password required on resume | `HKCU\Control Panel\Desktop`, `powercfg` |
| Password requirements | Minimum 12 characters, mixed case, digit and symbol, unique per service, held in a password manager. Enforced by the services themselves; the workstation is a standalone device with no domain password policy applied | `net accounts` shows no local minimum |
| Disk encryption | ❌ **Not enabled.** Checked 7 November 2026: all volumes report `ProtectionStatus: Off`. Being remediated — see section 11 | `Get-BitLockerVolume` (elevated) |
| **Multi-factor authentication on administrator accounts** | Enabled on the hosting provider, database provider, source-code host, domain registrar, email provider and the platform developer accounts | Verified in each provider's security settings |
| Security awareness | The proprietor is the only person with access; practices are reviewed in the annual review of this document | — |

The screen-lock and disk-encryption rows are written as they happened rather
than as a clean pass. A control list that has never found anything is a list
nobody has actually checked, and a reviewer reading one can tell.

**On the scope of the encryption finding.** Customer personal data is not stored
on this workstation. It lives in the managed database and object storage, where
it is encrypted at rest with AES-256 and in transit with TLS 1.2 or above, as
section 9 describes — that remains true and is what the "data protection"
requirement asks about. What the workstation holds is *developer credentials*.
The exposure is therefore theft of the physical device, not of a customer
record store, and the remedy is full-volume encryption on the endpoint.

There is **one** workstation with production access, operated by the proprietor.
No contractor, employee or third party holds production credentials.

---

## 9. Data protection (encryption) and access control

### Encryption

* **At rest:** AES-256, provided by the managed database and object storage
  (Supabase on AWS) and by the hosting provider's storage layer.
* **In transit:** TLS 1.2 or above, enforced on every public endpoint. HTTP is
  redirected to HTTPS; no plaintext endpoint is published.
* Platform access tokens are held in the database, reachable only through
  server-side code holding the service-role credential, and never returned to a
  browser.

### Access control policy

Built on **need-to-know** and **least privilege**:

* Access is granted by role, not by person: customers see only their own records;
  staff roles are limited to the screens their work requires; the proprietor
  alone holds production infrastructure access.
* The administrative area is gated at the edge by role, and again inside each
  privileged API route — a URL alone grants nothing.
* Customer-facing database access runs under row-level security, so a query
  cannot reach another customer's rows even if the application is wrong.
* **System access logs are retained** (hosting request logs, database logs, and
  an in-application login log recording who signed in, when, from what device
  and address).
* **Privileges are reviewed at least annually**, as part of the review of this
  document, and immediately whenever a role changes.

---

## 10. Vulnerability and incident management

### Vulnerability management

* Dependencies are monitored for known vulnerabilities and updated; security
  advisories affecting our stack are acted on when published.
* A structured security review of the application was carried out in June 2026
  across authentication, authorisation, credential handling and injection
  surfaces; the findings were remediated and deployed. A further hardening pass
  in September 2026 covered the TikTok integration specifically — OAuth CSRF
  design, token storage, webhook signature verification and refresh locking —
  and is recorded in `TIKTOK_AUDIT_FOR_REVIEW.md`.
* Review records are retained and available on request.
* **Limitation:** these were internal structured reviews, not an accredited
  third-party penetration test. See section 11.

### Incident response policy

| Phase | Action |
|---|---|
| **Detect** | Platform alerts, error monitoring, and reports to `trend@trendstore-ly.com` |
| **Contain** | Revoke affected credentials and tokens; disable the affected path |
| **Assess** | Determine what data was reachable, for how long, and whose |
| **Notify** | Affected account owners without undue delay; the platform (Meta/TikTok) where their data is involved, within the window their terms require; authorities where law requires |
| **Remediate** | Fix the cause, deploy, and verify |
| **Record** | Write up cause, timeline, impact and fix; retain the report |

Credential rotation is the **first** action in any suspected compromise, before
investigation, because investigation takes time and an exposed credential does
not wait.

**Drills:** a recovery and response walkthrough is performed at least annually,
alongside the review of this document, and the result recorded.

---

## 11. What we do not have — stated plainly

* **No ISO 27001 certification and no SOC 2 report.**
* **No accredited third-party penetration test.** The June 2026 engagement was a
  structured internal security review.
* **No bug bounty programme.**
* **No 24/7 security operations centre** and no on-call rotation. Response is
  business-hours, by one person, with urgent matters answered sooner.
* **No centralised SIEM.** Logging is operational — error logs, request logs and
  an application activity log — not correlated security event management.
* **No appointed Data Protection Officer**, for the reason given in section 1.
* **Full-volume encryption is not yet enabled on the developer workstation.**
  Found on 7 November 2026 and scheduled for remediation. The device is Windows
  11 Pro with a TPM, so BitLocker will be enabled on the system volume with the
  recovery key held offline. Until it is done, this is an open finding and is
  recorded here rather than omitted.

TikTok's documentation names an ISO 27001 certificate, a SOC 2 report or a recent
penetration-test report as ways to speed up approval. We hold none of them and
will not imply otherwise. The controls described in sections 1–10 are implemented
and verifiable in the running product, and we will demonstrate any of them on
request.

---

## 12. Contact

Security, privacy and data-protection enquiries: **trend@trendstore-ly.com**
Acknowledged within 30 days, and sooner for anything flagged urgent.
