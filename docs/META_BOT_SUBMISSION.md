# Meta App Review — comment auto-reply bot

**App:** Trend Store Ads · **App ID** 1307261104860558 · Business type, Live
**Login config:** 27396251056635828
**Permissions requested:** `pages_manage_engagement` · `pages_messaging` · `pages_manage_metadata`
**Demo Page:** مكتب ليبيا للعقارات — 106443047882388 (assigned to system user "جمعة العرفي" with Full control)
**Prepared:** 2026-09-20

The ads permissions (`pages_show_list`, `pages_read_engagement`, `pages_manage_ads`,
`ads_management`) were **approved 2026-09-11**. This submission is the second, separate
round, for the auto-reply bot.

---

## 0. What sank the previous rounds (do not repeat)

| Rejection | Cause | Already fixed? |
|---|---|---|
| 2026-06-24 | Screencast didn't show the end-to-end flow; UI was Arabic-only | ✅ `/bot` + `/bot/[pageId]` are bilingual (EN toggle) |
| 2026-06-24 | Server-to-server token use not declared | ✅ declared in §3 notes below |
| 2026-09-02 | "Disallowed Use Case Details / Dev Policy 1.6" — the **notes** didn't answer the three boilerplate questions | ✅ §3 answers all three per permission |
| — | Consent screen not on camera (returning user → "Continue as …") | ⚠️ remove the app first — see §2 step 0 |

---

## 1. Dashboard prerequisites — DO THESE FIRST

Nothing below can be recorded until the Login config carries the permissions, because
the consent screen is generated from the config, not from the code.

1. **Add the three permissions to Login config `27396251056635828`**
   (App Dashboard → Facebook Login for Business → Configurations → edit → Permissions):
   `pages_manage_engagement`, `pages_messaging`, `pages_manage_metadata`
   — keep the four approved ads permissions in the config as they are.
2. Confirm the **webhook** is still connected: Page object, field `feed`,
   callback `https://trendstore-ly.com/api/bot/webhook`, verify token `META_WEBHOOK_VERIFY_TOKEN`.
   (Verified live 2026-09-20: a bare GET returns 403, i.e. the route is up and fails closed.)
3. Confirm the demo Page is still assigned **to the system user** (not just to the person)
   with Full control — Business Settings → Users → System users → جمعة العرفي → Add assets → Pages.

---

## 2. Screen recording script

**Language:** press **EN** in the header before recording anything. The whole video must be
in English — an Arabic-only UI was an explicit rejection cause.
**Length:** 2–3 minutes, unhurried. **Do not** show wallet balances, phone numbers or the
business licence.

### 0 — Reset so the consent screen appears
Go to `facebook.com/settings?tab=business_tools`, **remove** "Trend Store Ads", and sign out of
the site. If the dialog says "Continue as … with previous settings" while recording, the take is
unusable — the reviewer must see the permissions being granted.

### 1 — Landing
`https://www.trendstore-ly.com/facebook` → press **EN**. Show the two product cards.

> "Trend Store is a SaaS platform for businesses in Libya. This section is the comment
> auto-reply product we are applying for."

### 2 — Login + consent  ← the most important shot
Open `/bot` → **Connect a Page** → the full Facebook login → **hold on the consent screen** and
let the permission list stay readable for several seconds:
*Manage engagement on your Page · Send messages from your Page · Manage Page settings*
(plus the already-approved ads permissions).

> "The Page owner explicitly grants each permission. Trend Store uses only what is granted."

### 3 — Page selected
Show the Page appearing in the dashboard list.

### 4 — Turn the bot on  → demonstrates `pages_manage_metadata`
Open the Page console `/bot/<pageId>` and flip the power switch ON.

> "Turning the bot on subscribes this Page to our webhook so new comments are delivered to us.
> That subscription call is what requires Manage Page settings."

### 5 — Create a rule
Rules tab → add a keyword rule: keyword `price`, public reply *"We have sent you a private
message ✅"*, private message *"Hello! The price is 250 LYD — here are the details."* Save.

### 6 — Post a real comment
On the Page's own post, as a normal Facebook user (second account or phone), comment **price**.

### 7 — Public reply lands  → demonstrates `pages_manage_engagement`
Back on the post, show the Page's public reply appearing under the comment, and the comment
being liked by the Page.

> "The Page replies publicly to the comment and likes it. This is Manage engagement."

### 8 — Private reply lands  → demonstrates `pages_messaging`
Open the commenter's Messenger inbox and show the private message arriving from the Page.

> "The same comment triggers a private message with the price and details, sent from the Page
> to the person who commented. This is Send messages."

