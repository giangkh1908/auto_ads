import AnalyticsSnapshot from "../models/analytics/analyticsSnapshot.model.js";
import Ads from "../models/ads/ads.model.js";
import AdPerformance from "../models/ads/adPerformance.model.js";

/**
 * Sync analytics snapshots for an account
 * @param {Object} account - Account object with external_id and access_token
 * @returns {Object} - Sync result
 */
export async function syncAnalyticsSnapshots(account) {
  try {
    const accountId = account.external_id;

    if (!accountId) {
      console.error(`[analyticsSnapshotService] ❌ No external_id for account: ${account.name || account._id}`);
      return { synced: 0, errors: 1 };
    }

    console.log(`[analyticsSnapshotService] 📊 Syncing analytics snapshots for account: ${account.name || accountId}`);

    // AnalyticsSnapshot là bảng TỔNG HỢP - aggregate từ AdPerformance (không lấy từ Facebook Insights)
    // Fetch all ads for this account
    const normalizedAccountId = accountId.replace(/^act_/, '');
    let allAds = [];
    try {
      allAds = await Ads.find({ 
        $or: [
          { external_account_id: normalizedAccountId },
          { external_account_id: accountId }
        ],
        status: { $in: ["ACTIVE", "PAUSED"] }
      })
        .populate({
          path: 'set_id',
          populate: { path: 'campaign_id' }
        })
        .lean();
      console.log(`[analyticsSnapshotService] 📊 Found ${allAds.length} total ads in DB for account ${accountId}`);
    } catch (err) {
      console.warn(`[analyticsSnapshotService] ⚠️ Error fetching all ads:`, err.message);
      return { synced: 0, errors: 1 };
    }

    if (allAds.length === 0) {
      console.log(`[analyticsSnapshotService] ⚠️ No ads found for account ${accountId}`);
      return { synced: 0, errors: 0 };
    }

    // Aggregate metrics from AdPerformance for ALL ads (tổng hợp tất cả ngày)
    const adIds = allAds.filter(ad => ad?._id).map(ad => ad._id);
    console.log(`[analyticsSnapshotService] 📊 Aggregating metrics from AdPerformance for ${adIds.length} ads...`);
    
    // ✅ THÊM: Filter date range để loại bỏ data sai (future dates hoặc quá cũ)
    const today = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    
    const performanceData = await AdPerformance.aggregate([
      {
        $match: {
          ads_id: { $in: adIds },
          // ✅ Bỏ account_id filter vì ads đã được filter theo account rồi
          // ✅ THÊM: Chỉ lấy data trong 2 năm gần nhất và không phải tương lai
          date: {
            $gte: twoYearsAgo,
            $lte: today
          }
        }
      },
      {
        $group: {
          _id: "$ads_id",
          totalSpend: { $sum: "$spend" },
          totalImpressions: { $sum: "$impressions" },
          totalClicks: { $sum: "$clicks" },
          totalReach: { $sum: "$reach" },
          totalLinkClicks: { $sum: "$link_clicks" },
          totalConversions: { $sum: "$conversions" },
          totalPurchases: { $sum: "$website_purchases" },
          totalLeads: { $sum: "$leads" },
          totalPostEngagement: { $sum: "$post_engagement" },
          totalMobileAppInstall: { $sum: "$mobile_app_install" },
          avgFrequency: { $avg: "$frequency" },
          avgCpc: { $avg: "$cpc" },
          avgCpm: { $avg: "$cpm" },
          avgCtr: { $avg: "$ctr" },
          avgCostPerLead: { $avg: "$cost_per_lead" },
          avgCostPerConversion: { $avg: "$cost_per_conversion" },
          latestQualityRanking: { $last: "$quality_ranking" },
          latestEngagementRateRanking: { $last: "$engagement_rate_ranking" },
          recordCount: { $sum: 1 }
        }
      }
    ]);
    
    const performanceMap = new Map();
    performanceData.forEach(perf => {
      performanceMap.set(perf._id.toString(), perf);
    });
    
    console.log(`[analyticsSnapshotService] 📊 Found performance data for ${performanceMap.size} ads from AdPerformance`);

    // Build page name cache from adsets/campaigns
    const pageNameCache = new Map();
    allAds.forEach(ad => {
      if (ad.set_id?.external_id) {
        const pageName = ad.set_id.page_name || ad.set_id.campaign_id?.page_name || "N/A";
        pageNameCache.set(ad.set_id.external_id, pageName);
      }
    });

    let synced = 0;
    let errors = 0;

    // Sync ALL ads - aggregate from AdPerformance
    const BATCH_SIZE = 500;
    const batches = [];
    
    for (let i = 0; i < allAds.length; i += BATCH_SIZE) {
      batches.push(allAds.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[analyticsSnapshotService] 📦 Processing ${allAds.length} ads in ${batches.length} batch(es)`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const bulkOps = [];
      
      for (const ad of batch) {
        try {
          if (!ad.set_id) {
            continue; // Skip ads without adset
          }
          
          const campaignId = ad.set_id.campaign_id?._id || ad.set_id.campaign_id;
          const campaignObjective = ad.set_id.campaign_id?.objective || null;
          const pageName = ad.set_id.page_name || ad.set_id.campaign_id?.page_name || "N/A";
          
          // Get aggregated metrics from AdPerformance
          const perf = performanceMap.get(ad._id.toString());
          const metrics = perf ? {
            spend: perf.totalSpend || 0,
            impressions: perf.totalImpressions || 0,
            clicks: perf.totalClicks || 0,
            reach: perf.totalReach || 0,
            frequency: perf.avgFrequency || 0,
            cpm: perf.avgCpm || (perf.totalImpressions > 0 ? (perf.totalSpend / perf.totalImpressions) * 1000 : 0),
            cpc: perf.avgCpc || (perf.totalClicks > 0 ? perf.totalSpend / perf.totalClicks : 0),
            ctr: perf.avgCtr || (perf.totalImpressions > 0 ? (perf.totalClicks / perf.totalImpressions) * 100 : 0),
            link_clicks: perf.totalLinkClicks || 0,
            conversions: perf.totalConversions || 0,
            website_purchases: perf.totalPurchases || 0,
            leads: perf.totalLeads || 0,
            post_engagement: perf.totalPostEngagement || 0,
            mobile_app_install: perf.totalMobileAppInstall || 0,
            cost_per_lead: perf.avgCostPerLead || (perf.totalLeads > 0 ? perf.totalSpend / perf.totalLeads : 0),
            cost_per_conversion: perf.avgCostPerConversion || (perf.totalConversions > 0 ? perf.totalSpend / perf.totalConversions : 0),
            cost_per_inline_post_engagement: perf.totalPostEngagement > 0 ? perf.totalSpend / perf.totalPostEngagement : 0,
            cost_per_mobile_app_install: perf.totalMobileAppInstall > 0 ? perf.totalSpend / perf.totalMobileAppInstall : 0,
            quality_ranking: perf.latestQualityRanking || null,
            engagement_rate_ranking: perf.latestEngagementRateRanking || null,
            conversion_rate: perf.totalClicks > 0 ? (perf.totalConversions / perf.totalClicks) * 100 : 0,
            link_ctr: perf.totalImpressions > 0 ? (perf.totalLinkClicks / perf.totalImpressions) * 100 : 0,
            link_cpc: perf.totalLinkClicks > 0 ? (perf.totalSpend / perf.totalLinkClicks) : 0,
            cost_per_result: perf.totalClicks > 0 ? perf.totalSpend / perf.totalClicks : 0,
            website_purchase_roas: perf.totalPurchases > 0 && perf.totalSpend > 0 ? (perf.totalPurchases * 100) / perf.totalSpend : 0,
            cost_per_action: perf.totalConversions > 0 ? perf.totalSpend / perf.totalConversions : 0,
          } : {
            spend: 0,
            impressions: 0,
            clicks: 0,
            reach: 0,
            frequency: 0,
            cpm: 0,
            cpc: 0,
            ctr: 0,
            link_clicks: 0,
            conversions: 0,
            website_purchases: 0,
            leads: 0,
            post_engagement: 0,
            mobile_app_install: 0,
            cost_per_lead: 0,
            cost_per_conversion: 0,
            cost_per_inline_post_engagement: 0,
            cost_per_mobile_app_install: 0,
            quality_ranking: null,
            engagement_rate_ranking: null,
            conversion_rate: 0,
            link_ctr: 0,
            link_cpc: 0,
            cost_per_result: 0,
            website_purchase_roas: 0,
            cost_per_action: 0,
          };
          
          bulkOps.push({
            updateOne: {
              filter: { ad_id: ad._id },
              update: {
                $set: {
                  external_ad_id: ad.external_id,
                  account_id: account._id,
                  external_account_id: accountId,
                  campaign_id: campaignId,
                  campaign_name: ad.set_id.campaign_id?.name || null,
                  campaign_objective: campaignObjective,
                  adset_id: ad.set_id._id || ad.set_id,
                  adset_name: ad.set_id.name || null,
                  ad_name: ad.name,
                  ad_status: ad.status,
                  page_name: pageName,
                  ...metrics,
                  last_synced: new Date(),
                }
              },
              upsert: true
            }
          });
        } catch (err) {
          console.error(`[analyticsSnapshotService] ❌ Error preparing bulk op for ad ${ad.external_id}:`, err.message);
          errors++;
        }
      }
      
      if (bulkOps.length > 0) {
        try {
          const result = await AnalyticsSnapshot.bulkWrite(bulkOps, { ordered: false });
          synced += result.upsertedCount + result.modifiedCount;
          console.log(`[analyticsSnapshotService] ✅ Batch ${batchIndex + 1}/${batches.length}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
        } catch (err) {
          console.error(`[analyticsSnapshotService] ❌ Error in batch ${batchIndex + 1}:`, err.message);
          errors += bulkOps.length;
        }
      }
    }

    console.log(`[analyticsSnapshotService] ✅ Synced ${synced} snapshots (aggregated from AdPerformance), ${errors} errors`);
    return { synced, errors };

  } catch (error) {
    console.error(`[analyticsSnapshotService] ❌ Error syncing analytics snapshots:`, error.message);
    throw error;
  }
}

