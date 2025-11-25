// services/fbAdsService.js
import axios from "axios";
import crypto from "crypto";

// MODELS
import AdsAccount from "../models/ads/adsAccount.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";
import AdPerformance from "../models/ads/adPerformance.model.js";
import AdHourlyInsight from "../models/ads/adHourlyInsight.model.js";

const FB_API = "https://graph.facebook.com/v23.0";

function buildFbAuthParams(accessToken) {
  const appSecret = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET || process.env.APP_SECRET;
  const base = { access_token: accessToken };
  if (!accessToken) return base;
  if (!appSecret) return base;
  try {
    const proof = crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
    return { ...base, appsecret_proof: proof };
  } catch {
    return base;
  }
}

/* =========================
 *  Helpers
 * ========================= */

// Chuẩn hóa account id: luôn trả về cả 2 dạng
function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? accountId : `act_${accountId}`;
  const withoutPrefix = hasPrefix ? accountId.substring(4) : String(accountId);
  return { withPrefix, withoutPrefix };
}

// Tìm AdsAccount trong DB theo external_id (hỗ trợ cả act_xxx và xxx)
async function findAdsAccountByExternalId(accountId) {
  const { withPrefix, withoutPrefix } = normalizeAccountPair(accountId);
  return AdsAccount.findOne({
    external_id: { $in: [withPrefix, withoutPrefix] },
  });
}

/* =========================
 *  CREATE HELPERS (giữ nguyên)
 * ========================= */
export async function createCampaign(adAccountId, accessToken, body) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const { data } = await axios.post(
    `${FB_API}/${withPrefix}/campaigns`,
    body,
    { params: buildFbAuthParams(accessToken) }
  );
  return data.id;
}

export async function createAdSet(adAccountId, accessToken, body) {
  // Clone body để tránh thay đổi dữ liệu gốc
  const payload = { ...body };
  
  // Xử lý xung đột bid_strategy và bid_amount
  if (payload.bid_strategy === 'LOWEST_COST_WITHOUT_CAP' && payload.bid_amount !== undefined) {
    console.log("🛠️ fbAdsService: Phát hiện xung đột bid_strategy/bid_amount");
    console.log(`🔧 Xóa bid_amount (${payload.bid_amount}) khi dùng LOWEST_COST_WITHOUT_CAP`);
    delete payload.bid_amount;
  }
  
  // Đảm bảo có bid_amount khi dùng LOWEST_COST_WITH_BID_CAP
  if (payload.bid_strategy === 'LOWEST_COST_WITH_BID_CAP' && payload.bid_amount === undefined) {
    console.log("⚠️ fbAdsService: Thiếu bid_amount cho LOWEST_COST_WITH_BID_CAP");
    console.log("🔧 Thêm bid_amount mặc định (100) cho LOWEST_COST_WITH_BID_CAP");
    payload.bid_amount = 100; // Giá trị mặc định
  }
  
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const { data } = await axios.post(
    `${FB_API}/${withPrefix}/adsets`,
    payload, // Sử dụng payload đã được xử lý
    { params: buildFbAuthParams(accessToken) }
  );
  return data.id;
}

export async function createCreative(adAccountId, accessToken, body) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  
  // 🔍 DETECT VIDEO: Check if media is video
  let creativePayload = { ...body };
  const linkData = body?.object_story_spec?.link_data;
  const pictureUrl = linkData?.picture;
  
  const isVideo = pictureUrl && (
    pictureUrl.includes('/video/') ||
    pictureUrl.endsWith('.mp4') ||
    pictureUrl.endsWith('.mov') ||
    pictureUrl.endsWith('.avi') ||
    pictureUrl.endsWith('.webm')
  );
  
  if (isVideo) {
    console.log(`🎥 Detected VIDEO creative: ${pictureUrl}`);
    
    try {
      // Step 1: Upload video to Facebook Ad Account
      console.log('📤 Uploading video to Facebook...');
      const videoUploadResponse = await axios.post(
        `${FB_API}/${withPrefix}/advideos`,
        {
          file_url: pictureUrl,
          name: body.name || 'Ad Video',
        },
        { params: buildFbAuthParams(accessToken) }
      );
      
      const videoId = videoUploadResponse.data.id;
      console.log(`✅ Video uploaded successfully. Video ID: ${videoId}`);
      
      // Step 2: Get video details to retrieve thumbnail
      console.log('🖼️ Fetching video thumbnail...');
      const videoDetailsResponse = await axios.get(
        `${FB_API}/${videoId}`,
        { 
          params: {
            ...buildFbAuthParams(accessToken),
            fields: 'id,picture,thumbnails'
          }
        }
      );
      
      const thumbnailUrl = videoDetailsResponse.data.picture || videoDetailsResponse.data.thumbnails?.data?.[0]?.uri;
      console.log(`✅ Thumbnail URL: ${thumbnailUrl}`);
      
      // Step 3: Create creative with video_data using video_id and thumbnail
      creativePayload = {
        name: body.name,
        object_story_spec: {
          page_id: body.object_story_spec.page_id,
          video_data: {
            video_id: videoId,
            image_url: thumbnailUrl, // ✅ Required: thumbnail for video
            message: linkData.message,
            title: linkData.name,
            link_description: linkData.description,
            call_to_action: linkData.call_to_action,
          }
        }
      };
      
      console.log('🎬 Converted to video_data format with video_id and thumbnail');
    } catch (uploadError) {
      console.error('❌ Failed to upload video to Facebook:', uploadError);
      throw new Error(`Video upload failed: ${uploadError.response?.data?.error?.message || uploadError.message}`);
    }
  } else {
    console.log(`🖼️ Detected IMAGE creative`);
  }
  
  // ✅ Whitelist: Chỉ gửi các field Facebook chấp nhận
  const allowedFields = [
    'name',
    'object_story_spec',
    'image_hash',
    'video_id',
    'thumbnail_url',
    'asset_feed_spec',
    'url_tags',
    'degrees_of_freedom_spec',
    'instagram_actor_id',
    'instagram_permalink_url',
    'interactive_components_spec',
  ];
  
  const filteredBody = Object.keys(creativePayload)
    .filter(key => allowedFields.includes(key) && creativePayload[key] !== undefined)
    .reduce((obj, key) => {
      obj[key] = creativePayload[key];
      return obj;
    }, {});
  
  console.log('🎨 Creating creative with filtered fields:', Object.keys(filteredBody));
  
  const { data } = await axios.post(
    `${FB_API}/${withPrefix}/adcreatives`,
    filteredBody,  // ✅ Gửi filtered body
    { params: buildFbAuthParams(accessToken) }
  );
  return data.id;
}

export async function createAd(adAccountId, accessToken, body) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  
  // ✅ Whitelist: Chỉ gửi các field Facebook chấp nhận cho Ad
  const allowedFields = [
    'name',
    'adset_id',
    'creative',
    'status',
    'tracking_specs',
    'conversion_specs',
    'destination_url',
  ];
  
  const filteredBody = Object.keys(body)
    .filter(key => allowedFields.includes(key) && body[key] !== undefined)
    .reduce((obj, key) => {
      obj[key] = body[key];
      return obj;
    }, {});
  
  console.log('📢 Creating ad with filtered fields:', Object.keys(filteredBody));
  
  const { data } = await axios.post(
    `${FB_API}/${withPrefix}/ads`,
    filteredBody,  // ✅ Gửi filtered body
    { params: buildFbAuthParams(accessToken) }
  );
  return data.id;
}

/**
 * Xoá entity (campaign, adset, ad, creative...) khỏi Facebook
 * @param {string} entityId - ID thật của entity trên Facebook
 * @param {string} accessToken - Facebook access_token hợp lệ
 * @returns {boolean} true nếu xoá thành công, false nếu lỗi
 */
