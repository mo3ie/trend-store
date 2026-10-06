// TikTok Marketing API v1.3 — campaign creation, targeting lookups and reporting.
//
// The advertiser OAuth half lives in `tiktokAds.ts`; this file is what that token is
// FOR. It is the TikTok counterpart of `boostPost` in `services/meta.ts`, and it
// deliberately mirrors that function's shape — one call in, three objects out
// (campaign → ad group → ad) — so the paid-campaign flow is identical on both
// platforms and only this adapter knows the difference.
//
// Three TikTok facts drive almost every design choice below:
//
//  1. `advertiser_id` is required on EVERY call. Meta derives the ad account from the
//     Page; TikTok does not, so the chosen advertiser is stored on the campaign row.
//  2. Minimum spend is a hard platform floor, not a preference: USD 20 per day per ad
//     group (so a lifetime budget must be at least 20 × days). A campaign under it is
//     rejected by TikTok at creation, which is why the floor is validated by us
//     first, with a message the advertiser can act on.
//  3. Promoting an existing organic video is a "Spark Ad": it needs the creator's
//     IDENTITY plus the video's `tiktok_item_id`. There is no "boost this URL" call.
//
// SERVER ONLY.

import { TikTokAdsError } from "@/services/tiktokAds";

const DEFAULT_BASE = "https://business-api.tiktok.com/open_api/v1.3";

function apiBase(): string {
  return (process.env.TIKTOK_API_BASE || "").replace(/^﻿/, "").trim() || DEFAULT_BASE;
}

/**
 * TikTok's minimum ad-group spend, in USD per day. A platform rule, not ours — a
 * campaign below it fails at creation. Overridable only so a change on TikTok's side
 * does not need a deploy.
 */
export const MIN_DAILY_USD = Number(process.env.TIKTOK_ADS_MIN_DAILY_USD) || 20;

/** The lifetime floor for a run of `days` days. */
export function minTotalUsd(days: number): number {
  return MIN_DAILY_USD * Math.max(1, Number(days) || 1);
}

interface Envelope<T> { code: number; message?: string; request_id?: string; data?: T }

async function call<T>(
  method: "GET" | "POST",
  path: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<T> {
  let url = `${apiBase()}/${path}`;
  const init: RequestInit = {
    method,
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    cache: "no-store",
  };

  if (method === "GET") {
    // TikTok takes array/object GET parameters as JSON-encoded strings.
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    const q = qs.toString();
    if (q) url += `?${q}`;
  } else {
    init.body = JSON.stringify(payload);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new TikTokAdsError("network_error", "TikTok request failed", path);
  }

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new TikTokAdsError("bad_response", "TikTok returned a non-JSON response", path, res.status);
  }

  // TikTok reports failure as a non-zero `code` inside an HTTP 200 body.
  if (json.code !== 0) {
    throw new TikTokAdsError(
      "api_error",
      json.message || `TikTok API error (code ${json.code})`,
      path, res.status, json.code, json.request_id,
    );
  }
  return (json.data ?? ({} as T));
}

// ── Advertiser accounts ───────────────────────────────────────────────────────

export interface AdvertiserInfo {
  advertiserId: string;
  name: string;
  currency: string;
  status: string;
  timezone: string;
}

/** The ad accounts a granted token can spend from, with their display details. */
export async function getAdvertisers(token: string, advertiserIds: string[]): Promise<AdvertiserInfo[]> {
  if (!advertiserIds.length) return [];
  const data = await call<{ list?: Array<Record<string, unknown>> }>(
    "GET", "advertiser/info/", token, { advertiser_ids: advertiserIds },
  );
  return (data.list || []).map((a) => ({
    advertiserId: String(a.advertiser_id ?? ""),
    name: String(a.name ?? a.advertiser_name ?? "TikTok Ads"),
    currency: String(a.currency ?? "USD"),
    status: String(a.status ?? ""),
    timezone: String(a.timezone ?? ""),
  })).filter((a) => a.advertiserId);
}

// ── Identities (required for Spark Ads) ───────────────────────────────────────

export interface AdIdentity { identityId: string; identityType: string; displayName: string; avatarUrl: string | null }

/**
 * The identities this advertiser may post an ad as.
 *
 * A Spark Ad runs under the identity of the account that owns the organic video, so
 * without one there is nothing to promote — an advertiser who has not linked their
 * TikTok account to Ads Manager gets an empty list, and the create screen says so
 * rather than failing at launch.
 */
