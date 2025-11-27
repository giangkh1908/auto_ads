import AnalyticsSnapshot from "../models/analytics/analyticsSnapshot.model.js";
import Ads from "../models/ads/ads.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import { fetchAccountInsights } from "./fbAdsService.js";
import axios from "axios";

const FB_API = "https://graph.facebook.com/v23.0";

/**
 * Sync analytics snapshots for an account
 * @param {Object} account - Account object with external_id and access_token
 * @returns {Object} - Sync result
 */
export async function syncAnalyticsSnapshots(account) {
  try {
    const accessToken = account.shop_admin_id?.facebookAccessToken;
    const accountId = account.external_id;

    if (!accessToken) {
      console.error(`[analyticsSnapshotService] ❌ No access token for account: ${account.name || accountId}`);
      return { synced: 0, errors: 1 };
    }

    console.log(`[analyticsSnapshotService] 📊 Syncing analytics snapshots for account: ${account.name || accountId}`);

    // Calculate time range for lifetime data (last 90 days - đủ cho analytics, giảm tải API)
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);
    
    const since = ninetyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
    const until = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Fetch lifetime insights from Facebook
    let insights;
    try {
      insights = await fetchAccountInsights(accessToken, accountId, {
        level: 'ad',
        fields: [
          'ad_id',
          'ad_name',
          'adset_id',
          'adset_name',
          'campaign_id',
          'campaign_name',
          'objective',
          'spend',
          'impressions',
          'clicks',
          'reach',
          'frequency',
          'cpm',
          'cpc',
          'ctr',
          'actions',
          'action_values',
          'cost_per_action_type',
          'cost_per_inline_post_engagement',
          'quality_ranking',
          'engagement_rate_ranking',
        ],
        timeIncrement: 'all_days',
        timeRange: { since, until },
      });
    } catch (error) {
      // Handle rate limit errors
      const fbError = error?.response?.data?.error;
      if (fbError?.code === 4 || fbError?.code === 17 || fbError?.error_subcode === 1504022) {
        console.warn(`[analyticsSnapshotService] ⚠️ Rate limit reached for account ${accountId}. Will retry in next cron run.`);
        return { synced: 0, errors: 0, rateLimited: true };
      }
      throw error; // Re-throw other errors
    }

    if (!insights || insights.length === 0) {
      console.log(`[analyticsSnapshotService] ⚠️ No insights data returned for account ${accountId}`);
      return { synced: 0, errors: 0 };
    }

    console.log(`[analyticsSnapshotService] 📥 Received ${insights.length} ad insights`);

    const adExternalIds = insights.map(i => i.ad_id).filter(Boolean);
    const ads = await Ads.find({ external_id: { $in: adExternalIds } })
      .populate({
        path: 'set_id',
        populate: { path: 'campaign_id' }
      })
      .lean();

    const adsMap = new Map(ads.map(ad => [ad.external_id, ad]));

    const adsetIds = [...new Set(insights.map(i => i.adset_id).filter(Boolean))];
    const pageNameCache = new Map();

    for (const adsetId of adsetIds) {
      const ad = ads.find(a => a.set_id?.external_id === adsetId);
      if (ad?.set_id?.page_name) {
        pageNameCache.set(adsetId, ad.set_id.page_name);
      } else if (ad?.set_id?.campaign_id?.page_name) {
        pageNameCache.set(adsetId, ad.set_id.campaign_id.page_name);
      }
    }

    const missingPageNameAdsets = adsetIds.filter(id => !pageNameCache.has(id));
    if (missingPageNameAdsets.length > 0 && accessToken) {
      const adsetToPageIdMap = new Map();
      const uniquePageIds = new Set();
      
      for (const adsetId of missingPageNameAdsets) {
        try {
          const pageId = await getPageIdFromAdset(adsetId, accessToken);
          if (pageId) {
            adsetToPageIdMap.set(adsetId, pageId);
            uniquePageIds.add(pageId);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          // Skip if error
        }
      }

      if (uniquePageIds.size > 0) {
        const pageNames = await batchFetchPageNames(Array.from(uniquePageIds), accessToken);
        for (const [adsetId, pageId] of adsetToPageIdMap.entries()) {
          if (pageNames.has(pageId)) {
            pageNameCache.set(adsetId, pageNames.get(pageId));
          }
        }
      }
    }

    let synced = 0;
    let errors = 0;

    for (const insight of insights) {
      try {
        const ad = adsMap.get(insight.ad_id);
        if (!ad) {
          console.log(`[analyticsSnapshotService] ⚠️ Ad not found in DB: ${insight.ad_id}`);
          continue;
        }

        let campaignObjective = insight.objective;
        let campaignId = null;
        let pageName = null;
        
        if (ad.set_id) {
          campaignId = ad.set_id.campaign_id?._id || ad.set_id.campaign_id;
          if (!campaignObjective && ad.set_id.campaign_id) {
            campaignObjective = ad.set_id.campaign_id.objective;
          }
          pageName = ad.set_id.page_name || ad.set_id.campaign_id?.page_name || null;
        }

        if (!pageName && insight.adset_id) {
          pageName = pageNameCache.get(insight.adset_id) || null;
        }

        if (!pageName) {
          pageName = "N/A";
        }

        // Extract metrics
        const metrics = extractMetrics(insight);

        // Upsert analytics snapshot
        await AnalyticsSnapshot.findOneAndUpdate(
          { ad_id: ad._id },
          {
            external_ad_id: insight.ad_id,
            account_id: account._id,
            external_account_id: accountId,
            campaign_id: campaignId,
            campaign_name: insight.campaign_name,
            campaign_objective: campaignObjective,
            adset_id: ad.set_id,
            adset_name: insight.adset_name,
            ad_name: insight.ad_name,
            ad_status: ad.status,
            page_name: pageName,
            ...metrics,
            last_synced: new Date(),
          },
          { upsert: true, new: true }
        );

        synced++;
      } catch (err) {
        console.error(`[analyticsSnapshotService] ❌ Error syncing ad ${insight.ad_id}:`, err.message);
        errors++;
      }
    }

    console.log(`[analyticsSnapshotService] ✅ Synced ${synced} snapshots, ${errors} errors`);
    return { synced, errors };

  } catch (error) {
    console.error(`[analyticsSnapshotService] ❌ Error syncing analytics snapshots:`, error.message);
    throw error;
  }
}

