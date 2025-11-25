import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";
import Creative from "../models/ads/creative.model.js";
import AdsAccount from "../models/ads/adsAccount.model.js";
import {
  createCampaign,
  createAdSet,
  createCreative,
  createAd,
  deleteEntity,
  updateCampaign,
  updateAdset,
  updateAd,
} from "./fbAdsService.js";
import { transformAdsetTargeting } from "./targetingBuilder.js";
import axios from "axios";

/* =========================
 *  HELPER FUNCTIONS
 * ========================= */

/**
 * Map engagement_destination sang destination_type cho Facebook API
 * @param {string} engagementDest - engagement_destination value (MESSENGER, ON_POST, CALL, etc.)
 * @returns {string|null} - destination_type value cho Facebook API
 */
function mapEngagementDestination(engagementDest) {
  if (!engagementDest) return null;
  const map = {
    MESSENGER: "MESSENGER",
    ON_POST: "ON_POST",
    CALL: "CALL_BUTTON", // Facebook API dùng CALL_BUTTON
    WEBSITE: "WEBSITE",
    APP: "APP",
    ON_PAGE: "ON_PAGE",
  };
  return map[engagementDest] || engagementDest;
}

/**
 * Helper function: Chạy promises với giới hạn concurrency
 * @param {Array} tasks - Mảng các async functions
 * @param {number} limit - Số lượng tasks chạy đồng thời tối đa
 */
async function runWithConcurrencyLimit(tasks, limit = 8) {
  const localResults = [];
  const batches = [];

  // Chia tasks thành các batches
  for (let i = 0; i < tasks.length; i += limit) {
    batches.push(tasks.slice(i, i + limit));
  }

  // Chạy từng batch tuần tự, nhưng trong batch thì song song
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(
      `🔄 Xử lý batch ${batchIndex + 1}/${batches.length} (${
        batch.length
      } items)...`
    );

    const batchResults = await Promise.all(batch.map((task) => task()));
    localResults.push(...batchResults);

    const successCount = batchResults.filter(
      (r) => r?.success !== false
    ).length;
    console.log(
      `✅ Batch ${batchIndex + 1} hoàn thành: ${successCount}/${
        batch.length
      } thành công`
    );
  }

  return localResults;
}

/**
 * Helper: Tìm entity hiện có trong DB theo _id, draftId, hoặc external_id
 */
async function findExistingEntity(entity, Model) {
  if (!entity) return null;

  // Priority 1: Tìm theo _id hoặc draftId
  if (entity._id || entity.draftId) {
    const found = await Model.findById(entity._id || entity.draftId);
    if (found) return found;
  }

  // Priority 2: Tìm theo external_id
  if (entity.external_id) {
    const found = await Model.findOne({ external_id: entity.external_id });
    if (found) return found;
  }

  return null;
}

/* =========================
 *  UPDATE OR CREATE HELPERS
 * ========================= */

/**
 * Update hoặc tạo mới Campaign
 */
async function updateOrCreateCampaign({
  campaign,
  ad_account_id,
  access_token,
}) {
  const now = new Date();
  const existingCampaign = await findExistingEntity(campaign, AdsCampaign);

  // 🔍 DEBUG: Log để kiểm tra
  console.log(`🔍 [updateOrCreateCampaign] Campaign từ payload:`, {
    _id: campaign._id,
    draftId: campaign.draftId,
    external_id: campaign.external_id,
    name: campaign.name,
  });
  console.log(
    `🔍 [updateOrCreateCampaign] Existing campaign:`,
    existingCampaign
      ? {
          _id: existingCampaign._id,
          external_id: existingCampaign.external_id,
          status: existingCampaign.status,
          name: existingCampaign.name,
        }
      : "null"
  );

  // ✅ LOGIC: Nếu có status FAILED và không có external_id → publish lại (tạo mới)
  if (
    existingCampaign &&
    existingCampaign.status === "FAILED" &&
    !existingCampaign.external_id
  ) {
    console.log(
      `🔄 Retry publishing FAILED campaign (no external_id): ${existingCampaign.name} (${existingCampaign._id})`
    );
    return await publishCampaignService({
      ad_account_id,
      access_token,
      campaign: {
        ...existingCampaign.toObject(), // Lấy data từ DB trước
        ...campaign, // Override với data mới từ payload
        _id: existingCampaign._id,
        account_id: existingCampaign.account_id || campaign.account_id,
        shop_id: existingCampaign.shop_id || campaign.shop_id,
        created_by: existingCampaign.created_by || campaign.created_by,
      },
      campaignDraftId: existingCampaign._id,
    });
  }

  if (existingCampaign) {
    console.log(
      `🔄 Updating existing campaign: ${existingCampaign.name} (${existingCampaign._id})`
    );

    // ✅ LOGIC: Merge data từ DB với data từ payload (ưu tiên DB cho các item không FAILED)
    const mergedCampaign = {
      ...existingCampaign.toObject(), // Lấy data từ DB
      ...campaign, // Override với data mới từ payload
      // Giữ lại các field quan trọng từ DB
      _id: existingCampaign._id,
      external_id: existingCampaign.external_id,
      external_account_id: existingCampaign.external_account_id,
      account_id: existingCampaign.account_id || campaign.account_id,
      shop_id: existingCampaign.shop_id || campaign.shop_id,
      created_by: existingCampaign.created_by || campaign.created_by,
    };

    // Build updates (chỉ các field được phép update)
    const updates = {
      ...(mergedCampaign.name && { name: mergedCampaign.name }),
      ...(mergedCampaign.status && { status: mergedCampaign.status }),
      ...(mergedCampaign.daily_budget !== undefined && {
        daily_budget: mergedCampaign.daily_budget,
      }),
      ...(mergedCampaign.lifetime_budget !== undefined && {
        lifetime_budget: mergedCampaign.lifetime_budget,
      }),
      ...(mergedCampaign.start_time && {
        start_time: mergedCampaign.start_time,
      }),
      ...(mergedCampaign.stop_time && { stop_time: mergedCampaign.stop_time }),
      updated_at: now,
    };

    // Update trên Facebook nếu có external_id
    if (existingCampaign.external_id) {
      try {
        await updateCampaign(
          existingCampaign.external_id,
          access_token,
          updates
        );
      } catch (fbError) {
        console.warn(
          `⚠️ Facebook update campaign failed:`,
          fbError.response?.data || fbError.message
        );
        // Continue với DB update ngay cả khi Facebook fail
      }
    }

    // Update trong MongoDB
    await AdsCampaign.findByIdAndUpdate(existingCampaign._id, updates);

    return {
      action: "updated",
      campaignId: existingCampaign.external_id,
      campaignDbId: existingCampaign._id,
      success: true,
    };
  } else {
    // CREATE new campaign
    console.log(`➕ Creating new campaign: ${campaign.name}`);
    return await publishCampaignService({
      ad_account_id,
      access_token,
      campaign,
      campaignDraftId: campaign.draftId,
    });
  }
}

/**
 * Update hoặc tạo mới AdSet
 */
