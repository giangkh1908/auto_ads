import AdsAccount from "../models/ads/adsAccount.model.js";
import {
  fetchAccountInsights,
  saveInsightsToAdPerformance,
} from "./fbAdsService.js";

function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? String(accountId) : `act_${accountId}`;
  const withoutPrefix = hasPrefix
    ? String(accountId).substring(4)
    : String(accountId);
  return { withPrefix, withoutPrefix };
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function buildDefaultTimeRange() {
  const today = new Date();
  const since = new Date(today);
  since.setDate(since.getDate() - 2);
  return {
    since: formatDate(since),
    until: formatDate(today),
  };
}

export async function syncAdPerformanceData(accountExternalId, options = {}) {
  if (!accountExternalId) {
    throw new Error(
      "accountExternalId is required to sync ad performance data"
    );
  }

  const { withPrefix, withoutPrefix } = normalizeAccountPair(accountExternalId);

  const account = await AdsAccount.findOne({
    external_id: { $in: [withPrefix, withoutPrefix] },
    status: "ACTIVE",
  }).populate({ path: "shop_admin_id", select: "+facebookAccessToken" });

  if (!account) {
    throw new Error(`Active ads account not found for ${accountExternalId}`);
  }

  const accessToken = account.shop_admin_id?.facebookAccessToken;
  if (!accessToken) {
    throw new Error(
      `Missing Facebook access token for account ${accountExternalId}`
    );
  }

  const timeRange = options.timeRange || buildDefaultTimeRange();

  try {
    const insightsOptions = {
      level: "ad",
      needActions: true,
      actionBreakdowns: "action_type,action_destination",
      timeRange,
      ...options,
    };

    const insightsData = await fetchAccountInsights(
      accessToken,
      account.external_id,
      insightsOptions
    );

    if (!Array.isArray(insightsData) || insightsData.length === 0) {
      return {
        rateLimitReached: false,
        fetched: 0,
        synced: 0,
        skipped: 0,
      };
    }

    const saveResult = await saveInsightsToAdPerformance(
      insightsData,
      account._id.toString()
    );

    return {
      rateLimitReached: false,
      fetched: insightsData.length,
      synced: saveResult?.saved || 0,
      skipped: saveResult?.skipped || 0,
    };
  } catch (error) {
    const fbError = error?.response?.data?.error;
    if (fbError?.code === 17 || fbError?.error_subcode === 2446079) {
      return {
        rateLimitReached: true,
        fetched: 0,
        synced: 0,
        skipped: 0,
      };
    }
    throw error;
  }
}