/**
 * Extract metrics from Facebook insights
 */
function extractMetrics(insight) {
  const metrics = {
    spend: parseFloat(insight.spend) || 0,
    impressions: parseInt(insight.impressions) || 0,
    clicks: parseInt(insight.clicks) || 0,
    reach: parseInt(insight.reach) || 0,
    frequency: parseFloat(insight.frequency) || 0,
    cpm: parseFloat(insight.cpm) || 0,
    cpc: parseFloat(insight.cpc) || 0,
    ctr: parseFloat(insight.ctr) || 0,
    cost_per_inline_post_engagement: parseFloat(insight.cost_per_inline_post_engagement) || 0,
    quality_ranking: insight.quality_ranking || null,
    engagement_rate_ranking: insight.engagement_rate_ranking || null,
  };

  // Extract action-based metrics
  if (insight.actions && Array.isArray(insight.actions)) {
    insight.actions.forEach(action => {
      switch (action.action_type) {
        case 'link_click':
        case 'inline_link_click':
        case 'outbound_click':
          // Accumulate clicks if multiple types are present (though usually one dominates)
          // Or prioritize one. Here we'll take the max to avoid double counting if they overlap
          // But typically we want 'link_click' which is the standard metric.
          // Let's just sum them up if they are distinct, but usually we look for 'link_click'.
          // If 'link_click' is missing, we might use others.
          // For safety, let's trust 'link_click' if present.
          if (action.action_type === 'link_click') {
             metrics.link_clicks = parseInt(action.value) || 0;
          } else if (metrics.link_clicks === 0) {
             // Fallback if link_click is 0/missing
             metrics.link_clicks = Math.max(metrics.link_clicks, parseInt(action.value) || 0);
          }
          break;
        case 'post_engagement':
          metrics.post_engagement = parseInt(action.value) || 0;
          break;
        case 'lead':
          metrics.leads = parseInt(action.value) || 0;
          break;
        case 'omni_purchase':
        case 'purchase':
          metrics.website_purchases = parseInt(action.value) || 0;
          break;
        case 'mobile_app_install':
          metrics.mobile_app_install = parseInt(action.value) || 0;
          break;
        case 'onsite_conversion.post_save':
          metrics.conversions = parseInt(action.value) || 0;
          break;
      }
    });
  }

  // Extract cost per action metrics
  if (insight.cost_per_action_type && Array.isArray(insight.cost_per_action_type)) {
    insight.cost_per_action_type.forEach(cost => {
      switch (cost.action_type) {
        case 'link_click':
          metrics.link_cpc = parseFloat(cost.value) || 0;
          break;
        case 'lead':
          metrics.cost_per_lead = parseFloat(cost.value) || 0;
          break;
        case 'omni_purchase':
        case 'purchase':
          metrics.cost_per_conversion = parseFloat(cost.value) || 0;
          break;
        case 'mobile_app_install':
          metrics.cost_per_mobile_app_install = parseFloat(cost.value) || 0;
          break;
        case 'post_engagement':
          metrics.cost_per_result = parseFloat(cost.value) || 0;
          break;
      }
    });
  }

  // Calculate derived metrics
  if (metrics.link_clicks > 0 && metrics.impressions > 0) {
    metrics.link_ctr = (metrics.link_clicks / metrics.impressions) * 100;
  }

  if (metrics.conversions > 0 && metrics.clicks > 0) {
    metrics.conversion_rate = (metrics.conversions / metrics.clicks) * 100;
  }

  // Extract ROAS
  if (insight.action_values && Array.isArray(insight.action_values)) {
    const purchaseValue = insight.action_values.find(
      v => v.action_type === 'omni_purchase' || v.action_type === 'purchase'
    );
    if (purchaseValue && metrics.spend > 0) {
      metrics.website_purchase_roas = parseFloat(purchaseValue.value) / metrics.spend;
    }
  }

  // Cost per action (generic)
  if (metrics.spend > 0 && (metrics.conversions > 0 || metrics.leads > 0)) {
    metrics.cost_per_action = metrics.spend / (metrics.conversions || metrics.leads);
  }

  return metrics;
}