async function updateOrCreateAdset({
  adset,
  campaignId,
  campaignDbId,
  ad_account_id,
  access_token,
}) {
  const now = new Date();
  const existingAdset = await findExistingEntity(adset, AdsSet);

  // 🔍 DEBUG: Log để kiểm tra
  console.log(`🔍 [updateOrCreateAdset] AdSet từ payload:`, {
    _id: adset._id,
    draftId: adset.draftId,
    external_id: adset.external_id,
    name: adset.name,
  });
  console.log(
    `🔍 [updateOrCreateAdset] Existing adset:`,
    existingAdset
      ? {
          _id: existingAdset._id,
          external_id: existingAdset.external_id,
          status: existingAdset.status,
          name: existingAdset.name,
        }
      : "null"
  );

  // ✅ LOGIC: Nếu có status FAILED và không có external_id → publish lại (tạo mới)
  if (
    existingAdset &&
    existingAdset.status === "FAILED" &&
    !existingAdset.external_id
  ) {
    console.log(
      `🔄 Retry publishing FAILED adset (no external_id): ${existingAdset.name} (${existingAdset._id})`
    );
    return await publishAdsetService({
      ad_account_id,
      access_token,
      campaignId,
      campaignDbId,
      adset: {
        ...existingAdset.toObject(), // Lấy data từ DB trước
        ...adset, // Override với data mới từ payload
        _id: existingAdset._id,
        campaign_id: existingAdset.campaign_id || campaignDbId,
        created_by: existingAdset.created_by || adset.created_by,
      },
      adsetDraftId: existingAdset._id,
    });
  }

  if (existingAdset) {
    console.log(
      `🔄 Updating existing adset: ${existingAdset.name} (${existingAdset._id})`
    );

    // ✅ LOGIC: Merge data từ DB với data từ payload (ưu tiên DB cho các item không FAILED)
    const mergedAdset = {
      ...existingAdset.toObject(), // Lấy data từ DB
      ...adset, // Override với data mới từ payload
      // Giữ lại các field quan trọng từ DB
      _id: existingAdset._id,
      external_id: existingAdset.external_id,
      external_account_id: existingAdset.external_account_id,
      campaign_id: existingAdset.campaign_id || campaignDbId,
      created_by: existingAdset.created_by || adset.created_by,
    };

    // 🎯 Transform targeting trước khi update (giống create)
    let transformedMergedAdset = mergedAdset;
    try {
      transformedMergedAdset = await transformAdsetTargeting(
        mergedAdset,
        access_token
      );
      console.log(
        "✅ [Update Existing Adset] Adset after transform:",
        JSON.stringify(
          {
            name: transformedMergedAdset.name,
            targeting: transformedMergedAdset.targeting,
          },
          null,
          2
        )
      );
    } catch (targetingError) {
      console.error(
        "❌ [Update Existing Adset] Error transforming targeting:",
        targetingError.message
      );
      throw new Error(`Targeting validation failed: ${targetingError.message}`);
    }

    // Build promoted_object theo format create (xóa null/undefined)
    let promotedObject = null;
    if (transformedMergedAdset.promoted_object) {
      const obj = { ...transformedMergedAdset.promoted_object };
      Object.keys(obj).forEach((key) => {
        if (obj[key] === null || obj[key] === undefined) {
          delete obj[key];
        }
      });
      if (Object.keys(obj).length > 0) {
        promotedObject = obj;
      }
    }

    // Loại bỏ field 'locations' và '_regionNames' khỏi targeting (không hợp lệ với Facebook)
    let cleanTargeting = transformedMergedAdset.targeting || {};
    if (cleanTargeting.locations || cleanTargeting._regionNames) {
      const { locations, _regionNames, ...rest } = cleanTargeting;
      cleanTargeting = rest;
    }

    // Đảm bảo geo_locations có ít nhất một location
    if (
      !cleanTargeting.geo_locations ||
      (!cleanTargeting.geo_locations.countries &&
        !cleanTargeting.geo_locations.regions &&
        !cleanTargeting.geo_locations.cities &&
        !cleanTargeting.geo_locations.custom_locations)
    ) {
      cleanTargeting.geo_locations = { countries: ["VN"] };
      console.log(
        '⚠️ [Update Existing Adset] No geo_locations found, adding default: countries: ["VN"]'
      );
    }

    // Format update giống hệt format create (trừ campaign_id và status)
    const updates = {
      ...(transformedMergedAdset.name && { name: transformedMergedAdset.name }),
      ...(transformedMergedAdset.optimization_goal && {
        optimization_goal: transformedMergedAdset.optimization_goal,
      }),
      ...(transformedMergedAdset.billing_event && {
        billing_event: transformedMergedAdset.billing_event,
      }),
      ...(transformedMergedAdset.bid_strategy && {
        bid_strategy: transformedMergedAdset.bid_strategy,
      }),
      ...(transformedMergedAdset.bid_amount !== undefined && {
        bid_amount: transformedMergedAdset.bid_amount,
      }),
      ...(transformedMergedAdset.daily_budget !== undefined && {
        daily_budget: transformedMergedAdset.daily_budget,
      }),
      ...(transformedMergedAdset.lifetime_budget !== undefined && {
        lifetime_budget: transformedMergedAdset.lifetime_budget,
      }),
      targeting: cleanTargeting, // Clean targeting with geo_locations
      // start_time không thể update nếu adset đã bắt đầu
      ...(transformedMergedAdset.end_time && {
        end_time: transformedMergedAdset.end_time,
      }),
      ...(promotedObject && { promoted_object: promotedObject }),
      ...(transformedMergedAdset.pixel_id && {
        pixel_id: transformedMergedAdset.pixel_id,
      }),
      ...(transformedMergedAdset.conversion_event && {
        conversion_event: transformedMergedAdset.conversion_event,
      }),
      // ✅ Map destination: ưu tiên destination_type > engagement_destination > traffic_destination
      ...(transformedMergedAdset.destination_type && {
        destination_type: transformedMergedAdset.destination_type
      }),
      ...(!transformedMergedAdset.destination_type && transformedMergedAdset.engagement_destination && {
        destination_type: mapEngagementDestination(transformedMergedAdset.engagement_destination)
      }),
      ...(!transformedMergedAdset.destination_type && !transformedMergedAdset.engagement_destination && transformedMergedAdset.traffic_destination && {
        destination_type: transformedMergedAdset.traffic_destination
      }),
      updated_at: now,
    };

    // ✅ Thêm engagement_destination và destination_type vào updates để lưu vào DB
    updates.traffic_destination = transformedMergedAdset.traffic_destination || null;
    updates.engagement_destination = transformedMergedAdset.engagement_destination || null;
    updates.destination_type = updates.destination_type || null;

    console.log(
      `📋 Updating Adset ${existingAdset.external_id} với fields:`,
      Object.keys(updates)
    );
    console.log(
      `📍 Targeting geo_locations:`,
      JSON.stringify(updates.targeting?.geo_locations, null, 2)
    );

    // Update trên Facebook nếu có external_id
    if (existingAdset.external_id) {
      try {
        await updateAdset(existingAdset.external_id, access_token, updates);
      } catch (fbError) {
        console.warn(
          `⚠️ Facebook update adset failed:`,
          fbError.response?.data || fbError.message
        );
      }
    }

    // Update trong MongoDB (keep locations with names for edit mode)
    // Save original locations for database storage
    const originalLocationsForUpdate = mergedAdset.targeting?.locations
      ? { ...mergedAdset.targeting.locations }
      : null;
    const targetingForDatabaseUpdate = originalLocationsForUpdate
      ? { ...cleanTargeting, locations: originalLocationsForUpdate }
      : cleanTargeting;

    await AdsSet.findByIdAndUpdate(existingAdset._id, {
      ...updates,
      targeting: targetingForDatabaseUpdate, // Use targeting with locations preserved
    });

    return {
      action: "updated",
      adsetId: existingAdset.external_id,
      adsetDbId: existingAdset._id,
      success: true,
    };
  } else {
    // CREATE new adset
    console.log(`➕ Creating new adset: ${adset.name}`);
    return await publishAdsetService({
      ad_account_id,
      access_token,
      campaignId,
      campaignDbId,
      adset,
      adsetDraftId: adset.draftId,
    });
  }
}

/**
 * Update hoặc tạo mới Ad
 * NOTE: Creative KHÔNG thể update - chỉ tạo mới nếu creative thay đổi
 */
async function updateOrCreateAd({
  ad,
  adsetId,
  adsetDbId,
  ad_account_id,
  access_token,
}) {
  const now = new Date();
  const existingAd = await findExistingEntity(ad, Ads);

  // 🔍 DEBUG: Log để kiểm tra
  console.log(`🔍 [updateOrCreateAd] Ad từ payload:`, {
    _id: ad._id,
    draftId: ad.draftId,
    external_id: ad.external_id,
    name: ad.name,
  });
  console.log(
    `🔍 [updateOrCreateAd] Existing ad:`,
    existingAd
      ? {
          _id: existingAd._id,
          external_id: existingAd.external_id,
          status: existingAd.status,
          name: existingAd.name,
        }
      : "null"
  );

  // ✅ LOGIC: Nếu có status FAILED và không có external_id → publish lại (tạo mới)
  if (existingAd && existingAd.status === "FAILED" && !existingAd.external_id) {
    console.log(
      `🔄 Retry publishing FAILED ad (no external_id): ${existingAd.name} (${existingAd._id})`
    );

    // Cần lấy creative từ existingAd hoặc ad
    // Nếu có creative trong DB, lấy từ đó, nếu không lấy từ payload
    const existingCreative = existingAd.creative_id
      ? await Creative.findById(existingAd.creative_id)
      : null;

    const creativeData =
      ad.creative ||
      (existingCreative
        ? {
            object_story_spec: existingCreative.object_story_spec,
            name: existingCreative.name,
          }
        : null);

    const creativeDraftId =
      ad.creative?.draftId || ad.creative?._id || existingAd.creative_id;

    return await publishAdService({
      ad_account_id,
      access_token,
      adsetId,
      adsetDbId,
      creative: creativeData,
      ad: {
        ...existingAd.toObject(), // Lấy data từ DB trước
        ...ad, // Override với data mới từ payload
        _id: existingAd._id,
        set_id: existingAd.set_id || adsetDbId,
        created_by: existingAd.created_by || ad.created_by,
      },
      adDraftId: existingAd._id,
      creativeDraftId: creativeDraftId,
    });
  }

  if (existingAd) {
    console.log(
      `🔄 Updating existing ad: ${existingAd.name} (${existingAd._id})`
    );

    // ✅ LOGIC: Merge data từ DB với data từ payload (ưu tiên DB cho các item không FAILED)
    const mergedAd = {
      ...existingAd.toObject(), // Lấy data từ DB
      ...ad, // Override với data mới từ payload
      // Giữ lại các field quan trọng từ DB
      _id: existingAd._id,
      external_id: existingAd.external_id,
      external_account_id: existingAd.external_account_id,
      set_id: existingAd.set_id || adsetDbId,
      creative_id: existingAd.creative_id || ad.creative?._id,
      created_by: existingAd.created_by || ad.created_by,
    };

    // Build updates (Ad chỉ update được name và status)
    const updates = {
      ...(mergedAd.name && { name: mergedAd.name }),
      ...(mergedAd.status && { status: mergedAd.status }),
      updated_at: now,
    };

    // ⚠️ IMPORTANT: Facebook KHÔNG cho update creative
    // Nếu creative thay đổi, cần tạo ad mới (không implement ở đây để giữ metrics)

    // Update trên Facebook nếu có external_id
    if (existingAd.external_id) {
      try {
        await updateAd(existingAd.external_id, access_token, updates);
      } catch (fbError) {
        console.warn(
          `⚠️ Facebook update ad failed:`,
          fbError.response?.data || fbError.message
        );
      }
    }

    // Update trong MongoDB
    await Ads.findByIdAndUpdate(existingAd._id, updates);

    return {
      action: "updated",
      adId: existingAd.external_id,
      adDbId: existingAd._id,
      success: true,
    };
  } else {
    // CREATE new ad
    console.log(`➕ Creating new ad: ${ad.name}`);
    return await publishAdService({
      ad_account_id,
      access_token,
      adsetId,
      adsetDbId,
      creative: ad.creative,
      ad,
      adDraftId: ad.draftId,
      creativeDraftId: ad.creative?.draftId || ad.creative?._id, // ✅ THÊM creative draft ID
    });
  }
}

/**
 * 🧩 Publish toàn bộ quy trình tạo quảng cáo Wizard
 * (Campaign → Ad Set → Creative → Ad)
 */
