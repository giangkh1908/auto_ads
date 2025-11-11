import AdsAccount from "../models/ads/adsAccount.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";
import AdPerformance from "../models/ads/adPerformance.model.js";
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

    // Lưu insights data (nếu có)
    let saveResult = { saved: 0, skipped: 0 };
    if (Array.isArray(insightsData) && insightsData.length > 0) {
      saveResult = await saveInsightsToAdPerformance(
        insightsData,
        account._id.toString()
      );
    } else {
      console.warn(`[adPerformanceService] ⚠️ No insights data from Facebook for ${accountExternalId}`, {
        timeRange,
        reason: 'Facebook API returned empty array - possible causes: no ads running in date range, access token expired, or rate limit reached'
      });
    }

    // ✅ Tạo records với giá trị 0 cho các ads chưa có số liệu
    const zeroRecordsResult = await createZeroPerformanceRecords(
      account._id.toString(),
      timeRange
    );

    return {
      rateLimitReached: false,
      fetched: insightsData?.length || 0,
      synced: saveResult?.saved || 0,
      skipped: saveResult?.skipped || 0,
      zeroRecordsCreated: zeroRecordsResult?.created || 0,
    };
  } catch (error) {
    const fbError = error?.response?.data?.error;
    if (fbError?.code === 17 || fbError?.error_subcode === 2446079) {
      return {
        rateLimitReached: true,
        fetched: 0,
        synced: 0,
        skipped: 0,
        zeroRecordsCreated: 0,
      };
    }
    throw error;
  }
}

/**
 * Tạo AdPerformance records với giá trị 0 cho các ads chưa có số liệu
 * @param {string} accountId - MongoDB _id của AdsAccount
 * @param {Object} timeRange - { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD' }
 * @returns {Promise<{created: number}>}
 */
async function createZeroPerformanceRecords(accountId, timeRange) {
  try {
    const account = await AdsAccount.findById(accountId);
    if (!account) {
      console.warn(`[adPerformanceService] ⚠️ Account ${accountId} not found, skipping zero records creation`);
      return { created: 0 };
    }

    // Lấy tất cả ads ACTIVE/PAUSED của account
    // ✅ FIX: Populate set_id với nested populate campaign_id (vì Ads không có campaign_id trực tiếp)
    const allAds = await Ads.find({
      account_id: accountId,
      status: { $in: ['ACTIVE', 'PAUSED'] }, // Bao gồm cả PAUSED để track
    }).populate({
      path: 'set_id',
      populate: {
        path: 'campaign_id' // Populate campaign_id từ AdsSet
      }
    });

    if (allAds.length === 0) {
      console.log(`[adPerformanceService] ℹ️ No ads found for account ${accountId}, skipping zero records creation`);
      return { created: 0 };
    }

    // Tạo danh sách các ngày trong timeRange
    const sinceDate = new Date(`${timeRange.since}T00:00:00Z`);
    const untilDate = new Date(`${timeRange.until}T00:00:00Z`);
    const dates = [];
    const currentDate = new Date(sinceDate);
    while (currentDate <= untilDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Lấy tất cả ad_ids đã có performance data trong timeRange
    const existingPerformance = await AdPerformance.find({
      account_id: accountId,
      date: {
        $gte: sinceDate,
        $lte: untilDate
      }
    }).select('ads_id date').lean();

    // Tạo Set để check nhanh: "adId_date" => true
    const existingKeys = new Set(
      existingPerformance.map(p => 
        `${p.ads_id.toString()}_${p.date.toISOString().split('T')[0]}`
      )
    );

    // Tạo bulk operations cho các records chưa tồn tại
    const bulkOps = [];
    let created = 0;

    for (const ad of allAds) {
      const adset = ad.set_id; // Đã được populate
      // ✅ FIX: Lấy campaign_id từ adset (vì Ads không có campaign_id trực tiếp)
      const campaign = adset?.campaign_id || null;

      for (const date of dates) {
        const key = `${ad._id.toString()}_${date.toISOString().split('T')[0]}`;
        
        // Chỉ tạo nếu chưa có record
        if (!existingKeys.has(key)) {
          const performanceData = {
            ads_id: ad._id,
            set_id: adset?._id || null,
            campaign_id: campaign?._id || null,
            account_id: accountId,
            external_account_id: account.external_id.replace('act_', ''),
            external_campaign_id: campaign?.external_id || null,
            external_adset_id: adset?.external_id || null,
            external_ad_id: ad.external_id || null,
            date: date,
            
            // Tất cả giá trị = 0 vì chưa có số liệu
            impressions: 0,
            reach: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            frequency: 0,
            
            cpc: null,
            cpm: null,
            ctr: null,
            conversion_rate: null,
            cost_per_conversion: null,
            
            campaign_name: campaign?.name || null,
            adset_name: adset?.name || null,
            ad_name: ad.name || null,
            page_name: adset?.page_name || campaign?.page_name || null,
            
            daily_budget: adset?.daily_budget 
              ? Number(adset.daily_budget) / 100 
              : (campaign?.daily_budget ? Number(campaign.daily_budget) / 100 : null),
            daily_spend_rate: null,
            total_amount_spent: 0,
            
            link_clicks: 0,
            link_cpc: null,
            link_ctr: null,
            
            website_purchases: 0,
            website_purchase_roas: null,
            
            results: 0,
            cost_per_result: null,
            
            audience_reach_percentage: null,
          };

          bulkOps.push({
            updateOne: {
              filter: {
                ads_id: ad._id,
                date: date
              },
              update: {
                $set: performanceData,
                $setOnInsert: {
                  created_at: new Date()
                }
              },
              upsert: true
            }
          });

          created++;
        }
      }
    }

    // Thực hiện bulk write
    if (bulkOps.length > 0) {
      console.log(`[adPerformanceService] 💾 Creating ${bulkOps.length} zero-performance records for ads without data...`);
      await AdPerformance.bulkWrite(bulkOps);
      console.log(`[adPerformanceService] ✅ Created ${created} zero-performance records`);
    } else {
      console.log(`[adPerformanceService] ℹ️ All ads already have performance records, no zero records needed`);
    }

    return { created };
  } catch (err) {
    console.error('[adPerformanceService] ❌ Error creating zero performance records:', err.message);
    return { created: 0 };
  }
}
