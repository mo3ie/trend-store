// Meta Graph Marketing API service
// Handles: OAuth, Pages, Campaigns, AdSets, Ads

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
    params.set("scope", "pages_manage_ads,pages_read_engagement,pages_show_list,ads_management");
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
  const data = await graph<{ data: Array<{
    id: string; message?: string; created_time: string; full_picture?: string; permalink_url?: string;
  }> }>(
    `me/published_posts?fields=id,message,created_time,full_picture,permalink_url&limit=${limit}`,
    "GET",
    undefined,
    pageToken
  );
  return (data.data || []).map((p) => ({
    id:           p.id,
    postId:       p.id.includes("_") ? p.id.split("_")[1] : p.id,
    message:      p.message || "",
    createdTime:  p.created_time,
    picture:      p.full_picture,
    permalinkUrl: p.permalink_url,
  }));
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

interface BoostParams {
  pageId:       string;
  postId:       string;
  pageToken:    string;
  budgetUsd?:   number; // preferred — the campaign stores the USD ad budget
  budgetLyd?:   number; // legacy fallback (older campaigns) — converted via LYD_TO_USD
  durationDays: number;
  campaignName: string;
  targeting?:   Record<string, unknown>;
}

interface BoostResult {
  campaignId: string;
  adsetId:    string;
  adId:       string;
}

export async function boostPost(params: BoostParams): Promise<BoostResult> {
  const budgetUsd = params.budgetUsd ?? (params.budgetLyd ?? 0) / LYD_TO_USD;
  // Meta expects lifetime_budget in cents
  const lifetimeBudget = Math.round(budgetUsd * 100);
  const startTime = Math.floor(Date.now() / 1000) + 60; // 1 min from now
  const endTime   = startTime + params.durationDays * 86400;

  // 1) Campaign
  const campaign = await graph<{ id: string }>(
    `${AD_ACCOUNT}/campaigns`,
    "POST",
    {
      name:                  params.campaignName,
      // ODAX objective (Meta deprecated the legacy POST_ENGAGEMENT campaign
      // objective; post-boost engagement now lives under OUTCOME_ENGAGEMENT
      // with the ad set optimizing for POST_ENGAGEMENT).
      objective:             "OUTCOME_ENGAGEMENT",
      status:                "ACTIVE",
      special_ad_categories: [],
      // Budget lives on the ad set (not the campaign). Meta now *requires* this
      // flag to be explicit when campaign budget optimization is off — omitting
      // it fails campaign creation with "Must specify True or False in
      // is_adset_budget_sharing_enabled field".
      is_adset_budget_sharing_enabled: false,
    }
  );

  // 2) AdSet
  const t = (params.targeting ?? {}) as Record<string, unknown>;
  const geo = (t.geo_locations ?? {}) as Record<string, unknown>;
  const targeting = {
    age_min: 18,
    age_max: 65,
    ...t,
    // Always keep Libya as the country; merge any selected cities on top.
    geo_locations: {
      countries: ["LY"],
      ...geo,
    },
  };

  const adset = await graph<{ id: string }>(
    `${AD_ACCOUNT}/adsets`,
    "POST",
    {
      name:              `AdSet-${params.pageId}`,
      campaign_id:       campaign.id,
      lifetime_budget:   lifetimeBudget,
      start_time:        startTime,
      end_time:          endTime,
      billing_event:     "IMPRESSIONS",
      optimization_goal: "POST_ENGAGEMENT",
      // Automatic (lowest-cost) bidding — without an explicit strategy this
      // account defaults to a bid-cap strategy and rejects the ad set with
      // "Bid amount or bid constraints required for bid strategy".
      bid_strategy:      "LOWEST_COST_WITHOUT_CAP",
      // The ad promotes engagement on the post itself; without ON_POST the ad
      // creation step treats the campaign as conversions and demands a tracking
      // pixel ("Tracking Pixel Required").
      destination_type:  "ON_POST",
      targeting,
      status:            "ACTIVE",
      pacing_type:       ["standard"],
    }
  );

  // 3) Creative — reference existing page post
  const creative = await graph<{ id: string }>(
    `${AD_ACCOUNT}/adcreatives`,
    "POST",
    {
      name:             "Creative",
      object_story_id:  `${params.pageId}_${params.postId}`,
    }
  );

  // 4) Ad
  const ad = await graph<{ id: string }>(
    `${AD_ACCOUNT}/ads`,
    "POST",
    {
      name:      "Ad",
      adset_id:  adset.id,
      creative:  { creative_id: creative.id },
      status:    "ACTIVE",
    }
  );

  return {
    campaignId: campaign.id,
    adsetId:    adset.id,
    adId:       ad.id,
  };
}
