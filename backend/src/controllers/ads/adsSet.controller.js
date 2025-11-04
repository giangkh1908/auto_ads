// controllers/ads/adsSet.controller.js
import AdsSet from "../../models/ads/adsSet.model.js";
import { syncAdSetsFromFacebook, fetchAdsetsFromFacebook, updateAdsetStatus, deleteEntity, fetchInsightsForEntities } from "../../services/fbAdsService.js";
import User from "../../models/user.model.js";
import Ads from "../../models/ads/ads.model.js";

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

// Lấy list status của trạng thái on/off ads
export async function toggleAdsetStatusCtrl(req, res) {
  try {
    const { id } = req.params; // Facebook adset id
    const { status } = req.body; // "ACTIVE" | "PAUSED"
    if (!id || !status) return res.status(400).json({ message: "Thiếu id hoặc status" });

    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    const accessToken = user?.facebookAccessToken;
    if (!accessToken) return res.status(401).json({ message: "Thiếu access token Facebook" });

    await updateAdsetStatus(id, accessToken, status);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Toggle adset status error:", err.response?.data || err.message);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái adset", detail: err.response?.data || err.message });
  }
}
/**
 * GET /api/adsets/database
 * Lấy adset từ database theo adset_id hoặc campaign_id
 */
export async function getAdsetFromDatabase(req, res) {
  try {
    const { adset_id, campaign_id } = req.query;
    
    if (!adset_id && !campaign_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu adset_id hoặc campaign_id"
      });
    }

    // Extract và validate adset_id nếu có
    const cleanAdsetId = extractObjectId(adset_id);
    if (adset_id && !cleanAdsetId) {
      return res.status(400).json({
        success: false,
        message: "adset_id không hợp lệ"
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

    let adset;
    if (cleanAdsetId) {
      adset = await AdsSet.findById(cleanAdsetId).populate('created_by', 'full_name email');
    } else if (cleanCampaignId) {
      const adsets = await AdsSet.find({ campaign_id: cleanCampaignId })
        .populate('created_by', 'full_name email')
        .sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        data: adsets
      });
    }
    
    if (!adset) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy adset"
      });
    }

    return res.status(200).json({
      success: true,
      data: adset
    });
  } catch (err) {
    console.error("GET Adset from database error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy adset từ database",
      error: err.message
    });
  }
}

/**
 * GET /api/adsets
 * Lấy danh sách nhóm quảng cáo
 */
export async function listAdSetsCtrl(req, res) {
  try {
    const { account_id, campaign_id, q, status, page = 1, limit = 10, fetch_all = false } = req.query;

    const filter = {};

    // ✅ Lấy tất cả items (không filter theo status) - Frontend sẽ filter
    if (account_id) {
      const normalizedId = account_id.startsWith("act_")
        ? account_id.substring(4)
        : account_id;
      filter.external_account_id = { $in: [normalizedId, `act_${normalizedId}`] };
    }

    if (campaign_id) filter.campaign_id = campaign_id;
    // Nếu có filter status cụ thể, áp dụng filter đó (bao gồm cả DELETED nếu query)
    if (status) {
      filter.status = status;
    }
    // Nếu không có status parameter, lấy tất cả (bao gồm cả DELETED)
    
    if (q) filter.name = new RegExp(q, "i");

    // Hỗ trợ fetch_all hoặc limit lớn để Frontend có thể sort và phân trang
    const limitNum = Number(limit);
    const shouldFetchAll = fetch_all === 'true' || fetch_all === true || limitNum === 0 || limitNum > 10000;
    
    let items, total;
    
    if (shouldFetchAll) {
      // Fetch tất cả (không phân trang) - để Frontend sort và phân trang
      [items, total] = await Promise.all([
        AdsSet.find(filter)
          .populate('created_by', 'full_name email')
          .sort({ createdAt: -1 }), // Sort ở Backend trước
        AdsSet.countDocuments(filter)
      ]);
      
      return res.status(200).json({
        items,
        total,
        page: 1,
        limit: total,
        pages: 1,
      });
    } else {
      // Phân trang như cũ (nếu cần)
      const skip = (Number(page) - 1) * Number(limit);
      [items, total] = await Promise.all([
        AdsSet.find(filter)
          .populate('created_by', 'full_name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        AdsSet.countDocuments(filter),
      ]);
      
      return res.status(200).json({
        items,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)) || 1,
      });
    }
  } catch (err) {
    console.error("GET AdSets error:", err);
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách nhóm quảng cáo",
      error: err.message,
    });
  }
}
/**
 * GET /api/adsets/sync
 * Đồng bộ nhóm quảng cáo từ Facebook
 */
