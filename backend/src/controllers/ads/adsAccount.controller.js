// controllers/ads/adsAccount.controller.js
import {
  upsertAdAccountsFromFacebook,
  listAdsAccounts,
  getAdsAccountById,
  getAdsAccountByExternalId,
  updateAdsAccount,
  softDeleteAdsAccount,
} from "../../services/adsAccountService.js";
import User from "../../models/user.model.js";
// Thêm imports
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
// Live stats from Facebook
import {
  fetchCampaignsFromFacebook,
  fetchAdsetsFromFacebook,
  fetchAdsFromFacebook,
} from "../../services/fbAdsService.js";
import axios from "axios";
import { upsertOneAdAccount } from "../../services/adsAccountService.js";

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
    const shopId = req.user?.shop_id || null; // Thêm dòng này để lấy shopId

    const docs = await upsertAdAccountsFromFacebook(accessToken, { shopUserId, adminUserId, shopId });

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
    const shopUserId = req.user?.shop_user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        message: "Vui lòng đăng nhập để xem danh sách tài khoản quảng cáo" 
      });
    }
    
    const result = await listAdsAccounts({ 
      userId, 
      shopUserId, 
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
 */
export async function deleteAdsAccountCtrl(req, res) {
  try {
    const doc = await softDeleteAdsAccount(req.params.id);
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tài khoản quảng cáo" });
    return res.status(200).json({ message: "Đã vô hiệu hóa tài khoản quảng cáo", account: doc });
  } catch (err) {
    console.error("DELETE AdsAccount error:", err.message);
    return res.status(500).json({ message: "Lỗi xóa tài khoản quảng cáo", error: err.message });
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
 * Lấy thống kê trực tiếp từ Facebook (không dựa DB)
 */
export async function getAccountLiveStatsCtrl(req, res) {
  try {
    const { account_id } = req.query;
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }

    // Ưu tiên token từ query, nếu không có thì lấy từ DB theo user hiện tại
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

    const [campaigns, adsets, ads] = await Promise.all([
      fetchCampaignsFromFacebook(accessToken, account_id),
      fetchAdsetsFromFacebook(accessToken, account_id),
      fetchAdsFromFacebook(accessToken, account_id),
    ]);

    return res.status(200).json({
      account_id,
      source: "facebook",
      stats: {
        campaigns: Array.isArray(campaigns) ? campaigns.length : 0,
        adsets: Array.isArray(adsets) ? adsets.length : 0,
        ads: Array.isArray(ads) ? ads.length : 0,
      },
    });
  } catch (err) {
    console.error("GET Live Account Stats error:", err);
    return res.status(500).json({
      message: "Lỗi khi lấy thống kê trực tiếp từ Facebook",
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

    return res.status(200).json({ items: all, total: all.length });
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
    const shopId = req.user?.shop_id || null;

    const saved = await upsertOneAdAccount(
      {
        id: fbAcc.id,
        name: fbAcc.name,
        account_status: fbAcc.account_status,
        currency: fbAcc.currency,
        timezone_name: fbAcc.timezone_name,
      },
      { shopUserId, adminUserId, shopId }
    );

    return res.status(200).json({ message: "Kết nối tài khoản thành công", account: saved });
  } catch (err) {
    console.error("CONNECT AdAccount error:", err?.response?.data || err.message);
    return res.status(500).json({ message: "Lỗi kết nối tài khoản quảng cáo", error: err.message });
  }
}