export async function deleteEntity(entityId, accessToken) {
  if (!entityId || !accessToken) {
    console.warn("⚠️ deleteEntity() thiếu entityId hoặc accessToken");
    return false;
  }

  try {
    const url = `${FB_API}/${entityId}`;
    const { data } = await axios.delete(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Facebook trả về { success: true } nếu xoá thành công
    if (data?.success) {
      console.log(`✅ Đã xoá thành công entity ${entityId} trên Facebook`);
      return true;
    } else {
      console.warn(`⚠️ Facebook không xoá entity ${entityId}:`, data);
      return false;
    }
  } catch (err) {
    const fbErr = err.response?.data?.error;
    if (fbErr?.code === 190) {
      console.error("🚨 Token Facebook hết hạn hoặc không hợp lệ:", fbErr);
    } else if (fbErr?.code === 10) {
      console.error("🚨 Không có quyền xoá entity:", fbErr);
    } else {
      console.error(`❌ Lỗi xoá entity ${entityId}:`, fbErr || err.message);
    }
    return false;
  }
}


/* =========================
 *  UPDATE STATUS HELPERS
 * ========================= */
export async function updateCampaignStatus(entityId, accessToken, status) {
  const { data } = await axios.post(
    `${FB_API}/${entityId}`,
    { status },
    { params: buildFbAuthParams(accessToken) }
  );
  return data;
}

export async function updateAdsetStatus(entityId, accessToken, status) {
  const { data } = await axios.post(
    `${FB_API}/${entityId}`,
    { status },
    { params: buildFbAuthParams(accessToken) }
  );
  return data;
}

export async function updateAdStatus(entityId, accessToken, status) {
  const { data } = await axios.post(
    `${FB_API}/${entityId}`,
    { status },
    { params: buildFbAuthParams(accessToken) }
  );
  return data;
}

/**
 * Update campaign với nhiều fields (không chỉ status)
 * Whitelist: name, status, daily_budget, lifetime_budget, start_time, stop_time
 */
export async function updateCampaign(entityId, accessToken, updates) {
  const payload = { ...updates };
  
  // Whitelist các fields có thể update cho Campaign
  const allowedFields = ['name', 'status', 'daily_budget', 'lifetime_budget', 'start_time', 'stop_time'];
  const filteredPayload = Object.keys(payload)
    .filter(key => allowedFields.includes(key) && payload[key] !== undefined)
    .reduce((obj, key) => {
      obj[key] = payload[key];
      return obj;
    }, {});

  // Nếu không có field nào để update, return ngay
  if (Object.keys(filteredPayload).length === 0) {
    console.log("⚠️ updateCampaign: Không có field nào để update");
    return null;
  }

  console.log(`🔄 Updating campaign ${entityId} với fields:`, Object.keys(filteredPayload));
  const { data } = await axios.post(
    `${FB_API}/${entityId}`,
    filteredPayload,
    { params: buildFbAuthParams(accessToken) }
  );
  return data;
}

/**
 * Update adset với nhiều fields
 * Whitelist: name, status, daily_budget, lifetime_budget, start_time, end_time, 
 *            targeting, optimization_goal, bid_strategy, bid_amount, billing_event, conversion_event
 */
export async function updateAdset(entityId, accessToken, updates) {
  const payload = { ...updates };
  
  // ✅ Xử lý xung đột bid_strategy (giống createAdSet)
  if (payload.bid_strategy === 'LOWEST_COST_WITHOUT_CAP' && payload.bid_amount !== undefined) {
    console.log("🔧 updateAdset: Xóa bid_amount khi dùng LOWEST_COST_WITHOUT_CAP");
    delete payload.bid_amount;
  }
  
  // ✅ Đảm bảo có bid_amount khi dùng LOWEST_COST_WITH_BID_CAP
  if (payload.bid_strategy === 'LOWEST_COST_WITH_BID_CAP' && payload.bid_amount === undefined) {
    console.log("⚠️ updateAdset: Thiếu bid_amount cho LOWEST_COST_WITH_BID_CAP");
    payload.bid_amount = 100; // Giá trị mặc định
  }
  
  // Whitelist các fields có thể update cho AdSet
  const allowedFields = [
    'name', 'status', 'daily_budget', 'lifetime_budget', 
    'start_time', 'end_time', 'targeting', 'optimization_goal',
    'bid_strategy', 'bid_amount', 'billing_event', 'conversion_event',
    'promoted_object', 'destination_type', 'pixel_id'
  ];
  
  const filteredPayload = Object.keys(payload)
    .filter(key => allowedFields.includes(key) && payload[key] !== undefined)
    .reduce((obj, key) => {
      obj[key] = payload[key];
      return obj;
    }, {});

  // Nếu không có field nào để update, return ngay
  if (Object.keys(filteredPayload).length === 0) {
    console.log("⚠️ updateAdset: Không có field nào để update");
    return null;
  }

  console.log(`🔄 Updating Adset ${entityId} với fields:`, Object.keys(filteredPayload));
  const { data } = await axios.post(
    `${FB_API}/${entityId}`,
    filteredPayload,
    { params: buildFbAuthParams(accessToken) }
  );
  return data;
}

/**
 * Update ad (chỉ name và status - Facebook không cho update creative)
 * NOTE: Creative không thể update - phải tạo ad mới nếu muốn đổi creative
 */
export async function updateAd(entityId, accessToken, updates) {
  const payload = { ...updates };
  
  // Ad chỉ update được name và status
  const allowedFields = ['name', 'status'];
  const filteredPayload = Object.keys(payload)
    .filter(key => allowedFields.includes(key) && payload[key] !== undefined)
    .reduce((obj, key) => {
      obj[key] = payload[key];
      return obj;
    }, {});

  // Nếu không có field nào để update, return ngay
  if (Object.keys(filteredPayload).length === 0) {
    console.log("⚠️ updateAd: Không có field nào để update");
    return null;
  }

  console.log(`🔄 Updating Ad ${entityId} với fields:`, Object.keys(filteredPayload));
  const { data } = await axios.post(
    `${FB_API}/${entityId}`,
    filteredPayload,
    { params: buildFbAuthParams(accessToken) }
  );
  return data;
}

/* =========================
 *  FETCH HELPERS (giữ nguyên fields)
 * ========================= */

export async function fetchCampaignsFromFacebook(accessToken, adAccountId) {
  try {
    const { withPrefix } = normalizeAccountPair(adAccountId);
    const url = `${FB_API}/${withPrefix}/campaigns`;
    const response = await axios.get(url, {
      params: {
        fields:
          "id,name,status,objective,special_ad_categories,daily_budget,lifetime_budget,start_time,stop_time,effective_status",
        access_token: accessToken,
        limit: 100,
      },
    });
    return response.data?.data || [];
  } catch (err) {
    console.error(
      `Error fetching campaigns from Facebook for account ${adAccountId}:`,
      err.response?.data || err.message
    );
    return [];
  }
}

export async function fetchAdsetsFromFacebook(accessToken, adAccountId) {
  try {
    const { withPrefix } = normalizeAccountPair(adAccountId);
    const url = `${FB_API}/${withPrefix}/adsets`;
    const response = await axios.get(url, {
      params: {
        fields:
          "id,name,status,campaign{id},daily_budget,lifetime_budget,optimization_goal,targeting,start_time,end_time,effective_status",
        access_token: accessToken,
        limit: 100,
      },
    });
    return response.data?.data || [];
  } catch (err) {
    console.error(
      `Error fetching adsets from Facebook for account ${adAccountId}:`,
      err.response?.data || err.message
    );
    return [];
  }
}

export async function fetchAdsFromFacebook(accessToken, adAccountId) {
  try {
    const { withPrefix } = normalizeAccountPair(adAccountId);
    const url = `${FB_API}/${withPrefix}/ads`;
    const response = await axios.get(url, {
      params: {
        fields: "id,name,status,adset_id,creative,effective_status",
        access_token: accessToken,
        limit: 100,
      },
    });
    return response.data?.data || [];
  } catch (err) {
    console.error(
      `Error fetching ads from Facebook for account ${adAccountId}:`,
      JSON.stringify(err.response?.data || err.message, null, 2)
    );
    return [];
  }
}

/* =========================
 *  SYNC → DB (đã tối ưu & map đủ _id)
 * ========================= */

/**
 * Đồng bộ Campaigns từ Facebook → DB
 * - Bắt buộc: phải tìm được AdsAccount trong DB (để có account_id + shop_id)
 * - Lưu external_account_id ở dạng "không prefix" để đồng bộ với filter hiện có
 */
export async function syncCampaignsFromFacebook(accessToken, adAccountId) {
  try {
    const campaigns = await fetchCampaignsFromFacebook(
      accessToken,
      adAccountId
    );
    console.log(
      `Fetched ${campaigns.length} campaigns from Facebook for account ${adAccountId}`
    );

    const adsAccount = await findAdsAccountByExternalId(adAccountId);
    if (!adsAccount) {
      console.warn(
        `⚠️ Không tìm thấy AdsAccount trong DB cho ${adAccountId}. Bỏ qua upsert campaigns để tránh ValidationError.`
      );
      return [];
    }

    const { withoutPrefix } = normalizeAccountPair(adAccountId);
    
    if (campaigns.length === 0) {
      return [];
    }

    // ✅ BULK WRITE: Sử dụng bulkWrite thay vì từng findOneAndUpdate
    const bulkOps = [];
    const validCampaigns = [];

    for (const c of campaigns) {
      try {
        const data = {
          shop_id: adsAccount.shop_id, // required by schema
          account_id: adsAccount._id, // required by schema
          name: c.name,
          status: c.status,
          objective: c.objective,
          external_id: c.id,
          external_account_id: withoutPrefix, // chuẩn với filter hiện có
          effective_status: c.effective_status,
          special_ad_categories: c.special_ad_categories,
          daily_budget: c.daily_budget,
          lifetime_budget: c.lifetime_budget,
          start_time: c.start_time,
          stop_time: c.stop_time,
        };

        bulkOps.push({
          updateOne: {
            filter: { external_id: c.id },
            update: { $set: data },
            upsert: true
          }
        });
        validCampaigns.push(c);
      } catch (err) {
        console.error(`Error preparing campaign ${c.id}:`, err.message);
      }
    }

    // Thực hiện bulk write
    if (bulkOps.length > 0) {
      await AdsCampaign.bulkWrite(bulkOps);
    }

    // Fetch lại để trả về documents đã upsert
    const externalIds = validCampaigns.map(c => c.id);
    const results = externalIds.length > 0 
      ? await AdsCampaign.find({ external_id: { $in: externalIds } })
      : [];
    // Reconcile: soft-delete campaigns that no longer exist on Facebook for this account
    // ✅ KHÔNG update các items đã ARCHIVED (chúng đã được xóa trên FB nhưng giữ status ARCHIVED)
    try {
      const fetchedIds = new Set(campaigns.map((c) => c.id));
      const now = new Date();
      await AdsCampaign.updateMany(
        {
          external_account_id: withoutPrefix,
          external_id: { $nin: Array.from(fetchedIds) },
          status: { $nin: ["DELETED", "ARCHIVED"] }, // ✅ Bỏ qua cả ARCHIVED và DELETED
        },
        { $set: { status: "DELETED", deleted_at: now } }
      );
    } catch (reconcileErr) {
      console.warn("⚠️ Reconcile campaigns failed:", reconcileErr?.message || reconcileErr);
    }

    return results;
  } catch (err) {
    console.error(
      `Error syncing campaigns for account ${adAccountId}:`,
      err.message
    );
    throw err;
  }
}

/**
 * Đồng bộ AdSets từ Facebook → DB
 * - Map campaign_id (FB) → _id (Mongo)
 * - Nếu chưa có campaign tương ứng → skip để tránh vi phạm required
 */
export async function syncAdSetsFromFacebook(accessToken, adAccountId) {
  try {
    const adsets = await fetchAdsetsFromFacebook(accessToken, adAccountId);
    console.log(
      `Fetched ${adsets.length} adsets from Facebook for account ${adAccountId}`
    );

    const { withoutPrefix } = normalizeAccountPair(adAccountId);
    
    if (adsets.length === 0) {
      return [];
    }

    // ✅ BATCH QUERY: Lấy tất cả campaigns một lần thay vì query từng cái (giải quyết N+1 problem)
    const campaignExternalIds = [...new Set(adsets.map(s => s.campaign?.id || s.campaign_id).filter(Boolean))];
    const campaignsMap = new Map();
    
    if (campaignExternalIds.length > 0) {
      const campaignsDocs = await AdsCampaign.find({
        external_id: { $in: campaignExternalIds }
      });
      campaignsDocs.forEach(c => campaignsMap.set(c.external_id, c._id));
    }

    // ✅ BULK WRITE: Sử dụng bulkWrite thay vì từng findOneAndUpdate
    const bulkOps = [];
    const validAdsets = [];

    for (const s of adsets) {
      const externalCampaignId = s.campaign?.id || s.campaign_id;
      const campaignId = campaignsMap.get(externalCampaignId);
      if (!campaignId) {
        console.warn(
          `⚠️ Bỏ qua adset ${s.id} vì chưa tìm thấy campaign external_id=${externalCampaignId} trong DB.`
        );
        continue;
      }

      const data = {
        name: s.name,
        status: s.status,
        external_id: s.id,
        external_account_id: withoutPrefix,
        campaign_id: campaignId,
        effective_status: s.effective_status,
        daily_budget: s.daily_budget,
        lifetime_budget: s.lifetime_budget,
        targeting: s.targeting,
        start_time: s.start_time,
        end_time: s.end_time,
        optimization_goal: s.optimization_goal,
      };

      bulkOps.push({
        updateOne: {
          filter: { external_id: s.id },
          update: { $set: data },
          upsert: true
        }
      });
      validAdsets.push(s);
    }

    // Thực hiện bulk write
    if (bulkOps.length > 0) {
      await AdsSet.bulkWrite(bulkOps);
    }

    // Fetch lại để trả về documents đã upsert
    const externalIds = validAdsets.map(s => s.id);
    const results = externalIds.length > 0 
      ? await AdsSet.find({ external_id: { $in: externalIds } })
      : [];
    // Reconcile: soft-delete adsets that no longer exist on Facebook for this account
    // ✅ KHÔNG update các items đã ARCHIVED (chúng đã được xóa trên FB nhưng giữ status ARCHIVED)
    try {
      const fetchedIds = new Set(adsets.map((s) => s.id));
      const now = new Date();
      await AdsSet.updateMany(
        {
          external_account_id: withoutPrefix,
          external_id: { $nin: Array.from(fetchedIds) },
          status: { $nin: ["DELETED", "ARCHIVED", "FAILED"] }, // ✅ Bỏ qua cả ARCHIVED và DELETED
        },
        { $set: { status: "DELETED", deleted_at: now } }
      );
    } catch (reconcileErr) {
      console.warn("⚠️ Reconcile adsets failed:", reconcileErr?.message || reconcileErr);
    }

    return results;
  } catch (err) {
    console.error(
      `Error syncing adsets for account ${adAccountId}:`,
      err.message
    );
    throw err;
  }
}

/**
 * Đồng bộ Ads từ Facebook → DB
 * - Map adset_id (FB) → _id (Mongo)
 * - Nếu chưa có adset tương ứng → skip để tránh set_id null
 */
export async function syncAdsFromFacebook(accessToken, adAccountId) {
  try {
    const ads = await fetchAdsFromFacebook(accessToken, adAccountId);
    console.log(
      `Fetched ${ads.length} ads from Facebook for account ${adAccountId}`
    );

    const { withoutPrefix } = normalizeAccountPair(adAccountId);
    
    if (ads.length === 0) {
      return [];
    }

    // ✅ BATCH QUERY: Lấy tất cả adsets một lần thay vì query từng cái (giải quyết N+1 problem)
    const adsetExternalIds = [...new Set(ads.map(a => a.adset_id).filter(Boolean))];
    const adsetsMap = new Map();
    
    if (adsetExternalIds.length > 0) {
      const adsetsDocs = await AdsSet.find({
        external_id: { $in: adsetExternalIds }
      });
      adsetsDocs.forEach(a => adsetsMap.set(a.external_id, a._id));
    }

    // ✅ BULK WRITE: Sử dụng bulkWrite thay vì từng findOneAndUpdate
    const bulkOps = [];
    const validAds = [];

    for (const a of ads) {
      const adsetId = adsetsMap.get(a.adset_id);
      if (!adsetId) {
        console.warn(
          `⚠️ Bỏ qua ad ${a.id} vì chưa tìm thấy adset external_id=${a.adset_id} trong DB.`
        );
        continue;
      }

      const data = {
        name: a.name,
        status: a.status,
        external_id: a.id,
        external_account_id: withoutPrefix,
        set_id: adsetId,
        effective_status: a.effective_status,
        creative: a.creative,
      };

      bulkOps.push({
        updateOne: {
          filter: { external_id: a.id },
          update: { $set: data },
          upsert: true
        }
      });
      validAds.push(a);
    }

    // Thực hiện bulk write
    if (bulkOps.length > 0) {
      await Ads.bulkWrite(bulkOps);
    }

    // Fetch lại để trả về documents đã upsert
    const externalIds = validAds.map(a => a.id);
    const results = externalIds.length > 0 
      ? await Ads.find({ external_id: { $in: externalIds } })
      : [];
    // Reconcile: soft-delete ads that no longer exist on Facebook for this account
    // ✅ KHÔNG update các items đã ARCHIVED (chúng đã được xóa trên FB nhưng giữ status ARCHIVED)
    try {
      const fetchedIds = new Set(ads.map((a) => a.id));
      const now = new Date();
      await Ads.updateMany(
        {
          external_account_id: withoutPrefix,
          external_id: { $nin: Array.from(fetchedIds) },
          status: { $nin: ["DELETED", "ARCHIVED"] }, // ✅ Bỏ qua cả ARCHIVED và DELETED
        },
        { $set: { status: "DELETED", deleted_at: now } }
      );
    } catch (reconcileErr) {
      console.warn("⚠️ Reconcile ads failed:", reconcileErr?.message || reconcileErr);
    }

    return results;
  } catch (err) {
    console.error(`Error syncing ads for account ${adAccountId}:`, err.message);
    throw err;
  }
}

export async function fetchAdInsights(accessToken, adIds = []) {
  if (!adIds.length) return [];

  try {
    const url = `${FB_API}/?ids=${adIds.join(",")}`;
    const fields =
      "insights{impressions,reach,spend,clicks,actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking}";
    const { data } = await axios.get(url, {
      params: { fields, access_token: accessToken },
    });

    // Flatten lại dữ liệu cho dễ xử lý
    return Object.keys(data).map((id) => ({
      id,
      insights: data[id].insights?.data?.[0] || {},
    }));
  } catch (err) {
    console.error(
      "Error fetching insights:",
      err.response?.data || err.message
    );
    return [];
  }
}

/**
 * Lấy insights cho nhiều thực thể (campaigns, adsets, ads) bằng batch request.
 * @param {string[]} entityIds - Mảng các ID của Facebook.
 * @param {string} accessToken - Access token của người dùng.
 * @returns {Promise<Array<{id: string, insights: object}>>}
 */
export async function fetchInsightsForEntities(entityIds, accessToken) {
  if (!entityIds || entityIds.length === 0) {
    return [];
  }

  const fields = [
    'impressions',
    'reach',
    'spend',
    'clicks',
    'actions',
    'quality_ranking',
  ].join(',');

  // Tạo mảng batch request
  const batch = entityIds.map(id => ({
    method: 'GET',
    relative_url: `${id}/insights?fields=${fields}`
  }));

  try {
    const response = await axios.post(
      `${FB_API}/`, // Sửa FB_GRAPH_API_URL thành FB_API
      {
        batch: JSON.stringify(batch),
        include_headers: false
      },
      {
        params: {
          access_token: accessToken
        }
      }
    );

    // Xử lý kết quả trả về từ batch request
    const results = response.data.map((res, index) => {
      const originalId = entityIds[index];
      if (res.code === 200) {
        const body = JSON.parse(res.body);
        return {
          id: originalId,
          insights: body // body chính là object insights { data: [...] }
        };
      } else {
        console.warn(`Lỗi khi lấy insights cho ID ${originalId}:`, JSON.parse(res.body).error);
        return {
          id: originalId,
          insights: { data: [] } // Trả về rỗng nếu có lỗi
        };
      }
    });

    return results;

  } catch (error) {
    console.error("Lỗi batch insights request từ Facebook:", error.response?.data || error.message);
    throw error; // Ném lỗi để controller xử lý
  }
}

/**
 * ✅ Batch Sync: Đồng bộ tất cả entities (Campaigns, AdSets, Ads) trong một batch request
 * Giảm từ 3 API calls xuống 1 batch request → tăng hiệu suất đáng kể
 * @param {string} accessToken - Facebook access token
 * @param {string} adAccountId - Facebook ad account ID
 * @returns {Promise<{campaigns: [], adsets: [], ads: []}>}
 */
export async function syncAllFromFacebook(accessToken, adAccountId) {
  try {
    const { withPrefix } = normalizeAccountPair(adAccountId);
    const url = `${FB_API}/`;
    
    // ✅ Batch request: Gộp 3 API calls thành 1
    const batch = [
      {
        method: 'GET',
        relative_url: `${withPrefix}/campaigns?fields=id,name,status,objective,special_ad_categories,daily_budget,lifetime_budget,start_time,stop_time,effective_status&limit=500`
      },
      {
        method: 'GET',
        relative_url: `${withPrefix}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,targeting,start_time,end_time,effective_status&limit=500`
      },
      {
        method: 'GET',
        relative_url: `${withPrefix}/ads?fields=id,name,status,adset_id,creative,effective_status&limit=500`
      }
    ];

    const response = await axios.post(url, {
      batch: JSON.stringify(batch),
      include_headers: false
    }, {
      params: { access_token: accessToken }
    });

    // Parse kết quả từ batch response
    const [campaignsData, adsetsData, adsData] = response.data.map((res, index) => {
      if (res.code === 200) {
        return JSON.parse(res.body).data || [];
      }
      const entityType = ['campaigns', 'adsets', 'ads'][index];
      const errorBody = res.body ? JSON.parse(res.body) : {};
      console.warn(`⚠️ Batch sync ${entityType} failed:`, errorBody);
      return [];
    });

    console.log(`📊 Batch fetched: ${campaignsData.length} campaigns, ${adsetsData.length} adsets, ${adsData.length} ads`);

    // Xử lý campaigns trước (cần để map relationship)
    const adsAccount = await findAdsAccountByExternalId(adAccountId);
    if (!adsAccount) {
      console.warn(`⚠️ Không tìm thấy AdsAccount cho ${adAccountId}`);
      return { campaigns: [], adsets: [], ads: [] };
    }

    const { withoutPrefix } = normalizeAccountPair(adAccountId);
    
    // ✅ Xử lý trực tiếp từ batch data (không gọi lại fetch từ Facebook)
    const campaigns = await processCampaignsBatch(campaignsData, adsAccount, withoutPrefix);
    
    // Xử lý adsets (cần campaigns đã được lưu)
    const adsets = await processAdsetsBatch(adsetsData, withoutPrefix);
    
    // Xử lý ads (cần adsets đã được lưu)
    const ads = await processAdsBatch(adsData, withoutPrefix);

    return { campaigns, adsets, ads };
  } catch (err) {
    console.error(`Error batch syncing for account ${adAccountId}:`, err.message);
    throw err;
  }
}

/**
 * Helper: Xử lý campaigns từ batch data
 */
async function processCampaignsBatch(campaigns, adsAccount, withoutPrefix) {
  if (campaigns.length === 0) return [];

  const bulkOps = [];
  const validCampaigns = [];

  for (const c of campaigns) {
    try {
      const data = {
        shop_id: adsAccount.shop_id,
        account_id: adsAccount._id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        external_id: c.id,
        external_account_id: withoutPrefix,
        effective_status: c.effective_status,
        special_ad_categories: c.special_ad_categories,
        daily_budget: c.daily_budget,
        lifetime_budget: c.lifetime_budget,
        start_time: c.start_time,
        stop_time: c.stop_time,
      };

      bulkOps.push({
        updateOne: {
          filter: { external_id: c.id },
          update: { $set: data },
          upsert: true
        }
      });
      validCampaigns.push(c);
    } catch (err) {
      console.error(`Error preparing campaign ${c.id}:`, err.message);
    }
  }

  if (bulkOps.length > 0) {
    await AdsCampaign.bulkWrite(bulkOps);
  }

  // Reconcile
  const fetchedIds = new Set(validCampaigns.map(c => c.id));
  const now = new Date();
  await AdsCampaign.updateMany(
    {
      external_account_id: withoutPrefix,
      external_id: { $nin: Array.from(fetchedIds) },
      status: { $nin: ["DELETED", "ARCHIVED"] },
    },
    { $set: { status: "DELETED", deleted_at: now } }
  );

  const externalIds = validCampaigns.map(c => c.id);
  return externalIds.length > 0 
    ? await AdsCampaign.find({ external_id: { $in: externalIds } })
    : [];
}

/**
 * Helper: Xử lý adsets từ batch data (đã tối ưu N+1 query)
 */
async function processAdsetsBatch(adsets, withoutPrefix) {
  if (adsets.length === 0) return [];

  // ✅ Batch query campaigns một lần
  const campaignExternalIds = [...new Set(adsets.map(s => s.campaign_id).filter(Boolean))];
  const campaignsMap = new Map();
  
  if (campaignExternalIds.length > 0) {
    const campaignsDocs = await AdsCampaign.find({
      external_id: { $in: campaignExternalIds }
    });
    campaignsDocs.forEach(c => campaignsMap.set(c.external_id, c._id));
  }

  const bulkOps = [];
  const validAdsets = [];

  for (const s of adsets) {
    const campaignId = campaignsMap.get(s.campaign_id);
    if (!campaignId) {
      console.warn(`⚠️ Bỏ qua adset ${s.id} - campaign ${s.campaign_id} không tồn tại`);
      continue;
    }

    const data = {
      name: s.name,
      status: s.status,
      external_id: s.id,
      external_account_id: withoutPrefix,
      campaign_id: campaignId,
      effective_status: s.effective_status,
      daily_budget: s.daily_budget,
      lifetime_budget: s.lifetime_budget,
      targeting: s.targeting,
      start_time: s.start_time,
      end_time: s.end_time,
      optimization_goal: s.optimization_goal,
    };

    bulkOps.push({
      updateOne: {
        filter: { external_id: s.id },
        update: { $set: data },
        upsert: true
      }
    });
    validAdsets.push(s);
  }

  if (bulkOps.length > 0) {
    await AdsSet.bulkWrite(bulkOps);
  }

  // Reconcile
  const fetchedIds = new Set(validAdsets.map(s => s.id));
  const now = new Date();
  await AdsSet.updateMany(
    {
      external_account_id: withoutPrefix,
      external_id: { $nin: Array.from(fetchedIds) },
      status: { $nin: ["DELETED", "ARCHIVED", "FAILED"] },
    },
    { $set: { status: "DELETED", deleted_at: now } }
  );

  const externalIds = validAdsets.map(s => s.id);
  return externalIds.length > 0 
    ? await AdsSet.find({ external_id: { $in: externalIds } })
    : [];
}

/**
 * Helper: Xử lý ads từ batch data (đã tối ưu N+1 query)
 */
async function processAdsBatch(ads, withoutPrefix) {
  if (ads.length === 0) return [];

  // ✅ Batch query adsets một lần
  const adsetExternalIds = [...new Set(ads.map(a => a.adset_id).filter(Boolean))];
  const adsetsMap = new Map();
  
  if (adsetExternalIds.length > 0) {
    const adsetsDocs = await AdsSet.find({
      external_id: { $in: adsetExternalIds }
    });
    adsetsDocs.forEach(a => adsetsMap.set(a.external_id, a._id));
  }

  const bulkOps = [];
  const validAds = [];

  for (const a of ads) {
    const adsetId = adsetsMap.get(a.adset_id);
    if (!adsetId) {
      console.warn(`⚠️ Bỏ qua ad ${a.id} - adset ${a.adset_id} không tồn tại`);
      continue;
    }

    const data = {
      name: a.name,
      status: a.status,
      external_id: a.id,
      external_account_id: withoutPrefix,
      set_id: adsetId,
      effective_status: a.effective_status,
      creative: a.creative,
    };

    bulkOps.push({
      updateOne: {
        filter: { external_id: a.id },
        update: { $set: data },
        upsert: true
      }
    });
    validAds.push(a);
  }

  if (bulkOps.length > 0) {
    await Ads.bulkWrite(bulkOps);
  }

  // Reconcile
  const fetchedIds = new Set(validAds.map(a => a.id));
  const now = new Date();
  await Ads.updateMany(
    {
      external_account_id: withoutPrefix,
      external_id: { $nin: Array.from(fetchedIds) },
      status: { $nin: ["DELETED", "ARCHIVED"] },
    },
    { $set: { status: "DELETED", deleted_at: now } }
  );

  const externalIds = validAds.map(a => a.id);
  return externalIds.length > 0 
    ? await Ads.find({ external_id: { $in: externalIds } })
    : [];
}

/**
 * Fetch account insights với breakdowns từ Facebook Graph API
 * @param {string} accessToken - Facebook access token
 * @param {string} adAccountId - Facebook ad account ID (có thể có hoặc không có prefix act_)
 * @param {Object} options - Các tùy chọn: timeRange, datePreset, breakdowns
 * @returns {Promise<Array>} Mảng các insights records
 */
export async function fetchAccountInsights(accessToken, adAccountId, options = {}) {
  try {
    const { withPrefix } = normalizeAccountPair(adAccountId);
    
    const baseFields = [
      'campaign_name',
      'adset_name',
      'ad_name',
      'ad_id',
      'adset_id',
      'campaign_id',
      'objective',
      'date_start',
      'date_stop',
      'spend',
      'impressions',
      'reach',
      'frequency',
      'cpm',
      'clicks',
      'cpc',
      'ctr',
      'inline_link_clicks',
      'inline_link_click_ctr',
      'cost_per_inline_link_click',
      'results',
      'cost_per_result',
      'conversions',
      'cost_per_conversion',
      'purchase_roas',
      'website_purchase_roas',
      'quality_ranking',
      'engagement_rate_ranking',
      'conversion_rate_ranking',
    ];

    const needActions = options.needActions === true;
    const insightsFields = needActions ? [...baseFields, 'actions'].join(',') : baseFields.join(',');

    const url = `${FB_API}/${withPrefix}/insights`;
    const params = new URLSearchParams({
      fields: insightsFields,
      level: options.level || 'ad',
      access_token: accessToken
    });

    if (options.timeIncrement === 'all_days') {
      params.set('time_increment', 'all_days');
    } else {
      const rawTimeIncrement = options.timeIncrement ?? 1;
      const numericTimeIncrement = Number(rawTimeIncrement);
      const resolvedTimeIncrement = Number.isFinite(numericTimeIncrement)
        ? Math.max(1, Math.floor(numericTimeIncrement))
        : 1;
      params.set('time_increment', String(resolvedTimeIncrement));
    }

    if (needActions && options.actionBreakdowns) {
      params.set('action_breakdowns', options.actionBreakdowns);
    }

    if (options.breakdowns && needActions) {
      params.set('breakdowns', options.breakdowns);
    }

    // Xử lý time_range và date_preset
    if (options.datePreset) {
      // Nếu có datePreset (ví dụ: 'lifetime'), dùng date_preset parameter
      params.set('date_preset', options.datePreset);
    } else if (options.timeRange) {
      if (typeof options.timeRange === 'string') {
        // Nếu là preset string (ví dụ: 'last_30d')
        params.set('date_preset', options.timeRange);
      } else if (typeof options.timeRange === 'object') {
        // Nếu là object { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD' }
        params.set('time_range', JSON.stringify(options.timeRange));
      }
    } else {
      // Mặc định là last_30d
      params.set('date_preset', 'last_30d');
    }
    
    console.log('[fbAdsService] Fetching account insights', {
      accountId: withPrefix,
      level: params.get('level'),
      timeIncrement: params.get('time_increment'),
      hasActions: needActions,
      breakdowns: params.get('breakdowns') || null,
      actionBreakdowns: params.get('action_breakdowns') || null,
      timeRange: params.get('time_range') || null
    });

    const response = await axios.get(`${url}?${params.toString()}`);
    const insightsData = response.data?.data || [];
    
    // ✅ LOG: Kiểm tra response từ Facebook API
    console.log(`[fbAdsService] 📊 API Response: ${insightsData.length} records`, {
      firstRecord: insightsData[0] ? {
        ad_id: insightsData[0].ad_id,
        date_start: insightsData[0].date_start,
        date_stop: insightsData[0].date_stop,
        spend: insightsData[0].spend,
        impressions: insightsData[0].impressions
      } : null,
      sampleDates: insightsData.slice(0, 3).map(item => ({
        ad_id: item.ad_id,
        date_start: item.date_start,
        date_stop: item.date_stop
      }))
    });
    
    if (insightsData.length > 0) {
      const uniqueAdIds = [...new Set(insightsData.map(item => item.ad_id).filter(Boolean))];
      
      // Fetch creative data bằng batch request nếu có ad_ids
      if (uniqueAdIds.length > 0) {
        const batch = uniqueAdIds.map(adId => ({
          method: 'GET',
          relative_url: `${adId}?fields=creative{body,title}`
        }));
        
        try {
          const creativeResponse = await axios.post(
            `${FB_API}/`,
            {
              batch: JSON.stringify(batch),
              include_headers: false
            },
            {
              params: { access_token: accessToken }
            }
          );
          
          // Map creative data vào insights
          const creativeMap = {};
          creativeResponse.data.forEach((res, index) => {
            if (res.code === 200) {
              try {
                const adData = JSON.parse(res.body);
                creativeMap[uniqueAdIds[index]] = adData.creative?.body || '';
              } catch (parseErr) {
                console.warn(`Error parsing creative for ad ${uniqueAdIds[index]}:`, parseErr.message);
                creativeMap[uniqueAdIds[index]] = '';
              }
            }
          });
          
          insightsData.forEach(item => {
            item.ad_creative_body = creativeMap[item.ad_id] || '';
            
            item.link_clicks = Number(item.inline_link_clicks || 0);
            item.link_ctr = item.inline_link_click_ctr !== undefined ? Number(item.inline_link_click_ctr) : null;
            item.link_cpc = item.cost_per_inline_link_click !== undefined ? Number(item.cost_per_inline_link_click) : null;

            if (item.clicks && item.spend) {
              item.cpc = item.cpc !== undefined ? Number(item.cpc) : (Number(item.spend) / Number(item.clicks));
            }

            if (item.clicks && item.impressions) {
              item.ctr = item.ctr !== undefined ? Number(item.ctr) : ((Number(item.clicks) / Number(item.impressions)) * 100);
            }

            if (Array.isArray(item.conversions)) {
              const totalConversions = item.conversions.reduce((sum, conv) => sum + Number(conv.value || 0), 0);
              item.conversions = totalConversions;
            } else {
              item.conversions = item.conversions ? Number(item.conversions) : 0;
            }

            if (Array.isArray(item.cost_per_conversion)) {
              item.cost_per_conversion = item.cost_per_conversion[0]?.value ? Number(item.cost_per_conversion[0].value) : null;
            } else {
              item.cost_per_conversion = item.cost_per_conversion ? Number(item.cost_per_conversion) : null;
            }

            if (Array.isArray(item.results)) {
              const totalResults = item.results.reduce((sum, res) => {
                const value = res.value !== undefined ? Number(res.value || 0) : 0;
                return sum + value;
              }, 0);
              item.results = totalResults;
            } else {
              item.results = item.results ? Number(item.results) : 0;
            }

            if (item.conversions > 0 && item.clicks > 0) {
              item.conversion_rate = (item.conversions / item.clicks) * 100;
            }

            if (item.results && item.spend) {
              item.cost_per_result = item.cost_per_result !== undefined 
                ? Number(item.cost_per_result) 
                : (Number(item.spend) / Number(item.results));
            }

            item.audience_reach_percentage = null;
            item.delivery = item.impressions > 0 ? 'active' : '';
          });
        } catch (creativeErr) {
          console.warn('Error fetching creative data:', creativeErr.message);
          insightsData.forEach(item => {
            item.ad_creative_body = '';
            item.link_clicks = Number(item.inline_link_clicks || 0);
            item.link_ctr = item.inline_link_click_ctr !== undefined ? Number(item.inline_link_click_ctr) : null;
            item.link_cpc = item.cost_per_inline_link_click !== undefined ? Number(item.cost_per_inline_link_click) : null;

            if (item.clicks && item.spend) {
              item.cpc = item.cpc !== undefined ? Number(item.cpc) : (Number(item.spend) / Number(item.clicks));
            }

            if (item.clicks && item.impressions) {
              item.ctr = item.ctr !== undefined ? Number(item.ctr) : ((Number(item.clicks) / Number(item.impressions)) * 100);
            }

            if (Array.isArray(item.conversions)) {
              const totalConversions = item.conversions.reduce((sum, conv) => sum + Number(conv.value || 0), 0);
              item.conversions = totalConversions;
            } else {
              item.conversions = item.conversions ? Number(item.conversions) : 0;
            }

            if (Array.isArray(item.cost_per_conversion)) {
              item.cost_per_conversion = item.cost_per_conversion[0]?.value ? Number(item.cost_per_conversion[0].value) : null;
            } else {
              item.cost_per_conversion = item.cost_per_conversion ? Number(item.cost_per_conversion) : null;
            }

            if (Array.isArray(item.results)) {
              const totalResults = item.results.reduce((sum, res) => {
                const value = res.value !== undefined ? Number(res.value || 0) : 0;
                return sum + value;
              }, 0);
              item.results = totalResults;
            } else {
              item.results = item.results ? Number(item.results) : 0;
            }

            if (item.conversions > 0 && item.clicks > 0) {
              item.conversion_rate = (item.conversions / item.clicks) * 100;
            }

            if (item.results && item.spend) {
              item.cost_per_result = item.cost_per_result !== undefined 
                ? Number(item.cost_per_result) 
                : (Number(item.spend) / Number(item.results));
            }
            item.audience_reach_percentage = null;
            item.delivery = item.impressions > 0 ? 'active' : '';
          });
        }
      } else {
        insightsData.forEach(item => {
          item.ad_creative_body = '';
          item.link_clicks = Number(item.inline_link_clicks || 0);
          item.link_ctr = item.inline_link_click_ctr !== undefined ? Number(item.inline_link_click_ctr) : null;
          item.link_cpc = item.cost_per_inline_link_click !== undefined ? Number(item.cost_per_inline_link_click) : null;

          if (item.clicks && item.spend) {
            item.cpc = item.cpc !== undefined ? Number(item.cpc) : (Number(item.spend) / Number(item.clicks));
          }

          if (item.clicks && item.impressions) {
            item.ctr = item.ctr !== undefined ? Number(item.ctr) : ((Number(item.clicks) / Number(item.impressions)) * 100);
          }

          if (Array.isArray(item.conversions)) {
            const totalConversions = item.conversions.reduce((sum, conv) => sum + Number(conv.value || 0), 0);
            item.conversions = totalConversions;
          } else {
            item.conversions = item.conversions ? Number(item.conversions) : 0;
          }

          if (Array.isArray(item.cost_per_conversion)) {
            item.cost_per_conversion = item.cost_per_conversion[0]?.value ? Number(item.cost_per_conversion[0].value) : null;
          } else {
            item.cost_per_conversion = item.cost_per_conversion ? Number(item.cost_per_conversion) : null;
          }

          if (Array.isArray(item.results)) {
            const totalResults = item.results.reduce((sum, res) => {
              const value = res.value !== undefined ? Number(res.value || 0) : 0;
              return sum + value;
            }, 0);
            item.results = totalResults;
          } else {
            item.results = item.results ? Number(item.results) : 0;
          }

          if (item.conversions > 0 && item.clicks > 0) {
            item.conversion_rate = (item.conversions / item.clicks) * 100;
          }

          if (item.results && item.spend) {
            item.cost_per_result = item.cost_per_result !== undefined 
              ? Number(item.cost_per_result) 
              : (Number(item.spend) / Number(item.results));
          }
          item.audience_reach_percentage = null;
          item.delivery = '';
        });
      }
    }
    
    if (needActions) {
      for (const item of insightsData) {
        if (Array.isArray(item.actions)) {
          const pw = item.actions.find(a => 
            a.action_type === 'purchase' && 
            (a.action_destination === 'website' || !a.action_destination)
          );
          item.website_purchases = pw ? Number(pw.value || 0) : 0;
          
          // Leads
          const lead = item.actions.find(a => a.action_type === 'lead');
          item.leads = lead ? Number(lead.value || 0) : 0;

          // Mobile App Install
          const install = item.actions.find(a => a.action_type === 'mobile_app_install');
          item.mobile_app_install = install ? Number(install.value || 0) : 0;

          // Post Engagement
          const engagement = item.actions.find(a => a.action_type === 'post_engagement');
          item.post_engagement = engagement ? Number(engagement.value || 0) : 0;

          if (!item.results) {
            const purchaseAction = item.actions.find(a => a.action_type === 'purchase');
            item.results = purchaseAction ? Number(purchaseAction.value || 0) : 0;
          }
        } else {
          item.website_purchases = 0;
          item.leads = 0;
          item.mobile_app_install = 0;
          item.post_engagement = 0;
          if (!item.results) {
            item.results = 0;
          }
        }

        // Calculate Costs
        if (item.leads > 0 && item.spend) {
          item.cost_per_lead = Number(item.spend) / item.leads;
        }
        if (item.mobile_app_install > 0 && item.spend) {
          item.cost_per_mobile_app_install = Number(item.spend) / item.mobile_app_install;
        }
      }
    } else {
      insightsData.forEach(item => {
        item.website_purchases = item.results || 0;
        item.leads = 0;
        item.mobile_app_install = 0;
        item.post_engagement = 0;
      });
    }
    
    return insightsData;
  } catch (err) {
    console.error('Error fetching account insights:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Lưu insights data vào AdPerformance collection
 * @param {Array} insightsData - Mảng insights data từ Facebook API
 * @param {string} accountId - MongoDB _id của AdsAccount
 * @returns {Promise<{saved: number, skipped: number}>}
 */
function normalizeToVietnamMidnight(dateInput) {
  let dateStr;
  if (typeof dateInput === 'string') {
    dateStr = dateInput.split('T')[0];
  } else if (dateInput instanceof Date) {
    const vnDateStr = dateInput.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    dateStr = vnDateStr;
  } else {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    dateStr = vnDateStr;
  }
  
  const vnMidnight = new Date(`${dateStr}T00:00:00+07:00`);
  return vnMidnight;
}

function parseInsightDate(item) {
  const baseDate = item?.date_start || item?.date_stop;
  if (!baseDate) {
    return null;
  }

  const parsed = normalizeToVietnamMidnight(baseDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isAggregatedInsight(item) {
  if (!item) return false;
  if (!item.date_start || !item.date_stop) return false;
  return item.date_start !== item.date_stop;
}

export async function saveInsightsToAdPerformance(insightsData, accountId) {
  if (!insightsData || !Array.isArray(insightsData) || insightsData.length === 0) {
    console.log('[fbAdsService] ⚠️ No insights data to save');
    return { saved: 0, skipped: 0 };
  }

  console.log(`[fbAdsService] 💾 Preparing to save ${insightsData.length} performance records to database...`);

  try {
    const account = await AdsAccount.findById(accountId);
    if (!account) {
      console.warn(`⚠️ Account ${accountId} not found, skipping save`);
      return { saved: 0, skipped: insightsData.length };
    }

    const adExternalIds = [...new Set(insightsData.map(item => item.ad_id).filter(Boolean))];
    const adsetExternalIds = [...new Set(insightsData.map(item => item.adset_id).filter(Boolean))];
    const campaignExternalIds = [...new Set(insightsData.map(item => item.campaign_id).filter(Boolean))];

    const [adsDocs, adsetsDocs, campaignsDocs] = await Promise.all([
      Ads.find({ external_id: { $in: adExternalIds } }),
      AdsSet.find({ external_id: { $in: adsetExternalIds } }),
      AdsCampaign.find({ external_id: { $in: campaignExternalIds } })
    ]);

    const adsMap = new Map(adsDocs.map(ad => [ad.external_id, ad]));
    const adsetsMap = new Map(adsetsDocs.map(adset => [adset.external_id, adset]));
    const campaignsMap = new Map(campaignsDocs.map(campaign => [campaign.external_id, campaign]));

    const bulkOps = [];
    let saved = 0;
    let skipped = 0;

    for (const item of insightsData) {
      try {
        if (!item.ad_id) {
          skipped++;
          continue;
        }

        const ad = adsMap.get(item.ad_id);
        if (!ad) {
          skipped++;
          continue;
        }

        const adset = item.adset_id ? adsetsMap.get(item.adset_id) : null;
        const campaign = item.campaign_id ? campaignsMap.get(item.campaign_id) : null;

        if (isAggregatedInsight(item)) {
          console.warn(
            `[fbAdsService] ⚠️ Skipping aggregated insight for ad ${item.ad_id} covering ${item.date_start} -> ${item.date_stop}. Ensure time_increment=1 to avoid aggregated rows.`
          );
          skipped++;
          continue;
        }

        const date = parseInsightDate(item);
        if (!date) {
          console.warn(`[fbAdsService] ⚠️ Unable to parse insight date for ad ${item.ad_id}. Raw dates:`, {
            date_start: item.date_start,
            date_stop: item.date_stop
          });
          skipped++;
          continue;
        }
        
        // ✅ LOG: Debug first few items để verify date parsing
        if (saved < 3) {
          console.log(`[fbAdsService] 🔍 Processing insight #${saved + 1}:`, {
            ad_id: item.ad_id,
            ad_name: item.ad_name,
            date_start: item.date_start,
            date_stop: item.date_stop,
            parsed_date: date.toISOString().split('T')[0],
            spend: item.spend,
            impressions: item.impressions
          });
        }
        
        const performanceData = {
          ads_id: ad._id,
          set_id: adset?._id || null,
          campaign_id: campaign?._id || null,
          account_id: accountId,
          external_account_id: account.external_id.replace('act_', ''), 
          date: date,
          
          impressions: parseFloat(item.impressions) || 0,
          reach: parseFloat(item.reach) || 0,
          clicks: item.clicks ? parseFloat(item.clicks) : 0,
          spend: parseFloat(item.spend) || 0,
          conversions: item.conversions ? parseFloat(item.conversions) : 0,
          frequency: parseFloat(item.frequency) || 0,
          
          cpc: item.cpc ? parseFloat(item.cpc) : null,
          cpm: item.cpm ? parseFloat(item.cpm) : null,
          ctr: item.ctr ? parseFloat(item.ctr) : null,
          conversion_rate: item.conversion_rate ? parseFloat(item.conversion_rate) : null,
          cost_per_conversion: item.cost_per_conversion ? parseFloat(item.cost_per_conversion) : null,
          
          campaign_name: item.campaign_name || null,
          adset_name: item.adset_name || null,
          ad_name: item.ad_name || null,
          page_name: item.page_name || adset?.page_name || campaign?.page_name || null,
          
          daily_budget: null,
          daily_spend_rate: null,
          total_amount_spent: parseFloat(item.spend) || 0,
          
          link_clicks: item.link_clicks !== undefined
            ? Number(item.link_clicks)
            : Number(item.inline_link_clicks || 0),
          link_cpc: item.link_cpc !== undefined
            ? Number(item.link_cpc)
            : (item.cost_per_inline_link_click !== undefined ? Number(item.cost_per_inline_link_click) : null),
          link_ctr: item.link_ctr !== undefined
            ? Number(item.link_ctr)
            : (item.inline_link_click_ctr !== undefined ? Number(item.inline_link_click_ctr) : null),
          
          website_purchases: item.website_purchases ? Number(item.website_purchases) : 0,
          website_purchase_roas: (() => {
            if (Array.isArray(item.website_purchase_roas)) {
              return Number(item.website_purchase_roas[0]?.value ?? null);
            }
            if (typeof item.website_purchase_roas === 'number') {
              return Number(item.website_purchase_roas);
            }
            if (Array.isArray(item.purchase_roas)) {
              return Number(item.purchase_roas[0]?.value ?? null);
            }
            if (typeof item.purchase_roas === 'number') {
              return Number(item.purchase_roas);
            }
            return null;
          })(),
          
          results: (() => {
            if (Array.isArray(item.results)) {
              const totalResults = item.results.reduce((sum, res) => {
                const value = res.value !== undefined ? Number(res.value || 0) : 0;
                return sum + value;
              }, 0);
              return totalResults;
            }
            const parsed = item.results ? parseFloat(item.results) : 0;
            return isNaN(parsed) ? 0 : parsed;
          })(),
          cost_per_result: item.cost_per_result ? parseFloat(item.cost_per_result) : null,
          
          audience_reach_percentage: item.audience_reach_percentage ?? null,

          // New metrics
          quality_ranking: item.quality_ranking || null,
          post_engagement: item.post_engagement || 0,
          leads: item.leads || 0,
          cost_per_lead: item.cost_per_lead || null,
          mobile_app_install: item.mobile_app_install || 0,
          cost_per_mobile_app_install: item.cost_per_mobile_app_install || null,
        };

        if (adset?.daily_budget) {
          performanceData.daily_budget = Number(adset.daily_budget) / 100;
          if (performanceData.daily_budget > 0 && performanceData.spend > 0) {
            performanceData.daily_spend_rate = (performanceData.spend / performanceData.daily_budget) * 100;
          }
        } else if (campaign?.daily_budget) {
          performanceData.daily_budget = Number(campaign.daily_budget) / 100;
          if (performanceData.daily_budget > 0 && performanceData.spend > 0) {
            performanceData.daily_spend_rate = (performanceData.spend / performanceData.daily_budget) * 100;
          }
        }

        // ✅ DÙNG UPSERT thay vì insert
        bulkOps.push({
          updateOne: {
            filter: {
              ads_id: ad._id,
              date: date
            },
            update: { 
              $set: performanceData,
              $setOnInsert: {
                created_at: new Date()
              }
            },
            upsert: true
          }
        });

        saved++;
      } catch (itemErr) {
        console.error(`Error processing insight item:`, itemErr.message);
        skipped++;
      }
    }

    if (bulkOps.length > 0) {
      console.log(`[fbAdsService] 💾 Saving ${bulkOps.length} performance records to database...`);
      const result = await AdPerformance.bulkWrite(bulkOps);
      
      // ✅ LOG CHI TIẾT KẾT QUẢ
      console.log(`[fbAdsService] ✅ BulkWrite completed:`, {
        upserted: result.upsertedCount,    // Số records MỚI được insert
        modified: result.modifiedCount,     // Số records CŨ được update
        matched: result.matchedCount,       // Số records tìm thấy
        total: result.upsertedCount + result.modifiedCount
      });
    }

    console.log(`[fbAdsService] 📊 Save summary: saved=${saved}, skipped=${skipped}`);

    return { saved, skipped };
  } catch (err) {
    console.error('[fbAdsService] ❌ Error saving insights to AdPerformance:', err.message);
    throw err;
  }
}

function toHourFloor(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now;
  }
  date.setMinutes(0, 0, 0);
  return date;
}

function resolveInsightAt(item, fallback) {
  const candidate =
    item?.insight_at ||
    item?.timestamp ||
    item?.time ||
    item?.date_start ||
    fallback;
  const date = candidate ? new Date(candidate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return fallback instanceof Date ? fallback : new Date(fallback || Date.now());
  }
  return date;
}

export async function saveInsightsToAdHourlyCollection(insightsData, accountId) {
  if (!insightsData || !Array.isArray(insightsData) || insightsData.length === 0) {
    return { saved: 0, skipped: 0 };
  }

  try {
    const account = await AdsAccount.findById(accountId).lean();
    if (!account) {
      console.warn(`⚠️ Account ${accountId} not found, skipping hourly save`);
      return { saved: 0, skipped: insightsData.length };
    }

    const adExternalIds = [...new Set(insightsData.map(item => item?.ad_id).filter(Boolean))];
    if (adExternalIds.length === 0) {
      return { saved: 0, skipped: insightsData.length };
    }

    const [adsDocs, adsetsDocs, campaignsDocs] = await Promise.all([
      Ads.find({ external_id: { $in: adExternalIds } }),
      AdsSet.find({ external_id: { $in: [...new Set(insightsData.map(item => item?.adset_id).filter(Boolean))] } }),
      AdsCampaign.find({ external_id: { $in: [...new Set(insightsData.map(item => item?.campaign_id).filter(Boolean))] } })
    ]);

    const adsMap = new Map(adsDocs.map(ad => [ad.external_id, ad]));
    const adsetsMap = new Map(adsetsDocs.map(adset => [adset.external_id, adset]));
    const campaignsMap = new Map(campaignsDocs.map(campaign => [campaign.external_id, campaign]));

    let saved = 0;
    let skipped = 0;

    for (const item of insightsData) {
      try {
        if (!item?.ad_id) {
          skipped++;
          continue;
        }

        const ad = adsMap.get(item.ad_id);
        if (!ad) {
          skipped++;
          continue;
        }

        const adset = item.adset_id ? adsetsMap.get(item.adset_id) : null;
        const campaign = item.campaign_id ? campaignsMap.get(item.campaign_id) : null;

        let retrievedAt = item.retrieved_at ? new Date(item.retrieved_at) : new Date();
        if (Number.isNaN(retrievedAt.getTime())) {
          retrievedAt = new Date();
        }
        const retrievedAtHour = toHourFloor(retrievedAt);
        const insightAt = resolveInsightAt(item, retrievedAtHour);

        const spendValue = Number(item.spend ?? 0) || 0;
        const derivedDailyBudget = (() => {
          if (item.daily_budget !== undefined) return Number(item.daily_budget) || 0;
          if (adset?.daily_budget) return Number(adset.daily_budget) / 100;
          if (campaign?.daily_budget) return Number(campaign.daily_budget) / 100;
          return 0;
        })();

        const document = {
          account_id: account._id,
          campaign_id: campaign?._id || null,
          adset_id: adset?._id || null,
          ad_id: ad._id,

          account_external_id: account.external_id || null,
          campaign_external_id: item.campaign_id || campaign?.external_id || null,
          adset_external_id: item.adset_id || adset?.external_id || null,
          ad_external_id: item.ad_id || ad.external_id || null,

          delivery_status: item.delivery || item.delivery_status || null,

          impressions: Number(item.impressions ?? 0) || 0,
          reach: Number(item.reach ?? 0) || 0,
          clicks: Number(item.clicks ?? item.inline_link_clicks ?? 0) || 0,
          spend: spendValue,
          conversions: Number(item.conversions ?? item.results ?? 0) || 0,
          frequency: Number(item.frequency ?? 0) || 0,

          cpc: item.cpc !== undefined ? Number(item.cpc) : null,
          cpm: item.cpm !== undefined ? Number(item.cpm) : null,
          ctr: item.ctr !== undefined ? Number(item.ctr) : null,
          conversion_rate: item.conversion_rate !== undefined ? Number(item.conversion_rate) : null,
          cost_per_conversion: item.cost_per_conversion !== undefined ? Number(item.cost_per_conversion) : null,

          results: (() => {
            if (Array.isArray(item.results)) {
              return item.results.reduce((sum, res) => sum + Number(res?.value ?? 0), 0);
            }
            return item.results !== undefined ? Number(item.results) || 0 : Number(item.website_purchases ?? 0) || 0;
          })(),
          cost_per_result: item.cost_per_result !== undefined ? Number(item.cost_per_result) : null,

          campaign_name: item.campaign_name || campaign?.name || null,
          adset_name: item.adset_name || adset?.name || null,
          ad_name: item.ad_name || ad?.name || null,
          page_name: item.page_name || adset?.page_name || campaign?.page_name || null,

          daily_budget: derivedDailyBudget,
          daily_spend_rate:
            derivedDailyBudget > 0 && spendValue > 0
              ? (spendValue / derivedDailyBudget) * 100
              : null,
          total_amount_spent: Number(item.total_amount_spent ?? spendValue) || 0,

          link_clicks: Number(item.link_clicks ?? item.inline_link_clicks ?? 0) || 0,
          link_cpc: item.link_cpc !== undefined
            ? Number(item.link_cpc)
            : (item.cost_per_inline_link_click !== undefined ? Number(item.cost_per_inline_link_click) : null),
          link_ctr: item.link_ctr !== undefined
            ? Number(item.link_ctr)
            : (item.inline_link_click_ctr !== undefined ? Number(item.inline_link_click_ctr) : null),

          website_purchases: Number(item.website_purchases ?? item.results ?? 0) || 0,
          website_purchase_roas: (() => {
            if (Array.isArray(item.website_purchase_roas)) {
              return Number(item.website_purchase_roas[0]?.value ?? null);
            }
            if (typeof item.website_purchase_roas === 'number') {
              return Number(item.website_purchase_roas);
            }
            if (Array.isArray(item.purchase_roas)) {
              return Number(item.purchase_roas[0]?.value ?? null);
            }
            if (typeof item.purchase_roas === 'number') {
              return Number(item.purchase_roas);
            }
            return null;
          })(),

          audience_reach_percentage: item.audience_reach_percentage !== undefined
            ? Number(item.audience_reach_percentage)
            : null,

          rule_evaluations: item.rule_evaluations || {},

          insight_at: insightAt,
          retrieved_at: retrievedAt,
          retrieved_at_hour: retrievedAtHour,
          meta: item.meta || {},
        };

        await AdHourlyInsight.findOneAndUpdate(
          { ad_id: document.ad_id, retrieved_at_hour: document.retrieved_at_hour },
          { $set: document },
          { upsert: true, new: true }
        );

        saved++;
      } catch (itemError) {
        console.error('Error saving hourly insight item:', itemError.message);
        skipped++;
      }
    }

    return { saved, skipped };
  } catch (error) {
    console.error('Error saving hourly insights:', error.message);
    throw error;
  }
}
