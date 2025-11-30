import pLimit from "p-limit";
import AdsAccount from "../models/ads/adsAccount.model.js";
import Ads from "../models/ads/ads.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import { fetchAdInsights, saveInsightsToAdPerformance, fetchInsightsForEntities } from "./fbAdsService.js";
import User from "../models/user.model.js";

const BATCH_SIZE = 50;
const CONCURRENCY = 2;

async function getAccessTokenForAccount(account) {
  if (!account?.shop_admin_id) {
    return null;
  }
  const user = await User.findById(account.shop_admin_id).select("+facebookAccessToken");
  return user?.facebookAccessToken || null;
}

/**
 * Updates Ads collection with insights fetched from Facebook
 * @param {Array} insights Flattened insights array
 */
async function updateAdsModelWithInsights(insights) {
  if (!insights || insights.length === 0) return;

  const bulkOps = insights.map((item) => ({
    updateOne: {
      filter: { external_id: item.ad_id }, // ad_id from FB is external_id in DB
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
      console.log(`✅ Updated ${res.modifiedCount} Ads documents with latest insights`);
    } catch (err) {
      console.error("❌ Error updating Ads model with insights:", err.message);
    }
  }
}

/**
 * Fetches and updates AdSets insights for the account
 */
async function syncAdSetsInsights(accessToken, accountExternalId, withoutPrefix) {
  try {
    // Find active AdSets for this account
    const adsets = await AdsSet.find({
      external_account_id: { $in: [withoutPrefix, `act_${withoutPrefix}`] },
      status: { $in: ["ACTIVE", "PAUSED"] },
    }).select("external_id");

    if (adsets.length === 0) return;

    const adsetIds = adsets.map((a) => a.external_id).filter(Boolean);
    console.log(`📊 Syncing insights for ${adsetIds.length} AdSets...`);

    // Fetch insights in batches using existing helper
    const batches = [];
    for (let i = 0; i < adsetIds.length; i += BATCH_SIZE) {
      batches.push(adsetIds.slice(i, i + BATCH_SIZE));
    }

    let updatedCount = 0;
    for (const batch of batches) {
      const insightsData = await fetchInsightsForEntities(batch, accessToken);
      
      const bulkOps = insightsData
        .filter(item => item.id && item.insights?.data?.[0])
        .map(item => ({
          updateOne: {
            filter: { external_id: item.id },
            update: {
              $set: {
                insights: item.insights.data[0],
                updated_at: new Date(),
              }
            }
          }
        }));

      if (bulkOps.length > 0) {
        const res = await AdsSet.bulkWrite(bulkOps, { ordered: false });
        updatedCount += res.modifiedCount;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit guard
    }
    console.log(`✅ Updated ${updatedCount} AdSets with latest insights`);

  } catch (err) {
    console.error("❌ Error syncing AdSets insights:", err.message);
  }
}

/**
 * Fetches and updates Campaigns insights for the account
 */
async function syncCampaignsInsights(accessToken, accountExternalId, withoutPrefix) {
  try {
    // Find active Campaigns for this account
    const campaigns = await AdsCampaign.find({
      external_account_id: { $in: [withoutPrefix, `act_${withoutPrefix}`] },
      status: { $in: ["ACTIVE", "PAUSED"] },
    }).select("external_id");

    if (campaigns.length === 0) return;

    const campaignIds = campaigns.map((c) => c.external_id).filter(Boolean);
    console.log(`📊 Syncing insights for ${campaignIds.length} Campaigns...`);

    // Fetch insights in batches
    const batches = [];
    for (let i = 0; i < campaignIds.length; i += BATCH_SIZE) {
      batches.push(campaignIds.slice(i, i + BATCH_SIZE));
    }

    let updatedCount = 0;
    for (const batch of batches) {
      const insightsData = await fetchInsightsForEntities(batch, accessToken);
      
      const bulkOps = insightsData
        .filter(item => item.id && item.insights?.data?.[0])
        .map(item => ({
          updateOne: {
            filter: { external_id: item.id },
            update: {
              $set: {
                insights: item.insights.data[0],
                updated_at: new Date(),
              }
            }
          }
        }));

      if (bulkOps.length > 0) {
        const res = await AdsCampaign.bulkWrite(bulkOps, { ordered: false });
        updatedCount += res.modifiedCount;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit guard
    }
    console.log(`✅ Updated ${updatedCount} Campaigns with latest insights`);

  } catch (err) {
    console.error("❌ Error syncing Campaigns insights:", err.message);
  }
}

export async function syncInsightsForAccount(accountId) {
  const account = await AdsAccount.findById(accountId);
  if (!account) {
    throw new Error("AdsAccount not found");
  }

  if (account.sync_metadata?.insights_status === "syncing") {
    // Check timeout/stuck status if needed, but for now just return
    const lastSynced = account.sync_metadata?.insights_last_synced_at;
    if (lastSynced && (new Date() - new Date(lastSynced) < 1000 * 60 * 10)) { // 10 mins
       return;
    }
    // If stuck > 10 mins, proceed (reset status effectively)
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

  const { withoutPrefix } = (function normalizeAccountPair(accountIdValue) {
    const hasPrefix = String(accountIdValue).startsWith("act_");
    const withPrefix = hasPrefix ? String(accountIdValue) : `act_${accountIdValue}`;
    const withoutPrefixValue = hasPrefix ? String(accountIdValue).substring(4) : String(accountIdValue);
    return { withPrefix, withoutPrefix: withoutPrefixValue };
  })(account.external_id);

  // 1. Sync Campaigns & AdSets Insights FIRST (Parallel)
  // We do this to ensure parent entities have data too
  await Promise.all([
    syncCampaignsInsights(accessToken, account.external_id, withoutPrefix),
    syncAdSetsInsights(accessToken, account.external_id, withoutPrefix)
  ]);

  // 2. Sync Ads Insights (Main logic)
  const ads = await Ads.find({
    external_account_id: { $in: [withoutPrefix, `act_${withoutPrefix}`] },
    status: { $in: ["ACTIVE", "PAUSED"] },
  }).select("external_id");

  if (ads.length === 0) {
    console.log(`⏭️ Skip insights sync - no active ads for account ${account.external_id}`);
    await AdsAccount.updateOne(
      { _id: account._id },
      {
        $set: {
          "sync_metadata.insights_status": "done",
          "sync_metadata.insights_last_synced_at": new Date(),
        },
      }
    );
    return;
  }

  console.log(`📊 Syncing insights for ${ads.length} active ads`);

  const adIds = ads.map((a) => a.external_id).filter(Boolean);
  const limit = pLimit(CONCURRENCY);
  let hasError = null;

  try {
    const batches = [];
    for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
      batches.push(adIds.slice(i, i + BATCH_SIZE));
    }

    const tasks = batches.map((batch) =>
      limit(async () => {
        const insights = await fetchAdInsights(accessToken, batch);
        if (insights && insights.length > 0) {
          const flattened = insights
            .map((item) => ({
              ad_id: item.id,
              ...(item.insights || {}),
            }))
            .flatMap((entry) => {
              const data = entry.data || [];
              if (!Array.isArray(data) || data.length === 0) {
                return [];
              }
              // Data này trả về mảng, thường chỉ có 1 phần tử nếu không breakdown
              // Nhưng fetchAdInsights đang trả về structure khác một chút so với fetchInsightsForEntities
              // fetchAdInsights trả về { id, insights: { data: [...] } }
              // Logic cũ flatten đang giả định structure này.
              return data.map((row) => ({
                ...row,
                ad_id: entry.ad_id,
              }));
            });

          if (flattened.length > 0) {
            // A. Save history to AdPerformance (Old logic)
            await saveInsightsToAdPerformance(flattened, account._id.toString());
            
            // B. Update Ads model with latest insights (New logic)
            // Flattened contains daily breakdown if requested, but here fetchAdInsights
            // usually returns 'lifetime' or 'default' range. 
            // We need to pick the most relevant one for the "current state".
            // However, `flattened` might contain multiple rows per ad if date_preset is used?
            // `fetchAdInsights` in `fbAdsService` uses default params (no date_preset specified = last_30d usually? or default).
            // Actually `fetchAdInsights` calls `/ids=...?fields=insights...` which returns lifetime or last 30d summary by default if not specified?
            // FB API default for `insights` edge is last 30 days.
            
            // For model update, we want the object that `fetchAdInsights` returned structure 
            // mapped to `item.insights.data[0]`.
            
            // Re-map simple array for model update (taking the first/main insight object)
            const modelUpdates = [];
            insights.forEach(item => {
               if (item.insights?.data?.[0]) {
                 modelUpdates.push({
                   ...item.insights.data[0],
                   ad_id: item.id
                 });
               }
            });
            
            if (modelUpdates.length > 0) {
               await updateAdsModelWithInsights(modelUpdates);
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      })
    );

    await Promise.all(tasks);

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
