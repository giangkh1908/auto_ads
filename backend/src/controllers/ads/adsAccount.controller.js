// controllers/ads/adsAccount.controller.js
import {
  upsertAdAccountsFromFacebook,
  listAdsAccounts,
  getAdsAccountById,
  getAdsAccountByExternalId,
  updateAdsAccount,
  hardDeleteAdsAccount,
} from "../../services/adsAccountService.js";
import User from "../../models/user.model.js";
// Thêm imports
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import {
  fetchAccountInsights,
  saveInsightsToAdPerformance,
} from "../../services/fbAdsService.js";
import axios from "axios";
import { upsertOneAdAccount } from "../../services/adsAccountService.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import { syncEntitiesForAccount } from "../../services/entitySyncService.js";
import { startBackfill } from "../../services/backfillService.js";

const FB_API = "https://graph.facebook.com/v23.0";

/**
 * GET /api/ads-accounts/sync
 * Đồng bộ từ Facebook → lưu DB
 */
export async function syncAdsAccounts(req, res) {
  try {
    // 1) Lấy token từ query (nếu FE có truyền)
    let accessToken = req.query.access_token;

    // 2) Nếu không có: lấy từ DB theo user hiện tại
    if (!accessToken) {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({ message: "Thiếu Facebook access_token." });
    }

    const adminUserId = req.user?.id || req.user?._id;
    const shopUserId = req.user?.shop_user_id || null;

    // ✅ Bỏ logic lấy shop_id, chỉ cần user_id
    const docs = await upsertAdAccountsFromFacebook(accessToken, { 
      shopUserId, 
      adminUserId, 
      shopId: null 
    });

    return res.status(200).json({
      message: "Đồng bộ tài khoản quảng cáo thành công",
      total: docs.length,
      accounts: docs,
    });
  } catch (err) {
    console.error("SYNC AdsAccount error:", err?.response?.data || err.message);
    return res.status(500).json({
      message: "Lỗi đồng bộ tài khoản quảng cáo",
      error: err?.response?.data || err.message,
    });
  }
}

/**
 * GET /api/ads-accounts
 */
export async function listAdsAccountsCtrl(req, res) {
  try {
    const { q, status, account_status, page, limit, sort } = req.query;
    
    // Lấy thông tin user từ req.user (được set bởi middleware authenticate)
    const userId = req.user?._id || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        message: "Vui lòng đăng nhập để xem danh sách tài khoản quảng cáo" 
      });
    }
    
    // ✅ Filter trực tiếp theo userId (tìm trong array user_ids)
    const result = await listAdsAccounts({ 
      userId, 
      q, 
      status, 
      account_status, 
      page, 
      limit, 
      sort 
    });
    
    return res.status(200).json(result);
  } catch (err) {
    console.error("LIST AdsAccount error:", err.message);
    return res.status(500).json({ 
      message: "Lỗi lấy danh sách tài khoản quảng cáo", 
      error: err.message 
    });
  }
}

/**
 * GET /api/ads-accounts/:id
 */
export async function getAdsAccountCtrl(req, res) {
  try {
    const doc = await getAdsAccountById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tài khoản quảng cáo" });
    return res.status(200).json(doc);
  } catch (err) {
    console.error("GET AdsAccount error:", err.message);
    return res.status(500).json({ message: "Lỗi lấy chi tiết tài khoản quảng cáo", error: err.message });
  }
}

/**
 * GET /api/ads-accounts/by-external/:externalId
 */
export async function getAdsAccountByExternalCtrl(req, res) {
  try {
    const doc = await getAdsAccountByExternalId(req.params.externalId);
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tài khoản quảng cáo" });
    return res.status(200).json(doc);
  } catch (err) {
    console.error("GET by external AdsAccount error:", err.message);
    return res.status(500).json({ message: "Lỗi lấy tài khoản quảng cáo", error: err.message });
  }
}

/**
 * PATCH /api/ads-accounts/:id
 */