export async function publishWizard({
  ad_account_id,
  access_token,
  campaign,
  adset,
  creative,
  ad,
  dry_run = false,
  campaignDraftId,
  adsetDraftId,
  creativeDraftId,
  adDraftId,
}) {
  const steps = [];
  let fbCampaignId, fbAdSetId, fbCreativeId, fbAdId;
  const now = new Date();

  // 🧱 1) Khởi tạo draft (nháp) với đầy đủ thông tin
  const draftCamp = campaignDraftId
    ? await AdsCampaign.findById(campaignDraftId)
    : await AdsCampaign.create({
        name: campaign?.name,
        objective: campaign?.objective,
        status: "DRAFT",
        account_id: campaign?.account_id,
        shop_id: campaign?.shop_id,
        page_id: campaign?.page_id,
        page_name: campaign?.page_name,
        daily_budget: campaign?.daily_budget,
        lifetime_budget: campaign?.lifetime_budget,
        start_time: campaign?.start_time,
        stop_time: campaign?.stop_time,
        created_by: campaign?.created_by,
      });

  const draftSet = adsetDraftId
    ? await AdsSet.findById(adsetDraftId)
    : await AdsSet.create({
        campaign_id: draftCamp._id,
        name: adset?.name,
        status: "DRAFT",
        optimization_goal: adset?.optimization_goal,
        conversion_event: adset?.conversion_event,
        billing_event: adset?.billing_event,
        bid_strategy: adset?.bid_strategy,
        bid_amount: adset?.bid_amount,
        targeting: adset?.targeting,
        traffic_destination: adset?.traffic_destination || null,
        engagement_destination: adset?.engagement_destination || null,
        destination_type: adset?.destination_type || null,
        daily_budget: adset?.daily_budget,
        lifetime_budget: adset?.lifetime_budget,
        start_time: adset?.start_time,
        end_time: adset?.end_time,
        created_by: adset?.created_by,
      });

  const draftCreative = creativeDraftId
    ? await Creative.findById(creativeDraftId)
    : await Creative.create({
        name: creative?.name,
        title: creative?.object_story_spec?.link_data?.name,
        body: creative?.object_story_spec?.link_data?.message,
        creative_type: "LINK",
        page_id: creative?.object_story_spec?.page_id || null,
        object_story_spec: creative?.object_story_spec,
        cta: creative?.object_story_spec?.link_data?.call_to_action?.type,
        created_by: creative?.created_by,
      });

  const draftAd = adDraftId
    ? await Ads.findById(adDraftId)
    : await Ads.create({
        set_id: draftSet._id,
        account_id: campaign?.account_id,
        name: ad?.name,
        creative_id: draftCreative._id,
        status: "DRAFT",
        created_by: ad?.created_by,
      });

  try {
    // 🧠 Validate cơ bản
    if (!campaign?.name || !campaign?.objective) {
      throw new Error(
        "Thiếu dữ liệu chiến dịch (campaign.name hoặc objective)."
      );
    }
    if (!adset?.name) {
      throw new Error("Thiếu tên nhóm quảng cáo (adset.name).");
    }
    if (!creative?.object_story_spec) {
      throw new Error("Thiếu nội dung creative.object_story_spec.");
    }
    if (!ad?.name) {
      throw new Error("Thiếu tên quảng cáo (ad.name).");
    }
    if (!ad_account_id) {
      throw new Error("Thiếu ad_account_id.");
    }
    if (!access_token) {
      throw new Error("Thiếu access_token.");
    }

    // 🚀 2) Campaign
    if (dry_run) {
      fbCampaignId = "dry_" + Date.now();
      console.log(`[DRY RUN] Campaign giả: ${campaign.name}`);
    } else {
      fbCampaignId = await createCampaign(ad_account_id, access_token, {
        ...campaign,
        status: "PAUSED",
        special_ad_categories: campaign?.special_ad_categories || ["NONE"],
      });
      steps.push(async () => deleteEntity(fbCampaignId, access_token));
    }

    // ✅ UPDATE DRAFT VỚI external_id VÀ STATUS PAUSED (KHÔNG TẠO MỚI)
    console.log(
      `💾 Update draft Campaign trong database: ${draftCamp._id} -> ${fbCampaignId}`
    );
    await AdsCampaign.findByIdAndUpdate(draftCamp._id, {
      external_id: fbCampaignId,
      external_account_id: ad_account_id,
      status: "PAUSED", // ✅ CHUYỂN TỪ DRAFT THÀNH PAUSED
      synced_at: now,
      updated_at: now,
    });

    // 🚀 3) Ad Set
    if (dry_run) {
      fbAdSetId = "dry_" + (Date.now() + 1);
      console.log(`[DRY RUN] AdSet giả: ${adset.name}`);
    } else {
      console.log(`🚀 Tạo AdSet trên Facebook: ${adset.name}`);
      console.log("📋 AdSet data:", {
        name: adset.name,
        optimization_goal: adset.optimization_goal,
        conversion_event: adset.conversion_event,
        billing_event: adset.billing_event,
        bid_strategy: adset.bid_strategy,
        bid_amount: adset.bid_amount,
      });

      fbAdSetId = await createAdSet(ad_account_id, access_token, {
        ...adset,
        campaign_id: fbCampaignId,
        status: adset?.status || "PAUSED",
        bid_strategy: adset?.bid_strategy || "LOWEST_COST_WITH_BID_CAP",
        bid_amount: adset?.bid_amount || 1000,
        billing_event: adset?.billing_event || "IMPRESSIONS", // Thêm billing_event bắt buộc
      });
      steps.push(async () => deleteEntity(fbAdSetId, access_token));
    }

    // ✅ UPDATE DRAFT VỚI external_id VÀ STATUS PAUSED (KHÔNG TẠO MỚI)
    console.log(
      `💾 Update draft AdSet trong database: ${draftSet._id} -> ${fbAdSetId}`
    );
    await AdsSet.findByIdAndUpdate(draftSet._id, {
      external_id: fbAdSetId,
      external_account_id: ad_account_id,
      status: "PAUSED", // ✅ CHUYỂN TỪ DRAFT THÀNH PAUSED
      optimization_goal: adset.optimization_goal,
      conversion_event: adset.conversion_event,
      billing_event: adset.billing_event,
      synced_at: now,
      updated_at: now,
    });

    // 🚀 4) Creative
    if (dry_run) {
      fbCreativeId = "dry_" + (Date.now() + 2);
      console.log(`[DRY RUN] Creative giả: ${creative.name}`);
    } else {
      fbCreativeId = await createCreative(
        ad_account_id,
        access_token,
        creative
      );
      steps.push(async () => deleteEntity(fbCreativeId, access_token));
    }

    // Lưu Creative vào database
    console.log(
      `💾 Lưu Creative vào database: ${draftCreative._id} -> ${fbCreativeId}`
    );
    await Creative.findByIdAndUpdate(draftCreative._id, {
      external_id: fbCreativeId,
      synced_at: now,
      updated_at: now,
    });

    // 🚀 5) Ad
    if (dry_run) {
      fbAdId = "dry_" + (Date.now() + 3);
      console.log(`[DRY RUN] Ad giả: ${ad.name}`);
    } else {
      fbAdId = await createAd(ad_account_id, access_token, {
        ...ad,
        adset_id: fbAdSetId,
        creative: { creative_id: fbCreativeId },
        status: ad?.status || "PAUSED",
      });
      steps.push(async () => deleteEntity(fbAdId, access_token));
    }

    // Lưu Ad vào database
    console.log(`💾 Lưu Ad vào database: ${draftAd._id} -> ${fbAdId}`);
    await Ads.findByIdAndUpdate(draftAd._id, {
      external_id: fbAdId,
      external_account_id: ad_account_id,
      status: "PAUSED",
      synced_at: now,
      updated_at: now,
    });

    // 🎁 6) Return dữ liệu đầy đủ cho FE
    console.log(
      `✅ Hoàn thành lưu tất cả quảng cáo vào database: Campaign(${fbCampaignId}), AdSet(${fbAdSetId}), Creative(${fbCreativeId}), Ad(${fbAdId})`
    );
    return {
      success: true,
      message: dry_run
        ? "Dry run thành công (chưa publish thật)"
        : "Publish thành công và đã lưu vào database.",
      campaign: {
        id: fbCampaignId,
        name: campaign.name,
        status: campaign.status || "PAUSED",
        objective: campaign.objective,
        budget: campaign.daily_budget || campaign.lifetime_budget || "0",
        spend: 0,
        impressions: 0,
        reach: 0,
        results: 0,
        quality_ranking: null,
        synced_at: now,
      },
      adset: {
        id: fbAdSetId,
        name: adset.name,
        status: adset.status || "PAUSED",
        budget: adset.daily_budget || adset.lifetime_budget || "0",
        spend: 0,
        impressions: 0,
        reach: 0,
        results: 0,
        quality_ranking: null,
        synced_at: now,
      },
      ad: {
        id: fbAdId,
        name: ad.name,
        status: ad.status || "PAUSED",
        spend: 0,
        impressions: 0,
        reach: 0,
        results: 0,
        quality_ranking: null,
        synced_at: now,
      },
      creative: {
        id: fbCreativeId,
        page_id: creative?.object_story_spec?.page_id || null,
        name: creative?.name,
      },
      drafts: {
        campaign: draftCamp._id,
        adset: draftSet._id,
        creative: draftCreative._id,
        ad: draftAd._id,
      },
    };
  } catch (err) {
    console.error("❌ Wizard Publish Error:", err.message);
    // Rollback Saga
    for (let i = steps.length - 1; i >= 0; i--) {
      try {
        await steps[i]();
      } catch (rollbackErr) {
        console.warn("⚠️ Rollback step failed:", rollbackErr.message);
      }
    }

    // Cập nhật trạng thái draft fail
    const errMeta = { "meta.last_error": err?.message, status: "FAILED" };
    await Promise.all([
      Ads.findByIdAndUpdate(draftAd._id, errMeta),
      AdsSet.findByIdAndUpdate(draftSet._id, errMeta),
      AdsCampaign.findByIdAndUpdate(draftCamp._id, errMeta),
    ]);

    throw err;
  }
}

/**
 * 🧠 Update wizard (Campaign → AdSet → Creative → Ad)
 */
