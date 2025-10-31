// controllers/ads/ads.controller.js
import Ads from "../../models/ads/ads.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import { syncAdsFromFacebook, fetchAdsFromFacebook, updateAdStatus, deleteEntity, fetchAdInsights } from "../../services/fbAdsService.js";
import User from "../../models/user.model.js";

// Helper function để extract string ID từ ObjectId format
function extractObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/[0-9a-fA-F]{24}/);
    return match ? match[0] : null;
  }
  if (value.$oid) return value.$oid; // trong trường hợp Mongo xuất ra kiểu { $oid: '...' }
  return value.toString();
}

/**
 * GET /api/ads/database
 * Lấy ad từ database theo ad_id hoặc campaign_id
 */
export async function getAdFromDatabase(req, res) {
  try {
    const { ad_id, campaign_id } = req.query;
    
    if (!ad_id && !campaign_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ad_id hoặc campaign_id"
      });
    }

    // Extract và validate ad_id nếu có
    const cleanAdId = extractObjectId(ad_id);
    if (ad_id && !cleanAdId) {
      return res.status(400).json({
        success: false,
        message: "ad_id không hợp lệ"
      });
    }

    // Extract và validate campaign_id nếu có
    const cleanCampaignId = extractObjectId(campaign_id);
    if (campaign_id && !cleanCampaignId) {
      return res.status(400).json({
        success: false,
        message: "campaign_id không hợp lệ"
      });
    }

    let ad;
    if (cleanAdId) {
      ad = await Ads.findById(cleanAdId).populate('created_by', 'full_name email');
    } else if (cleanCampaignId) {
      // Tìm ads thông qua campaign_id
      const ads = await Ads.find({ 
        $or: [
          { campaign_id: cleanCampaignId },
          { set_id: { $in: await AdsSet.find({ campaign_id: cleanCampaignId }).distinct('_id') } }
        ]
      })
      .populate('created_by', 'full_name email')
      .sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        data: ads
      });
    }
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy ad"
      });
    }

    return res.status(200).json({
      success: true,
      data: ad
    });
  } catch (err) {
    console.error("GET Ad from database error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy ad từ database",
      error: err.message
    });
  }
}

/**
 * GET /api/ads
 * Lấy danh sách quảng cáo
 */
export async function listAdsCtrl(req, res) {
  try {
    const { account_id, adset_id, q, status, page = 1, limit = 10 } = req.query;

    // Xây dựng filter
    const filter = {};

    filter.status = { $ne: "DELETED" };
    if (account_id) {
      // Hỗ trợ cả định dạng có act_ và không có act_
      const normalizedId = account_id.startsWith("act_")
        ? account_id.substring(4)
        : account_id;
      filter.external_account_id = {
        $in: [normalizedId, `act_${normalizedId}`],
      };
      filter.external_account_id = {
        $in: [normalizedId, `act_${normalizedId}`],
      };
    }

    if (adset_id) filter.set_id = adset_id;
    // Nếu có filter status cụ thể, ghi đè filter mặc định
    if (status) filter.status = status;
    if (q) filter.name = new RegExp(q, "i");

    // Lấy dữ liệu có phân trang
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Ads.find(filter)
        .populate('created_by', 'full_name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Ads.countDocuments(filter),
    ]);

    return res.status(200).json({
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)) || 1,
    });
  } catch (err) {
    console.error("GET Ads error:", err);
    return res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách quảng cáo", error: err.message });
  }
}

/**
 * GET /api/ads/sync
 * Đồng bộ quảng cáo (Ads) từ Facebook
 */
export async function syncAdsCtrl(req, res) {
  try {
    const { account_id } = req.query;
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }

    // Lấy token: ưu tiên query, fallback DB của user hiện tại
    let accessToken = req.query.access_token;
    if (!accessToken) {
      const user = await User.findById(req.user?._id).select(
        "+facebookAccessToken"
      );
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        message:
          "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    const results = await syncAdsFromFacebook(accessToken, account_id);
    return res.status(200).json({
      message: `Đã đồng bộ ${results.length} quảng cáo từ Facebook`,
      count: results.length,
    });
  } catch (err) {
    console.error("SYNC Ads error:", err);
    return res.status(500).json({
      message: "Lỗi khi đồng bộ quảng cáo từ Facebook",
      error: err.message,
    });
  }
}