export async function getIdentities(token: string, advertiserId: string): Promise<AdIdentity[]> {
  const data = await call<{ identity_list?: Array<Record<string, unknown>> }>(
    "GET", "identity/get/", token, { advertiser_id: advertiserId },
  );
  return (data.identity_list || []).map((i) => ({
    identityId: String(i.identity_id ?? ""),
    identityType: String(i.identity_type ?? "TT_USER"),
    displayName: String(i.display_name ?? "TikTok"),
    avatarUrl: (i.profile_image_url as string) || (i.image_uri as string) || null,
  })).filter((i) => i.identityId);
}

/**
 * The organic videos of an identity that are eligible to be promoted as Spark Ads.
 * Note this is the ADS-side video list — not `/business/video/list/` from the organic
 * flow, which returns ids the Marketing API will not accept.
 */
export async function getSparkVideos(
  token: string, advertiserId: string, identityId: string, identityType = "TT_USER",
): Promise<Array<{ itemId: string; caption: string; thumbnail: string | null }>> {
  const data = await call<{ list?: Array<Record<string, unknown>> }>(
    "GET", "identity/video/get/", token,
    { advertiser_id: advertiserId, identity_id: identityId, identity_type: identityType, page_size: 30 },
  );
  return (data.list || []).map((v) => ({
    itemId: String(v.item_id ?? v.tiktok_item_id ?? ""),
    caption: String(v.text ?? v.caption ?? ""),
    thumbnail: (v.cover_url as string) || (v.poster_url as string) || null,
  })).filter((v) => v.itemId);
}

// ── Targeting lookups ─────────────────────────────────────────────────────────

export interface GeoLocation { id: string; name: string; parent: string | null; level: string }

/**
 * Searchable targeting locations. TikTok returns the whole tree for a country rather
 * than offering a search endpoint, so the filtering is done here — the equivalent of
 * Meta's `searchCities`, which does search server-side.
 */
export async function searchLocations(
  token: string, advertiserId: string, query: string, objective = "REACH",
): Promise<GeoLocation[]> {
  const data = await call<{ region_info?: Array<Record<string, unknown>> }>(
    "GET", "tool/region/", token,
    { advertiser_id: advertiserId, objective_type: objective, placements: ["PLACEMENT_TIKTOK"] },
  );
  const q = query.trim().toLowerCase();
  const all = (data.region_info || []).map((r) => ({
    id: String(r.location_id ?? ""),
    name: String(r.name ?? ""),
    parent: (r.parent_name as string) || (r.region_name as string) || null,
    level: String(r.level ?? ""),
  })).filter((r) => r.id && r.name);

  if (!q) return all.filter((r) => r.level === "COUNTRY").slice(0, 50);
  return all.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 50);
}

export interface InterestCategory { id: string; name: string; parent: string | null }

/** Detailed-targeting interest categories — the counterpart of Meta's `searchInterests`. */
export async function searchInterestCategories(
  token: string, advertiserId: string, query: string,
): Promise<InterestCategory[]> {
  const data = await call<{ interest_categories?: Array<Record<string, unknown>> }>(
    "GET", "tool/interest_category/", token,
    { advertiser_id: advertiserId, placements: ["PLACEMENT_TIKTOK"], version: 2 },
  );
  const q = query.trim().toLowerCase();

  // The tree arrives nested; flatten it so a child is findable by its own name.
  const out: InterestCategory[] = [];
  const walk = (nodes: Array<Record<string, unknown>>, parent: string | null) => {
    for (const n of nodes) {
      const id = String(n.interest_category_id ?? n.id ?? "");
      const name = String(n.interest_category_name ?? n.name ?? "");
      if (id && name) out.push({ id, name, parent });
      const kids = n.sub_interest_categories ?? n.children;
      if (Array.isArray(kids)) walk(kids as Array<Record<string, unknown>>, name);
    }
  };
  walk(data.interest_categories || [], null);

  if (!q) return out.slice(0, 60);
  return out.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 60);
}

// ── Objective mapping ─────────────────────────────────────────────────────────

/**
 * The store's objective vocabulary translated to TikTok's.
 *
 * The customer-facing names are shared with the Facebook flow so the two create
 * screens read the same, but each platform's objective, optimisation goal and billing
 * event are its own — picking Meta's values here would be rejected, and picking a
 * mismatched triple (say REACH optimised for CLICK) is the most common cause of a
 * campaign that spends with no result.
 *
 * `promotionType` FOLLOWERS is TikTok's answer to Facebook's page-likes ad: it
 * promotes the profile, so it takes no landing page.
 */
