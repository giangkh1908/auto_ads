import mongoose from "mongoose";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import Ads from "../../models/ads/ads.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdPerformance from "../../models/ads/adPerformance.model.js";
import { fetchLifetimeInsightsForAds, fetchLifetimeInsightsForAdsets, fetchLifetimeInsightsForCampaigns } from "../ads/fbAdsService.js";
import User from "../../models/user/user.model.js";

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
  const user = await User.findById(account.shop_admin_id).select("+facebookAccessToken");
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

/**
 * Lưu lifetime insights vào AdPerformance cho TẤT CẢ ads trong account.
 */
async function saveLifetimeInsightsToAdPerformance(insightsData, account) {
  const today = normalizeToVietnamMidnight(new Date());
  const accountObjectId = account._id;
  
  const rawAccountId = account.external_id;
  const withoutPrefix = rawAccountId.replace(/^act_/, '');
  const withPrefix = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  // 1. Lấy TẤT CẢ ads của account từ DB
  const allAdsInAccount = await Ads.find({
    external_account_id: { $in: [withoutPrefix, withPrefix] }
  })
    .populate({ path: 'set_id', select: 'campaign_id' })
    .select('_id external_id set_id name')
    .lean();

  if (allAdsInAccount.length === 0) {
    console.log(`⚠️ No ads found for account ${account.external_id}`);
    return { saved: 0, skipped: 0 };
  }

  // 2. Tạo Map từ insights data
  const insightsMap = new Map();
  for (const item of (insightsData || [])) {
    if (item.ad_id) {
      insightsMap.set(item.ad_id, item);
    }
  }

  // 3. Tạo bulkOps cho TẤT CẢ ads
  const bulkOps = [];
  let withInsights = 0;
  let withoutInsights = 0;

  for (const ad of allAdsInAccount) {
    const item = insightsMap.get(ad.external_id) || {};

    if (insightsMap.has(ad.external_id)) {
      withInsights++;
    } else {
      withoutInsights++;
    }

    const performanceData = {
      ads_id: ad._id,
      set_id: ad.set_id?._id || ad.set_id || null,
      campaign_id: ad.set_id?.campaign_id || null,
      account_id: accountObjectId,
      external_account_id: withPrefix,
      external_ad_id: ad.external_id,
      external_adset_id: item.adset_id || null,
      external_campaign_id: item.campaign_id || null,
      date: today,
      
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
        filter: { ads_id: ad._id, date: today },
        update: { $set: performanceData },
        upsert: true,
      },
    });
  }

  // 4. Execute bulkWrite in batches
  if (bulkOps.length > 0) {
    try {
      let totalUpserted = 0;
      let totalModified = 0;
      let totalMatched = 0;
      
      for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
        const batch = bulkOps.slice(i, i + BATCH_SIZE);
        const batchResult = await AdPerformance.bulkWrite(batch, { ordered: false });
        
        totalUpserted += batchResult.upsertedCount || 0;
        totalModified += batchResult.modifiedCount || 0;
        totalMatched += batchResult.matchedCount || 0;
      }
      
      console.log(`✅ AdPerformance: ${totalUpserted} upserted, ${totalModified} modified, ${totalMatched} matched (${withInsights} with insights, ${withoutInsights} without)`);
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
  const account = await AdsAccount.findById(accountId);
  if (!account) {
    throw new Error("AdsAccount not found");
  }

  const accessToken = await getAccessTokenForAccount(account);
  if (!accessToken) {
    throw new Error("Missing Facebook access token for account");
  }

  await AdsAccount.updateOne(
    { _id: account._id },
    {
      $set: {
        "sync_metadata.insights_status": "syncing",
        "sync_metadata.insights_error": null,
      },
    }
  );

  const withPrefix = account.external_id.startsWith('act_') 
    ? account.external_id 
    : `act_${account.external_id}`;

  let hasError = null;

  try {
    const lifetimeInsights = await fetchLifetimeInsightsForAds(accessToken, account.external_id);

    await saveLifetimeInsightsToAdPerformance(lifetimeInsights, account);
    
    if (lifetimeInsights.length > 0) {
      await updateAdsModelWithInsights(lifetimeInsights);
    }

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
}