export async function updateWizard({
  ad_account_id,
  access_token,
  campaign,
  adset,
  creative,
  ad,
  dry_run = false,
}) {
  const FB_API = "https://graph.facebook.com/v23.0";
  const now = new Date();
  const result = {};

  async function fbUpdate(entityId, body, type) {
    if (!entityId || dry_run) {
      console.log(`⚪ Skip ${type} update (no external_id or dry_run)`);
      return false;
    }
    try {
      console.log(`🔵 Updating ${type} on Facebook:`, entityId);
      await axios.post(`${FB_API}/${entityId}`, body, {
        params: { access_token },
      });
      return true;
    } catch (e) {
      console.warn(
        `⚠️ Facebook ${type} update failed:`,
        e.response?.data || e.message
      );
      return false;
    }
  }

  // ✅ Campaign
  if (campaign) {
    const { external_id, draftId, ...rawFields } = campaign;
    // Whitelist updateable fields for Campaign
    const fields = {
      ...(rawFields?.name ? { name: rawFields.name } : {}),
      ...(rawFields?.status ? { status: rawFields.status } : {}),
    };
    if (external_id && Object.keys(fields).length > 0) {
      await fbUpdate(external_id, fields, "campaign");
    }
    const updated =
      (draftId &&
        (await AdsCampaign.findByIdAndUpdate(
          draftId,
          { ...fields, updated_at: now },
          { new: true }
        ))) ||
      (await AdsCampaign.findOneAndUpdate(
        { external_id },
        { ...fields, updated_at: now },
        { new: true }
      ));
    result.campaign = updated;
  }

  // ✅ AdSet
  if (adset) {
    const { external_id, draftId, ...rawFields } = adset;
    // Prepare promoted_object merge (ensure page_id if provided separately)
    const mergedPromotedObject = {
      ...(rawFields?.promoted_object || {}),
      ...(rawFields?.facebookPageId
        ? { page_id: rawFields.facebookPageId }
        : {}),
    };

    // Whitelist updateable fields for AdSet (DB fields only)
    const fields = {
      ...(rawFields?.name ? { name: rawFields.name } : {}),
      ...(rawFields?.status ? { status: rawFields.status } : {}),
      ...(rawFields?.daily_budget
        ? { daily_budget: rawFields.daily_budget }
        : {}),
      ...(rawFields?.lifetime_budget
        ? { lifetime_budget: rawFields.lifetime_budget }
        : {}),
      ...(rawFields?.start_time ? { start_time: rawFields.start_time } : {}),
      ...(rawFields?.end_time ? { end_time: rawFields.end_time } : {}),
      ...(rawFields?.targeting ? { targeting: rawFields.targeting } : {}),
      ...(rawFields?.optimization_goal
        ? { optimization_goal: rawFields.optimization_goal }
        : {}),
      ...(rawFields?.conversion_event
        ? { conversion_event: rawFields.conversion_event }
        : {}),
      ...(rawFields?.billing_event
        ? { billing_event: rawFields.billing_event }
        : {}),
      ...(rawFields?.bid_strategy
        ? { bid_strategy: rawFields.bid_strategy }
        : {}),
      ...(rawFields?.bid_amount ? { bid_amount: rawFields.bid_amount } : {}),
      ...(Object.keys(mergedPromotedObject).length
        ? { promoted_object: mergedPromotedObject }
        : {}),
      ...(rawFields?.pixel_id ? { pixel_id: rawFields.pixel_id } : {}),
      ...(rawFields?.traffic_destination
        ? { traffic_destination: rawFields.traffic_destination }
        : {}),
    };
    let fbAdSetId = external_id;

    if (!fbAdSetId) {
      console.log("⚪ AdSet chưa có external_id → tạo mới trên Facebook...");
      try {
        const newAdSet = await createAdSet(ad_account_id, access_token, {
          ...adset,
          campaign_id: campaign?.external_id,
          bid_strategy: adset?.bid_strategy || "LOWEST_COST_WITH_BID_CAP",
          bid_amount: adset?.bid_amount || 1000,
          billing_event: adset?.billing_event || "IMPRESSIONS", // Thêm billing_event bắt buộc
        });
        fbAdSetId = newAdSet?.id || newAdSet;
        if (fbAdSetId)
          await AdsSet.findByIdAndUpdate(draftId, { external_id: fbAdSetId });
      } catch (err) {
        console.error(
          "❌ Không thể tạo lại AdSet:",
          err.response?.data || err.message
        );
      }
    }

    if (fbAdSetId && Object.keys(fields).length > 0) {
      // ✅ Facebook payload may include destination_type derived from traffic_destination or engagement_destination
      let finalDestinationType = null;
      if (rawFields?.destination_type) {
        finalDestinationType = rawFields.destination_type;
      } else if (rawFields?.engagement_destination) {
        finalDestinationType = mapEngagementDestination(rawFields.engagement_destination);
      } else if (rawFields?.traffic_destination) {
        finalDestinationType = rawFields.traffic_destination;
      }
      
      const fbFields = {
        ...fields,
        ...(finalDestinationType && { destination_type: finalDestinationType }),
      };
      const ok = await fbUpdate(fbAdSetId, fbFields, "adset");
      if (!ok) {
        console.log("⚠️ Update adset thất bại → thử tạo mới lại...");
        const newAdSet = await createAdSet(ad_account_id, access_token, {
          ...adset,
          campaign_id: campaign?.external_id,
          bid_strategy: adset?.bid_strategy || "LOWEST_COST_WITH_BID_CAP",
          bid_amount: adset?.bid_amount || 1000,
          billing_event: adset?.billing_event || "IMPRESSIONS",
        });
        fbAdSetId = newAdSet?.id || newAdSet;
        await AdsSet.findByIdAndUpdate(draftId, { external_id: fbAdSetId });
      }
    }

    const updated =
      (draftId &&
        (await AdsSet.findByIdAndUpdate(
          draftId,
          { ...fields, updated_at: now, external_id: fbAdSetId },
          { new: true }
        ))) ||
      (await AdsSet.findOneAndUpdate(
        { external_id: fbAdSetId },
        { ...fields, updated_at: now },
        { new: true }
      )) ||
      (await AdsSet.findOneAndUpdate(
        { campaign_id: campaign?.draftId || campaign?._id },
        { ...fields, updated_at: now },
        { new: true }
      ));
    result.adset = updated;
  }

  // ✅ Creative
  if (creative) {
    const { external_id, draftId, ...fields } = creative;
    let fbCreativeId = external_id;

    if (!fbCreativeId) {
      console.log(
        "⚪ Creative chưa có external_id → tạo mới lại trên Facebook..."
      );
      try {
        const newCreative = await createCreative(ad_account_id, access_token, {
          ...creative,
          name: `${creative.name || "Creative"}_${Date.now()}`, // ✅ đảm bảo unique
        });
        fbCreativeId = newCreative?.id || newCreative;
        if (fbCreativeId)
          await Creative.findByIdAndUpdate(draftId, {
            external_id: fbCreativeId,
          });
      } catch (err) {
        console.error(
          "❌ Không thể tạo lại creative:",
          err.response?.data || err.message
        );
      }
    }

    if (fbCreativeId) await fbUpdate(fbCreativeId, fields, "creative");

    const updated =
      (draftId &&
        (await Creative.findByIdAndUpdate(
          draftId,
          { ...fields, updated_at: now, external_id: fbCreativeId },
          { new: true }
        ))) ||
      (await Creative.findOneAndUpdate(
        { external_id: fbCreativeId },
        { ...fields, updated_at: now },
        { new: true }
      ));
    result.creative = updated;
  }

  // ✅ Ad
  if (ad) {
    const { external_id, draftId, ...fields } = ad;
    let fbAdId = external_id;

    if (!fbAdId && adset?.external_id && creative?.external_id) {
      console.log("⚪ Ad chưa có external_id → tạo mới trên Facebook...");
      try {
        const newAd = await createAd(ad_account_id, access_token, {
          ...ad,
          name: ad.name || "Quảng cáo mới",
          adset_id: adset.external_id,
          creative: { creative_id: creative.external_id },
          status: ad?.status || "PAUSED",
        });
        fbAdId = newAd?.id || newAd;
        if (fbAdId)
          await Ads.findByIdAndUpdate(draftId, { external_id: fbAdId });
      } catch (err) {
        console.error(
          "❌ Không thể tạo lại Ad:",
          err.response?.data || err.message
        );
      }
    }

    if (fbAdId) await fbUpdate(fbAdId, fields, "ad");

    const updated =
      (draftId &&
        (await Ads.findByIdAndUpdate(
          draftId,
          { ...fields, updated_at: now, external_id: fbAdId },
          { new: true }
        ))) ||
      (await Ads.findOneAndUpdate(
        { external_id: fbAdId },
        { ...fields, updated_at: now },
        { new: true }
      )) ||
      (await Ads.findOneAndUpdate(
        { set_id: adset?.draftId || adset?._id },
        { ...fields, updated_at: now },
        { new: true }
      ));
    result.ad = updated;
  }

  return result;
}

// ========================================
// 🎯 NEW FLEXIBLE SERVICES FOR DIFFERENT MODELS
// ========================================

/**
 * 🎯 Service tạo Campaign riêng biệt
 * Hỗ trợ mô hình: 1-1-1, 1-nhiều-nhiều, nhiều-nhiều-nhiều
 */
export async function publishCampaignService({
  ad_account_id,
  access_token,
  campaign,
  dry_run = false,
  campaignDraftId,
}) {
  const now = new Date();
  let fbCampaignId;

  // 🧱 1) Tìm hoặc tạo draft (nháp) với đầy đủ thông tin
  let draftCamp;

  if (campaignDraftId) {
    // ✅ VALIDATE DRAFT ID: Nếu có campaignDraftId, PHẢI tìm được draft
    draftCamp = await AdsCampaign.findById(campaignDraftId);
    if (!draftCamp) {
      throw new Error(
        `Không tìm thấy draft campaign với ID: ${campaignDraftId}`
      );
    }

    // 🔍 DEBUG: Check xem draft đã có external_id chưa
    console.log(`🔍 [publishCampaignService] Draft campaign:`, {
      _id: draftCamp._id,
      external_id: draftCamp.external_id,
      status: draftCamp.status,
      name: draftCamp.name,
    });

    // ✅ Nếu đã có external_id → Update thay vì tạo mới
    if (draftCamp.external_id) {
      console.log(
        `🔄 Draft đã có external_id (${draftCamp.external_id}), sẽ update thay vì tạo mới`
      );
      const updates = {
        name: campaign.name,
        objective: campaign.objective,
        ...(campaign.daily_budget !== undefined && {
          daily_budget: campaign.daily_budget,
        }),
        ...(campaign.lifetime_budget !== undefined && {
          lifetime_budget: campaign.lifetime_budget,
        }),
        ...(campaign.start_time && { start_time: campaign.start_time }),
        ...(campaign.stop_time && { stop_time: campaign.stop_time }),
        updated_at: new Date(),
      };

      // Update trên Facebook
      try {
        await updateCampaign(draftCamp.external_id, access_token, updates);
      } catch (fbError) {
        console.warn(
          `⚠️ Facebook update campaign failed:`,
          fbError.response?.data || fbError.message
        );
      }

      // Update trong MongoDB
      await AdsCampaign.findByIdAndUpdate(draftCamp._id, {
        ...updates,
        status: "PAUSED", // Đảm bảo status là PAUSED sau khi update
      });

      return {
        success: true,
        campaignId: draftCamp.external_id,
        campaignDbId: draftCamp._id,
        draftId: draftCamp._id,
        message: `Campaign "${campaign.name}" đã được cập nhật thành công`,
      };
    }

    // ✅ UPDATE DRAFT VỚI TẤT CẢ FIELD TỪ PAYLOAD TRƯỚC KHI PUBLISH
    await AdsCampaign.findByIdAndUpdate(draftCamp._id, {
      name: campaign.name,
      objective: campaign.objective,
      ...(campaign.daily_budget !== undefined && {
        daily_budget: campaign.daily_budget,
      }),
      ...(campaign.lifetime_budget !== undefined && {
        lifetime_budget: campaign.lifetime_budget,
      }),
      ...(campaign.start_time && { start_time: campaign.start_time }),
      ...(campaign.stop_time && { stop_time: campaign.stop_time }),
      // ...(campaign.page_id && { page_id: campaign.page_id }),
      // ...(campaign.page_name && { page_name: campaign.page_name }),
      updated_at: new Date(),
    });
  } else {
    // ✅ CHỈ TẠO MỚI KHI KHÔNG CÓ DRAFTID (trường hợp tạo mới hoàn toàn)
    draftCamp = await AdsCampaign.create({
      name: campaign?.name,
      objective: campaign?.objective,
      status: "DRAFT",
      account_id: campaign?.account_id,
      shop_id: campaign?.shop_id,
      // page_id: campaign?.page_id,
      // page_name: campaign?.page_name,
      daily_budget: campaign?.daily_budget,
      lifetime_budget: campaign?.lifetime_budget,
      start_time: campaign?.start_time,
      stop_time: campaign?.stop_time,
      created_by: campaign?.created_by,
    });
  }
  try {
    // 🧠 Validate cơ bản
    if (!campaign?.name || !campaign?.objective) {
      throw new Error(
        "Thiếu dữ liệu chiến dịch (campaign.name hoặc objective)."
      );
    }
    if (!ad_account_id) {
      throw new Error("Thiếu ad_account_id.");
    }
    if (!access_token) {
      throw new Error("Thiếu access_token.");
    }

    // 🚀 2) Tạo Campaign trên Facebook
    if (dry_run) {
      fbCampaignId = "dry_" + Date.now();
      console.log(`[DRY RUN] Campaign giả: ${campaign.name}`);
    } else {
      const campaignPayload = {
        name: campaign.name,
        objective: campaign.objective,
        status: "PAUSED",
        special_ad_categories: campaign?.special_ad_categories || ["NONE"],
        // Thêm các field khác nếu cần
        ...(campaign.daily_budget && { daily_budget: campaign.daily_budget }),
        ...(campaign.lifetime_budget && {
          lifetime_budget: campaign.lifetime_budget,
        }),
        ...(campaign.start_time && { start_time: campaign.start_time }),
        ...(campaign.stop_time && { stop_time: campaign.stop_time }),
      };

      console.log(
        `📤 Campaign Payload gửi Facebook:`,
        JSON.stringify(campaignPayload, null, 2)
      );
      fbCampaignId = await createCampaign(
        ad_account_id,
        access_token,
        campaignPayload
      );
    }

    // ✅ UPDATE DRAFT VỚI external_id VÀ STATUS PAUSED (KHÔNG TẠO MỚI)
    console.log(
      `💾 Update draft Campaign trong database: ${draftCamp._id} -> ${fbCampaignId}`
    );
    await AdsCampaign.findByIdAndUpdate(draftCamp._id, {
      external_id: fbCampaignId,
      external_account_id: ad_account_id,
      status: "PAUSED", // ✅ CHUYỂN TỪ DRAFT THÀNH PAUSED
      synced_at: now,
      updated_at: now,
    });

    return {
      success: true,
      campaignId: fbCampaignId, // Facebook Campaign ID
      campaignDbId: draftCamp._id, // MongoDB _id (để dùng cho AdSet)
      draftId: draftCamp._id, // Giữ lại để tương thích
      message: `Campaign "${campaign.name}" đã được tạo thành công`,
    };
  } catch (error) {
    console.error("❌ Lỗi tạo Campaign:", error);

    // ✅ Cập nhật status FAILED nếu có draftCamp
    if (draftCamp?._id) {
      const errorMessage =
        error?.response?.data?.error_user_msg ||
        error?.response?.data?.error?.error_user_msg ||
        error?.message ||
        "Lỗi không xác định";

      await AdsCampaign.findByIdAndUpdate(draftCamp._id, {
        status: "FAILED",
        "meta.last_error": errorMessage,
        ...(ad_account_id && { external_account_id: ad_account_id }), // ✅ Thêm external_account_id
        updated_at: new Date(),
      });
      console.log(
        `⚠️ Campaign ${draftCamp._id} đã được đánh dấu FAILED: ${errorMessage}`
      );
    }

    throw error;
  }
}