export const TIKTOK_OBJECTIVES = {
  reach:       { objective: "REACH",       goal: "REACH",        billing: "CPM",  promotionType: "WEBSITE"   },
  video_views: { objective: "VIDEO_VIEWS", goal: "VIDEO_VIEW",   billing: "CPV",  promotionType: "WEBSITE"   },
  traffic:     { objective: "TRAFFIC",     goal: "CLICK",        billing: "CPC",  promotionType: "WEBSITE"   },
  engagement:  { objective: "ENGAGEMENT",  goal: "ENGAGED_VIEW", billing: "CPV",  promotionType: "WEBSITE"   },
  followers:   { objective: "ENGAGEMENT",  goal: "FOLLOWERS",    billing: "OCPM", promotionType: "FOLLOWERS" },
} as const;

export type TikTokObjectiveKey = keyof typeof TIKTOK_OBJECTIVES;

export const TIKTOK_OBJECTIVE_KEYS = Object.keys(TIKTOK_OBJECTIVES) as TikTokObjectiveKey[];

export function resolveObjective(key: string | null | undefined) {
  return TIKTOK_OBJECTIVES[(key || "reach") as TikTokObjectiveKey] || TIKTOK_OBJECTIVES.reach;
}

/**
 * Ages as TikTok wants them: fixed buckets, not a min/max pair.
 *
 * A bucket is included when it overlaps the advertiser's range at all, because
 * dropping a partially covered bucket would silently shrink the audience the
 * advertiser asked for (an 18–30 request must still reach 25-34).
 */
export function ageGroupsFor(min: number, max: number): string[] {
  const buckets: Array<[string, number, number]> = [
    ["AGE_13_17", 13, 17], ["AGE_18_24", 18, 24], ["AGE_25_34", 25, 34],
    ["AGE_35_44", 35, 44], ["AGE_45_54", 45, 54], ["AGE_55_100", 55, 100],
  ];
  const lo = Math.max(13, Math.min(min || 18, max || 45));
  const hi = Math.min(100, Math.max(min || 18, max || 45));
  const picked = buckets.filter(([, a, b]) => b >= lo && a <= hi).map(([name]) => name);
  return picked.length ? picked : ["AGE_18_24", "AGE_25_34"];
}

export function genderFor(g: string | null | undefined): string {
  if (g === "male") return "GENDER_MALE";
  if (g === "female") return "GENDER_FEMALE";
  return "GENDER_UNLIMITED";
}

// ── Launching a campaign ──────────────────────────────────────────────────────

export interface TikTokTargeting {
  ageMin?: number; ageMax?: number; gender?: string;
  /** TikTok location ids. Empty means the advertiser's whole country. */
  locationIds?: string[];
  interestIds?: string[];
  languages?: string[];
}

export interface LaunchInput {
  token: string;
  advertiserId: string;
  campaignName: string;
  objective?: string | null;
  /** Total spend for the whole run, in USD (per-day when `continuous`). */
  budgetUsd: number;
  durationDays: number;
  /** Open-ended: a daily budget with no end date, debited daily from the wallet. */
  continuous?: boolean;
  identityId: string;
  identityType?: string;
  /** The organic video to promote as a Spark Ad. */
  itemId?: string | null;
  adText?: string | null;
  landingPageUrl?: string | null;
  targeting?: TikTokTargeting | null;
  /**
   * The B side of a head-to-head test: a SECOND organic video, same audience.
   *
   * Facebook's A/B pits two audiences against each other. On TikTok the creative is
   * what decides delivery — the same offer on a different clip can differ by an order
   * of magnitude — so the useful question here is "which of my videos performs?",
   * not "which age bracket?". The budget is split evenly between the two ad groups.
   */
  itemIdB?: string | null;
}

export interface LaunchResult {
  campaignId: string; adgroupId: string; adId: string;
  /** Present only for a two-video test. */
  adgroupB?: string; adB?: string;
}

/** TikTok wants "YYYY-MM-DD HH:mm:ss", not an ISO string. */
function ttTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Creates campaign → ad group → ad for one paid campaign.
 *
 * The three objects are created in that order because each needs the previous one's
 * id. If a later step fails, what already exists is PAUSED rather than left live:
 * an advertiser whose ad never got created must not be charged for an empty ad group.
 */
