import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";
import Creative from "../models/ads/creative.model.js";
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
import axios from "axios";

/* =========================
 *  HELPER FUNCTIONS
 * ========================= */

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
      `🔄 Xử lý batch ${batchIndex + 1}/${batches.length} (${batch.length} items)...`
    );

    const batchResults = await Promise.all(batch.map((task) => task()));
    localResults.push(...batchResults);

    const successCount = batchResults.filter((r) => r?.success !== false).length;
    console.log(
      `✅ Batch ${batchIndex + 1} hoàn thành: ${successCount}/${batch.length} thành công`
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
  access_token 
}) {
  const now = new Date();
  const existingCampaign = await findExistingEntity(campaign, AdsCampaign);
  
  if (existingCampaign) {
    console.log(`🔄 Updating existing campaign: ${existingCampaign.name} (${existingCampaign._id})`);
    
    // Build updates (chỉ các field được phép update)
    const updates = {
      ...(campaign.name && { name: campaign.name }),
      ...(campaign.status && { status: campaign.status }),
      ...(campaign.daily_budget !== undefined && { daily_budget: campaign.daily_budget }),
      ...(campaign.lifetime_budget !== undefined && { lifetime_budget: campaign.lifetime_budget }),
      ...(campaign.start_time && { start_time: campaign.start_time }),
      ...(campaign.stop_time && { stop_time: campaign.stop_time }),
      updated_at: now,
    };
    
    // Update trên Facebook nếu có external_id
    if (existingCampaign.external_id) {
      try {
        await updateCampaign(existingCampaign.external_id, access_token, updates);
      } catch (fbError) {
        console.warn(`⚠️ Facebook update campaign failed:`, fbError.response?.data || fbError.message);
        // Continue với DB update ngay cả khi Facebook fail
      }
    }
    
    // Update trong MongoDB
    await AdsCampaign.findByIdAndUpdate(existingCampaign._id, updates);
    
    return { 
      action: 'updated',
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
  access_token 
}) {
  const now = new Date();
  const existingAdset = await findExistingEntity(adset, AdsSet);
  
  if (existingAdset) {
    console.log(`🔄 Updating existing adset: ${existingAdset.name} (${existingAdset._id})`);
    
    // Build updates
    const updates = {
      ...(adset.name && { name: adset.name }),
      // ...(adset.status && { status: adset.status }),
      ...(adset.daily_budget !== undefined && { daily_budget: adset.daily_budget }),
      ...(adset.lifetime_budget !== undefined && { lifetime_budget: adset.lifetime_budget }),
      ...(adset.end_time && { end_time: adset.end_time }),
      ...(adset.targeting && { targeting: adset.targeting }),
      ...(adset.optimization_goal && { optimization_goal: adset.optimization_goal }),
      ...(adset.bid_strategy && { bid_strategy: adset.bid_strategy }),
      ...(adset.bid_amount !== undefined && { bid_amount: adset.bid_amount }),
      ...(adset.billing_event && { billing_event: adset.billing_event }),
      ...(adset.conversion_event && { conversion_event: adset.conversion_event }),
      updated_at: now,
    };
    
    // Update trên Facebook nếu có external_id
    if (existingAdset.external_id) {
      try {
        await updateAdset(existingAdset.external_id, access_token, updates);
      } catch (fbError) {
        console.warn(`⚠️ Facebook update adset failed:`, fbError.response?.data || fbError.message);
      }
    }
    
    // Update trong MongoDB
    await AdsSet.findByIdAndUpdate(existingAdset._id, updates);
    
    return { 
      action: 'updated',
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
  access_token 
}) {
  const now = new Date();
  const existingAd = await findExistingEntity(ad, Ads);
  
  if (existingAd) {
    console.log(`🔄 Updating existing ad: ${existingAd.name} (${existingAd._id})`);
    
    // Build updates (Ad chỉ update được name và status)
    const updates = {
      ...(ad.name && { name: ad.name }),
      ...(ad.status && { status: ad.status }),
      updated_at: now,
    };
    
    // ⚠️ IMPORTANT: Facebook KHÔNG cho update creative
    // Nếu creative thay đổi, cần tạo ad mới (không implement ở đây để giữ metrics)
    
    // Update trên Facebook nếu có external_id
    if (existingAd.external_id) {
      try {
        await updateAd(existingAd.external_id, access_token, updates);
      } catch (fbError) {
        console.warn(`⚠️ Facebook update ad failed:`, fbError.response?.data || fbError.message);
      }
    }
    
    // Update trong MongoDB
    await Ads.findByIdAndUpdate(existingAd._id, updates);
    
    return { 
      action: 'updated',
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
        traffic_destination: adset?.traffic_destination || adset?.destination_type || null,
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
        status: campaign?.status || "PAUSED",
        special_ad_categories: campaign?.special_ad_categories || ["NONE"],
      });
      steps.push(async () => deleteEntity(fbCampaignId, access_token));
    }

    // Lưu Campaign vào database
    console.log(
      `💾 Lưu Campaign vào database: ${draftCamp._id} -> ${fbCampaignId}`
    );
    await AdsCampaign.findByIdAndUpdate(draftCamp._id, {
      external_id: fbCampaignId,
      external_account_id: ad_account_id,
      status: "PAUSED",
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

    // Lưu AdSet vào database
    console.log(`💾 Lưu AdSet vào database: ${draftSet._id} -> ${fbAdSetId}`);
    await AdsSet.findByIdAndUpdate(draftSet._id, {
      external_id: fbAdSetId,
      external_account_id: ad_account_id,
      status: "PAUSED",
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
      ...(rawFields?.facebookPageId ? { page_id: rawFields.facebookPageId } : {}),
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
      // Facebook payload may include destination_type derived from traffic_destination
      const fbFields = {
        ...fields,
        ...(rawFields?.traffic_destination
          ? { destination_type: rawFields.traffic_destination }
          : {}),
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
        status: campaign?.status || "PAUSED",
        special_ad_categories: campaign?.special_ad_categories || ["NONE"],
        // Thêm các field khác nếu cần
        ...(campaign.daily_budget && { daily_budget: campaign.daily_budget }),
        ...(campaign.lifetime_budget && {
          lifetime_budget: campaign.lifetime_budget,
        }),
        ...(campaign.start_time && { start_time: campaign.start_time }),
        ...(campaign.stop_time && { stop_time: campaign.stop_time }),
      };

      console.log(`📤 Campaign Payload gửi Facebook:`, JSON.stringify(campaignPayload, null, 2));
      fbCampaignId = await createCampaign(
        ad_account_id,
        access_token,
        campaignPayload
      );
    }

    // Lưu Campaign vào database
    console.log(
      `💾 Lưu Campaign vào database: ${draftCamp._id} -> ${fbCampaignId}`
    );
    await AdsCampaign.findByIdAndUpdate(draftCamp._id, {
      external_id: fbCampaignId,
      external_account_id: ad_account_id,
      status: "PAUSED",
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

  // 🧱 1) Khởi tạo draft (nháp) với đầy đủ thông tin
  const draftSet = adsetDraftId
    ? await AdsSet.findById(adsetDraftId)
    : await AdsSet.create({
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
        targeting: adset?.targeting,
        conversion_event: adset?.conversion_event,
        pixel_id: adset?.pixel_id,
        created_by: adset?.created_by,
      });

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
        Object.keys(obj).forEach(key => {
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
        status: adset?.status || "PAUSED",
        optimization_goal: adset.optimization_goal,
        billing_event: adset.billing_event,
        bid_strategy: adset.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
        ...(adset.daily_budget && { daily_budget: adset.daily_budget }),
        ...(adset.lifetime_budget && {
          lifetime_budget: adset.lifetime_budget,
        }),
        ...(adset.targeting && { targeting: adset.targeting }),
        ...(adset.start_time && { start_time: adset.start_time }),
        ...(adset.end_time && { end_time: adset.end_time }),
        ...(promotedObject && { promoted_object: promotedObject }),
        ...(adset.pixel_id && { pixel_id: adset.pixel_id }),
        ...(adset.conversion_event && { conversion_event: adset.conversion_event }),
        // ODAX: destination_type cho OUTCOME_ENGAGEMENT
        ...(adset.destination_type && { destination_type: adset.destination_type }),
      };

      console.log(`📤 Payload gửi Facebook:`, JSON.stringify(adsetPayload, null, 2));
      fbAdSetId = await createAdSet(ad_account_id, access_token, adsetPayload);
    }

    // Lưu AdSet vào database
    console.log(`💾 Lưu AdSet vào database: ${draftSet._id} -> ${fbAdSetId}`);
    await AdsSet.findByIdAndUpdate(draftSet._id, {
      external_id: fbAdSetId,
      external_account_id: ad_account_id,
      status: "PAUSED",
      optimization_goal: adset.optimization_goal,
      conversion_event: adset.conversion_event,
      billing_event: adset.billing_event,
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
      console.error("📋 Facebook API Error Details:", JSON.stringify(error.response.data, null, 2));
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
      console.log(`⚠️ Creative đã publish (${draftCreative.external_id}), tạo mới...`);
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

  const draftAd = adDraftId
    ? await Ads.findById(adDraftId)
    : await Ads.create({
        set_id: adsetDbId, // MongoDB _id của adset
        name: ad?.name,
        creative_id: draftCreative._id,
        status: "DRAFT",
        created_by: ad?.created_by,
      });

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
        status: ad?.status || "PAUSED",
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

    // Lưu Ad vào database
    console.log(`Lưu Ad vào database: ${draftAd._id} -> ${fbAdId}`);
    await Ads.findByIdAndUpdate(draftAd._id, {
      external_id: fbAdId,
      external_account_id: ad_account_id,
      creative_id: draftCreative._id, // ✅ Link với creative
      status: "PAUSED",
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
                ` [${adsetIndex + 1}/${campaign.adsets.length}] Tạo AdSet: "${adset.name}"...`
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
                console.log(`   AdSet._id: ${adset._id || 'undefined'}`);
                console.log(`   Ads in adset:`, adset.ads.map(ad => ({ name: ad.name, adset_id: ad.adset_id })));

                for (let adIndex = 0; adIndex < adset.ads.length; adIndex++) {
                  const ad = adset.ads[adIndex];

                  try {
                    console.log(
                      `   📝 [${adIndex + 1}/${adset.ads.length}] Tạo Ad: "${ad.name}"...`
                    );
                    console.log(`      Ad.adset_id: ${ad.adset_id || 'undefined'}`);
                    
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
                      error: adError.response?.data?.error?.message || adError.message,
                      error_user_msg: adError.response?.data?.error?.error_user_msg || 
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
                console.error("📋 Facebook API Error:", JSON.stringify(adsetError.response.data, null, 2));
              }
              results.totalErrors++;
              results.errors.push({
                type: "adset",
                campaignIndex,
                adsetIndex,
                error: adsetError.message,
                error_user_msg: adsetError.response?.data?.error?.error_user_msg || 
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
        console.log(`Campaign "${campaign.name}" hoàn thành trong ${campaignDuration}s`);
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
          error_user_msg: campaignError.response?.data?.error?.error_user_msg || 
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
        console.log(`Processing campaign ${campaignIndex + 1}/${campaignsList.length}: ${campaign.name}`);
        
        const campaignResult = await updateOrCreateCampaign({
          campaign,
          ad_account_id,
          access_token,
        });
        
        results.campaigns.push(campaignResult);
        
        // Track action
        if (campaignResult.action === 'updated') {
          results.totalUpdated++;
          results.details.updated.campaigns.push(campaignResult);
        } else {
          results.totalCreated++;
          results.details.created.campaigns.push(campaignResult);
        }

        // Bước 2: Xử lý AdSets với concurrency limit (8)
        console.log(
          `\nProcessing ${campaign.adsets?.length || 0} AdSets cho Campaign "${campaign.name}"...`
        );

        const adsetTasks = (campaign.adsets || []).map(
          (adset, adsetIndex) => async () => {
            const startTime = Date.now();

            try {
              // 2.1: Update hoặc tạo AdSet
              console.log(
                ` [${adsetIndex + 1}/${campaign.adsets.length}] Processing AdSet: "${adset.name}"...`
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
              if (adsetResult.action === 'updated') {
                results.details.updated.adsets.push(adsetResult);
              } else {
                results.details.created.adsets.push(adsetResult);
              }
              
              console.log(
                `   ${adsetResult.action === 'updated' ? '🔄 Updated' : '➕ Created'} AdSet "${adset.name}" (ID: ${adsetResult.adsetId})`
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
                      `     [${adIndex + 1}/${adset.ads.length}] Processing Ad: "${ad.name}"...`
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
                    if (adResult.action === 'updated') {
                      results.totalUpdated++;
                      results.details.updated.ads.push(adResult);
                    } else {
                      results.totalCreated++;
                      results.details.created.ads.push(adResult);
                    }
                    
                    console.log(
                      `       ${adResult.action === 'updated' ? '🔄 Updated' : '➕ Created'} Ad "${ad.name}" (ID: ${adResult.adId})`
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
                      error_user_msg: adError.response?.data?.error?.error_user_msg || 
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
                error_user_msg: adsetError.response?.data?.error?.error_user_msg || 
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
        console.log(`Campaign "${campaign.name}" hoàn thành trong ${campaignDuration}s`);
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
          error_user_msg: campaignError.response?.data?.error?.error_user_msg || 
                         campaignError.response?.data?.error_user_msg || 
                         campaignError.response?.data?.error?.message || 
                         campaignError.message,
          errorDetails: campaignError.response?.data,
          name: campaign.name,
        });
      }
    }

    const finalMessage = `Cập nhật ${results.details.updated.campaigns.length + results.details.updated.adsets.length + results.details.updated.ads.length} entities, tạo mới ${results.details.created.campaigns.length + results.details.created.adsets.length + results.details.created.ads.length} entities trong ${campaignsList.length} campaigns`;
    
    console.log(`\n========== KẾT QUẢ TỔNG ==========`);
    console.log(`✅ Updated: ${results.details.updated.campaigns.length} campaigns, ${results.details.updated.adsets.length} adsets, ${results.details.updated.ads.length} ads`);
    console.log(`➕ Created: ${results.details.created.campaigns.length} campaigns, ${results.details.created.adsets.length} adsets, ${results.details.created.ads.length} ads`);
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
