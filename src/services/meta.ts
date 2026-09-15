// Meta Graph Marketing API service
// Handles: OAuth, Pages, Campaigns, AdSets, Ads, and the comment auto-reply bot.

import crypto from "crypto";

// Strip BOM/whitespace — env values added via PowerShell pipes or pasted into
// the Vercel dashboard can carry an invisible U+FEFF prefix that makes Meta
// reject every request (same incident previously broke the WhatsApp vars).
function cleanEnv(v: string | undefined): string {
  return (v ?? "").replace(/^\uFEFF/, "").trim();
}

const META_VERSION = cleanEnv(process.env.META_API_VERSION) || "v19.0";
const BASE = `https://graph.facebook.com/${META_VERSION}`;
const AD_ACCOUNT = cleanEnv(process.env.META_AD_ACCOUNT_ID); // e.g. "act_123456789"
const SYS_TOKEN = cleanEnv(process.env.META_ACCESS_TOKEN);   // system user long-lived token
const LYD_TO_USD = parseFloat(cleanEnv(process.env.META_LYD_TO_USD_RATE) || "5");

// ── Graph API helper ─────────────────────────────────────────────────────────

async function graph<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const t = token || SYS_TOKEN;
  // path may already carry a query string (e.g. "me/accounts?fields=...") —
  // a second "?" would swallow the access_token and Facebook rejects the call
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}/${path}${method === "GET" ? `${sep}access_token=${t}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "GET" ? JSON.stringify({ ...body, access_token: t }) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if ((data as Record<string, unknown>).error) {
    const err = (data as { error: { message: string } }).error;
    throw new Error(err.message);
  }
  return data as T;
}

// ── OAuth ────────────────────────────────────────────────────────────────────

export function buildOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id:    cleanEnv(process.env.META_APP_ID) || cleanEnv(process.env.NEXT_PUBLIC_META_APP_ID),
    redirect_uri:  redirectUri,
    state,
    response_type: "code",
  });

  // Business-type apps must use Facebook Login for Business: a config_id
  // (created in the app dashboard) replaces the scope list. Plain scope-based
  // OAuth shows "this app isn't available" for Business apps.
  const configId = cleanEnv(process.env.META_LOGIN_CONFIG_ID);
  if (configId) {
    params.set("config_id", configId);
  } else {
    // pages_manage_engagement + pages_messaging power the comment auto-reply bot
    // (public reply + private DM). In production the config_id (Login for Business)
    // carries the permission set — keep the dashboard config in sync with this list.
    params.set("scope", "pages_manage_ads,pages_read_engagement,pages_show_list,ads_management,pages_manage_engagement,pages_messaging");
  }

  return `https://www.facebook.com/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id:     cleanEnv(process.env.META_APP_ID) || cleanEnv(process.env.NEXT_PUBLIC_META_APP_ID),
    client_secret: cleanEnv(process.env.META_APP_SECRET),
    redirect_uri:  redirectUri,
    code,
  });
  const res = await fetch(`${BASE}/oauth/access_token?${params}`, { cache: "no-store" });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.access_token as string;
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export interface MetaPage {
  id:           string;
  name:         string;
  picture?:     { data: { url: string } };
  access_token: string;
}

export async function getUserPages(userToken: string): Promise<MetaPage[]> {
  // me/accounts returns 25 pages per page by default — without pagination,
  // anyone managing more than 25 pages loses the rest (incl. their own).
  const pages: MetaPage[] = [];
  const FIELDS = "fields=id,name,picture,access_token&limit=100";
  let path: string | null = `me/accounts?${FIELDS}`;
  let guard = 0;
  while (path && guard < 20) {
    const data: { data: MetaPage[]; paging?: { next?: string; cursors?: { after?: string } } } =
      await graph(path, "GET", undefined, userToken);
    pages.push(...(data.data || []));
    const after = data.paging?.cursors?.after;
    path = data.paging?.next && after ? `me/accounts?${FIELDS}&after=${after}` : null;
    guard++;
  }
  return pages;
}

