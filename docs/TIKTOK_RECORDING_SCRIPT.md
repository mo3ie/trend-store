# TikTok Accounts API — Screen Recording Script

**Purpose:** the screen recording required by the *Accounts API Access Application Form* (field 8).
**Prototype:** demonstrates the planned official TikTok Accounts API workflow with **demo data**.
**Rule for the whole recording:** never claim real TikTok data was retrieved, a real account was
connected, a real comment was changed, or a real video was published.

---

## Before you start

| Check | Value |
|---|---|
| Browser | Chrome, one clean window, no unrelated tabs |
| Zoom | 100% · window ≥ 1440×900 |
| Language | Arabic (default). If TikTok's reviewer reads English, press **EN** in the top bar first |
| Theme | Either works; dark looks better on video |
| Start state | Press **إعادة ضبط / Reset Demo** once, so the account starts disconnected |
| Screen | Close notifications; hide bookmarks; do not show the business licence, phone numbers or IDs |
| Length | Aim for 2–3 minutes, unhurried |

> The **"نموذج أولي / Prototype / Demo"** badge stays visible in the header the whole time. Do not
> hide it — it is what keeps the recording honest.

---

## Step-by-step

### 1 — Dashboard
**Go to:** `https://www.trendstore-ly.com/tiktok`
**Show:** the TikTok Accounts & Content section, the four capability cards ("Not connected"), and
the four-step "How Trend Store uses TikTok Accounts API" panel.

> "Trend Store is a SaaS platform that lets businesses connect and manage their TikTok presence from
> one dashboard. This section shows the TikTok Accounts capabilities we are applying for."

### 2 — Connect
**Click:** **ربط حساب TikTok / Connect TikTok Account**

### 3 — Authorization preview
**Show:** the six permission cards, slowly — Account information · Account media · Account comments ·
Manage account comments · Video publishing · Photo publishing. Point at the blue note.

> "The business owner explicitly authorizes Trend Store. This screen is a preview of the
> authorization step — after approval it is replaced by TikTok's official OAuth flow. Trend Store
> only uses the permissions the owner grants."

### 4 — Authorize
**Click:** **تصريح لمحل ترند / Authorize Trend Store** → the "Authorizing…" state appears.

### 5 — Success
**Show:** "TikTok account connected", the account card, and the **Authorized** badge.

### 6 — Account dashboard
**Click:** **فتح لوحة TikTok / Open TikTok Dashboard** → `/tiktok-bot/demo-account`
**Show:** display name, username, account type, connection status, authorization status.
Point at the **بيانات تجريبية / Demo data** label under the statistics.

> "After authorization, Trend Store displays the connected account's basic information. The figures
> here are demo data, not real TikTok statistics."

### 7 — Videos
**Click the** الفيديوهات / Videos **tab.**
**Show:** the six video cards, then press **تحديث / Refresh** so the loading state is visible.
Point at the **Accounts API — Demo** source label.

> "Trend Store retrieves and displays the videos that belong to the authorized account."

### 8 — Comments
**Click the** التعليقات / Comments **tab.**
**Show:** the video filter, the status filter, the search box, one comment that already has a reply
from the account owner, and the comment marked **مخفي / Hidden**.

> "The platform retrieves comments and replies on videos owned by the account."

### 9 — Reply
**Click** رد / Reply **on "من أين يمكنني شراء هذا؟"** → type a short reply → **إرسال الرد / Send Reply**.
**Show:** "Sending reply…" then the toast, then the new reply nested under the comment.

> "The authorized business can reply to comments on its own videos, directly from Trend Store."

### 10 — Manage: like, hide, delete
- **Like:** click **إعجاب / Like** — the heart fills and the count increases.
- **Hide:** click **إخفاء / Hide** → the confirmation dialog → confirm → toast "Comment hidden
  successfully" → the comment shows the **مخفي / Hidden** badge.
- **Delete:** click **حذف / Delete** on the spam comment → confirm → toast → the row disappears.

> "Comment management actions — like, hide and delete — are performed only on the account's own
> videos, and only with the granted permissions."

### 11 — Publish video
**Click the** نشر المحتوى / Publish **tab**, keep **نشر فيديو / Publish Video** selected.
**Show:** the upload area, the caption, hashtags, visibility options, the comment/duet/stitch
toggles, and the live preview panel on the side.

> "Trend Store also provides a centralized publishing workflow for the authorized account."

### 12 — Publishing progress
**Click:** **نشر إلى TikTok / Publish to TikTok**
**Show:** Preparing → Uploading → Publishing → the success card.

> "This is the demo publishing flow. No file is uploaded in the prototype."

### 13 — Photo publishing + history
**Click** نشر صور / Publish Photo **to show the photo form**, then scroll to
**نشاط النشر الأخير / Recent Publishing Activity** and show the Published / Processing / Draft rows.

### 14 — Disconnect
**Go back to the dashboard tab** → click **فصل الحساب / Disconnect** → show the confirmation text
→ confirm → the account is removed and `/tiktok` shows **غير متصل / Not connected** again.

> "The business owner can disconnect at any time, which removes the account from Trend Store."

---

## What the recording proves to the reviewer

| Form requirement | Where it is shown |
|---|---|
| Explicit user authorization | Steps 2–5 |
| Account information | Step 6 |
| Account media (videos) | Step 7 |
| Account comments + replies | Steps 8–9 |
| Manage comments | Step 10 |
| Video publishing | Steps 11–12 |
| Photo publishing | Step 13 |
| Revocation / user control | Step 14 |
| Least privilege, no unrelated data | Step 3 (permission list + notice) |

## Do not say

- "connected to a real TikTok account"
- "these are real views / likes / followers"
- "the video was published to TikTok"
- anything implying the data came from TikTok during the recording

## Do say

- "prototype", "demo data", "planned workflow"
- "after approval this step uses TikTok's official OAuth flow"
