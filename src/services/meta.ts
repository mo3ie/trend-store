// Meta Graph Marketing API service
// Handles: OAuth, Pages, Campaigns, AdSets, Ads

const META_VERSION = process.env.META_API_VERSION || "v19.0";
const BASE = `https://graph.facebook.com/${META_VERSION}`;
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID!; // e.g. "act_123456789"
const SYS_TOKEN = process.env.META_ACCESS_TOKEN!;    // system user long-lived token
const LYD_TO_USD = parseFloat(process.env.META_LYD_TO_USD_RATE || "5");

// ── Graph API helper ─────────────────────────────────────────────────────────

async function graph<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const t = token || SYS_TOKEN;
  const url = `${BASE}/${path}${method === "GET" ? `?access_token=${t}` : ""}`;
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
    client_id:    process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "",
    redirect_uri:  redirectUri,
    state,
    scope: "pages_manage_ads,pages_read_engagement,pages_show_list,ads_management",
    response_type: "code",
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id:     process.env.NEXT_PUBLIC_META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
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
  const data = await graph<{ data: MetaPage[] }>(
    "me/accounts?fields=id,name,picture,access_token",
    "GET",
    undefined,
    userToken
  );
  return data.data;
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
  budgetLyd:    number;
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
  const budgetUsd = params.budgetLyd / LYD_TO_USD;
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
      objective:             "POST_ENGAGEMENT",
      status:                "ACTIVE",
      special_ad_categories: [],
    }
  );

  // 2) AdSet
  const targeting = {
    geo_locations: { countries: ["LY"] },
    age_min: 18,
    age_max: 65,
    ...params.targeting,
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