// ── Page posts (pages_read_engagement) ────────────────────────────────────────

export interface PagePost {
  id:           string; // "{pageId}_{postId}"
  postId:       string; // numeric post id only
  message:      string;
  createdTime:  string;
  picture?:     string;
  permalinkUrl?: string;
}

// Lists a Page's recent published posts using the stored PAGE access token.
// This read demonstrates the `pages_read_engagement` permission end-to-end.
export async function getPagePosts(pageToken: string, limit = 15): Promise<PagePost[]> {
  type RawPost = { id: string; message?: string; story?: string; created_time: string; full_picture?: string; permalink_url?: string };
  async function fetchFrom(edge: string): Promise<PagePost[]> {
    const data = await graph<{ data: RawPost[] }>(
      `${edge}?fields=id,message,story,created_time,full_picture,permalink_url&limit=${limit}`,
      "GET", undefined, pageToken
    );
    return (data.data || []).map((p) => ({
      id:           p.id,
      postId:       p.id.includes("_") ? p.id.split("_")[1] : p.id,
      message:      p.message || p.story || "",
      createdTime:  p.created_time,
      picture:      p.full_picture,
      permalinkUrl: p.permalink_url,
    }));
  }
  // published_posts is the canonical list, but it omits some post types (shared
  // content, certain photo/video stories) — so some Pages come back empty. When
  // that happens, fall back to the Page feed. A permission error still THROWS
  // here so the route can retry with a fresh system-user token.
  const primary = await fetchFrom("me/published_posts");
  if (primary.length > 0) return primary;
  try {
    const feed = await fetchFrom("me/feed");
    return feed.length > 0 ? feed : primary;
  } catch {
    return primary;
  }
}

