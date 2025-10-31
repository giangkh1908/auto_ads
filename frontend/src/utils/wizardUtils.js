// Utility functions cho CreateAdsWizard

/**
 * Helper function để extract string ID từ ObjectId format
 * @param {any} value - Giá trị cần extract ID
 * @returns {string|null} - ID string hoặc null
 */
export function extractObjectId(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/[0-9a-fA-F]{24}/);
    return match ? match[0] : null;
  }
  if (value.$oid) return value.$oid; // trong trường hợp Mongo xuất ra kiểu { $oid: '...' }
  return value.toString();
}

/**
 * Helper function để tìm ID trong object
 * @param {object} obj - Object cần tìm ID
 * @returns {string|null} - ID tìm được hoặc null
 */
export function findIdInObject(obj) {
  if (!obj || typeof obj !== "object") return null;

  // Danh sách các trường có thể chứa ID
  const idFields = [
    "id",
    "_id",
    "campaign_id",
    "adset_id",
    "ad_id",
    "creative_id",
    "set_id",
    "campaignId",
    "adsetId",
    "adId",
    "creativeId",
    "setId",
  ];

  // Tìm trong các trường trực tiếp
  for (const field of idFields) {
    if (obj[field]) {
      return obj[field];
    }
  }

  // Tìm trong nested objects
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === "object") {
      const nestedId = findIdInObject(obj[key]);
      if (nestedId) {
        return nestedId;
      }
    }
  }

  return null;
}

/**
 * Xây dựng payload để gửi API
 * @param {object} campaign - Dữ liệu campaign
 * @param {object} adset - Dữ liệu adset
 * @param {object} ad - Dữ liệu ad
 * @param {string} selectedAccountId - ID tài khoản quảng cáo
 * @param {object} editingItem - Item đang edit (nếu có)
 * @param {object} fbObjectiveMap - Map objective
 * @param {object} fbAdsetDefaultsByObjective - Defaults cho adset theo objective
 * @returns {object} - Payload để gửi API
 */
export function buildPayload({
  campaign,
  adset,
  ad,
  selectedAccountId,
  editingItem,
  fbObjectiveMap,
  fbAdsetDefaultsByObjective,
}) {
  const fbObjective = fbObjectiveMap[campaign.objective] || "OUTCOME_ENGAGEMENT";
  const adsetDefaults = fbAdsetDefaultsByObjective[fbObjective] || {
    optimization_goal: "REACH",
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITH_BID_CAP",
    bid_amount: 1000,
  };

  if (!campaign.facebookPageId) {
    throw new Error("Vui lòng chọn Trang Facebook trước khi đăng quảng cáo.");
  }

  const creative = {
    name: ad.name,
    object_story_spec: {
      page_id: campaign.facebookPageId || "fb_page_id_placeholder",
      link_data: {
        message: ad.primaryText,
        link: ad.destinationUrl || "https://fchat.vn",
        caption: "fchat.vn",
        name: ad.headline,
        description: ad.description,
        call_to_action: {
          type: "MESSAGE_PAGE",
          value: { link: ad.destinationUrl || "https://fchat.vn" },
        },
        ...(ad.mediaUrl && { picture: ad.mediaUrl }),
      },
    },
  };

  return {
    ad_account_id: selectedAccountId || localStorage.getItem("selectedAdAccount"),
    campaign: {
      draftId: campaign.id || editingItem?.data?._id || null,
      external_id: campaign.external_id || editingItem?.data?.external_id || null,
      name: campaign.name,
      objective: fbObjective,
      status: "PAUSED",
      special_ad_categories: ["NONE"],
      page_id: campaign.facebookPageId,
      page_name: campaign.facebookPage,
      daily_budget: campaign.daily_budget,
      lifetime_budget: campaign.lifetime_budget,
      start_time: campaign.start_time,
      stop_time: campaign.stop_time,
    },
    adset: {
      draftId: adset.id || null,
      external_id: adset.external_id || null,
      name: adset.name,
      daily_budget: adset.budgetAmount,
      status: "PAUSED",
      ...adsetDefaults,
      targeting: {
        age_min: adset.targeting.ageMin || 18,
        age_max: adset.targeting.ageMax || 65,
        geo_locations: { countries: ["VN"] },
        targeting_automation: {
          advantage_audience: 0,
        },
      },
      start_time: adset.start_time
        ? new Date(adset.start_time).toISOString()
        : new Date().toISOString(),
      end_time: adset.end_time
        ? new Date(adset.end_time).toISOString()
        : null,
      optimization_goal: adset.optimization_goal,
      conversion_event: adset.conversion_event,
      billing_event: adset.billing_event,
      bid_strategy: adset.bid_strategy,
      bid_amount: adset.bid_amount,
      ...(fbObjective === "OUTCOME_SALES" && adset.pixel_id
        ? {
            promoted_object: {
              pixel_id: adset.pixel_id,
              ...(adset.conversion_event
                ? { custom_event_type: adset.conversion_event }
                : {}),
            },
          }
        : {}),
      // Vị trí chuyển đổi/lưu lượng (prefill & update BE/FB)
      ...(adset.traffic_destination && {
        traffic_destination: adset.traffic_destination,
      }),
      ...(adset.destination_type && {
        destination_type: adset.destination_type,
      }),
    },
    ad: {
      draftId: ad.id || null,
      external_id: ad.external_id || null,
      name: ad.name,
      status: "PAUSED",
      creative_id: ad.creative_id,
    },
    creative: {
      draftId: ad.creative_id || null,
      external_id: null,
      ...creative,
    },
  };
}

/**
 * Xác định wizard step dựa trên editing item type
 * @param {string} mode - Mode hiện tại (create/edit)
 * @param {object} editingItem - Item đang edit
 * @returns {number} - Wizard step tương ứng
 */
export function getInitialWizardStep(mode, editingItem) {
  if (mode !== "edit" || !editingItem) {
    return 0;
  }

  switch (editingItem.type) {
    case "campaign":
      return 1;
    case "adset":
      return 2;
    case "ad":
      return 3;
    default:
      return 1;
  }
}
