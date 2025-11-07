// services/fbAdsService.js
import axios from "axios";
import crypto from "crypto";

// MODELS
import AdsAccount from "../models/ads/adsAccount.model.js";
import AdsCampaign from "../models/ads/adsCampaign.model.js";
import AdsSet from "../models/ads/adsSet.model.js";
import Ads from "../models/ads/ads.model.js";

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
  
  const filteredBody = Object.keys(body)
    .filter(key => allowedFields.includes(key) && body[key] !== undefined)
    .reduce((obj, key) => {
      obj[key] = body[key];
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
          "id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,targeting,start_time,end_time,effective_status",
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
      err.response?.data || err.message
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
    const campaignExternalIds = [...new Set(adsets.map(s => s.campaign_id).filter(Boolean))];
    const campaignsMap = new Map();
    
    if (campaignExternalIds.length > 0) {
      const campaignsDocs = await AdsCampaign.find({
        external_id: { $in: campaignExternalIds }
      }).select('external_id _id account_id');
      campaignsDocs.forEach(c => campaignsMap.set(c.external_id, { _id: c._id, account_id: c.account_id }));
    }

    // ✅ BULK WRITE: Sử dụng bulkWrite thay vì từng findOneAndUpdate
    const bulkOps = [];
    const validAdsets = [];

    for (const s of adsets) {
      const campaignData = campaignsMap.get(s.campaign_id);
      if (!campaignData) {
        console.warn(
          `⚠️ Bỏ qua adset ${s.id} vì chưa tìm thấy campaign external_id=${s.campaign_id} trong DB.`
        );
        continue;
      }

      const data = {
        name: s.name,
        status: s.status,
        external_id: s.id,
        external_account_id: withoutPrefix,
        campaign_id: campaignData._id,
        account_id: campaignData.account_id,
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
    
    // ✅ Fields hợp lệ cho Insights API
    const insightsFields = [
      'campaign_name',
      'adset_name',
      'ad_name',
      'ad_id', // ✅ Thêm để có thể fetch creative sau
      'page_id',
      'objective',
      'date_start',
      'date_stop',
      'spend',
      'impressions',
      'reach',
      'actions', // ✅ Có thể parse để lấy link_clicks từ action_type="link_click"
      'frequency',
      'cpc',
      'cpm',
      'ctr',
      'purchase_roas',
      // ❌ XÓA: ad_creative_body, link_clicks, delivery - không hợp lệ với Insights API
    ].join(',');

    // Breakdowns - mặc định là age
    const breakdowns = options.breakdowns || 'age';
    
    // Build URL và params
    const url = `${FB_API}/${withPrefix}/insights`;
    const params = new URLSearchParams({
      fields: insightsFields,
      breakdowns,
      level: 'ad', // ✅ Set level để có ad_id trong response
      access_token: accessToken
    });

    // Xử lý time_range
    if (options.timeRange) {
      if (typeof options.timeRange === 'string') {
        // Nếu là preset (ví dụ: 'last_30d')
        params.set('time_range', JSON.stringify({ preset: options.timeRange }));
      } else if (typeof options.timeRange === 'object') {
        // Nếu là object { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD' }
        params.set('time_range', JSON.stringify(options.timeRange));
      }
    } else {
      // Mặc định là last_30d
      params.set('time_range', JSON.stringify({ preset: 'last_30d' }));
    }
    
    const response = await axios.get(`${url}?${params.toString()}`);
    const insightsData = response.data?.data || [];
    
    // ✅ Bước 2: Fetch creative data cho các ads unique để lấy ad_creative_body
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
          
          // Merge creative body vào insights data
          insightsData.forEach(item => {
            item.ad_creative_body = creativeMap[item.ad_id] || '';
            // ✅ Thêm link_clicks từ actions nếu có
            if (item.actions && Array.isArray(item.actions)) {
              const linkClickAction = item.actions.find(
                (action) => action.action_type === "link_click"
              );
              item.link_clicks = linkClickAction ? parseInt(linkClickAction.value) || 0 : 0;
            } else {
              item.link_clicks = 0;
            }
            // ✅ Delivery không có trong API, để empty hoặc tính từ impressions
            item.delivery = item.impressions > 0 ? 'active' : '';
          });
        } catch (creativeErr) {
          console.warn('Error fetching creative data:', creativeErr.message);
          // Nếu không fetch được creative, vẫn trả về insights nhưng không có creative body
          insightsData.forEach(item => {
            item.ad_creative_body = '';
            item.link_clicks = 0;
            item.delivery = item.impressions > 0 ? 'active' : '';
          });
        }
      } else {
        // Không có ad_id, set default values
        insightsData.forEach(item => {
          item.ad_creative_body = '';
          item.link_clicks = 0;
          item.delivery = '';
        });
      }
    }
    
    // Facebook trả về data trong response.data.data
    return insightsData;
  } catch (err) {
    console.error('Error fetching account insights:', err.response?.data || err.message);
    throw err;
  }
}

