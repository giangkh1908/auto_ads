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

    // Calculate time range for lifetime data (last 2 years to today)
    const today = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    
    const since = twoYearsAgo.toISOString().split('T')[0]; // YYYY-MM-DD
    const until = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Fetch lifetime insights from Facebook
    const insights = await fetchAccountInsights(accessToken, accountId, {
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
      timeRange: { since, until }, // Use time_range instead of date_preset
    });

    if (!insights || insights.length === 0) {
      console.log(`[analyticsSnapshotService] ⚠️ No insights data returned for account ${accountId}`);
      return { synced: 0, errors: 0 };
    }

    console.log(`[analyticsSnapshotService] 📥 Received ${insights.length} ad insights`);

    let synced = 0;
    let errors = 0;

    for (const insight of insights) {
      try {
        // Find the ad in our database
        const ad = await Ads.findOne({ external_id: insight.ad_id }).lean();
        if (!ad) {
          console.log(`[analyticsSnapshotService] ⚠️ Ad not found in DB: ${insight.ad_id}`);
          continue;
        }

        // Get campaign objective, campaign_id, and page_name
        let campaignObjective = insight.objective;
        let campaignId = null;
        let pageName = null;
        
        if (ad.set_id) {
          const adset = await AdsSet.findById(ad.set_id).populate('campaign_id').lean();
          if (adset) {
            campaignId = adset.campaign_id?._id || adset.campaign_id;
            if (!campaignObjective && adset.campaign_id) {
              campaignObjective = adset.campaign_id.objective;
            }
            // Get page_name: ưu tiên từ adset, fallback từ campaign
            pageName = adset.page_name || adset.campaign_id?.page_name || null;
          }
        }

        // If page_name is still null, try to fetch from Facebook API
        if (!pageName && insight.adset_id && accessToken) {
          try {
            pageName = await fetchPageNameFromFacebook(insight.adset_id, insight.ad_id, accessToken);
          } catch (err) {
            console.log(`[analyticsSnapshotService] ⚠️ Could not fetch page_name from Facebook for ad ${insight.ad_id}:`, err.message);
          }
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

/**
 * Fetch page name from Facebook API
 * Tries multiple methods:
 * 1. Fetch adset promoted_object to get page_id
 * 2. Fetch ad creative to get page_id from object_story_spec
 * 3. Fetch page name from page_id
 */
async function fetchPageNameFromFacebook(adsetId, adId, accessToken) {
  try {
    let pageId = null;

    // Method 1: Try to get page_id from adset promoted_object
    try {
      const adsetResponse = await axios.get(`${FB_API}/${adsetId}`, {
        params: {
          fields: 'promoted_object',
          access_token: accessToken,
        },
      });
      
      if (adsetResponse.data?.promoted_object?.page_id) {
        pageId = adsetResponse.data.promoted_object.page_id;
      }
    } catch (err) {
      // Continue to next method
    }

    // Method 2: If no page_id from adset, try to get from ad creative
    if (!pageId && adId) {
      try {
        const adResponse = await axios.get(`${FB_API}/${adId}`, {
          params: {
            fields: 'creative{object_story_spec}',
            access_token: accessToken,
          },
        });
        
        if (adResponse.data?.creative?.object_story_spec?.page_id) {
          pageId = adResponse.data.creative.object_story_spec.page_id;
        }
      } catch (err) {
        // Continue to next method
      }
    }

    // Method 3: Fetch page name from page_id
    if (pageId) {
      try {
        const pageResponse = await axios.get(`${FB_API}/${pageId}`, {
          params: {
            fields: 'name',
            access_token: accessToken,
          },
        });
        
        if (pageResponse.data?.name) {
          return pageResponse.data.name;
        }
      } catch (err) {
        console.log(`[analyticsSnapshotService] ⚠️ Could not fetch page name for page_id ${pageId}:`, err.message);
      }
    }

    return null;
  } catch (error) {
    console.error(`[analyticsSnapshotService] ❌ Error fetching page name:`, error.message);
    return null;
  }
}
