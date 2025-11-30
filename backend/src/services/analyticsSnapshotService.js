import AnalyticsSnapshot from "../models/analytics/analyticsSnapshot.model.js";
import Ads from "../models/ads/ads.model.js";

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

    // ✅ SIMPLIFIED: Lấy insights trực tiếp từ Ads model (không cần aggregate AdPerformance nữa)
    // Fetch all ads for this account with insights
    const normalizedAccountId = accountId.replace(/^act_/, '');
    let allAds = [];
    try {
      allAds = await Ads.find({ 
        $or: [
          { external_account_id: normalizedAccountId },
          { external_account_id: accountId }
        ]
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

    // Count ads with/without insights
    const adsWithInsights = allAds.filter(ad => ad.insights && Object.keys(ad.insights).length > 0);
    const adsWithoutInsights = allAds.filter(ad => !ad.insights || Object.keys(ad.insights).length === 0);
    
    console.log(`[analyticsSnapshotService] 📊 ${adsWithInsights.length} ads have insights, ${adsWithoutInsights.length} ads have no insights`);
    
    if (adsWithoutInsights.length > 0 && adsWithoutInsights.length <= 5) {
      console.log(`[analyticsSnapshotService] ⚠️ Ads without insights:`);
      adsWithoutInsights.forEach(ad => {
        console.log(`  - ${ad.name} (${ad.external_id}) - Status: ${ad.status}`);
      });
    }

    let synced = 0;
    let errors = 0;
    let skipped = 0;

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
          // ⚠️ Skip ads without adset (orphaned ads)
          if (!ad.set_id) {
            skipped++;
            continue;
          }
          
          // ⚠️ Skip ads without insights data
          if (!ad.insights || Object.keys(ad.insights).length === 0) {
            skipped++;
            continue;
          }
          
          const campaignId = ad.set_id.campaign_id?._id || ad.set_id.campaign_id || null;
          const campaignObjective = ad.set_id.campaign_id?.objective || null;
          const pageName = ad.set_id.page_name || ad.set_id.campaign_id?.page_name || "N/A";
          const adsetId = ad.set_id._id || ad.set_id;
          const adsetName = ad.set_id.name || null;
          const campaignName = ad.set_id.campaign_id?.name || null;
          
          // ✅ Get metrics directly from ad.insights (already synced from Facebook)
          const insights = ad.insights || {};
          const metrics = {
            spend: insights.spend || 0,
            impressions: insights.impressions || 0,
            clicks: insights.clicks || 0,
            reach: insights.reach || 0,
            frequency: insights.frequency || 0,
            cpm: insights.cpm || 0,
            cpc: insights.cpc || 0,
            ctr: insights.ctr || 0,
            link_clicks: insights.link_clicks || 0,
            conversions: insights.conversions || 0,
            website_purchases: insights.website_purchases || 0,
            leads: insights.leads || 0,
            post_engagement: insights.post_engagement || 0,
            mobile_app_install: insights.mobile_app_install || 0,
            cost_per_lead: insights.cost_per_lead || 0,
            cost_per_conversion: insights.cost_per_conversion || 0,
            cost_per_inline_post_engagement: insights.post_engagement > 0 ? (insights.spend || 0) / insights.post_engagement : 0,
            cost_per_mobile_app_install: insights.cost_per_mobile_app_install || 0,
            quality_ranking: insights.quality_ranking || null,
            engagement_rate_ranking: insights.engagement_rate_ranking || null,
            conversion_rate: insights.conversion_rate || 0,
            link_ctr: insights.link_ctr || 0,
            link_cpc: insights.link_cpc || 0,
            cost_per_result: insights.cost_per_result || 0,
            website_purchase_roas: insights.website_purchase_roas || 0,
            cost_per_action: insights.conversions > 0 ? (insights.spend || 0) / insights.conversions : 0,
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
                  campaign_name: campaignName,
                  campaign_objective: campaignObjective,
                  adset_id: adsetId,
                  adset_name: adsetName,
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

    console.log(`[analyticsSnapshotService] ✅ Synced ${synced} snapshots (from Ads.insights), ${skipped} skipped (no insights/adset), ${errors} errors`);
    return { synced, errors, skipped };

  } catch (error) {
    console.error(`[analyticsSnapshotService] ❌ Error syncing analytics snapshots:`, error.message);
    throw error;
  }
}