export async function launchCampaign(input: LaunchInput): Promise<LaunchResult> {
  const {
    token, advertiserId, campaignName, budgetUsd, durationDays, continuous,
    identityId, identityType = "TT_USER", itemId, itemIdB, adText, landingPageUrl, targeting,
  } = input;

  const obj = resolveObjective(input.objective);
  const days = Math.max(1, Number(durationDays) || 1);

  // A head-to-head test runs two ad groups, and TikTok's minimum applies to EACH of
  // them — so a legal $60 campaign split in two becomes two illegal $30 groups. The
  // floor is therefore checked against the per-group share, not the total.
  const groups = itemIdB ? 2 : 1;
  const perGroupBudget = Math.floor(budgetUsd / groups);

  const floor = continuous ? MIN_DAILY_USD : minTotalUsd(days);
  if (perGroupBudget < floor) {
    throw new TikTokAdsError(
      "below_minimum",
      groups === 2
        ? `A two-video test needs at least $${floor * 2} (TikTok's $${MIN_DAILY_USD}/day minimum applies to each video)`
        : continuous
          ? `TikTok requires at least $${MIN_DAILY_USD} per day`
          : `TikTok requires at least $${floor} for ${days} days`,
    );
  }

  const campaign = await call<{ campaign_id?: string }>("POST", "campaign/create/", token, {
    advertiser_id: advertiserId,
    campaign_name: campaignName.slice(0, 500),
    objective_type: obj.objective,
    budget_mode: continuous ? "BUDGET_MODE_DAY" : "BUDGET_MODE_TOTAL",
    budget: budgetUsd,
  });
  const campaignId = String(campaign.campaign_id || "");
  if (!campaignId) throw new TikTokAdsError("no_campaign_id", "TikTok created no campaign id", "campaign/create/");

  const start = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes out: TikTok rejects a past start
  const end = new Date(start.getTime() + days * 86400000);

  const adgroupBody: Record<string, unknown> = {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    adgroup_name: `${campaignName.slice(0, 480)} — AG`,
    promotion_type: obj.promotionType,
    placement_type: "PLACEMENT_TYPE_NORMAL",
    placements: ["PLACEMENT_TIKTOK"],
    location_ids: targeting?.locationIds?.length ? targeting.locationIds : undefined,
    gender: genderFor(targeting?.gender),
    age_groups: ageGroupsFor(targeting?.ageMin ?? 18, targeting?.ageMax ?? 45),
    optimization_goal: obj.goal,
    billing_event: obj.billing,
    bid_type: "BID_TYPE_NO_BID",
    pacing: "PACING_MODE_SMOOTH",
    budget_mode: continuous ? "BUDGET_MODE_DAY" : "BUDGET_MODE_TOTAL",
    budget: perGroupBudget,
    schedule_type: continuous ? "SCHEDULE_FROM_NOW" : "SCHEDULE_START_END",
    schedule_start_time: ttTime(start),
    identity_id: identityId,
    identity_type: identityType,
    operation_status: "ENABLE",
  };
  if (!continuous) adgroupBody.schedule_end_time = ttTime(end);
  if (targeting?.interestIds?.length) adgroupBody.interest_category_ids = targeting.interestIds;
  if (targeting?.languages?.length) adgroupBody.languages = targeting.languages;
  // A profile-growth ad has no destination; every other objective needs one.
  if (obj.promotionType === "WEBSITE") {
    adgroupBody.landing_page_url = landingPageUrl || "https://www.trendstore-ly.com";
  }

  /**
   * One side of the test: an ad group plus its ad, for one video.
   *
   * Both sides are identical except the clip, which is the only way the comparison
   * means anything — if the audiences differed too, a win would not say which
   * variable caused it.
   */
  const makeSide = async (video: string | null | undefined, suffix: string) => {
    const body = { ...adgroupBody, adgroup_name: `${campaignName.slice(0, 460)} — ${suffix}` };
    const ag = await call<{ adgroup_id?: string }>("POST", "adgroup/create/", token, body);
    const groupId = String(ag.adgroup_id || "");
    if (!groupId) throw new TikTokAdsError("no_adgroup_id", "TikTok created no ad group id", "adgroup/create/");

    const creative: Record<string, unknown> = {
      ad_name: `${campaignName.slice(0, 460)} — ${suffix}`,
      identity_id: identityId,
      identity_type: identityType,
      ad_format: "SINGLE_VIDEO",
      ad_text: (adText || "").slice(0, 100) || undefined,
      call_to_action: obj.promotionType === "FOLLOWERS" ? "FOLLOW_NOW" : "SHOP_NOW",
    };
    // Spark Ad: promote the existing organic video rather than uploading a creative.
    if (video) creative.tiktok_item_id = video;
    if (obj.promotionType === "WEBSITE") {
      creative.landing_page_url = landingPageUrl || "https://www.trendstore-ly.com";
    }

    const ad = await call<{ ad_ids?: string[]; creatives?: Array<{ ad_id?: string }> }>(
      "POST", "ad/create/", token,
      { advertiser_id: advertiserId, adgroup_id: groupId, creatives: [creative] },
    );
    const adId = String(ad.ad_ids?.[0] || ad.creatives?.[0]?.ad_id || "");
    if (!adId) throw new TikTokAdsError("no_ad_id", "TikTok created no ad id", "ad/create/");
    return { groupId, adId };
  };

  try {
    const a = await makeSide(itemId, "A");
    if (!itemIdB) return { campaignId, adgroupId: a.groupId, adId: a.adId };

    const b = await makeSide(itemIdB, "B");
    return { campaignId, adgroupId: a.groupId, adId: a.adId, adgroupB: b.groupId, adB: b.adId };
  } catch (e) {
    // Pause the whole campaign on any failure. A half-built test must not spend: an
    // ad group with no ad still accrues cost, and a one-sided "test" would report a
    // winner that never had an opponent.
    await pauseCampaign(token, advertiserId, campaignId).catch(() => {});
    throw e;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

async function setStatus(
  token: string, advertiserId: string, campaignId: string,
  status: "ENABLE" | "DISABLE" | "DELETE",
) {
  await call("POST", "campaign/status/update/", token, {
    advertiser_id: advertiserId, campaign_ids: [campaignId], operation_status: status,
  });
}

export const pauseCampaign  = (t: string, a: string, c: string) => setStatus(t, a, c, "DISABLE");
export const resumeCampaign = (t: string, a: string, c: string) => setStatus(t, a, c, "ENABLE");
export const deleteCampaign = (t: string, a: string, c: string) => setStatus(t, a, c, "DELETE");

/** Raises an existing campaign's daily budget — used when a continuous run is topped up. */
export async function updateCampaignBudget(
  token: string, advertiserId: string, campaignId: string, budgetUsd: number,
) {
  await call("POST", "campaign/update/", token, {
    advertiser_id: advertiserId, campaign_id: campaignId, budget: budgetUsd,
  });
}

// ── Reporting ─────────────────────────────────────────────────────────────────

export interface CampaignStats {
  reach: number; impressions: number; clicks: number; spendUsd: number;
  videoViews: number; status: string | null;
}

/**
 * Live numbers for one campaign.
 *
 * The lifetime report and the campaign's own status come from two different
 * endpoints, and the status is the one that tells an advertiser WHY nothing is
 * happening (in review, rejected, out of budget), so a missing report must not stop
 * us returning it.
 */
export async function getCampaignStats(
  token: string, advertiserId: string, campaignId: string,
): Promise<CampaignStats> {
  const [report, info] = await Promise.all([
    call<{ list?: Array<{ metrics?: Record<string, unknown> }> }>("GET", "report/integrated/get/", token, {
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: ["campaign_id"],
      metrics: ["spend", "impressions", "clicks", "reach", "video_play_actions"],
      filters: [{ field_name: "campaign_ids", filter_type: "IN", filter_value: [campaignId] }],
      lifetime: true,
      page_size: 1,
    }).catch(() => ({ list: [] as Array<{ metrics?: Record<string, unknown> }> })),
    call<{ list?: Array<Record<string, unknown>> }>("GET", "campaign/get/", token, {
      advertiser_id: advertiserId,
      filtering: { campaign_ids: [campaignId] },
      page_size: 1,
    }).catch(() => ({ list: [] as Array<Record<string, unknown>> })),
  ]);

  const m = report.list?.[0]?.metrics || {};
  const num = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const row = info.list?.[0];

  return {
    spendUsd:    num(m.spend),
    impressions: num(m.impressions),
    clicks:      num(m.clicks),
    reach:       num(m.reach),
    videoViews:  num(m.video_play_actions),
    status: row ? String(row.secondary_status ?? row.operation_status ?? "") || null : null,
  };
}

/**
 * TikTok's campaign status vocabulary mapped onto the store's own, which the
 * campaigns list already knows how to colour and label on the Facebook side.
 */
export function mapStatus(ttStatus: string | null): string | null {
  if (!ttStatus) return null;
  const s = ttStatus.toUpperCase();
  if (s.includes("DELETE")) return "completed";
  if (s.includes("REJECT") || s.includes("DISAPPROVE")) return "rejected";
  if (s.includes("AUDIT") || s.includes("REVIEW")) return "in_review";
  if (s.includes("NOT_START") || s.includes("SCHEDULE")) return "in_review";
  if (s.includes("TIME_DONE") || s.includes("FINISH")) return "completed";
  if (s.includes("BUDGET") || s.includes("BALANCE")) return "issues";
  if (s.includes("DISABLE") || s.includes("SUSPEND") || s.includes("PAUSE")) return "paused";
  if (s.includes("DELIVER_OK") || s.includes("ENABLE")) return "active";
  return null;
}