export async function updateAdsAccountCtrl(req, res) {
  try {
    const doc = await updateAdsAccount(req.params.id, req.body || {});
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tài khoản quảng cáo" });
    return res.status(200).json({ message: "Cập nhật thành công", account: doc });
  } catch (err) {
    console.error("UPDATE AdsAccount error:", err.message);
    return res.status(500).json({ message: "Lỗi cập nhật tài khoản quảng cáo", error: err.message });
  }
}

/**
 * DELETE /api/ads-accounts/:id
 * Hard delete: xóa thật account khỏi DB, giữ nguyên dữ liệu liên quan (campaigns, adsets, ads)
 */
export async function deleteAdsAccountCtrl(req, res) {
  try {
    const doc = await hardDeleteAdsAccount(req.params.id);
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tài khoản quảng cáo" });
    return res.status(200).json({ message: "Đã ngắt kết nối tài khoản quảng cáo", account: doc });
  } catch (err) {
    console.error("DELETE AdsAccount error:", err.message);
    return res.status(500).json({ message: "Lỗi ngắt kết nối tài khoản quảng cáo", error: err.message });
  }
}

/**
 * GET /api/ads-accounts/stats
 * Lấy thống kê số lượng của account (campaigns, adsets, ads)
 */
export async function getAccountStatsCtrl(req, res) {
  try {
    const { account_id } = req.query;
    
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }
    
    // Chuẩn hóa ID (kiểm tra cả có và không có tiền tố act_)
    const normalizedId = account_id.startsWith('act_') ? account_id.substring(4) : account_id;
    const withPrefix = account_id.startsWith('act_') ? account_id : `act_${account_id}`;
    
    // Truy vấn song song để tăng hiệu suất
    const [campaignCount, adsetCount, adCount] = await Promise.all([
      // Đếm campaigns
      AdsCampaign.countDocuments({
        $or: [
          { external_account_id: normalizedId },
          { external_account_id: withPrefix }
        ],
        status: { $ne: "DELETED" }
      }),
      
      // Đếm adsets
      AdsSet.countDocuments({
        $or: [
          { external_account_id: normalizedId },
          { external_account_id: withPrefix }
        ],
        status: { $ne: "DELETED" }
      }),
      
      // Đếm ads
      Ads.countDocuments({
        $or: [
          { external_account_id: normalizedId },
          { external_account_id: withPrefix }
        ],
        status: { $ne: "DELETED" }
      })
    ]);
    
    return res.status(200).json({
      account_id,
      stats: {
        campaigns: campaignCount,
        adsets: adsetCount,
        ads: adCount
      }
    });
  } catch (err) {
    console.error("GET Account Stats error:", err);
    return res.status(500).json({
      message: "Lỗi khi lấy thống kê tài khoản",
      error: err.message
    });
  }
}

/**
 * GET /api/ads-accounts/stats/live
 * Lấy thống kê từ DB (chính xác hơn, có pagination)
 */
export async function getAccountLiveStatsCtrl(req, res) {
  try {
    const { account_id } = req.query;
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }

    // Chuẩn hóa ID (kiểm tra cả có và không có tiền tố act_)
    const normalizedId = account_id.startsWith('act_') ? account_id.substring(4) : account_id;
    const withPrefix = account_id.startsWith('act_') ? account_id : `act_${account_id}`;
    
    // Đếm từ DB (chính xác, có pagination trong entitySyncService)
    const [campaignCount, adsetCount, adCount] = await Promise.all([
      AdsCampaign.countDocuments({
        $or: [
          { external_account_id: normalizedId },
          { external_account_id: withPrefix }
        ],
        status: { $nin: ["DELETED", "ARCHIVED"] }
      }),
      AdsSet.countDocuments({
        $or: [
          { external_account_id: normalizedId },
          { external_account_id: withPrefix }
        ],
        status: { $nin: ["DELETED", "ARCHIVED"] }
      }),
      Ads.countDocuments({
        $or: [
          { external_account_id: normalizedId },
          { external_account_id: withPrefix }
        ],
        status: { $nin: ["DELETED", "ARCHIVED"] }
      })
    ]);

    return res.status(200).json({
      account_id,
      source: "database",
      stats: {
        campaigns: campaignCount,
        adsets: adsetCount,
        ads: adCount,
      },
    });
  } catch (err) {
    console.error("GET Live Account Stats error:", err);
    return res.status(500).json({
      message: "Lỗi khi lấy thống kê tài khoản",
      error: err.message,
    });
  }
}