export async function syncAdSetsCtrl(req, res) {
  try {
    const { account_id } = req.query;
    if (!account_id) {
      return res.status(400).json({ message: "Thiếu account_id" });
    }

    // Lấy token: ưu tiên query, fallback DB của user hiện tại
    let accessToken = req.query.access_token;
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message: "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    const results = await syncAdSetsFromFacebook(accessToken, account_id);
    return res.status(200).json({
      message: `Đã đồng bộ ${results.length} nhóm quảng cáo từ Facebook`,
      count: results.length,
    });
  } catch (err) {
    console.error("SYNC AdSets error:", err);
    return res.status(500).json({
      message: "Lỗi khi đồng bộ nhóm quảng cáo từ Facebook",
      error: err.message,
    });
  }
}

/**
 * GET /api/adsets/live
 * Lấy danh sách adsets trực tiếp từ Facebook (không lưu DB)
 */
export async function getAdSetsLiveCtrl(req, res) {
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

    const data = await fetchAdsetsFromFacebook(accessToken, account_id);
    return res.status(200).json({ items: data, total: data.length });
  } catch (err) {
    console.error("GET Live AdSets error:", err);
    return res.status(500).json({ message: "Lỗi lấy adsets từ Facebook", error: err.message });
  }
}

/**
 * DELETE /api/adsets/:id
 * Xóa AdSet + toàn bộ Ads con
 * - Có token: xóa thật trên Facebook
 * - Không có token: xóa mềm trong DB
 */