async function getPageIdFromAdset(adsetId, accessToken) {
  try {
    const adsetResponse = await axios.get(`${FB_API}/${adsetId}`, {
      params: {
        fields: 'promoted_object',
        access_token: accessToken,
      },
    });
    
    return adsetResponse.data?.promoted_object?.page_id || null;
  } catch (err) {
    return null;
  }
}

async function batchFetchPageNames(pageIds, accessToken) {
  const pageNamesMap = new Map();
  
  if (pageIds.length === 0) return pageNamesMap;

  try {
    const ids = pageIds.join(',');
    const response = await axios.get(`${FB_API}/?ids=${ids}`, {
      params: {
        fields: 'name',
        access_token: accessToken,
      },
    });

    if (response.data) {
      const failedPageIds = [];
      for (const [pageId, pageData] of Object.entries(response.data)) {
        if (pageData?.name) {
          pageNamesMap.set(pageId, pageData.name);
        } else if (pageData?.error) {
          const errorCode = pageData.error?.code;
          if (errorCode !== 17 && errorCode !== 4) {
            failedPageIds.push(pageId);
          }
        }
      }
      
      if (failedPageIds.length > 0) {
        console.log(`[analyticsSnapshotService] ⚠️ Could not fetch page names for ${failedPageIds.length} page(s): ${failedPageIds.slice(0, 3).join(', ')}${failedPageIds.length > 3 ? '...' : ''}`);
      }
    }
  } catch (err) {
    const fbError = err.response?.data?.error;
    if (fbError?.code !== 17 && fbError?.code !== 4) {
      console.warn(`[analyticsSnapshotService] ⚠️ Batch fetch page names failed:`, err.message);
    }
  }

  return pageNamesMap;
}