/**
 * 🎯 Service tạo AdSet cho Campaign đã có
 * Hỗ trợ mô hình: 1-nhiều-nhiều, nhiều-nhiều-nhiều
 */
export async function publishAdsetService({
  ad_account_id,
  access_token,
  campaignId, // ID của campaign đã tạo
  campaignDbId, // MongoDB _id của campaign
  adset,
  dry_run = false,
  adsetDraftId,
}) {
  const now = new Date();
  let fbAdSetId;

  // 🎯 Save original locations (with names) for database storage
  const originalLocations = adset.targeting?.locations
    ? { ...adset.targeting.locations }
    : null;

  // 🎯 Transform targeting if it has locations structure
  console.log(
    "🎯 [publishAdsetService] Adset before transform:",
    JSON.stringify(
      {
        name: adset.name,
        targeting: adset.targeting,
      },
      null,
      2
    )
  );

  let transformedAdset;
  try {
    // Pass access_token for Mapbox->Facebook key mapping
    transformedAdset = await transformAdsetTargeting(adset, access_token);
    console.log(
      "✅ [publishAdsetService] Adset after transform:",
      JSON.stringify(
        {
          name: transformedAdset.name,
          targeting: transformedAdset.targeting,
        },
        null,
        2
      )
    );
  } catch (targetingError) {
    console.error("❌ Error transforming targeting:", targetingError.message);
    throw new Error(`Targeting validation failed: ${targetingError.message}`);
  }

  // 🎯 Create targeting for database (keep locations with names)
  const targetingForDatabase = originalLocations
    ? { ...transformedAdset.targeting, locations: originalLocations }
    : transformedAdset.targeting;

  // Use transformed adset for Facebook API, but keep original locations for DB
  adset = transformedAdset;

  // 🧱 1) Tìm hoặc tạo draft (nháp) với đầy đủ thông tin
  let draftSet;

  if (adsetDraftId) {
    // ✅ VALIDATE DRAFT ID: Nếu có adsetDraftId, PHẢI tìm được draft
    draftSet = await AdsSet.findById(adsetDraftId);
    if (!draftSet) {
      throw new Error(`Không tìm thấy draft adset với ID: ${adsetDraftId}`);
    }

    // 🔍 DEBUG: Check xem draft đã có external_id chưa
    console.log(`🔍 [publishAdsetService] Draft adset:`, {
      _id: draftSet._id,
      external_id: draftSet.external_id,
      status: draftSet.status,
      name: draftSet.name,
    });

    // ✅ Nếu đã có external_id → Update thay vì tạo mới
    if (draftSet.external_id) {
      console.log(
        `🔄 Draft đã có external_id (${draftSet.external_id}), sẽ update thay vì tạo mới`
      );

      // 🎯 Transform targeting trước khi update (giống create)
      let updateAdset = adset;
      try {
        updateAdset = await transformAdsetTargeting(adset, access_token);
        console.log(
          "✅ [Update Adset] Adset after transform:",
          JSON.stringify(
            {
              name: updateAdset.name,
              targeting: updateAdset.targeting,
            },
            null,
            2
          )
        );
      } catch (targetingError) {
        console.error(
          "❌ [Update Adset] Error transforming targeting:",
          targetingError.message
        );
        throw new Error(
          `Targeting validation failed: ${targetingError.message}`
        );
      }

      // Build promoted_object theo format create (xóa null/undefined)
      let promotedObject = null;
      if (updateAdset.promoted_object) {
        const obj = { ...updateAdset.promoted_object };
        Object.keys(obj).forEach((key) => {
          if (obj[key] === null || obj[key] === undefined) {
            delete obj[key];
          }
        });
        if (Object.keys(obj).length > 0) {
          promotedObject = obj;
        }
      }

      // Loại bỏ field 'locations' và '_regionNames' khỏi targeting (không hợp lệ với Facebook)
      let cleanTargeting = updateAdset.targeting || {};
      if (cleanTargeting.locations || cleanTargeting._regionNames) {
        const { locations, _regionNames, ...rest } = cleanTargeting;
        cleanTargeting = rest;
      }

      // Đảm bảo geo_locations có ít nhất một location
      if (
        !cleanTargeting.geo_locations ||
        (!cleanTargeting.geo_locations.countries &&
          !cleanTargeting.geo_locations.regions &&
          !cleanTargeting.geo_locations.cities &&
          !cleanTargeting.geo_locations.custom_locations)
      ) {
        cleanTargeting.geo_locations = { countries: ["VN"] };
        console.log(
          '⚠️ [Update Adset] No geo_locations found, adding default: countries: ["VN"]'
        );
      }

      // Format update giống hệt format create (trừ campaign_id và status)
      const updates = {
        name: updateAdset.name,
        optimization_goal: updateAdset.optimization_goal,
        billing_event: updateAdset.billing_event,
        bid_strategy: updateAdset.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
        ...(updateAdset.bid_amount !== undefined && {
          bid_amount: updateAdset.bid_amount,
        }),
        ...(updateAdset.daily_budget !== undefined && {
          daily_budget: updateAdset.daily_budget,
        }),
        ...(updateAdset.lifetime_budget !== undefined && {
          lifetime_budget: updateAdset.lifetime_budget,
        }),
        targeting: cleanTargeting, // Clean targeting with geo_locations
        // ...(updateAdset.start_time && { start_time: updateAdset.start_time }),
        ...(updateAdset.end_time && { end_time: updateAdset.end_time }),
        ...(promotedObject && { promoted_object: promotedObject }),
        ...(updateAdset.pixel_id && { pixel_id: updateAdset.pixel_id }),
        ...(updateAdset.conversion_event && {
          conversion_event: updateAdset.conversion_event,
        }),
        // ✅ Map destination: ưu tiên destination_type > engagement_destination > traffic_destination
        ...(updateAdset.destination_type && {
          destination_type: updateAdset.destination_type
        }),
        ...(!updateAdset.destination_type && updateAdset.engagement_destination && {
          destination_type: mapEngagementDestination(updateAdset.engagement_destination)
        }),
        ...(!updateAdset.destination_type && !updateAdset.engagement_destination && updateAdset.traffic_destination && {
          destination_type: updateAdset.traffic_destination
        }),
      };

      console.log(
        `📋 Updating Adset ${draftSet.external_id} với fields:`,
        Object.keys(updates)
      );
      console.log(
        `📍 Targeting geo_locations:`,
        JSON.stringify(updates.targeting?.geo_locations, null, 2)
      );

      // Update trên Facebook
      try {
        await updateAdset(draftSet.external_id, access_token, updates);
      } catch (fbError) {
        console.warn(
          `⚠️ Facebook update adset failed:`,
          fbError.response?.data || fbError.message
        );
      }

      // Update trong MongoDB (keep locations with names for edit mode)
      // Save original locations for database storage
      const originalLocationsForUpdate = adset.targeting?.locations
        ? { ...adset.targeting.locations }
        : null;
      const targetingForDatabaseUpdate = originalLocationsForUpdate
        ? { ...cleanTargeting, locations: originalLocationsForUpdate }
        : cleanTargeting;

      await AdsSet.findByIdAndUpdate(draftSet._id, {
        name: updateAdset.name,
        optimization_goal: updateAdset.optimization_goal,
        conversion_event: updateAdset.conversion_event,
        billing_event: updateAdset.billing_event,
        bid_strategy: updateAdset.bid_strategy,
        bid_amount: updateAdset.bid_amount,
        ...(updateAdset.daily_budget !== undefined && {
          daily_budget: updateAdset.daily_budget,
        }),
        ...(updateAdset.lifetime_budget !== undefined && {
          lifetime_budget: updateAdset.lifetime_budget,
        }),
        // start_time không thể update nếu adset đã bắt đầu
        ...(updateAdset.end_time && { end_time: updateAdset.end_time }),
        targeting: targetingForDatabaseUpdate, // Use targeting with locations preserved
        ...(updateAdset.pixel_id && { pixel_id: updateAdset.pixel_id }),
        traffic_destination: updateAdset.traffic_destination || null,
        engagement_destination: updateAdset.engagement_destination || null,
        destination_type: updateAdset.destination_type || null,
        promoted_object: updateAdset.promoted_object || null,
        ...(updateAdset.page_id && { page_id: updateAdset.page_id }),
        ...(updateAdset.page_name && { page_name: updateAdset.page_name }),
        status: "PAUSED", // Đảm bảo status là PAUSED sau khi update
        updated_at: new Date(),
      });

      return {
        success: true,
        adsetId: draftSet.external_id,
        adsetDbId: draftSet._id,
        draftId: draftSet._id,
        message: `AdSet "${adset.name}" đã được cập nhật thành công`,
      };
    }

    // ✅ UPDATE DRAFT VỚI TẤT CẢ FIELD TỪ PAYLOAD TRƯỚC KHI PUBLISH
    await AdsSet.findByIdAndUpdate(draftSet._id, {
      name: adset.name,
      optimization_goal: adset.optimization_goal,
      conversion_event: adset.conversion_event,
      billing_event: adset.billing_event,
      bid_strategy: adset.bid_strategy,
      bid_amount: adset.bid_amount,
      ...(adset.daily_budget && { daily_budget: adset.daily_budget }),
      ...(adset.lifetime_budget && { lifetime_budget: adset.lifetime_budget }),
      ...(adset.start_time && { start_time: adset.start_time }),
      ...(adset.end_time && { end_time: adset.end_time }),
      targeting: targetingForDatabase, // Use targeting with locations preserved
      ...(adset.pixel_id && { pixel_id: adset.pixel_id }),
      traffic_destination:
        adset.traffic_destination || adset.destination_type || null,
      promoted_object: adset.promoted_object || null,
      // ✅ THÊM page_id và page_name từ adset (đã di chuyển từ campaign)
      ...(adset.page_id && { page_id: adset.page_id }),
      ...(adset.page_name && { page_name: adset.page_name }),
      updated_at: new Date(),
    });
  } else {
    // ✅ CHỈ TẠO MỚI KHI KHÔNG CÓ DRAFTID (trường hợp tạo mới hoàn toàn)
    // 🔍 TÌM account_id (MongoDB _id) từ ad_account_id (external_id)
    const adsAccount = await AdsAccount.findOne({
      external_id: {
        $in: [
          ad_account_id,
          `act_${ad_account_id}`,
          ad_account_id.replace("act_", ""),
        ],
      },
    });

    if (!adsAccount) {
      throw new Error(
        `Không tìm thấy AdsAccount với external_id: ${ad_account_id}`
      );
    }

    draftSet = await AdsSet.create({
      account_id: adsAccount._id, // ✅ THÊM account_id (MongoDB _id)
      campaign_id: campaignDbId, // MongoDB _id của campaign
      name: adset?.name,
      status: "DRAFT",
      optimization_goal: adset?.optimization_goal,
      billing_event: adset?.billing_event,
      bid_strategy: adset?.bid_strategy,
      bid_amount: adset?.bid_amount,
      daily_budget: adset?.daily_budget,
      lifetime_budget: adset?.lifetime_budget,
      start_time: adset?.start_time,
      end_time: adset?.end_time,
      targeting: targetingForDatabase, // Use targeting with locations preserved
      conversion_event: adset?.conversion_event,
      pixel_id: adset?.pixel_id,
      traffic_destination: adset?.traffic_destination || null,
      engagement_destination: adset?.engagement_destination || null,
      destination_type: adset?.destination_type || null,
      promoted_object: adset?.promoted_object || null,
      // ✅ THÊM page_id và page_name từ adset (đã di chuyển từ campaign)
      ...(adset.page_id && { page_id: adset.page_id }),
      ...(adset.page_name && { page_name: adset.page_name }),
      created_by: adset?.created_by,
    });
  }

  try {
    // 🧠 Validate cơ bản
    if (!adset?.name) {
      throw new Error("Thiếu tên nhóm quảng cáo (adset.name).");
    }
    if (!campaignId) {
      throw new Error("Thiếu campaignId.");
    }
    if (!ad_account_id) {
      throw new Error("Thiếu ad_account_id.");
    }
    if (!access_token) {
      throw new Error("Thiếu access_token.");
    }

    // 🚀 2) Tạo AdSet trên Facebook
    if (dry_run) {
      fbAdSetId = "dry_" + (Date.now() + 1);
      console.log(`[DRY RUN] AdSet giả: ${adset.name}`);
    } else {
      console.log(`🚀 Tạo AdSet trên Facebook: ${adset.name}`);

      // Build promoted_object theo bảng ODAX v23.0
      // Các trường: page_id, pixel_id, custom_event_type, application_id, object_store_url, event_id
      let promotedObject = null;

      if (adset.promoted_object) {
        const obj = { ...adset.promoted_object };

        // Xóa các field null/undefined để tránh gửi lên Facebook
        Object.keys(obj).forEach((key) => {
          if (obj[key] === null || obj[key] === undefined) {
            delete obj[key];
          }
        });

        // Chỉ gửi promoted_object nếu có ít nhất 1 field hợp lệ
        if (Object.keys(obj).length > 0) {
          promotedObject = obj;
        }
      }
      // Chỉ gửi các field cần thiết cho Facebook AdSet API
      const adsetPayload = {
        name: adset.name,
        campaign_id: campaignId,
        status: "PAUSED",
        optimization_goal: adset.optimization_goal,
        billing_event: adset.billing_event,
        bid_strategy: adset.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
        ...(adset.daily_budget && { daily_budget: adset.daily_budget }),
        ...(adset.lifetime_budget && {lifetime_budget: adset.lifetime_budget,}),
        ...(adset.targeting && { targeting: adset.targeting }),
        ...(adset.start_time && { start_time: adset.start_time }),
        ...(adset.end_time && { end_time: adset.end_time }),
        ...(promotedObject && { promoted_object: promotedObject }),
        ...(adset.pixel_id && { pixel_id: adset.pixel_id }),
        ...(adset.conversion_event && {conversion_event: adset.conversion_event}),
        // ✅ Map destination: ưu tiên destination_type > engagement_destination > traffic_destination
        ...(adset.destination_type && {
          destination_type: adset.destination_type
        }),
        ...(!adset.destination_type && adset.engagement_destination && {
          destination_type: mapEngagementDestination(adset.engagement_destination)
        }),
        ...(!adset.destination_type && !adset.engagement_destination && adset.traffic_destination && {
          destination_type: adset.traffic_destination
        }),
      };

      console.log(
        `📤 Payload gửi Facebook:`,
        JSON.stringify(adsetPayload, null, 2)
      );
      fbAdSetId = await createAdSet(ad_account_id, access_token, adsetPayload);
    }

    // ✅ UPDATE DRAFT VỚI external_id VÀ STATUS PAUSED (KHÔNG TẠO MỚI)
    console.log(
      `💾 Update draft AdSet trong database: ${draftSet._id} -> ${fbAdSetId}`
    );
    await AdsSet.findByIdAndUpdate(draftSet._id, {
      external_id: fbAdSetId,
      external_account_id: ad_account_id,
      status: "PAUSED", // ✅ CHUYỂN TỪ DRAFT THÀNH PAUSED
      optimization_goal: adset.optimization_goal,
      conversion_event: adset.conversion_event,
      billing_event: adset.billing_event,
      targeting: targetingForDatabase, // Keep locations with names for edit mode
      traffic_destination: adset.traffic_destination || null,
      engagement_destination: adset.engagement_destination || null,
      destination_type: adset.destination_type || null,
      promoted_object: adset.promoted_object || null,
      // ✅ THÊM page_id và page_name từ adset (đã di chuyển từ campaign)
      ...(adset.page_id && { page_id: adset.page_id }),
      ...(adset.page_name && { page_name: adset.page_name }),
      synced_at: now,
      updated_at: now,
    });

    return {
      success: true,
      adsetId: fbAdSetId, // Facebook AdSet ID
      adsetDbId: draftSet._id, // MongoDB _id
      draftId: draftSet._id, // Giữ lại để tương thích
      message: `AdSet "${adset.name}" đã được tạo thành công`,
    };
  } catch (error) {
    console.error("❌ Lỗi tạo AdSet:", error);
    if (error.response?.data) {
      console.error(
        "📋 Facebook API Error Details:",
        JSON.stringify(error.response.data, null, 2)
      );
    }

    // ✅ Cập nhật status FAILED nếu có draftSet
    if (draftSet?._id) {
      const errorMessage =
        error?.response?.data?.error_user_msg ||
        error?.response?.data?.error?.error_user_msg ||
        error?.message ||
        "Lỗi không xác định";

      await AdsSet.findByIdAndUpdate(draftSet._id, {
        status: "FAILED",
        "meta.last_error": errorMessage,
        ...(ad_account_id && { external_account_id: ad_account_id }), // ✅ Thêm external_account_id
        updated_at: new Date(),
      });
      console.log(
        `⚠️ AdSet ${draftSet._id} đã được đánh dấu FAILED: ${errorMessage}`
      );
    }

    throw error;
  }
}