export async function deleteAdsetCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const adset = await AdsSet.findById(id);
    if (!adset) return res.status(404).json({ message: "Không tìm thấy nhóm quảng cáo." });

    // ✅ Lấy access_token từ user hoặc query
    let accessToken = req.user?.facebookAccessToken || req.query.access_token || null;

    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      console.warn("⚠️ Không có Facebook access_token — chỉ xóa mềm trong DB.");
    }

    // Lấy toàn bộ ads con trong adset
    const ads = await Ads.find({ set_id: adset._id });

    // ✅ Xóa thật trên Facebook nếu có token
    if (accessToken) {
      try {
        // Xóa tất cả ads trước
        for (const ad of ads) {
          if (ad.external_id) await deleteEntity(ad.external_id, accessToken);
        }

        // Sau đó xóa adset
        if (adset.external_id) await deleteEntity(adset.external_id, accessToken);

        console.log(`🧹 Đã xoá thật adset ${adset.name} (${adset.external_id}) và ${ads.length} ads trên Facebook`);
      } catch (fbErr) {
        console.warn("⚠️ Lỗi khi xoá adset hoặc ads trên Facebook:", fbErr?.response?.data || fbErr.message);
      }
    }

    // ✅ Xóa mềm trong DB
    const now = new Date();
    await Promise.all([
      Ads.updateMany({ set_id: adset._id }, { status: "DELETED", deleted_at: now }),
      AdsSet.findByIdAndUpdate(id, { status: "DELETED", deleted_at: now }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Đã xoá nhóm quảng cáo "${adset.name}" và ${ads.length} quảng cáo liên quan.`,
    });
  } catch (err) {
    console.error("❌ Xoá AdSet cascade lỗi:", err);
    return res.status(500).json({
      message: "Xoá thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/adsets/:id/archive
 * Archive adset và các ads liên quan (set status ARCHIVED thay vì DELETED)
 */
export async function archiveAdsetCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const adset = await AdsSet.findById(id);
    if (!adset) return res.status(404).json({ message: "Không tìm thấy nhóm quảng cáo." });

    // ✅ Lấy access_token từ user hoặc query
    let accessToken = req.user?.facebookAccessToken || req.query.access_token || null;

    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    // Lấy toàn bộ ads con trong adset
    const ads = await Ads.find({ set_id: adset._id });

    // ✅ Xóa thật trên Facebook nếu có token (giống delete)
    if (accessToken) {
      try {
        // Xóa tất cả ads trước
        for (const ad of ads) {
          if (ad.external_id) await deleteEntity(ad.external_id, accessToken);
        }

        // Sau đó xóa adset
        if (adset.external_id) await deleteEntity(adset.external_id, accessToken);

        console.log(`📦 Đã xóa (archive) adset ${adset.name} (${adset.external_id}) và ${ads.length} ads trên Facebook`);
      } catch (fbErr) {
        console.warn("⚠️ Lỗi khi xóa (archive) adset hoặc ads trên Facebook:", fbErr?.response?.data || fbErr.message);
      }
    }

    // ✅ Cập nhật status ARCHIVED trong DB
    const now = new Date();
    await Promise.all([
      Ads.updateMany({ set_id: adset._id }, { status: "ARCHIVED", updated_at: now }),
      AdsSet.findByIdAndUpdate(id, { status: "ARCHIVED", updated_at: now }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Đã lưu trữ nhóm quảng cáo "${adset.name}" và ${ads.length} quảng cáo liên quan.`,
    });
  } catch (err) {
    console.error("❌ Archive AdSet cascade lỗi:", err);
    return res.status(500).json({
      message: "Lưu trữ thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/adsets/:id/copy
 * Tạo bản sao AdSet kèm toàn bộ Ads con (DB only)
 */
export async function copyAdsetCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const source = await AdsSet.findById(id);
    if (!source) return res.status(404).json({ message: "Không tìm thấy nhóm quảng cáo." });

    const newAdset = await AdsSet.create({
      campaign_id: source.campaign_id,
      external_account_id: source.external_account_id,
      name: `${source.name || "Nhóm quảng cáo"} (bản sao)`,
      status: "IN_PROCESS",
      configured_status: source.configured_status,
      effective_status: source.effective_status,
      optimization_goal: source.optimization_goal,
      billing_event: source.billing_event,
      bid_strategy: source.bid_strategy,
      bid_amount: source.bid_amount,
      pixel_id: source.pixel_id,
      conversion_event: source.conversion_event,
      promoted_object: source.promoted_object,
      targeting: source.targeting,
      daily_budget: source.daily_budget,
      lifetime_budget: source.lifetime_budget,
      start_time: source.start_time,
      end_time: source.end_time,
      external_id: null,
    });

    const ads = await Ads.find({ set_id: source._id }).lean();
    for (const a of ads) {
      await Ads.create({
        name: `${a.name || "Quảng cáo"} (bản sao)`,
        status: "IN_PROCESS",
        external_id: null,
        external_account_id: a.external_account_id,
        set_id: newAdset._id,
        campaign_id: source.campaign_id,
        effective_status: a.effective_status,
        creative: a.creative,
      });
    }

    return res.status(201).json({ success: true, message: "Đã sao chép AdSet cùng Ads.", data: { adset: newAdset } });
  } catch (err) {
    console.error("❌ Copy AdSet cascade lỗi:", err);
    return res.status(500).json({ message: "Copy thất bại", error: err.message });
  }
}

/**
 * GET /api/adsets/insights
 * Lấy insights cho nhiều adsets từ Facebook
 */
export async function getAdsetInsightsCtrl(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ message: "Thiếu danh sách IDs" });
    }

    const adsetIds = ids.split(',');

    // Lấy token người dùng hiện tại
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "Thiếu access token Facebook" });
    }

    // Gọi service để lấy insights
    const insightsData = await fetchInsightsForEntities(adsetIds, accessToken);

    // Map lại data để FE dễ xử lý: { id: '...', insights: {...} }
    const items = insightsData.map(item => ({
      id: item.id,
      insights: item.insights?.data?.[0] || {}
    }));

    return res.status(200).json({ items });

  } catch (err) {
    console.error("GET Adset Insights error:", err.response?.data || err.message);
    return res.status(500).json({ 
      message: "Không thể lấy dữ liệu insights", 
      detail: err.response?.data || err.message 
    });
  }
}
