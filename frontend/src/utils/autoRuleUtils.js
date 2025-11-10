/**
 * Utility functions for AutoRule components
 */

/**
 * Normalize ID from various formats (string, ObjectId, object with _id)
 * @param {*} id - ID to normalize
 * @returns {string|null} - Normalized ID string or null
 */
export const normalizeId = (id) => {
  if (!id) return null;
  if (typeof id === "string") return id;
  if (typeof id === "object" && id._id) return id._id.toString();
  if (typeof id === "object" && id.toString) return id.toString();
  return String(id);
};

/**
 * Status values that should be excluded from display
 * Using Set for O(1) lookup performance
 */
export const EXCLUDED_STATUSES = new Set(["DELETED", "DRAFT", "FAILED", "ARCHIVED"]);

/**
 * Check if a status should be excluded
 * @param {string} status - Status to check
 * @returns {boolean} - True if status should be excluded
 */
export const isExcludedStatus = (status) => {
  return EXCLUDED_STATUSES.has(status);
};

/**
 * Build apply to text from selected IDs
 * @param {string[]} campaignIds - Selected campaign IDs
 * @param {string[]} adsetIds - Selected adset IDs
 * @param {string[]} adIds - Selected ad IDs
 * @returns {string} - Formatted text
 */
export const buildApplyToText = (campaignIds, adsetIds, adIds) => {
  const parts = [];
  if (campaignIds.length > 0) {
    parts.push(`${campaignIds.length} chiến dịch`);
  }
  if (adsetIds.length > 0) {
    parts.push(`${adsetIds.length} nhóm quảng cáo`);
  }
  if (adIds.length > 0) {
    parts.push(`${adIds.length} quảng cáo`);
  }
  return parts.join(", ") || "";
};

/**
 * Build hierarchical structure from campaigns, adsets, and ads
 * @param {Array} campaigns - Campaigns array
 * @param {Array} adsets - Adsets array
 * @param {Array} ads - Ads array
 * @returns {Array} - Hierarchical structure
 */
export const buildHierarchicalStructure = (campaigns, adsets, ads) => {
  // Create lookup maps for better performance
  const adsetMap = new Map();
  adsets.forEach((adset) => {
    const campaignId = normalizeId(
      adset.campaign_id?._id || adset.campaign_id || adset.campaignId
    );
    if (!adsetMap.has(campaignId)) {
      adsetMap.set(campaignId, []);
    }
    adsetMap.get(campaignId).push(adset);
  });

  const adMap = new Map();
  ads.forEach((ad) => {
    const adsetId = normalizeId(ad.set_id?._id || ad.set_id || ad.adsetId);
    if (!adMap.has(adsetId)) {
      adMap.set(adsetId, []);
    }
    adMap.get(adsetId).push(ad);
  });

  return campaigns.map((campaign) => {
    const campaignId = normalizeId(campaign._id || campaign.id);
    const campaignAdsets = (adsetMap.get(campaignId) || []).map((adset) => {
      const adsetId = normalizeId(adset._id || adset.id);
      return {
        ...adset,
        id: adsetId,
        ads: (adMap.get(adsetId) || []).map((ad) => ({
          ...ad,
          id: normalizeId(ad._id || ad.id),
        })),
      };
    });

    return {
      ...campaign,
      id: campaignId,
      adsets: campaignAdsets,
    };
  });
};

/**
 * Extract IDs from array (handle both ObjectId objects and string IDs)
 * @param {Array} ids - Array of IDs
 * @returns {Array} - Array of normalized ID strings
 */
export const extractIds = (ids) => {
  return (ids || [])
    .map((id) => normalizeId(id))
    .filter(Boolean);
};

/**
 * Calculate which campaigns and adsets should be expanded based on selected IDs
 * Using Set for O(1) lookup performance instead of O(n) includes
 * @param {Array} hierarchical - Hierarchical data structure
 * @param {Array} selectedCampaignIds - Selected campaign IDs
 * @param {Array} selectedAdsetIds - Selected adset IDs
 * @param {Array} selectedAdIds - Selected ad IDs
 * @returns {Object} - Object with campaignsToExpand and adsetsToExpand Sets
 */
export const calculateExpandedItems = (
  hierarchical,
  selectedCampaignIds,
  selectedAdsetIds,
  selectedAdIds
) => {
  const campaignsToExpand = new Set();
  const adsetsToExpand = new Set();

  // Convert arrays to Sets for O(1) lookup performance
  const selectedCampaignIdsSet = new Set(
    selectedCampaignIds.map((id) => id?.toString())
  );
  const selectedAdsetIdsSet = new Set(
    selectedAdsetIds.map((id) => id?.toString())
  );
  const selectedAdIdsSet = new Set(selectedAdIds.map((id) => id?.toString()));

  hierarchical.forEach((campaign) => {
    const campaignId = campaign.id?.toString();
    
    // Check if campaign has selected adset (O(1) lookup)
    let hasSelectedAdset = false;
    if (campaign.adsets) {
      for (const adset of campaign.adsets) {
        const adsetId = adset.id?.toString();
        if (selectedAdsetIdsSet.has(adsetId)) {
          hasSelectedAdset = true;
          break;
        }
      }
    }

    if (hasSelectedAdset || selectedCampaignIdsSet.has(campaignId)) {
      campaignsToExpand.add(campaignId);
    }

    // Calculate adsets to expand
    if (campaign.adsets) {
      campaign.adsets.forEach((adset) => {
        const adsetId = adset.id?.toString();
        
        // Check if adset has selected ad (O(1) lookup)
        let hasSelectedAd = false;
        if (adset.ads) {
          for (const ad of adset.ads) {
            const adId = ad.id?.toString();
            if (selectedAdIdsSet.has(adId)) {
              hasSelectedAd = true;
              break;
            }
          }
        }

        if (hasSelectedAd || selectedAdsetIdsSet.has(adsetId)) {
          adsetsToExpand.add(adsetId);
          // If adset is selected, also expand its campaign
          campaignsToExpand.add(campaignId);
        }
      });
    }
  });

  return { campaignsToExpand, adsetsToExpand };
};