/**
 * 🎯 Service tạo Ad cho AdSet đã có
 * Hỗ trợ mô hình: 1-1-1, 1-nhiều-nhiều, nhiều-nhiều-nhiều
 */
export async function publishAdService({
  ad_account_id,
  access_token,
  adsetId, // ID của adset đã tạo
  adsetDbId, // MongoDB _id của adset
  creative, // Object creative
  ad, // Object ad
  dry_run = false,
  adDraftId, // MongoDB _id của ad
  creativeDraftId, // MongoDB _id của creative
}) {
  const now = new Date();
  let fbCreativeId, fbAdId;

  // 🧱 1) Tìm hoặc tạo draft creative
  let draftCreative;

  if (creativeDraftId) {
    console.log(`🔍 Tìm creative draft với ID: ${creativeDraftId}`);
    draftCreative = await Creative.findById(creativeDraftId);

    // Chỉ update nếu creative chưa được publish (chưa có external_id)
    if (draftCreative && !draftCreative.external_id) {
      console.log(`✏️ Update creative draft: ${creativeDraftId}`);
      await Creative.findByIdAndUpdate(creativeDraftId, {
        name: creative?.name,
        object_story_spec: creative?.object_story_spec,
        updated_at: now,
      });
      draftCreative = await Creative.findById(creativeDraftId);
    } else if (draftCreative && draftCreative.external_id) {
      // Nếu creative đã publish, không thể update → tạo mới
      console.log(
        `⚠️ Creative đã publish (${draftCreative.external_id}), tạo mới...`
      );
      draftCreative = null; // Force tạo mới
    }
  }

  if (!draftCreative) {
    console.log(`➕ Tạo mới creative draft`);
    draftCreative = await Creative.create({
      adset_id: adsetDbId, // MongoDB _id của adset
      name: creative?.name,
      object_story_spec: creative?.object_story_spec,
      created_by: creative?.created_by,
    });
  }

  // 🧱 3) Tìm hoặc tạo draft Ad
  let draftAd;

  if (adDraftId) {
    // ✅ VALIDATE DRAFT ID: Nếu có adDraftId, PHẢI tìm được draft
    draftAd = await Ads.findById(adDraftId);
    if (!draftAd) {
      throw new Error(`Không tìm thấy draft ad với ID: ${adDraftId}`);
    }

    // 🔍 DEBUG: Check xem draft đã có external_id chưa
    console.log(`🔍 [publishAdService] Draft ad:`, {
      _id: draftAd._id,
      external_id: draftAd.external_id,
      status: draftAd.status,
      name: draftAd.name,
    });

    // ✅ Nếu đã có external_id → Update thay vì tạo mới
    if (draftAd.external_id) {
      console.log(
        `🔄 Draft đã có external_id (${draftAd.external_id}), sẽ update thay vì tạo mới`
      );

      const updates = {
        name: ad.name,
        ...(ad.destination_url && { destination_url: ad.destination_url }),
        ...(ad.status && { status: ad.status }),
        updated_at: new Date(),
      };

      // Update trên Facebook (Ad chỉ update được name và status)
      try {
        await updateAd(draftAd.external_id, access_token, {
          name: ad.name,
          ...(ad.status && { status: ad.status }),
        });
      } catch (fbError) {
        console.warn(
          `⚠️ Facebook update ad failed:`,
          fbError.response?.data || fbError.message
        );
      }

      // Update trong MongoDB
      await Ads.findByIdAndUpdate(draftAd._id, {
        ...updates,
        status: ad.status || "PAUSED", // Đảm bảo status
      });

      return {
        success: true,
        adId: draftAd.external_id,
        adDbId: draftAd._id,
        creativeId: draftAd.creative_id
          ? (await Creative.findById(draftAd.creative_id))?.external_id
          : null,
        creativeDbId: draftAd.creative_id,
        draftId: draftAd._id,
        message: `Ad "${ad.name}" đã được cập nhật thành công`,
      };
    }

    // ✅ UPDATE DRAFT VỚI TẤT CẢ FIELD TỪ PAYLOAD TRƯỚC KHI PUBLISH
    await Ads.findByIdAndUpdate(draftAd._id, {
      name: ad.name,
      ...(ad.destination_url && { destination_url: ad.destination_url }),
      creative_id: draftCreative._id,
      updated_at: new Date(),
    });
  } else {
    // ✅ CHỈ TẠO MỚI KHI KHÔNG CÓ DRAFTID (trường hợp tạo mới hoàn toàn)
    draftAd = await Ads.create({
      set_id: adsetDbId, // MongoDB _id của adset
      name: ad?.name,
      creative_id: draftCreative._id,
      status: "DRAFT",
      created_by: ad?.created_by,
    });
  }

  try {
    // 🧠 Validate cơ bản
    if (!creative?.object_story_spec) {
      throw new Error("Thiếu nội dung creative.object_story_spec.");
    }
    if (!ad?.name) {
      throw new Error("Thiếu tên quảng cáo (ad.name).");
    }
    if (!adsetId) {
      throw new Error("Thiếu adsetId.");
    }
    if (!ad_account_id) {
      throw new Error("Thiếu ad_account_id.");
    }
    if (!access_token) {
      throw new Error("Thiếu access_token.");
    }

    // 2) Tạo Creative trên Facebook
    if (dry_run) {
      fbCreativeId = "dry_" + (Date.now() + 2);
      console.log(`[DRY RUN] Creative giả: ${creative.name}`);
    } else {
      // Validate: Creative PHẢI CÓ page_id hợp lệ (không phải placeholder)
      const creativePageId = creative?.object_story_spec?.page_id;
      if (!creativePageId || creativePageId === "fb_page_id_placeholder") {
        throw new Error(
          `❌ Creative không có page_id hợp lệ. Nhận được: "${creativePageId}". ` +
            `Vui lòng chọn Facebook Page trước khi tạo Ad.`
        );
      }

      // Tạo Creative trước
      fbCreativeId = await createCreative(
        ad_account_id,
        access_token,
        creative
      );
      console.log(`Creative đã tạo: ${fbCreativeId}`);
    }

    // 🚀 3) Tạo Ad trên Facebook
    if (dry_run) {
      fbAdId = "dry_" + (Date.now() + 3);
      console.log(`[DRY RUN] Ad giả: ${ad.name}`);
    } else {
      // Chỉ gửi các field cần thiết cho Facebook Ad API
      const adPayload = {
        name: ad.name,
        adset_id: adsetId,
        creative: { creative_id: fbCreativeId }, // Đã có fbCreativeId
        status: "PAUSED",
        ...(ad.destination_url && { destination_url: ad.destination_url }),
      };

      fbAdId = await createAd(ad_account_id, access_token, adPayload);
      console.log(`Ad đã tạo: ${fbAdId}`);
    }

    // Lưu Creative vào database
    console.log(
      `Lưu Creative vào database: ${draftCreative._id} -> ${fbCreativeId}`
    );
    await Creative.findByIdAndUpdate(draftCreative._id, {
      external_id: fbCreativeId,
      status: "PAUSED",
      synced_at: now,
      updated_at: now,
    });

    // ✅ UPDATE DRAFT VỚI external_id VÀ STATUS PAUSED (KHÔNG TẠO MỚI)
    console.log(
      `💾 Update draft Ad trong database: ${draftAd._id} -> ${fbAdId}`
    );
    await Ads.findByIdAndUpdate(draftAd._id, {
      external_id: fbAdId,
      external_account_id: ad_account_id,
      creative_id: draftCreative._id, // ✅ Link với creative
      status: "PAUSED", // ✅ CHUYỂN TỪ DRAFT THÀNH PAUSED
      synced_at: now,
      updated_at: now,
    });

    return {
      success: true,
      adId: fbAdId,
      adDbId: draftAd._id,
      creativeId: fbCreativeId,
      creativeDbId: draftCreative._id, // ✅ Trả về để frontend biết
      draftId: draftAd._id,
      message: `Ad "${ad.name}" đã được tạo thành công`,
    };
  } catch (error) {
    console.error("Lỗi tạo Ad:", error);

    // ✅ Cập nhật status FAILED nếu có draftAd
    if (draftAd?._id) {
      const errorMessage =
        error?.response?.data?.error_user_msg ||
        error?.response?.data?.error?.error_user_msg ||
        error?.message ||
        "Lỗi không xác định";

      await Ads.findByIdAndUpdate(draftAd._id, {
        status: "FAILED",
        "meta.last_error": errorMessage,
        ...(ad_account_id && { external_account_id: ad_account_id }),
        updated_at: new Date(),
      });
      console.log(
        `⚠️ Ad ${draftAd._id} đã được đánh dấu FAILED: ${errorMessage}`
      );
    }

    throw error;
  }
}

