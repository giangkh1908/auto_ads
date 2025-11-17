/**
 * Data service for Ads Management
 * Handles data transformation, insights merging, and filtering
 */

/**
 * Transform campaign data from API
 */
export const transformCampaign = (campaign) => ({
  ...campaign,
  id: campaign._id || campaign.id || campaign.external_id,
  external_id: campaign.external_id,
  isChecked: false,
  enabled: campaign.status === "ACTIVE",
  budget: campaign.daily_budget || campaign.lifetime_budget || 0,
  start_time: campaign.start_time,
  end_time: campaign.stop_time,
  objective: campaign.objective,
  buying_type: campaign.buying_type,
  created_by: campaign.created_by,
});

/**
 * Transform adset data from API
 */
export const transformAdset = (adset, campaignId = null) => ({
  ...adset,
  id: adset._id || adset.id || adset.external_id,
  external_id: adset.external_id,
  campaignId: campaignId || adset.campaign_id,
  isChecked: false,
  enabled: adset.status === "ACTIVE",
  budget: adset.daily_budget || adset.lifetime_budget || 0,
  start_time: adset.start_time,
  end_time: adset.end_time,
  targeting: adset.targeting || {},
  optimization_goal: adset.optimization_goal,
  bid_strategy: adset.bid_strategy,
  bid_amount: adset.bid_amount,
  created_by: adset.created_by,
});

/**
 * Transform ad data from API
 */
export const transformAd = (ad, adsetId = null) => ({
  ...ad,
  id: ad._id || ad.id || ad.external_id,
  external_id: ad.external_id,
  adsetId: adsetId || ad.adset_id || ad.set_id,
  isChecked: false,
  enabled: ad.status === "ACTIVE",
  budget: 0, // Ads don't have budget, it's inherited from adset
  created_by: ad.created_by,
});

/**
 * Merge insights into entity
 */
export const mergeInsights = (entity, insights) => {
  const actions = Array.isArray(insights.actions) ? insights.actions : [];
  const results = actions.reduce((sum, act) => sum + (Number(act.value) || 0), 0);
  
  return {
    ...entity,
    impressions: insights.impressions || 0,
    reach: insights.reach || 0,
    results,
    quality: insights.quality_ranking || '-',
  };
};

/**
 * Sort by created_at (newest first)
 */
export const sortByCreatedAtDesc = (array) => {
  return [...array].sort((a, b) => {
    const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
    const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
};

/**
 * Filter out deleted and archived items
 */
export const filterActiveItems = (items) => {
  return items.filter(
    (item) => item.status !== "DELETED" && item.status !== "ARCHIVED"
  );
};

/**
 * Filter items by campaign
 */
export const filterByCampaign = (items, campaignId) => {
  return items.filter((item) => String(item.campaignId) === String(campaignId));
};

/**
 * Filter ads by adset
 */
export const filterAdsByAdset = (ads, adsetId) => {
  return ads.filter((ad) => String(ad.adsetId) === String(adsetId));
};

/**
 * Filter ads by campaign (through adsets)
 */
export const filterAdsByCampaign = (ads, adsets, campaignId) => {
  const campaignAdsets = adsets.filter(
    (adset) => String(adset.campaignId) === String(campaignId)
  );
  const adsetIds = campaignAdsets.map((adset) => String(adset.id));
  
  return ads.filter((ad) => adsetIds.includes(String(ad.adsetId)));
};

/**
 * Get filtered rows based on active tab and selections
 */
export const getFilteredRows = (datasets, activeTab, selectedCampaign, selectedAdset) => {
  let result = [];
  
  if (activeTab === "campaigns") {
    result = filterActiveItems(datasets.campaigns);
  } else if (activeTab === "adsets") {
    let filteredAdsets = filterActiveItems(datasets.adsets);
    if (selectedCampaign) {
      filteredAdsets = filterByCampaign(filteredAdsets, selectedCampaign.id);
    }
    result = filteredAdsets;
  } else if (activeTab === "ads") {
    let filteredAds = filterActiveItems(datasets.ads);
    if (selectedAdset) {
      filteredAds = filterAdsByAdset(filteredAds, selectedAdset.id);
    } else if (selectedCampaign) {
      filteredAds = filterAdsByCampaign(filteredAds, datasets.adsets, selectedCampaign.id);
    }
    result = filteredAds;
  }
  
  return sortByCreatedAtDesc(result);
};