// Fetches a fresh Page access token via the system-user token. Works for pages
// assigned to the system user / in the store's Business — used as a fallback
// when a customer's stored OAuth token has expired or been invalidated
// (code 190 / subcode 460). Returns null if the system user can't reach the page.
export async function getSystemPageToken(pageId: string): Promise<string | null> {
  try {
    const data = await graph<{ access_token?: string }>(`${pageId}?fields=access_token`);
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// Large profile picture URL for a Page — used as the image on a Page-likes ad.
export async function getPagePicture(pageId: string, pageToken?: string): Promise<string | null> {
  try {
    const data = await graph<{ data?: { url?: string } }>(
      `${pageId}/picture?type=large&redirect=false`, "GET", undefined, pageToken
    );
    return data.data?.url ?? null;
  } catch {
    return null;
  }
}

// ── Comment auto-reply bot (pages_manage_engagement + pages_messaging) ─────────

// Posts a PUBLIC reply on a comment (e.g. "we messaged you privately ✅").
// Requires pages_manage_engagement. Returns the new comment id.
export async function replyToComment(
  commentId: string,
  message: string,
  pageToken: string
): Promise<string> {
  const data = await graph<{ id: string }>(
    `${commentId}/comments`,
    "POST",
    { message },
    pageToken
  );
  return data.id;
}

// Likes a comment as the Page (a light touch that shows the commenter they were
// seen). Requires pages_manage_engagement. Best-effort — callers ignore failures.
export async function likeComment(commentId: string, pageToken: string): Promise<void> {
  await graph(`${commentId}/likes`, "POST", {}, pageToken);
}

// Sends a PRIVATE reply (DM) to whoever wrote a comment, via the Send API using
// `recipient: { comment_id }`. This form supports attachments (images/files) and
// works outside the 24h window because commenting opens the messaging window.
// A comment can only be private-replied ONCE — idempotency is enforced upstream
// by the UNIQUE(comment_id) row in bot_reply_log. Requires pages_messaging.
export interface BotAttachment {
  type: "image" | "file" | "video" | "audio";
  url:  string;
}

export async function sendPrivateReply(
  pageId: string,
  commentId: string,
  message: string,
  pageToken: string,
  attachments: BotAttachment[] = []
): Promise<void> {
  // Text first (if any), then each attachment as its own message.
  if (message && message.trim()) {
    await graph(
      `${pageId}/messages`,
      "POST",
      {
        recipient:      { comment_id: commentId },
        messaging_type: "RESPONSE",
        message:        { text: message },
      },
      pageToken
    );
  }
  for (const att of attachments) {
    await graph(
      `${pageId}/messages`,
      "POST",
      {
        recipient:      { comment_id: commentId },
        messaging_type: "RESPONSE",
        message: {
          attachment: {
            type:    att.type,
            payload: { url: att.url, is_reusable: true },
          },
        },
      },
      pageToken
    );
  }
}

// Subscribes a Page to this app's webhooks (feed field → comments). Must be called
// once per page with a PAGE access token before comment events are delivered.
export async function subscribePageToWebhook(pageId: string, pageToken: string): Promise<void> {
  await graph(
    `${pageId}/subscribed_apps`,
    "POST",
    { subscribed_fields: ["feed"] },
    pageToken
  );
}

export async function unsubscribePageFromWebhook(pageId: string, pageToken: string): Promise<void> {
  await graph(`${pageId}/subscribed_apps`, "DELETE", undefined, pageToken);
}

// Verifies the X-Hub-Signature-256 header Meta sends on every webhook POST, so we
// only trust payloads actually signed with our app secret. Compares in constant time.
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = cleanEnv(process.env.META_APP_SECRET);
  if (!secret || !signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Geo targeting (city search) ───────────────────────────────────────────────

export interface GeoCity {
  key:    string; // Meta targeting key (required — names are not accepted)
  name:   string;
  region?: string;
}

// Searches Libyan cities via Meta's targeting search. Uses SYS_TOKEN.
export async function searchCities(q: string): Promise<GeoCity[]> {
  const data = await graph<{ data: Array<{ key: string; name: string; region?: string; country_code?: string }> }>(
    `search?type=adgeolocation&location_types=${encodeURIComponent('["city"]')}&country_code=LY&q=${encodeURIComponent(q)}&limit=20`,
    "GET"
  );
  return (data.data || [])
    .filter((c) => !c.country_code || c.country_code === "LY")
    .map((c) => ({ key: c.key, name: c.name, region: c.region }));
}

// Searches Libyan regions (محافظات/مناطق) via Meta's targeting search.
export async function searchRegions(q: string): Promise<GeoCity[]> {
  const data = await graph<{ data: Array<{ key: string; name: string; country_code?: string }> }>(
    `search?type=adgeolocation&location_types=${encodeURIComponent('["region"]')}&country_code=LY&q=${encodeURIComponent(q)}&limit=20`,
    "GET"
  );
  return (data.data || [])
    .filter((c) => !c.country_code || c.country_code === "LY")
    .map((c) => ({ key: c.key, name: c.name }));
}

// ── Detailed targeting (interests) ────────────────────────────────────────────

export interface AdInterest {
  id:            string;
  name:          string;
  audienceLower?: number;
  audienceUpper?: number;
  path?:         string[];
}

// Searches Meta's detailed-targeting interests (adinterest). Uses SYS_TOKEN.
export async function searchInterests(q: string): Promise<AdInterest[]> {
  const data = await graph<{ data: Array<{
    id: string; name: string; audience_size_lower_bound?: number; audience_size_upper_bound?: number; path?: string[];
  }> }>(
    `search?type=adinterest&q=${encodeURIComponent(q)}&limit=25`,
    "GET"
  );
  return (data.data || []).map((i) => ({
    id: i.id, name: i.name,
    audienceLower: i.audience_size_lower_bound, audienceUpper: i.audience_size_upper_bound,
    path: i.path,
  }));
}

// ── Live status + insights (for "My campaigns" reports) ───────────────────────

export interface AdInsights {
  reach:       number;
  impressions: number;
  clicks:      number;
  spendUsd:    number;
  cpm:         number;
  ctr:         number;
}

// Maps Meta's ad effective_status to our internal campaign status. An ad is only
// "active" once Meta has actually approved AND started delivering it.
export function mapEffectiveStatus(s: string): string {
  switch (s) {
    case "ACTIVE":               return "active";
    case "PENDING_REVIEW":
    case "PREAPPROVED":
    case "IN_PROCESS":
    case "PENDING_BILLING_INFO": return "in_review";
    case "DISAPPROVED":          return "rejected";
    case "WITH_ISSUES":          return "issues";
    case "PAUSED":
    case "ADSET_PAUSED":
    case "CAMPAIGN_PAUSED":      return "paused";
    case "ARCHIVED":
    case "DELETED":
    case "COMPLETED":            return "completed";
    default:                     return "in_review";
  }
}

// Pauses or resumes a whole campaign (cascades to its ad sets + ads). Uses SYS_TOKEN.
export async function setCampaignStatus(externalCampaignId: string, status: "PAUSED" | "ACTIVE"): Promise<void> {
  await graph(`${externalCampaignId}`, "POST", { status });
}

// Reads an ad's live effective_status. Uses SYS_TOKEN.
export async function getAdEffectiveStatus(adId: string): Promise<string | null> {
  try {
    const d = await graph<{ effective_status?: string }>(`${adId}?fields=effective_status`);
    return d.effective_status ?? null;
  } catch { return null; }
}

// Reads a campaign's aggregate insights (lifetime). Returns zeros if nothing has
// been delivered yet. Uses SYS_TOKEN.
export async function getCampaignInsights(externalCampaignId: string): Promise<AdInsights> {
  const empty: AdInsights = { reach: 0, impressions: 0, clicks: 0, spendUsd: 0, cpm: 0, ctr: 0 };
  try {
    const d = await graph<{ data?: Array<Record<string, string>> }>(
      `${externalCampaignId}/insights?fields=reach,impressions,clicks,spend,cpm,ctr&date_preset=maximum`
    );
    const r = d.data?.[0];
    if (!r) return empty;
    const n = (v?: string) => Math.round(Number(v || 0) * 100) / 100;
    return {
      reach: Number(r.reach || 0), impressions: Number(r.impressions || 0), clicks: Number(r.clicks || 0),
      spendUsd: n(r.spend), cpm: n(r.cpm), ctr: n(r.ctr),
    };
  } catch { return empty; }
}

// ── Post ID extraction ────────────────────────────────────────────────────────

export function extractPostId(postUrl: string): string | null {
  const decoded = decodeURIComponent(postUrl);

  // /posts/123456
  const postsMatch = decoded.match(/\/posts\/(\d+)/);
  if (postsMatch) return postsMatch[1];

  // /videos/123456
  const videoMatch = decoded.match(/\/videos\/(\d+)/);
  if (videoMatch) return videoMatch[1];

  // story_fbid=123456
  const storyMatch = decoded.match(/story_fbid=(\d+)/);
  if (storyMatch) return storyMatch[1];

  // fbid=123456 (photo/video)
  const fbidMatch = decoded.match(/fbid=(\d+)/);
  if (fbidMatch) return fbidMatch[1];

  // /photos/.../123456 or /photos/123456
  const photoMatch = decoded.match(/\/photos\/(?:.*\/)?(\d+)/);
  if (photoMatch) return photoMatch[1];

  return null;
}

// ── Campaign Creation ────────────────────────────────────────────────────────

// Facebook ad objectives (ODAX). Each maps to a campaign objective + ad-set
// optimization goal + delivery destination. `engagement` is the safe default and
// preserves the original post-boost behaviour; the others unlock the same goals
// the Facebook "Boost post" flow offers.
export type AdObjective =
  | "engagement" | "messages" | "traffic" | "calls" | "video_views" | "awareness" | "page_likes";

export const OBJECTIVE_CONFIG: Record<AdObjective, {
  campaignObjective: string;
  optimizationGoal:  string;
  destinationType?:  string;
  needsPromotedPage?: boolean;
  pageLikes?:        boolean; // promotes the Page itself, not a post
}> = {
  engagement:  { campaignObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "POST_ENGAGEMENT", destinationType: "ON_POST" },
  messages:    { campaignObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "CONVERSATIONS",  destinationType: "MESSENGER",  needsPromotedPage: true },
  calls:       { campaignObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "QUALITY_CALL",   destinationType: "PHONE_CALL", needsPromotedPage: true },
  traffic:     { campaignObjective: "OUTCOME_TRAFFIC",    optimizationGoal: "LINK_CLICKS" },
  video_views: { campaignObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "THRUPLAY",       destinationType: "ON_POST" },
  awareness:   { campaignObjective: "OUTCOME_AWARENESS",  optimizationGoal: "REACH" },
  page_likes:  { campaignObjective: "OUTCOME_ENGAGEMENT", optimizationGoal: "PAGE_LIKES",     needsPromotedPage: true, pageLikes: true },
};

// Manual placements → Meta publisher_platforms values.
export type Placement = "facebook" | "instagram" | "messenger" | "audience_network";

interface BoostParams {
  pageId:       string;
  postId:       string;
  pageToken:    string;
  budgetUsd?:   number; // preferred — the campaign stores the USD ad budget
  budgetLyd?:   number; // legacy fallback (older campaigns) — converted via LYD_TO_USD
  durationDays: number;
  campaignName: string;
  targeting?:   Record<string, unknown>;
  objective?:        AdObjective;   // default "engagement"
  placements?:       Placement[];   // omit/empty ⇒ Advantage+ automatic placements
  advantageAudience?: boolean;      // Advantage+ audience (targeting expansion) on/off
  specialAdCategory?: string;       // "HOUSING" | "EMPLOYMENT" | "CREDIT" | "ISSUES_ELECTIONS_POLITICS"
  targetingB?:       Record<string, unknown>; // A/B split test — second audience
  adText?:           string;        // page_likes: the promo caption on the Page ad
  pagePicture?:      string;        // page_likes: image URL for the Page ad creative
  continuous?:       boolean;       // open-ended: daily budget, no end time (wallet debited daily)
}

interface BoostResult {
  campaignId: string;
  adsetId:    string;
  adId:       string;
  variantB?:  { adsetId: string; adId: string };
}

export async function boostPost(params: BoostParams): Promise<BoostResult> {
  const budgetUsd = params.budgetUsd ?? (params.budgetLyd ?? 0) / LYD_TO_USD;
  // Meta expects budgets in cents. Continuous campaigns carry a DAILY budget and
  // no end time (they run until paused, wallet debited daily); fixed campaigns
  // carry a lifetime budget spread over the chosen days.
  const budgetCents = Math.round(budgetUsd * 100);
  const startTime = Math.floor(Date.now() / 1000) + 60; // 1 min from now
  const endTime   = params.continuous ? undefined : startTime + params.durationDays * 86400;

  const obj = OBJECTIVE_CONFIG[params.objective ?? "engagement"] ?? OBJECTIVE_CONFIG.engagement;

  // 1) Campaign
  const campaign = await graph<{ id: string }>(
    `${AD_ACCOUNT}/campaigns`,
    "POST",
    {
      name:                  params.campaignName,
      // ODAX objective — driven by the chosen goal (Meta deprecated the legacy
      // POST_ENGAGEMENT campaign objective; goals now live under OUTCOME_* with
      // the ad set carrying the matching optimization_goal).
      objective:             obj.campaignObjective,
      status:                "ACTIVE",
      special_ad_categories: params.specialAdCategory ? [params.specialAdCategory] : [],
      // Budget lives on the ad set (not the campaign). Meta now *requires* this
      // flag to be explicit when campaign budget optimization is off — omitting
      // it fails campaign creation with "Must specify True or False in
      // is_adset_budget_sharing_enabled field".
      is_adset_budget_sharing_enabled: false,
    }
  );

  // 2) AdSet(s)
  const t = (params.targeting ?? {}) as Record<string, unknown>;

  // Turn a raw targeting object into a Meta-ready one: age defaults, geo
  // normalization (Meta rejects a country AND a city/pin inside it — target the
  // specifics alone, otherwise the whole of Libya), manual placements, and the
  // Advantage+ audience flag. Applied to each A/B variant identically.
  function finalizeTargeting(raw: Record<string, unknown>): Record<string, unknown> {
    const g = (raw.geo_locations ?? {}) as Record<string, unknown>;
    const gCities  = Array.isArray(g.cities)  && g.cities.length  > 0;
    const gRegions = Array.isArray(g.regions) && g.regions.length > 0;
    const gCustom  = Array.isArray(g.custom_locations) && g.custom_locations.length > 0;
    const gLoc = gCities || gRegions || gCustom
      ? (() => { const { countries: _drop, ...rest } = g; void _drop; return rest; })()
      : { countries: ["LY"], ...g };
    const out: Record<string, unknown> = { age_min: 18, age_max: 65, ...raw, geo_locations: gLoc };
    if (Array.isArray(params.placements) && params.placements.length > 0) out.publisher_platforms = params.placements;
    out.targeting_automation = { advantage_audience: params.advantageAudience ? 1 : 0 };
    return out;
  }

  // 3) Creative — a Page-like ad promotes the Page itself (CTA "Like Page");
  // every other objective references the existing page post.
  const creativeBody = obj.pageLikes
    ? {
        name: "PageLikeCreative",
        object_story_spec: {
          page_id: params.pageId,
          link_data: {
            message: params.adText || "",
            link: `https://www.facebook.com/${params.pageId}`,
            ...(params.pagePicture ? { picture: params.pagePicture } : {}),
            call_to_action: { type: "LIKE_PAGE", value: { page: params.pageId } },
          },
        },
      }
    : { name: "Creative", object_story_id: `${params.pageId}_${params.postId}` };
  const creative = await graph<{ id: string }>(`${AD_ACCOUNT}/adcreatives`, "POST", creativeBody);

  async function makeAdSet(rawTargeting: Record<string, unknown>, budget: number, label: string): Promise<string> {
    const body: Record<string, unknown> = {
      name:              `AdSet-${params.pageId}-${label}`,
      campaign_id:       campaign.id,
      start_time:        startTime,
      billing_event:     "IMPRESSIONS",
      optimization_goal: obj.optimizationGoal,
      bid_strategy:      "LOWEST_COST_WITHOUT_CAP",
      targeting:         finalizeTargeting(rawTargeting),
      status:            "ACTIVE",
      pacing_type:       ["standard"],
    };
    if (params.continuous) {
      body.daily_budget = budget;           // runs until paused
    } else {
      body.lifetime_budget = budget;
      body.end_time        = endTime;
    }
    if (obj.destinationType)   body.destination_type = obj.destinationType;
    if (obj.needsPromotedPage) body.promoted_object   = { page_id: params.pageId };
    const as = await graph<{ id: string }>(`${AD_ACCOUNT}/adsets`, "POST", body);
    return as.id;
  }

  async function makeAd(adsetId: string, label: string): Promise<string> {
    const a = await graph<{ id: string }>(`${AD_ACCOUNT}/ads`, "POST", {
      name: `Ad-${label}`, adset_id: adsetId, creative: { creative_id: creative.id }, status: "ACTIVE",
    });
    return a.id;
  }

  // A/B split test — two ad sets (audience A vs B) under one campaign, budget
  // split evenly. Meta delivers to whichever audience performs better.
  const hasB = params.targetingB && Object.keys(params.targetingB).length > 0;
  if (hasB) {
    const half = Math.round(budgetCents / 2);
    const adsetA = await makeAdSet(t, half, "A");
    const adsetB = await makeAdSet(params.targetingB as Record<string, unknown>, budgetCents - half, "B");
    const adA = await makeAd(adsetA, "A");
    const adB = await makeAd(adsetB, "B");
    return { campaignId: campaign.id, adsetId: adsetA, adId: adA, variantB: { adsetId: adsetB, adId: adB } };
  }

  const adsetId = await makeAdSet(t, budgetCents, "A");
  const adId    = await makeAd(adsetId, "A");
  return { campaignId: campaign.id, adsetId, adId };
}