### 9 — Activity log
Activity tab in the console → show the logged reply rows.

> "Every automated reply is logged for the business owner."

---

## 3. Submission notes — paste one block per permission

Each block answers Meta's three questions (*which functionality needs it · how the integration
works · how it helps the end user*) and carries the server-to-server disclosure.

### `pages_manage_engagement`

> **Which functionality needs this permission.** Trend Store's comment auto-reply product. A
> business connects its own Facebook Page and defines keyword rules. When someone comments on
> one of that Page's posts, our system publishes a public reply to that comment as the Page, and
> optionally likes the comment.
>
> **How the integration works.** The Page owner grants this permission through Facebook Login
> for Business (config 27396251056635828). Comments are delivered to our webhook
> (`https://trendstore-ly.com/api/bot/webhook`, Page object, `feed` field). Our server matches
> the comment text against the owner's rules and calls `POST /{comment-id}/comments` to publish
> the reply, and `POST /{comment-id}/likes` to like it. Replies are rate-limited per Page and
> spaced with a human-like delay so the Page is never flooded. Each comment is replied to once
> only, enforced by a unique constraint on the comment id in our database.
>
> **Server-to-server disclosure.** These Graph API calls are made from our backend, not from a
> browser. For Pages that belong to our own Business portfolio the call is authorised by a Meta
> **System User access token** (system user "جمعة العرفي") rather than by the user token obtained
> at login. No token is ever exposed to the client.
>
> **How it helps the end user.** Small businesses in Libya receive hundreds of comments asking
> the same questions — price, availability, location. Without this, people wait hours for an
> answer and the business loses the sale. The public reply tells the commenter immediately that
> they have been answered, in the business's own wording, which the owner controls.

### `pages_messaging`

> **Which functionality needs this permission.** The private half of the same auto-reply
> product: sending the detailed answer (price, specifications, product images) privately to the
> person who commented, instead of publishing their enquiry details in a public thread.
>
> **How the integration works.** After the public reply, our server calls the Send API,
> `POST /{page-id}/messages` with `recipient: { comment_id }`, which delivers a private message
> to the commenter. This form is used specifically because commenting opens the messaging window,
> and it supports image attachments so the business can send product photos. A given comment can
> receive a private reply only once; this is enforced by a unique constraint on the comment id in
> our database. We do not send unsolicited messages: a message is only ever sent in response to a
> comment that person just wrote on the business's own Page.
>
> **Server-to-server disclosure.** As above — the Send API call is made from our backend, and for
> Pages in our own Business portfolio it is authorised by a Meta System User access token.
>
> **How it helps the end user.** The person asking gets the real answer in their inbox within
> seconds, privately, rather than having their question and the price discussed in a public
> comment thread. The business owner writes the message text; we only deliver it.

### `pages_manage_metadata`

> **Which functionality needs this permission.** Subscribing the connected Page to our app's
> webhook. Without the subscription no comment is ever delivered, so neither of the two features
> above can function at all.
>
> **How the integration works.** When the business owner switches the bot ON for a Page in our
> dashboard, our server calls `POST /{page-id}/subscribed_apps` with `subscribed_fields=feed`.
> When the owner switches the bot OFF, or disconnects the Page, we call
> `DELETE /{page-id}/subscribed_apps` and stop receiving anything for that Page. The permission
> is used for nothing else — we do not read or modify any other Page setting.
>
> **Server-to-server disclosure.** The subscription call is made from our backend, authorised by
> a Meta System User access token for Pages in our own Business portfolio.
>
> **How it helps the end user.** It is what makes the automation switch actually work, and — just
> as importantly — what makes turning it **off** immediate and complete. The owner stays in
> control of whether we receive their Page's comments at all.

---

## 4. Test credentials for the reviewer

Meta's reviewer needs to reach the product without a Libyan phone number or a wallet balance.

- Site: `https://www.trendstore-ly.com` → **EN** toggle in the header.
- Create an account at `/register`, then open `/bot`. New accounts get a **3-day free trial** of
  every product, so no payment is required to exercise the flow.
- Add the reviewer's Facebook account as a **Tester** (App Dashboard → App roles → Roles) so the
  Login dialog works for them before advanced access is granted.

---

## 5. Submit

App Review → Permissions and features → for each of the three permissions:
**Request advanced access** → paste the matching block from §3 → attach the same video → submit.

Submit all three **together**: `pages_manage_engagement` and `pages_messaging` are useless
without `pages_manage_metadata`, and a reviewer who cannot see the subscription step may read
the other two as unjustified.