/**
 * Service tạo toàn bộ cấu trúc linh hoạt
 * Hỗ trợ tất cả mô hình: 1-1-1, 1-nhiều-nhiều, nhiều-nhiều-nhiều
 */
export async function publishFlexibleService({
  ad_account_id,
  access_token,
  campaignsList, // Array of campaigns with nested adsets and ads
  dry_run = false,
}) {
  const results = {
    campaigns: [],
    adsets: [],
    ads: [],
    totalSuccess: 0,
    totalErrors: 0,
    errors: [],
  };

  // 🔍 LOG RECEIVED PAYLOAD
  console.log("\n🔍 ========== RECEIVED PAYLOAD IN BACKEND ==========");
  console.log("📊 Total Campaigns:", campaignsList.length);
  campaignsList.forEach((campaign, cIdx) => {
    console.log(`\n📋 Campaign ${cIdx + 1}: ${campaign.name}`);
    console.log(`  AdSets: ${campaign.adsets?.length || 0}`);
    campaign.adsets?.forEach((adset, aIdx) => {
      console.log(`    📦 AdSet ${aIdx + 1}: ${adset.name}`);
      console.log(`      Ads: ${adset.ads?.length || 0}`);
      adset.ads?.forEach((ad, adIdx) => {
        console.log(`        📝 Ad ${adIdx + 1}: ${ad.name}`);
      });
    });
  });
  console.log("====================================================\n");

  try {
    //Xử lý từng campaign
    for (
      let campaignIndex = 0;
      campaignIndex < campaignsList.length;
      campaignIndex++
    ) {
      const campaign = campaignsList[campaignIndex];

      try {
        //Bước 1: Tạo Campaign
        const campaignPayload = {
          ad_account_id,
          access_token,
          campaign,
          dry_run,
          campaignDraftId: campaign.draftId,
        };

        const campaignResult = await publishCampaignService(campaignPayload);
        results.campaigns.push(campaignResult);

        // Bước 2: Tạo AdSets SONG SONG (giới hạn 8 cùng lúc)
        console.log(
          `Bắt đầu tạo ${campaign.adsets.length} AdSets cho Campaign "${campaign.name}"...`
        );

        // Tạo tasks cho mỗi AdSet
        const adsetTasks = campaign.adsets.map(
          (adset, adsetIndex) => async () => {
            const startTime = Date.now();

            try {
              // 2.1: Tạo AdSet
              const adsetPayload = {
                ad_account_id,
                access_token,
                campaignId: campaignResult.campaignId, // Facebook Campaign ID
                campaignDbId: campaignResult.campaignDbId, // MongoDB _id
                adset,
                dry_run,
                adsetDraftId: adset.draftId,
              };

              console.log(
                ` [${adsetIndex + 1}/${campaign.adsets.length}] Tạo AdSet: "${
                  adset.name
                }"...`
              );
              const adsetResult = await publishAdsetService(adsetPayload);
              results.adsets.push(adsetResult);
              console.log(
                `AdSet "${adset.name}" đã tạo (ID: ${adsetResult.adsetId})`
              );

              // 2.2: Tạo Ads TUẦN TỰ cho AdSet này (vì phụ thuộc creative)
              if (adset.ads && adset.ads.length > 0) {
                console.log(
                  `🎨 Bắt đầu tạo ${adset.ads.length} Ads cho AdSet "${adset.name}"...`
                );
                console.log(`   AdSet._id: ${adset._id || "undefined"}`);
                console.log(
                  `   Ads in adset:`,
                  adset.ads.map((ad) => ({
                    name: ad.name,
                    adset_id: ad.adset_id,
                  }))
                );

                for (let adIndex = 0; adIndex < adset.ads.length; adIndex++) {
                  const ad = adset.ads[adIndex];

                  try {
                    console.log(
                      `   📝 [${adIndex + 1}/${adset.ads.length}] Tạo Ad: "${
                        ad.name
                      }"...`
                    );
                    console.log(
                      `      Ad.adset_id: ${ad.adset_id || "undefined"}`
                    );

                    const adPayload = {
                      ad_account_id,
                      access_token,
                      adsetId: adsetResult.adsetId, // Facebook AdSet ID
                      adsetDbId: adsetResult.adsetDbId, // MongoDB _id
                      creative: ad.creative,
                      ad,
                      dry_run,
                      adDraftId: ad.draftId,
                      creativeDraftId: ad.creative?.draftId || ad.creative?._id, // ✅ THÊM creative draft ID
                    };

                    const adResult = await publishAdService(adPayload);
                    results.ads.push(adResult);
                    results.totalSuccess++;
                    console.log(
                      `      ✅ Ad "${ad.name}" đã tạo (ID: ${adResult.adId})`
                    );
                  } catch (adError) {
                    console.error(
                      `   Lỗi tạo Ad "${ad.name}":`,
                      adError.response?.data || adError.message
                    );
                    results.totalErrors++;
                    results.errors.push({
                      type: "ad",
                      campaignIndex,
                      adsetIndex,
                      adIndex,
                      error:
                        adError.response?.data?.error?.message ||
                        adError.message,
                      error_user_msg:
                        adError.response?.data?.error?.error_user_msg ||
                        adError.response?.data?.error_user_msg ||
                        adError.response?.data?.error?.message ||
                        adError.message,
                      errorDetails: adError.response?.data,
                      name: ad.name,
                      adsetName: adset.name,
                    });
                  }
                }
              }

              const duration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log(
                `AdSet "${adset.name}" hoàn thành trong ${duration}s`
              );

              return {
                success: true,
                adsetIndex,
                adsetName: adset.name,
                adsCreated: adset.ads?.length || 0,
                duration,
              };
            } catch (adsetError) {
              const duration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.error(
                `Lỗi tạo AdSet "${adset.name}" sau ${duration}s:`,
                adsetError.message
              );
              if (adsetError.response?.data) {
                console.error(
                  "📋 Facebook API Error:",
                  JSON.stringify(adsetError.response.data, null, 2)
                );
              }
              results.totalErrors++;
              results.errors.push({
                type: "adset",
                campaignIndex,
                adsetIndex,
                error: adsetError.message,
                error_user_msg:
                  adsetError.response?.data?.error?.error_user_msg ||
                  adsetError.response?.data?.error_user_msg ||
                  adsetError.response?.data?.error?.message ||
                  adsetError.message,
                errorDetails: adsetError.response?.data,
                name: adset.name,
                campaignName: campaign.name,
              });

              return {
                success: false,
                adsetIndex,
                adsetName: adset.name,
                error: adsetError.message,
                duration,
              };
            }
          }
        );

        // Chạy tất cả AdSet tasks với giới hạn 8 cùng lúc
        const campaignStartTime = Date.now();
        const adsetResults = await runWithConcurrencyLimit(adsetTasks, 8);
        const campaignDuration = (
          (Date.now() - campaignStartTime) /
          1000
        ).toFixed(2);

        // Log tổng kết
        const successfulAdsets = adsetResults.filter((r) => r.success).length;
        const failedAdsets = adsetResults.filter((r) => !r.success).length;
        const totalAdsCreated = adsetResults.reduce(
          (sum, r) => sum + (r.adsCreated || 0),
          0
        );
        console.log(
          `Campaign "${campaign.name}" hoàn thành trong ${campaignDuration}s`
        );
      } catch (campaignError) {
        console.error(
          `Lỗi tạo Campaign "${campaign.name}":`,
          campaignError.message
        );
        results.totalErrors++;
        results.errors.push({
          type: "campaign",
          campaignIndex,
          error: campaignError.message,
          error_user_msg:
            campaignError.response?.data?.error?.error_user_msg ||
            campaignError.response?.data?.error_user_msg ||
            campaignError.response?.data?.error?.message ||
            campaignError.message,
          errorDetails: campaignError.response?.data,
          name: campaign.name,
        });
      }
    }

    return {
      success: results.totalErrors === 0,
      ...results,
      message: `Tạo thành công ${results.totalSuccess} quảng cáo trong ${campaignsList.length} chiến dịch`,
    };
  } catch (error) {
    console.error("Lỗi tổng thể:", error);
    throw error;
  }
}

