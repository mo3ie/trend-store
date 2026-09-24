# Meta App Review — `pages_manage_posts` (AI Employee Studio)

**App:** Trend Store Ads · **App ID** 1307261104860558 · Business type, Live
**Login config:** 27396251056635828
**Permission requested:** `pages_manage_posts` — one permission, on its own
**Demo Page:** مكتب ليبيا للعقارات — 106443047882388 (assigned to system user "جمعة العرفي", Full control)
**Prepared:** 2026-09-22

This is the third and final round. Already approved:

| Round | Permissions | Status |
|---|---|---|
| Ads | `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, `ads_management` | ✅ 2026-09-11 |
| Bot | `pages_read_user_content`, `pages_manage_metadata`, `pages_manage_engagement`, `pages_messaging` | ✅ 2026-09-21 |
| **Studio** | **`pages_manage_posts`** | **this submission** |

---

## 0. Why this is a separate round

The approved permissions cover *reading* a Page's posts, *replying* to comments and
*advertising* an existing post. None of them can create a post. The AI Employee
Studio — a separate product in the same app — plans a month of content and publishes
it on a schedule, which is the only thing `pages_manage_posts` is used for here.

**Evidence it is genuinely blocked today:** publishing a real plan to Page
113560053726849 on 2026-09-20 failed with `(#200) Permissions error`, while the same
token reads the Page successfully. The product is built, deployed and working
end-to-end apart from this one call.

---

## 1. Dashboard prerequisite — DO THIS FIRST

Add **`pages_manage_posts`** to Login config `27396251056635828`
(App Dashboard → Facebook Login for Business → Configurations → edit → Permissions),
keeping the eight already-approved permissions as they are.

The consent screen is generated from the config, **not** from the code — so nothing
below can be recorded until this is done, and a reviewer who cannot see the
permission being granted will reject the round. This was an explicit rejection cause
in an earlier round.

---

## 1b. The account you connect with decides everything

`pages_manage_posts` sits at **Standard Access** until review, which means it works
only for a Facebook account that **has a role on the app** (admin, developer or
tester). Connecting with an ordinary account fails with:

```
(#200) The permission(s) pages_manage_posts are not available.
It could because either they are deprecated or need to be approved by App Review.
```

That message reads like an app-level block and sends you back to the dashboard
hunting for a config problem. It is not: it is the wrong Facebook account.

Verified 2026-09-24 — connecting as a non-role account failed with exactly the
message above; reconnecting as an app-admin account published and scheduled six
posts to Page 113560053726849, each with a real post id.

**This is also precisely why the submission matters.** Customers have no role on
the app, so Standard Access never covers them. Until advanced access is granted,
auto-publish works for the app's own admins and nobody else.

---

## 2. Screen recording script

**Language:** press **EN** in the header first. The whole video must be in English —
an Arabic-only UI was an explicit rejection cause. `/studio` is bilingual.
**Length:** 2–3 minutes. **Do not** show wallet balances, phone numbers or the
business licence.

### 0 — Reset so the consent screen appears
Remove "Trend Store Ads" at `facebook.com/settings?tab=business_tools`, then sign out
of the site. If the dialog says "Continue as … with previous settings" while you are
recording, the take is unusable.

### 1 — The product
`https://www.trendstore-ly.com/studio` → press **EN**.

> "Trend Store is a SaaS platform for small businesses in Libya. This is the AI
> Employee — it plans a month of social content for a business and publishes it to
> their own Facebook Page on a schedule."

### 2 — Login + consent  ← the most important shot
**Connect a Page** → full Facebook login → **hold on the consent screen** long enough
to read it. *Manage your Page's posts* must be visible in the list.

> "The Page owner grants the permission explicitly. Trend Store publishes only to the
> Page they connect, and only content they approved."

### 3 — The business profile and catalog
Show the brand tab (business name, tone) and the catalog tab with a few products.

> "The business tells us who they are and what they sell. This is what the content is
> generated from — so posts are about their real products, at their real prices."

### 4 — Generate the plan
Plan tab → choose posts per day and duration → **Generate plan**. Show the resulting
posts with captions, hashtags, images and scheduled times.

> "The plan is a draft. Nothing is published yet."

### 5 — Review and edit  ← this is the consent story
Open one post. Show the caption being edited, the scheduled time being changed, and
the image being swapped.

> "The owner reviews every post and can edit, reschedule or delete it. Nothing reaches
> Facebook without their approval."

### 6 — Approve
Select posts → **Approve**. Show the status changing to approved.

### 7 — Publish  → demonstrates `pages_manage_posts`
Press **Publish plan**. Show the counts returned: published / scheduled.

> "On publish, Trend Store creates the post on the Page. Posts dated now go up
> immediately; posts dated later are created as scheduled posts."

### 8 — Proof on Facebook itself
Open the Page in a new tab and show the new post live on the timeline. Then open the
Page's **Publishing tools → Scheduled posts** and show the scheduled ones queued.

> "This is the post on the Page, created by Trend Store through the API."

### 9 — Turning it off
Back in the Studio, show deleting or unscheduling a post.

> "The owner stays in control — a scheduled post can be removed before it goes out."

---

## 3. Submission notes — paste this block

> **Which functionality needs this permission.** Trend Store's "AI Employee" product:
> a scheduled social-content service for small businesses. A business connects its own
> Facebook Page, enters its brand profile and product catalog, and our system generates
> a content plan — caption, hashtags, image and a publish time for each post. After the
> owner reviews and approves the plan, we create those posts on their Page, publishing
> immediately or scheduling them for the chosen time. `pages_manage_posts` is used for
> this and nothing else.
>
> **How the integration works.** The Page owner grants the permission through Facebook
> Login for Business (config 27396251056635828). Our server then calls
> `POST /{page-id}/photos` with the image url, the caption and — for a future slot —
> `published=false` plus `scheduled_publish_time`. When the business has uploaded a
> video of their own instead, we call `POST /{page-id}/videos` with `file_url` and the
> description in the same way. We publish **only** posts the owner has explicitly moved
> to the "approved" state in our dashboard; drafts are never sent. Each post records
> the id Facebook returns, and we never create a second post for the same planned item.
> We do not read, edit or delete posts that Trend Store did not create.
>
> **Server-to-server disclosure.** These Graph API calls are made from our backend, not
> from a browser. For Pages that belong to our own Business portfolio the call is
> authorised by a Meta **System User access token** (system user "جمعة العرفي") rather
> than by the user token obtained at login. No token is ever exposed to the client.
>
> **How it helps the end user.** A small shop in Libya has no marketing staff. Posting
> consistently — every day, at the hours their customers are actually online — is the
> single thing that grows their Page, and it is the first thing they drop when the shop
> is busy. The AI Employee prepares a month of posts from their own catalog in a few
> minutes; the owner reviews them once and their Page then stays active without further
> work. Every post is written from their real products and their real prices, and
> nothing is published that they have not approved.

---

## 4. Test credentials for the reviewer

- Site: `https://www.trendstore-ly.com` → **EN** toggle in the header → `/studio`.
- Register at `/register`. New accounts get a **3-day free trial** of every product, so
  the reviewer can generate and publish a plan without any payment.
- Add the reviewer's Facebook account as a **Tester** (App Dashboard → App roles →
  Roles) so the Login dialog works before advanced access is granted.

---

## 5. Submit

App Review → Permissions and features → `pages_manage_posts` → **Request advanced
access** → paste §3 → attach the video → submit.

Submit it **alone**. The other eight permissions are already approved and must not be
re-opened; and the reviewer for this round only needs to see one story — a business
approving content and Trend Store posting it.

---

## 6. After approval

1. Add `pages_manage_posts` to the system user's token scopes (Business Settings →
   Users → System users → جمعة العرفي → Generate new token), and set the new value as
   `META_ACCESS_TOKEN` in Vercel production.
2. Customers whose Page tokens were issued before approval must **reconnect** their
   Page — an existing token does not gain a scope retroactively.
3. Re-run a plan publish on a real Page and confirm the post appears. The code path is
   already built and deployed (`src/app/api/studio/plan/publish/route.ts`).
