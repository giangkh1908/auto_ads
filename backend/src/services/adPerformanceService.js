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
  const until = new Date(today);
  until.setDate(until.getDate());

  const since = new Date(until);
  since.setDate(since.getDate() - 14);

  return {
    since: formatDate(since),
    until: formatDate(until),
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
      timeIncrement: 1, // ✅ FIX: Phải là NUMBER, không phải string
      needActions: true,
      actionBreakdowns: "action_type,action_destination",
      timeRange,
      ...options,
    };

    // ✅ LOG: Verify params trước khi gọi API
    console.log('[adPerformanceService] 🔍 Calling fetchAccountInsights with:', {
      accountId: account.external_id,
      timeIncrement: insightsOptions.timeIncrement,
      timeRange: insightsOptions.timeRange,
      level: insightsOptions.level
    });

    const insightsData = await fetchAccountInsights(
      accessToken,
      account.external_id,
      insightsOptions
    );

    // ✅ LOG: Kiểm tra kết quả nhận được
    console.log(`[adPerformanceService] 📦 Received ${insightsData?.length || 0} insights from Facebook API`);

    if (!Array.isArray(insightsData) || insightsData.length === 0) {
      console.warn(`[adPerformanceService] ⚠️ No insights data from Facebook for ${accountExternalId}`, {
        timeRange,
        reason: 'Facebook API returned empty array - possible causes: no ads running in date range, access token expired, or rate limit reached'
      });
      
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
