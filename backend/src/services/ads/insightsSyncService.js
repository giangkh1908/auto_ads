import mongoose from "mongoose";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import Ads from "../../models/ads/ads.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdPerformance from "../../models/ads/adPerformance.model.js";
import { fetchLifetimeInsightsForAds, fetchLifetimeInsightsForAdsets, fetchLifetimeInsightsForCampaigns } from "../ads/fbAdsService.js";
import User from "../../models/user/user.model.js";
import redis from "../../config/redis.js";

const BATCH_SIZE = 500;

/**
 * Safely convert value to Number, returns null if NaN
 */
function safeNumber(value) {
  if (value === undefined || value === null || value === '' || value === '--') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Safely convert value to Number, returns 0 if NaN (for metrics that should default to 0)
 */
function safeNumberOrZero(value) {
  if (value === undefined || value === null || value === '' || value === '--') {
    return 0;
  }
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

async function getAccessTokenForAccount(account) {
  if (!account?.shop_admin_id) {
    return null;
  }
  const user = await User.findById(account.shop_admin_id).select("+facebookAccessToken").lean();
  return user?.facebookAccessToken || null;
}

/**
 * Normalize ngày về 00:00:00 Vietnam timezone (GMT+7)
 * Trả về Date object với ngày của Vietnam
 */
function normalizeToVietnamMidnight(date) {
  const d = new Date(date);
  const vietnamFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const vietnamDateStr = vietnamFormatter.format(d);
  return new Date(vietnamDateStr + 'T00:00:00.000Z');
}

/**
 * Updates Ads collection with insights fetched from Facebook
 */
async function updateAdsModelWithInsights(insights) {
  if (!insights || insights.length === 0) return;

  const bulkOps = insights.map((item) => ({
    updateOne: {
      filter: { external_id: item.ad_id },
      update: {
        $set: {
          insights: item,
          updated_at: new Date(),
        },
      },
    },
  }));

  if (bulkOps.length > 0) {
    try {
      const res = await Ads.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ Updated ${res.modifiedCount} Ads documents with insights`);
    } catch (err) {
      console.error("❌ Error updating Ads model:", err.message);
    }
  }
}

/**
 * Fetches and updates AdSets insights (LIFETIME) for the account
 */
async function syncAdSetsInsights(accessToken, accountExternalId) {
  try {
    const insightsData = await fetchLifetimeInsightsForAdsets(accessToken, accountExternalId);

    if (insightsData.length === 0) return;

    const bulkOps = insightsData
      .filter(item => item.adset_id)
      .map(item => ({
        updateOne: {
          filter: { external_id: item.adset_id },
          update: {
            $set: {
              insights: item,
              updated_at: new Date(),
            }
          }
        }
      }));

    if (bulkOps.length > 0) {
      const res = await AdsSet.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ Updated ${res.modifiedCount} AdSets with insights`);
    }
  } catch (err) {
    console.error("❌ Error syncing AdSets insights:", err.message);
  }
}

/**
 * Fetches and updates Campaigns insights (LIFETIME) for the account
 */
async function syncCampaignsInsights(accessToken, accountExternalId) {
  try {
    const insightsData = await fetchLifetimeInsightsForCampaigns(accessToken, accountExternalId);

    if (insightsData.length === 0) return;

    const bulkOps = insightsData
      .filter(item => item.campaign_id)
      .map(item => ({
        updateOne: {
          filter: { external_id: item.campaign_id },
          update: {
            $set: {
              insights: item,
              updated_at: new Date(),
            }
          }
        }
      }));

    if (bulkOps.length > 0) {
      const res = await AdsCampaign.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ Updated ${res.modifiedCount} Campaigns with insights`);
    }
  } catch (err) {
    console.error("❌ Error syncing Campaigns insights:", err.message);
  }
}


export async function pushToBuffer(bulkOpsArray) {
  if (!bulkOpsArray || bulkOpsArray.length === 0) return;

  // Biến mảng object thành mảng chuỗi JSON
  const stringOps = bulkOpsArray.map(op => JSON.stringify(op));

  // Đẩy vào đuôi danh sách (Right Push). Dấu ... để đẩy nhiều phần tử cùng lúc
  await redis.rpush("buffer:ads:bulkops", ...stringOps);
}

export async function flushAdPerformanceBuffer() {
  const bufferKey = "buffer:ads:bulkops";

  // Dùng Transaction để lấy data ra và xóa kho cùng 1 chớp mắt
  const multi = redis.multi();
  multi.lrange(bufferKey, 0, -1);
  multi.del(bufferKey);
  const results = await multi.exec();

  const rawOps = results[0][1]; // Mảng các chuỗi JSON
  if (!rawOps || rawOps.length === 0) {
    return; // Kho trống thì thôi không làm gì cả
  }

  console.log(`📤 Bắt đầu xả ${rawOps.length} bản ghi từ Redis Buffer vào MongoDB...`);

  // Phục hồi lại thành mảng Object cho MongoDB
  const bulkOps = rawOps.map(str => JSON.parse(str));

  try {
    // Gọi MongoDB đúng 1 lần duy nhất cho TẤT CẢ dữ liệu
    const res = await AdPerformance.bulkWrite(bulkOps, { ordered: false });
    console.log(`✅ Xả Buffer thành công! Upserted: ${res.upsertedCount}, Modified: ${res.modifiedCount}`);
  } catch (error) {
    console.error("❌ Lỗi khi xả Buffer vào MongoDB:", error.message);
    // Nếu lỗi có thể code thêm logic ném ngược lại vào Redis ở đây (tùy độ cẩn thận)
  }
}

async function saveDailyInsightsToAdPerformance(insightsData, account) {
  const today = normalizeToVietnamMidnight(new Date());
  const accountObjectId = account._id;

  const rawAccountId = account.external_id;
  const withoutPrefix = rawAccountId.replace(/^act_/, '');
  const withPrefix = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  // 1. Lấy TẤT CẢ ads của account từ DB (có Redis cache)
  const cacheKey = `ads:account:${withPrefix}:mapping`;
  let allAdsInAccount = null;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      allAdsInAccount = JSON.parse(cached);
      console.log(`✅ [cache-hit] Ads mapping for account ${withPrefix} from Redis`);
    }
  } catch (e) { /* ignore cache errors */ }

  if (!allAdsInAccount) {
    allAdsInAccount = await Ads.find({
      external_account_id: { $in: [withoutPrefix, withPrefix] }
    })
      .populate({ path: 'set_id', select: 'campaign_id' })
      .select('_id external_id set_id name')
      .lean();

    try {
      await redis.set(cacheKey, JSON.stringify(allAdsInAccount), 'EX', 3300); // 55 phút
      console.log(`✅ [cache-set] Ads mapping for account ${withPrefix} saved to Redis (TTL 55m)`);
    } catch (e) { /* ignore cache errors */ }
  }

  if (allAdsInAccount.length === 0) {
    console.log(`⚠️ No ads found for account ${account.external_id}`);
    return { saved: 0, skipped: 0 };
  }

  // 2. Tạo Map từ external_id → ad document
  const adsMap = new Map();
  for (const ad of allAdsInAccount) {
    adsMap.set(ad.external_id, ad);
  }

  // 3. Tạo bulkOps từ daily insights (mỗi item = 1 ngày của 1 ad)
  const bulkOps = [];
  let withInsights = 0;
  const adsWithInsights = new Set();

  for (const item of (insightsData || [])) {
    if (!item.ad_id) continue;

    const ad = adsMap.get(item.ad_id);
    if (!ad) continue;

    // Lấy ngày từ Facebook response (daily breakdown có date_start)
    const dateStr = item.date_start;
    if (!dateStr) continue;

    const date = normalizeToVietnamMidnight(dateStr);
    adsWithInsights.add(item.ad_id);
    withInsights++;

    const performanceData = {
      ads_id: ad._id,
      set_id: ad.set_id?._id || ad.set_id || null,
      campaign_id: ad.set_id?.campaign_id || null,
      account_id: accountObjectId,
      external_account_id: withPrefix,
      external_ad_id: ad.external_id,
      external_adset_id: item.adset_id || null,
      external_campaign_id: item.campaign_id || null,
      date,

      // Core metrics
      impressions: safeNumberOrZero(item.impressions),
      reach: safeNumberOrZero(item.reach),
      clicks: safeNumberOrZero(item.clicks),
      spend: safeNumberOrZero(item.spend),
      frequency: safeNumberOrZero(item.frequency),

      // Calculated metrics
      cpc: safeNumber(item.cpc),
      cpm: safeNumber(item.cpm),
      ctr: safeNumber(item.ctr),

      // Conversions & Results
      conversions: safeNumberOrZero(item.conversions),
      cost_per_conversion: safeNumber(item.cost_per_conversion),
      results: safeNumberOrZero(item.results),
      cost_per_result: safeNumber(item.cost_per_result),

      // Metadata
      campaign_name: item.campaign_name || null,
      adset_name: item.adset_name || null,
      ad_name: item.ad_name || ad.name || null,
      objective: item.objective || null,

      // Link metrics
      link_clicks: safeNumberOrZero(item.link_clicks),
      link_cpc: safeNumber(item.link_cpc),
      link_ctr: safeNumber(item.link_ctr),

      // ROAS
      website_purchase_roas: safeNumber(item.website_purchase_roas),

      // Additional metrics
      website_purchases: safeNumberOrZero(item.website_purchases),
      leads: safeNumberOrZero(item.leads),
      mobile_app_install: safeNumberOrZero(item.mobile_app_install),
      post_engagement: safeNumberOrZero(item.post_engagement),

      // Quality
      quality_ranking: item.quality_ranking || null,

      // Total spend
      total_amount_spent: safeNumberOrZero(item.spend),
    };

    bulkOps.push({
      updateOne: {
        filter: { ads_id: ad._id, date },
        update: { $set: performanceData },
        upsert: true,
      },
    });
  }

  // Ads không có insights → tạo record với 0 metrics cho ngày hôm nay
  let withoutInsights = 0;
  for (const ad of allAdsInAccount) {
    if (!adsWithInsights.has(ad.external_id)) {
      withoutInsights++;
      bulkOps.push({
        updateOne: {
          filter: { ads_id: ad._id, date: today },
          update: {
            $set: {
              ads_id: ad._id,
              set_id: ad.set_id?._id || ad.set_id || null,
              campaign_id: ad.set_id?.campaign_id || null,
              account_id: accountObjectId,
              external_account_id: withPrefix,
              external_ad_id: ad.external_id,
              external_adset_id: null,
              external_campaign_id: null,
              date: today,
              impressions: 0,
              reach: 0,
              clicks: 0,
              spend: 0,
              frequency: 0,
              results: 0,
              conversions: 0,
              link_clicks: 0,
              website_purchases: 0,
              leads: 0,
              mobile_app_install: 0,
              post_engagement: 0,
              total_amount_spent: 0,
              ad_name: ad.name || null,
            },
          },
          upsert: true,
        },
      });
    }
  }

  // 4. Execute bulkWrite in batches
  if (bulkOps.length > 0) {
    try {
      for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
        const batch = bulkOps.slice(i, i + BATCH_SIZE);
        await pushToBuffer(batch);
      }

      console.log(`✅ Đã đẩy ${bulkOps.length} daily records vào Redis Buffer (Chờ xe rác tới hốt).`);
    } catch (err) {
      console.error('❌ BulkWrite error:', err.message);
    }
  }

  return { saved: bulkOps.length, withInsights, withoutInsights };
}

/**
 * Main function: Sync insights for an account
 */
export async function syncInsightsForAccount(accountId) {
  const lockKey = `lock:sync:account:${accountId}`;
  const acquired = await redis.set(lockKey, "LOCKED", "NX", "EX", 300);

  if (!acquired) return;

  try {
    const account = await AdsAccount.findById(accountId).lean();
    if (!account) throw new Error("AdsAccount not found");

    const accessToken = await getAccessTokenForAccount(account);
    if (!accessToken) throw new Error("Missing Facebook access token for account");

    await AdsAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          "sync_metadata.insights_status": "syncing",
          "sync_metadata.insights_error": null,
        },
      }
    );

    let hasError = null;

    try {
      // 1. Sync Ads insights + AdPerformance (daily breakdown)
      const lifetimeInsights = await fetchLifetimeInsightsForAds(accessToken, account.external_id, { time_increment: 1 });

      if (lifetimeInsights.length > 0) {
        await saveDailyInsightsToAdPerformance(lifetimeInsights, account);
        await updateAdsModelWithInsights(lifetimeInsights);
      }

      // 2. Flush buffer to MongoDB
      await flushAdPerformanceBuffer();

      // 3. Sync AdSets insights
      await syncAdSetsInsights(accessToken, account.external_id);

      // 4. Sync Campaigns insights
      await syncCampaignsInsights(accessToken, account.external_id);

      await AdsAccount.updateOne(
        { _id: account._id },
        {
          $set: {
            "sync_metadata.insights_status": "done",
            "sync_metadata.insights_last_synced_at": new Date(),
          },
        }
      );

    } catch (err) {
      hasError = err;
      console.error(`❌ [syncInsightsForAccount] Error for ${account.external_id}:`, err.message);

      await AdsAccount.updateOne(
        { _id: account._id },
        {
          $set: {
            "sync_metadata.insights_status": "failed",
            "sync_metadata.insights_error": err.message || String(err),
          },
        }
      );
    }

    if (hasError) {
      throw hasError;
    }

  } finally {
    await redis.del(lockKey);
  }
}