/**
 * GET /api/ads-accounts/facebook
 * Lấy danh sách tài khoản quảng cáo trực tiếp từ Facebook (không lưu DB)
 */
export async function listFacebookAdAccountsCtrl(req, res) {
  try {
    let accessToken = req.query.access_token;
    if (!accessToken) {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }
    if (!accessToken) {
      return res.status(400).json({
        message: "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    const params = new URLSearchParams({
      fields: "id,name,account_status,currency,timezone_name",
      limit: String(50),
    });

    const all = [];
    let after = null;
    do {
      if (after) params.set("after", after); else params.delete("after");
      const url = `${FB_API}/me/adaccounts?${params.toString()}`;
      const resp = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = resp.data?.data || [];
      for (const a of data) {
        all.push({
          external_id: a.id,
          name: a.name,
          account_status: a.account_status,
          currency: a.currency,
          timezone_name: a.timezone_name,
        });
      }
      after = resp.data?.paging?.cursors?.after || null;
    } while (after);

    // ✅ Lấy user_id để check ownership
    const userId = req.user?._id || req.user?.id;
    
    // Check xem các account đã được kết nối với user nào chưa
    const externalIds = all.map(a => a.external_id);
    const connectedAccounts = await AdsAccount.find({
      external_id: { $in: externalIds },
      user_ids: { $ne: null, $exists: true, $size: { $gt: 0 } }
    }).populate('shop_admin_id', 'username email').lean();

    // Tạo map để tra cứu nhanh
    const connectedMap = {};
    for (const acc of connectedAccounts) {
      const hasAccess = acc.user_ids && acc.user_ids.some(
        id => id.toString() === userId?.toString()
      );
      connectedMap[acc.external_id] = {
        user_id: acc.shop_admin_id?._id || acc.shop_admin_id,
        username: acc.shop_admin_id?.username || 'Unknown User',
        is_current_user: hasAccess,
        total_users: acc.user_ids?.length || 0
      };
    }

    // Thêm thông tin connected_user và can_connect vào mỗi account
    const itemsWithConnection = all.map(acc => {
      const connectedInfo = connectedMap[acc.external_id];
      return {
        ...acc,
        connected_user: connectedInfo || null,
        can_connect: !connectedInfo || connectedInfo.is_current_user
      };
    });

    return res.status(200).json({ items: itemsWithConnection, total: itemsWithConnection.length });
  } catch (err) {
    console.error("LIST FB AdAccounts error:", err?.response?.data || err.message);
    return res.status(500).json({ message: "Lỗi lấy danh sách từ Facebook", error: err.message });
  }
}

/**
 * POST /api/ads-accounts/connect
 * Body: { account_id }
 * Chỉ khi người dùng bấm kết nối mới lưu tài khoản vào DB
 */
export async function connectAdAccountCtrl(req, res) {
  try {
    const { account_id } = req.body || {};
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }

    let accessToken = req.query.access_token;
    if (!accessToken) {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }
    if (!accessToken) {
      return res.status(400).json({
        message: "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    const withPrefix = account_id.startsWith("act_") ? account_id : `act_${account_id}`;
    const url = `${FB_API}/${withPrefix}`;
    const resp = await axios.get(url, {
      params: {
        fields: "id,name,account_status,currency,timezone_name",
        access_token: accessToken,
      },
    });
    const fbAcc = resp.data;

    const adminUserId = req.user?.id || req.user?._id;
    const shopUserId = req.user?.shop_user_id || null;

    // ✅ Upsert account - Tự động thêm user vào user_ids nếu account đã tồn tại
    const saved = await upsertOneAdAccount(
      {
        id: fbAcc.id,
        name: fbAcc.name,
        account_status: fbAcc.account_status,
        currency: fbAcc.currency,
        timezone_name: fbAcc.timezone_name,
      },
      { 
        shopUserId, 
        adminUserId, 
        shopId: null 
      }
    );

    syncEntitiesForAccount(fbAcc.id, accessToken).catch(err => {
      console.error(`Failed to sync entities for ${fbAcc.id}:`, err);
    });

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    startBackfill(
      saved._id.toString(),
      twoYearsAgo.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    ).catch(err => {
      console.error(`Failed to start backfill for ${fbAcc.id}:`, err);
    });

    return res.status(200).json({ 
      message: "Kết nối tài khoản thành công. Đang đồng bộ dữ liệu trong background...", 
      account: saved 
    });
  } catch (err) {
    console.error("CONNECT AdAccount error:", err?.response?.data || err.message);
    return res.status(500).json({ message: "Lỗi kết nối tài khoản quảng cáo", error: err.message });
  }
}

/**
 * GET /api/ads-accounts/:id/insights
 * Lấy insights data từ Facebook với breakdowns
 */
export async function getAccountInsightsCtrl(req, res) {
  try {
    const { id } = req.params;
    const { 
      breakdowns, 
      date_start, 
      date_stop, 
      time_range,
      needActions = 'true',
      actionBreakdowns = 'action_type,action_destination',
      level = 'ad'
    } = req.query;

    if (!id) {
      return res.status(400).json({ message: "Thiếu account ID" });
    }

    let accessToken = req.query.access_token;
    if (!accessToken) {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message: "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    const account = await getAdsAccountById(id);
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản quảng cáo" });
    }

    const externalId = account.external_id || account._id;

    const options = {
      level,
      needActions: needActions === 'true',
      actionBreakdowns: needActions === 'true' ? actionBreakdowns : undefined,
    };

    if (breakdowns && needActions === 'true') {
      options.breakdowns = breakdowns;
    }

    if (date_start && date_stop) {
      options.timeRange = {
        since: date_start,
        until: date_stop,
      };
    } else if (time_range) {
      options.timeRange = time_range;
    }

    const insightsData = await fetchAccountInsights(accessToken, externalId, options);

    // Map page_name từ adset/campaign trong DB vào insightsData để hiển thị ngay
    if (insightsData.length > 0) {
      const adsetExternalIds = [...new Set(insightsData.map(item => item.adset_id).filter(Boolean))];
      const campaignExternalIds = [...new Set(insightsData.map(item => item.campaign_id).filter(Boolean))];

      const [adsetsDocs, campaignsDocs] = await Promise.all([
        AdsSet.find({ external_id: { $in: adsetExternalIds } }).select('external_id page_name'),
        AdsCampaign.find({ external_id: { $in: campaignExternalIds } }).select('external_id page_name')
      ]);

      const adsetsMap = new Map(adsetsDocs.map(adset => [adset.external_id, adset]));
      const campaignsMap = new Map(campaignsDocs.map(campaign => [campaign.external_id, campaign]));

      insightsData.forEach(item => {
        const adset = item.adset_id ? adsetsMap.get(item.adset_id) : null;
        const campaign = item.campaign_id ? campaignsMap.get(item.campaign_id) : null;
        item.page_name = adset?.page_name || campaign?.page_name || null;
      });
    }

    try {
      const saveResult = await saveInsightsToAdPerformance(insightsData, id);
      console.log(`✅ Saved ${saveResult.saved} insights, skipped ${saveResult.skipped}`);
    } catch (saveErr) {
      console.warn('⚠️ Error saving insights to DB:', saveErr.message);
    }

    return res.status(200).json({
      account_id: id,
      breakdowns: breakdowns || null,
      needActions: options.needActions,
      items: insightsData,
      total: insightsData.length,
    });
  } catch (err) {
    console.error("GET Account Insights error:", err.response?.data || err.message);
    return res.status(500).json({
      message: "Lỗi khi lấy insights từ Facebook",
      error: err.message,
    });
  }
}
