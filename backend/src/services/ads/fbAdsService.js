// services/fbAdsService.js
import axios from "axios";
import crypto from "crypto";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import AdPerformance from "../../models/ads/adPerformance.model.js";

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
 *  FETCH HELPERS (có pagination)
 * ========================= */

/**
 * Helper function để fetch tất cả pages từ Facebook API
 * Sử dụng cursor-based pagination
 * @param {string} url - Base URL for the API call
 * @param {string} accessToken - Facebook access token
 * @param {string} fields - Fields to fetch
 * @param {string} entityName - Name for logging
 * @param {number} limitPerPage - Items per page (default 50 to avoid timeout)
 */
async function fetchAllPagesFromFacebook(url, accessToken, fields, entityName = "entities", limitPerPage = 50) {
  const allData = [];
  let nextUrl = url;
  let pageCount = 0;
  const MAX_PAGES = 100; // Giới hạn để tránh loop vô hạn (100 pages x 50 items = 5000 max)
  const MAX_RETRIES = 2;

  try {
    while (nextUrl && pageCount < MAX_PAGES) {
      pageCount++;
      let retries = 0;
      let response = null;
      
      // Retry logic for transient errors
      while (retries <= MAX_RETRIES) {
        try {
          response = await axios.get(nextUrl, {
            params: nextUrl === url ? {
              fields,
              access_token: accessToken,
              limit: limitPerPage,
            } : undefined, // Nếu là URL tiếp theo thì params đã có sẵn trong URL
            timeout: 60000, // 60 giây timeout cho mỗi request
          });
          break; // Success, exit retry loop
        } catch (reqError) {
          retries++;
          const fbError = reqError.response?.data?.error;
          
          // Nếu là timeout error (subcode 1504018), giảm limit và retry
          if (fbError?.error_subcode === 1504018 && retries <= MAX_RETRIES) {
            console.warn(`⚠️ Request timeout for ${entityName} page ${pageCount}, retrying with smaller limit...`);
            limitPerPage = Math.max(25, Math.floor(limitPerPage / 2)); // Giảm limit xuống còn nửa
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
            continue;
          }
          
          // Nếu hết retry hoặc lỗi khác, throw error
          if (retries > MAX_RETRIES) {
            throw reqError;
          }
          
          // Retry cho các lỗi transient khác
          console.warn(`⚠️ Error fetching ${entityName} page ${pageCount}, retry ${retries}/${MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
        }
      }
      
      if (!response) break;

      const data = response.data?.data || [];
      if (data.length === 0) {
        break;
      }

      allData.push(...data);

      // Check for next page
      const paging = response.data?.paging;
      if (paging?.next) {
        nextUrl = paging.next;
      } else if (paging?.cursors?.after) {
        // Build next URL with cursor
        const separator = url.includes('?') ? '&' : '?';
        nextUrl = `${url}${separator}fields=${encodeURIComponent(fields)}&access_token=${accessToken}&limit=${limitPerPage}&after=${paging.cursors.after}`;
      } else {
        break;
      }

      // Rate limit: delay giữa các requests (500ms để tránh rate limit)
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (pageCount >= MAX_PAGES) {
      console.warn(`⚠️ Reached max pages (${MAX_PAGES}) for ${entityName}. Total fetched: ${allData.length}`);
    } else {
      console.log(`✅ Fetched ${allData.length} ${entityName} in ${pageCount} page(s)`);
    }

    return allData;
  } catch (err) {
    console.error(`Error fetching ${entityName} from Facebook:`, err.response?.data || err.message);
    // Return what we have so far instead of empty array
    if (allData.length > 0) {
      console.log(`⚠️ Returning partial data: ${allData.length} ${entityName}`);
    }
    return allData;
  }
}

export async function fetchCampaignsFromFacebook(accessToken, adAccountId) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const url = `${FB_API}/${withPrefix}/campaigns`;
  // Không fetch insights ở đây để tránh timeout khi có nhiều campaigns
  // Insights sẽ được fetch riêng qua /api/campaigns/insights endpoint
  const fields = "id,name,status,objective,special_ad_categories,daily_budget,lifetime_budget,start_time,stop_time,effective_status";
  
  return fetchAllPagesFromFacebook(url, accessToken, fields, "campaigns");
}

export async function fetchAdsetsFromFacebook(accessToken, adAccountId) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const url = `${FB_API}/${withPrefix}/adsets`;
  // Không fetch insights ở đây để tránh timeout khi có nhiều adsets (800+)
  // Insights sẽ được fetch riêng qua /api/adsets/insights endpoint
  const fields = "id,name,status,campaign_id,daily_budget,lifetime_budget,optimization_goal,targeting,start_time,end_time,effective_status";
  
  return fetchAllPagesFromFacebook(url, accessToken, fields, "adsets");
}

export async function fetchAdsFromFacebook(accessToken, adAccountId) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const url = `${FB_API}/${withPrefix}/ads`;
  // Không fetch insights ở đây để tránh timeout khi có nhiều ads
  // Insights sẽ được fetch riêng qua /api/ads/insights endpoint
  const fields = "id,name,status,adset_id,creative,effective_status";
  
  return fetchAllPagesFromFacebook(url, accessToken, fields, "ads");
}

/**
 * Lấy LIFETIME insights cho tất cả ads trong account.
 * Dữ liệu là tổng tích lũy từ đầu ad chạy đến hiện tại.
 * Dùng cho cron sync vào bảng AdPerformance (rule tắt/bật ads).
 * Hỗ trợ PAGINATION để lấy tất cả ads khi account có nhiều ads.
 * 
 * @param {string} accessToken - Facebook access token
 * @param {string} adAccountId - Facebook ad account ID (có hoặc không có prefix act_)
 * @returns {Promise<Array>} Mảng các insights records, mỗi record là 1 ad
 */
export async function fetchLifetimeInsightsForAds(accessToken, adAccountId, options = {}) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const timeIncrement = options.time_increment; // undefined = LIFETIME aggregated, 1 = daily breakdown
  
  const fields = [
    // IDs & Names
    'ad_id', 'ad_name',
    'adset_id', 'adset_name',
    'campaign_id', 'campaign_name',
    'objective',
    // Core metrics
    'spend', 'impressions', 'reach', 'frequency',
    'clicks', 'cpc', 'cpm', 'ctr',
    // Link metrics
    'inline_link_clicks', 'inline_link_click_ctr', 'cost_per_inline_link_click',
    // Conversions & Results  
    'conversions', 'cost_per_conversion',
    'results', 'cost_per_result',
    // ROAS
    'website_purchase_roas',
    // Quality
    'quality_ranking',
    // Actions (để parse website_purchases, leads, mobile_app_install, post_engagement)
    'actions'
  ].join(',');

  // Fallback date presets nếu maximum quá nhiều data
  const DATE_PRESETS = ['maximum', 'last_year', 'last_90d', 'last_30d'];
  const LIMITS = [500, 200, 100]; // Giảm limit nếu timeout
  
  let allInsights = [];
  let usedDatePreset = 'maximum';
  let usedLimit = 500;

  for (const datePreset of DATE_PRESETS) {
    for (const limitPerPage of LIMITS) {
      try {
        allInsights = [];
        let pageCount = 0;
        const MAX_PAGES = 50;
        
        const mode = timeIncrement ? `DAILY (time_increment=${timeIncrement})` : 'LIFETIME (aggregated)';
        console.log(`📊 [fetchLifetimeInsightsForAds] Trying ${mode} with date_preset=${datePreset}, limit=${limitPerPage}...`);
        
        const params = {
          fields,
          level: 'ad',
          date_preset: datePreset,
          limit: limitPerPage,
          access_token: accessToken
        };
        
        if (timeIncrement) {
          params.time_increment = timeIncrement;
        }
        
        let response = await axios.get(`${FB_API}/${withPrefix}/insights`, { params });
        
        while (response && pageCount < MAX_PAGES) {
          pageCount++;
          const pageData = response.data?.data || [];
          allInsights.push(...pageData);
          
          console.log(`📄 [fetchLifetimeInsightsForAds] Page ${pageCount}: got ${pageData.length} records (total: ${allInsights.length})`);
          
          const nextUrl = response.data?.paging?.next;
          if (!nextUrl) break;
          
          await new Promise(resolve => setTimeout(resolve, 300));
          response = await axios.get(nextUrl);
        }
        
        usedDatePreset = datePreset;
        usedLimit = limitPerPage;
        console.log(`✅ [fetchLifetimeInsightsForAds] Success with date_preset=${datePreset}, limit=${limitPerPage}. Total: ${allInsights.length} records`);
        
        // Parse data sau khi fetch thành công
        parseInsightsData(allInsights);
        return allInsights;
        
      } catch (err) {
        const fbError = err.response?.data?.error;
        const isTimeout = fbError?.error_subcode === 1504018 || 
                          fbError?.message?.includes('timeout') ||
                          fbError?.message?.includes('Yêu cầu đã hết thời gian chờ');
        const isTooMuchData = fbError?.code === 100 && isTimeout;
        
        if (isTooMuchData || isTimeout) {
          console.warn(`⚠️ [fetchLifetimeInsightsForAds] Timeout/TooMuchData with date_preset=${datePreset}, limit=${limitPerPage}. Trying smaller range...`);
          continue; // Try next limit or date_preset
        }
        
        // Non-recoverable error
        console.error(`❌ [fetchLifetimeInsightsForAds] Error:`, fbError || err.message);
        throw err;
      }
    }
  }
  
  // Nếu tất cả đều fail, trả về mảng rỗng
  console.error(`❌ [fetchLifetimeInsightsForAds] All date_presets failed for account ${withPrefix}`);
  return [];
}

function parseInsightsData(allInsights) {
  for (const item of allInsights) {
    item.link_clicks = Number(item.inline_link_clicks || 0);
    item.link_ctr = item.inline_link_click_ctr !== undefined ? Number(item.inline_link_click_ctr) : null;
    item.link_cpc = item.cost_per_inline_link_click !== undefined ? Number(item.cost_per_inline_link_click) : null;
    
    if (Array.isArray(item.actions)) {
      const purchase = item.actions.find(a => 
        a.action_type === 'purchase' && 
        (a.action_destination === 'website' || !a.action_destination)
      );
      item.website_purchases = purchase ? Number(purchase.value || 0) : 0;
      
      const lead = item.actions.find(a => a.action_type === 'lead');
      item.leads = lead ? Number(lead.value || 0) : 0;
      
      const install = item.actions.find(a => a.action_type === 'mobile_app_install');
      item.mobile_app_install = install ? Number(install.value || 0) : 0;
      
      const engagement = item.actions.find(a => a.action_type === 'post_engagement');
      item.post_engagement = engagement ? Number(engagement.value || 0) : 0;
    } else {
      item.website_purchases = 0;
      item.leads = 0;
      item.mobile_app_install = 0;
      item.post_engagement = 0;
    }
    
    if (Array.isArray(item.conversions)) {
      item.conversions = item.conversions.reduce((sum, conv) => sum + Number(conv.value || 0), 0);
    } else {
      item.conversions = item.conversions ? Number(item.conversions) : 0;
    }
    
    if (Array.isArray(item.results)) {
      item.results = item.results.reduce((sum, res) => sum + Number(res.value || 0), 0);
    } else {
      item.results = item.results ? Number(item.results) : 0;
    }
    
    item.spend = Number(item.spend || 0);
    item.impressions = Number(item.impressions || 0);
    item.reach = Number(item.reach || 0);
    item.clicks = Number(item.clicks || 0);
    item.frequency = Number(item.frequency || 0);
    item.cpc = item.cpc ? Number(item.cpc) : null;
    item.cpm = item.cpm ? Number(item.cpm) : null;
    item.ctr = item.ctr ? Number(item.ctr) : null;
    item.cost_per_conversion = item.cost_per_conversion ? Number(item.cost_per_conversion) : null;
    item.cost_per_result = item.cost_per_result ? Number(item.cost_per_result) : null;
    item.website_purchase_roas = item.website_purchase_roas ? Number(item.website_purchase_roas) : null;
  }
}

/**
 * Lấy LIFETIME insights cho tất cả adsets trong account.
 * Hỗ trợ PAGINATION để lấy tất cả adsets khi account có nhiều adsets.
 * 
 * @param {string} accessToken - Facebook access token
 * @param {string} adAccountId - Facebook ad account ID
 * @returns {Promise<Array>} Mảng các insights records
 */
export async function fetchLifetimeInsightsForAdsets(accessToken, adAccountId, options = {}) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const timeIncrement = options.time_increment;
  
  const fields = [
    'adset_id', 'adset_name',
    'campaign_id', 'campaign_name',
    'spend', 'impressions', 'reach', 'frequency',
    'clicks', 'cpc', 'cpm', 'ctr',
    'inline_link_clicks', 'inline_link_click_ctr', 'cost_per_inline_link_click',
    'conversions', 'cost_per_conversion',
    'results', 'cost_per_result',
    'quality_ranking', 'actions'
  ].join(',');

  const DATE_PRESETS = ['maximum', 'last_year', 'last_90d', 'last_30d'];
  const LIMITS = [200, 100, 50];
  
  let allInsights = [];

  for (const datePreset of DATE_PRESETS) {
    for (const limitPerPage of LIMITS) {
      try {
        allInsights = [];
        let pageCount = 0;
        const MAX_PAGES = 50;
        
        const mode = timeIncrement ? `DAILY (time_increment=${timeIncrement})` : 'LIFETIME (aggregated)';
        console.log(`📊 [fetchLifetimeInsightsForAdsets] Trying ${mode} with date_preset=${datePreset}, limit=${limitPerPage}...`);
        
        const params = {
          fields,
          level: 'adset',
          date_preset: datePreset,
          limit: limitPerPage,
          access_token: accessToken
        };
        
        if (timeIncrement) {
          params.time_increment = timeIncrement;
        }
        
        let response = await axios.get(`${FB_API}/${withPrefix}/insights`, { params });
        
        while (response && pageCount < MAX_PAGES) {
          pageCount++;
          const pageData = response.data?.data || [];
          allInsights.push(...pageData);
          
          console.log(`📄 [fetchLifetimeInsightsForAdsets] Page ${pageCount}: ${pageData.length} records (total: ${allInsights.length})`);
          
          const nextUrl = response.data?.paging?.next;
          if (!nextUrl) break;
          
          await new Promise(resolve => setTimeout(resolve, 300));
          response = await axios.get(nextUrl);
        }
        
        console.log(`✅ [fetchLifetimeInsightsForAdsets] Success with date_preset=${datePreset}. Total: ${allInsights.length} records`);
        
        for (const item of allInsights) {
          item.spend = Number(item.spend || 0);
          item.impressions = Number(item.impressions || 0);
          item.reach = Number(item.reach || 0);
          item.clicks = Number(item.clicks || 0);
          item.frequency = Number(item.frequency || 0);
          item.cpc = item.cpc ? Number(item.cpc) : null;
          item.cpm = item.cpm ? Number(item.cpm) : null;
          item.ctr = item.ctr ? Number(item.ctr) : null;
        }
        
        return allInsights;
        
      } catch (err) {
        const fbError = err.response?.data?.error;
        const isTimeout = fbError?.error_subcode === 1504018 || 
                          fbError?.message?.includes('timeout') ||
                          fbError?.message?.includes('Yêu cầu đã hết thời gian chờ');
        
        if (isTimeout) {
          console.warn(`⚠️ [fetchLifetimeInsightsForAdsets] Timeout with date_preset=${datePreset}, limit=${limitPerPage}. Trying smaller range...`);
          continue;
        }
        
        console.error("❌ [fetchLifetimeInsightsForAdsets] Error:", fbError || err.message);
        throw err;
      }
    }
  }
  
  console.error(`❌ [fetchLifetimeInsightsForAdsets] All date_presets failed for account ${withPrefix}`);
  return [];
}

/**
 * Lấy LIFETIME insights cho tất cả campaigns trong account.
 * Hỗ trợ PAGINATION để lấy tất cả campaigns khi account có nhiều campaigns.
 * 
 * @param {string} accessToken - Facebook access token
 * @param {string} adAccountId - Facebook ad account ID
 * @returns {Promise<Array>} Mảng các insights records
 */
export async function fetchLifetimeInsightsForCampaigns(accessToken, adAccountId, options = {}) {
  const { withPrefix } = normalizeAccountPair(adAccountId);
  const timeIncrement = options.time_increment;
  
  const fields = [
    'campaign_id', 'campaign_name', 'objective',
    'spend', 'impressions', 'reach', 'frequency',
    'clicks', 'cpc', 'cpm', 'ctr',
    'inline_link_clicks', 'inline_link_click_ctr', 'cost_per_inline_link_click',
    'conversions', 'cost_per_conversion',
    'results', 'cost_per_result',
    'quality_ranking', 'actions'
  ].join(',');

  const DATE_PRESETS = ['maximum', 'last_year', 'last_90d', 'last_30d'];
  const LIMITS = [50, 25];
  
  let allInsights = [];

  for (const datePreset of DATE_PRESETS) {
    for (const limitPerPage of LIMITS) {
      try {
        allInsights = [];
        let pageCount = 0;
        const MAX_PAGES = 50;
        
        const mode = timeIncrement ? `DAILY (time_increment=${timeIncrement})` : 'LIFETIME (aggregated)';
        console.log(`📊 [fetchLifetimeInsightsForCampaigns] Trying ${mode} with date_preset=${datePreset}, limit=${limitPerPage}...`);
        
        const params = {
          fields,
          level: 'campaign',
          date_preset: datePreset,
          limit: limitPerPage,
          access_token: accessToken
        };
        
        if (timeIncrement) {
          params.time_increment = timeIncrement;
        }
        
        let response = await axios.get(`${FB_API}/${withPrefix}/insights`, { params });
        
        while (response && pageCount < MAX_PAGES) {
          pageCount++;
          const pageData = response.data?.data || [];
          allInsights.push(...pageData);
          
          console.log(`📄 [fetchLifetimeInsightsForCampaigns] Page ${pageCount}: ${pageData.length} records (total: ${allInsights.length})`);
          
          const nextUrl = response.data?.paging?.next;
          if (!nextUrl) break;
          
          await new Promise(resolve => setTimeout(resolve, 300));
          response = await axios.get(nextUrl);
        }
        
        console.log(`✅ [fetchLifetimeInsightsForCampaigns] Success with date_preset=${datePreset}. Total: ${allInsights.length} records`);
        
        for (const item of allInsights) {
          item.spend = Number(item.spend || 0);
          item.impressions = Number(item.impressions || 0);
          item.reach = Number(item.reach || 0);
          item.clicks = Number(item.clicks || 0);
          item.frequency = Number(item.frequency || 0);
          item.cpc = item.cpc ? Number(item.cpc) : null;
          item.cpm = item.cpm ? Number(item.cpm) : null;
          item.ctr = item.ctr ? Number(item.ctr) : null;
        }
        
        return allInsights;
        
      } catch (err) {
        const fbError = err.response?.data?.error;
        const isTimeout = fbError?.error_subcode === 1504018 || 
                          fbError?.message?.includes('timeout') ||
                          fbError?.message?.includes('Yêu cầu đã hết thời gian chờ');
        
        if (isTimeout) {
          console.warn(`⚠️ [fetchLifetimeInsightsForCampaigns] Timeout with date_preset=${datePreset}, limit=${limitPerPage}. Trying smaller range...`);
          continue;
        }
        
        console.error("❌ [fetchLifetimeInsightsForCampaigns] Error:", fbError || err.message);
        throw err;
      }
    }
  }
  
  console.error(`❌ [fetchLifetimeInsightsForCampaigns] All date_presets failed for account ${withPrefix}`);
  return [];
}
/**
 * Lấy LIFETIME insights cho danh sách ad IDs cụ thể (dùng cho controller API).
 * Trả về insights summary lifetime (tổng tích lũy từ đầu).
 * 
 * @param {string} accessToken - Facebook access token
 * @param {string[]} adIds - Mảng các Facebook ad IDs
 * @returns {Promise<Array>} Mảng insights { id, insights }
 */
export async function fetchInsightsForAdIds(accessToken, adIds = []) {
  if (!adIds.length) return [];
  
  try {
    const url = `${FB_API}/?ids=${adIds.join(",")}`;
    const fields = "insights.date_preset(maximum){impressions,reach,spend,clicks,actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking}";
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
      "Error fetching insights for ad IDs:",
      err.response?.data || err.message
    );
    return [];
  }
}

/**
 * Lấy LIFETIME insights cho danh sách adset IDs cụ thể (dùng cho controller API).
 * Trả về insights summary lifetime (tổng tích lũy từ đầu).
 * 
 * @param {string} accessToken - Facebook access token
 * @param {string[]} adsetIds - Mảng các Facebook adset IDs
 * @returns {Promise<Array>} Mảng insights { id, insights }
 */
export async function fetchInsightsForAdsetIds(accessToken, adsetIds = []) {
  if (!adsetIds.length) return [];

  try {
    const url = `${FB_API}/?ids=${adsetIds.join(",")}`;
    const fields = "insights.date_preset(maximum){impressions,reach,spend,clicks,actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking}";
    const { data } = await axios.get(url, {
      params: { fields, access_token: accessToken },
    });

    return Object.keys(data).map((id) => ({
      id,
      insights: data[id].insights?.data?.[0] || {},
    }));
  } catch (err) {
    console.error(
      "Error fetching insights for adset IDs:",
      err.response?.data || err.message
    );
    return [];
  }
}

/**
 * Lấy LIFETIME insights cho danh sách campaign IDs cụ thể (dùng cho controller API).
 * Trả về insights summary lifetime (tổng tích lũy từ đầu).
 * 
 * @param {string} accessToken - Facebook access token
 * @param {string[]} campaignIds - Mảng các Facebook campaign IDs
 * @returns {Promise<Array>} Mảng insights { id, insights }
 */
export async function fetchInsightsForCampaignIds(accessToken, campaignIds = []) {
  if (!campaignIds.length) return [];

  try {
    const url = `${FB_API}/?ids=${campaignIds.join(",")}`;
    const fields = "insights.date_preset(maximum){impressions,reach,spend,clicks,actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking}";
    const { data } = await axios.get(url, {
      params: { fields, access_token: accessToken },
    });

    return Object.keys(data).map((id) => ({
      id,
      insights: data[id].insights?.data?.[0] || {},
    }));
  } catch (err) {
    console.error(
      "Error fetching insights for campaign IDs:",
      err.response?.data || err.message
    );
    return [];
  }
}

/**
 * Lấy LIFETIME insights cho nhiều thực thể (campaigns, adsets, ads) bằng batch request.
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

  // Tạo mảng batch request với date_preset=lifetime
  const batch = entityIds.map(id => ({
    method: 'GET',
    relative_url: `${id}/insights?fields=${fields}&date_preset=lifetime`
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

// ❌ REMOVED: saveInsightsToAdHourlyCollection() - Dead code, not used anywhere
// AdHourlyInsight feature has been disabled