/**
 * GET /api/ads/live
 * Lấy danh sách quảng cáo (ads) trực tiếp từ Facebook (không lưu DB)
 */
export async function getAdsLiveCtrl(req, res) {
  try {
    const { account_id } = req.query;
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

    const data = await fetchAdsFromFacebook(accessToken, account_id);
    return res.status(200).json({ items: data, total: data.length });
  } catch (err) {
    console.error("GET Live Ads error:", err);
    return res.status(500).json({ message: "Lỗi lấy ads từ Facebook", error: err.message });
  }
}

/**
 * GET /api/ads/insights
 * Lấy insights cho danh sách ads (ids=comma,separated)
 */
export async function getAdsInsightsCtrl(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ message: "Thiếu danh sách ids" });
    }

    // Lấy access token từ query hoặc từ user hiện tại
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

    const adIds = String(ids)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const insights = await fetchAdInsights(accessToken, adIds);
    return res.status(200).json({ items: insights, total: insights.length });
  } catch (err) {
    console.error("GET Ads insights error:", err);
    return res.status(500).json({ message: "Lỗi lấy insights từ Facebook", error: err.message });
  }
}

/**
 * PATCH /api/ads/:id/status
 * Bật/Tắt ad trực tiếp trên Facebook
 */
export async function toggleAdStatusCtrl(req, res) {
  try {
    const { id } = req.params; // Facebook ad id
    const { status } = req.body; // "ACTIVE" | "PAUSED"
    if (!id || !status) return res.status(400).json({ message: "Thiếu id hoặc status" });

    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    const accessToken = user?.facebookAccessToken;
    if (!accessToken) return res.status(401).json({ message: "Thiếu access token Facebook" });

    await updateAdStatus(id, accessToken, status);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Toggle ad status error:", err.response?.data || err.message);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái ad", detail: err.response?.data || err.message });
  }
}

export async function deleteAdCtrl(req, res) {
  try {
    const { id } = req.params;
    const ad = await Ads.findById(id);
    if (!ad)
      return res.status(404).json({ message: "Không tìm thấy quảng cáo." });

    // ✅ Lấy access token từ user hoặc query (ưu tiên query)
    let accessToken = req.user?.facebookAccessToken || req.query.access_token || null;

    // Nếu chưa có token trong user, thử lấy từ DB
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      console.warn("⚠️ Không có Facebook access_token — chỉ xóa mềm trong DB, bỏ qua Facebook API.");
    }

    // ✅ Thực hiện xoá thật trên Facebook nếu có token & external_id
    if (accessToken && ad.external_id) {
      try {
        const deleted = await deleteEntity(ad.external_id, accessToken);
        if (deleted) {
          console.log(`🧹 Đã xoá thật quảng cáo ${ad.name} (${ad.external_id}) trên Facebook`);
        } else {
          console.warn(`⚠️ Không thể xoá quảng cáo ${ad.name} trên Facebook (Facebook trả về false)`);
        }
      } catch (fbErr) {
        console.warn("⚠️ Lỗi khi xoá trên Facebook:", fbErr?.response?.data || fbErr.message);
      }
    }

    // ✅ Xoá mềm trong DB (giữ lại record để không bị sync lại)
    await Ads.findByIdAndUpdate(id, {
      status: "DELETED",
      deleted_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Đã xoá quảng cáo "${ad.name}" ${accessToken ? "(Facebook + DB)" : "(chỉ trong DB)"}.`,
    });
  } catch (err) {
    console.error("❌ Xoá Ad lỗi:", err);
    return res.status(500).json({
      message: "Xoá thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/ads/:id/copy
 * Tạo bản sao một Ad (DB only)
 */
export async function copyAdCtrl(req, res) {
  try {
    const { id } = req.params;
    const ad = await Ads.findById(id).lean();
    if (!ad) return res.status(404).json({ message: "Không tìm thấy quảng cáo." });
    const created = await Ads.create({
      name: `${ad.name || 'Quảng cáo'} (bản sao)`,
      status: 'IN_PROCESS',
      external_id: null,
      external_account_id: ad.external_account_id,
      set_id: ad.set_id,
      campaign_id: ad.campaign_id,
      effective_status: ad.effective_status,
      creative: ad.creative,
    });
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('❌ Copy Ad lỗi:', err);
    return res.status(500).json({ message: 'Copy thất bại', error: err.message });
  }
}