/**
 * 🔄 UPDATE: Flexible service cho cascade update
 * Hỗ trợ update nhiều campaigns với cấu trúc linh hoạt (giống publishFlexibleService)
 * Update matching entities, tạo mới nếu chưa có
 */
export async function updateFlexibleService({
  ad_account_id,
  access_token,
  campaignsList, // Array of campaigns với nested adsets và ads
}) {
  const results = {
    campaigns: [],
    adsets: [],
    ads: [],
    totalUpdated: 0,
    totalCreated: 0,
    totalErrors: 0,
    errors: [],
    details: {
      updated: { campaigns: [], adsets: [], ads: [] },
      created: { campaigns: [], adsets: [], ads: [] },
    },
  };

  try {
    // Xử lý từng campaign
    for (
      let campaignIndex = 0;
      campaignIndex < campaignsList.length;
      campaignIndex++
    ) {
      const campaign = campaignsList[campaignIndex];

      try {
        // Bước 1: Update hoặc tạo Campaign
        console.log(
          `Processing campaign ${campaignIndex + 1}/${campaignsList.length}: ${
            campaign.name
          }`
        );

        const campaignResult = await updateOrCreateCampaign({
          campaign,
          ad_account_id,
          access_token,
        });

        results.campaigns.push(campaignResult);

        // Track action
        if (campaignResult.action === "updated") {
          results.totalUpdated++;
          results.details.updated.campaigns.push(campaignResult);
        } else {
          results.totalCreated++;
          results.details.created.campaigns.push(campaignResult);
        }

        // Bước 2: Xử lý AdSets với concurrency limit (8)
        console.log(
          `\nProcessing ${campaign.adsets?.length || 0} AdSets cho Campaign "${
            campaign.name
          }"...`
        );

        const adsetTasks = (campaign.adsets || []).map(
          (adset, adsetIndex) => async () => {
            const startTime = Date.now();

            try {
              // 2.1: Update hoặc tạo AdSet
              console.log(
                ` [${adsetIndex + 1}/${
                  campaign.adsets.length
                }] Processing AdSet: "${adset.name}"...`
              );

              const adsetResult = await updateOrCreateAdset({
                adset,
                campaignId: campaignResult.campaignId,
                campaignDbId: campaignResult.campaignDbId,
                ad_account_id,
                access_token,
              });

              results.adsets.push(adsetResult);

              // Track action
              if (adsetResult.action === "updated") {
                results.details.updated.adsets.push(adsetResult);
              } else {
                results.details.created.adsets.push(adsetResult);
              }

              console.log(
                `   ${
                  adsetResult.action === "updated" ? "🔄 Updated" : "➕ Created"
                } AdSet "${adset.name}" (ID: ${adsetResult.adsetId})`
              );

              // 2.2: Xử lý Ads TUẦN TỰ cho AdSet này
              if (adset.ads && adset.ads.length > 0) {
                console.log(
                  `   🎨 Processing ${adset.ads.length} Ads cho AdSet "${adset.name}"...`
                );

                for (let adIndex = 0; adIndex < adset.ads.length; adIndex++) {
                  const ad = adset.ads[adIndex];

                  try {
                    console.log(
                      `     [${adIndex + 1}/${
                        adset.ads.length
                      }] Processing Ad: "${ad.name}"...`
                    );

                    const adResult = await updateOrCreateAd({
                      ad,
                      adsetId: adsetResult.adsetId,
                      adsetDbId: adsetResult.adsetDbId,
                      ad_account_id,
                      access_token,
                    });

                    results.ads.push(adResult);

                    // Track action
                    if (adResult.action === "updated") {
                      results.totalUpdated++;
                      results.details.updated.ads.push(adResult);
                    } else {
                      results.totalCreated++;
                      results.details.created.ads.push(adResult);
                    }

                    console.log(
                      `       ${
                        adResult.action === "updated"
                          ? "🔄 Updated"
                          : "➕ Created"
                      } Ad "${ad.name}" (ID: ${adResult.adId})`
                    );
                  } catch (adError) {
                    console.error(
                      `     ❌ Lỗi xử lý Ad "${ad.name}":`,
                      adError.message
                    );
                    results.totalErrors++;
                    results.errors.push({
                      type: "ad",
                      campaignIndex,
                      adsetIndex,
                      adIndex,
                      error: adError.message,
                      error_user_msg:
                        adError.response?.data?.error?.error_user_msg ||
                        adError.response?.data?.error_user_msg ||
                        adError.response?.data?.error?.message ||
                        adError.message,
                      errorDetails: adError.response?.data,
                      name: ad.name,
                      adsetName: adset.name,
                    });
                  }
                }
              }

              const duration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log(
                `   ✅ AdSet "${adset.name}" hoàn thành trong ${duration}s`
              );

              return {
                success: true,
                adsetIndex,
                adsetName: adset.name,
                adsProcessed: adset.ads?.length || 0,
                duration,
              };
            } catch (adsetError) {
              const duration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.error(
                `   ❌ Lỗi xử lý AdSet "${adset.name}" sau ${duration}s:`,
                adsetError.message
              );
              results.totalErrors++;
              results.errors.push({
                type: "adset",
                campaignIndex,
                adsetIndex,
                error: adsetError.message,
                error_user_msg:
                  adsetError.response?.data?.error?.error_user_msg ||
                  adsetError.response?.data?.error_user_msg ||
                  adsetError.response?.data?.error?.message ||
                  adsetError.message,
                errorDetails: adsetError.response?.data,
                name: adset.name,
                campaignName: campaign.name,
              });

              return {
                success: false,
                adsetIndex,
                adsetName: adset.name,
                error: adsetError.message,
                duration,
              };
            }
          }
        );

        // Chạy tất cả AdSet tasks với giới hạn 8 cùng lúc
        const campaignStartTime = Date.now();
        const adsetResults = await runWithConcurrencyLimit(adsetTasks, 8);
        const campaignDuration = (
          (Date.now() - campaignStartTime) /
          1000
        ).toFixed(2);

        // Log tổng kết campaign
        const successfulAdsets = adsetResults.filter((r) => r.success).length;
        const failedAdsets = adsetResults.filter((r) => !r.success).length;
        const totalAdsProcessed = adsetResults.reduce(
          (sum, r) => sum + (r.adsProcessed || 0),
          0
        );
        console.log(
          `Campaign "${campaign.name}" hoàn thành trong ${campaignDuration}s`
        );
      } catch (campaignError) {
        console.error(
          `❌ Lỗi xử lý Campaign "${campaign.name}":`,
          campaignError.message
        );
        results.totalErrors++;
        results.errors.push({
          type: "campaign",
          campaignIndex,
          error: campaignError.message,
          error_user_msg:
            campaignError.response?.data?.error?.error_user_msg ||
            campaignError.response?.data?.error_user_msg ||
            campaignError.response?.data?.error?.message ||
            campaignError.message,
          errorDetails: campaignError.response?.data,
          name: campaign.name,
        });
      }
    }

    const finalMessage = `Cập nhật ${
      results.details.updated.campaigns.length +
      results.details.updated.adsets.length +
      results.details.updated.ads.length
    } entities, tạo mới ${
      results.details.created.campaigns.length +
      results.details.created.adsets.length +
      results.details.created.ads.length
    } entities trong ${campaignsList.length} campaigns`;

    console.log(`\n========== KẾT QUẢ TỔNG ==========`);
    console.log(
      `✅ Updated: ${results.details.updated.campaigns.length} campaigns, ${results.details.updated.adsets.length} adsets, ${results.details.updated.ads.length} ads`
    );
    console.log(
      `➕ Created: ${results.details.created.campaigns.length} campaigns, ${results.details.created.adsets.length} adsets, ${results.details.created.ads.length} ads`
    );
    console.log(`❌ Errors: ${results.totalErrors}`);
    console.log(`========================================\n`);

    return {
      success: results.totalErrors === 0,
      ...results,
      message: finalMessage,
    };
  } catch (error) {
    console.error("❌ Lỗi tổng thể updateFlexibleService:", error);
    throw error;
  }
}
