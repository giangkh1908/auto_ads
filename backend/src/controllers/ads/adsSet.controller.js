// controllers/ads/adsSet.controller.js
import AdsSet from "../../models/ads/adsSet.model.js";
import { fetchAdsetsFromFacebook, updateAdsetStatus, deleteEntity, fetchInsightsForAdsetIds } from "../../services/ads/fbAdsService.js";
import User from "../../models/user/user.model.js";
import Ads from "../../models/ads/ads.model.js";
import UserRole from "../../models/user/userRole.model.js";
import { saveLog } from "../../utils/log.js";

// Helper: Get current shop_id from user's active UserRole
async function getCurrentShopId(userId) {
  const currentRole = await UserRole.findOne({ user_id: userId, is_current: true }).lean();
  return currentRole?.shop_id || null;
}// Helper function để extract string ID từ ObjectId format
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
    const { account_id, campaign_id, q, status, page = 1, limit = 10, fetch_all = false, date_from, date_to } = req.query;

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

    // ✅ Filter theo ngày bắt đầu (start_time)
    if (date_from || date_to) {
      filter.start_time = {};
      if (date_from) {
        filter.start_time.$gte = new Date(date_from);
      }
      if (date_to) {
        // Thêm 1 ngày để bao gồm cả ngày kết thúc (end of day)
        const endDate = new Date(date_to);
        endDate.setDate(endDate.getDate() + 1);
        filter.start_time.$lte = endDate;
      }
    }

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


import AdsAccount from "../../models/ads/adsAccount.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";

function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? String(accountId) : `act_${accountId}`;
  const withoutPrefix = hasPrefix ? String(accountId).substring(4) : String(accountId);
  return { withPrefix, withoutPrefix };
}

/**
 * GET /api/adsets/live
 * Lấy danh sách adsets trực tiếp từ Facebook VÀ lưu vào DB
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

    // 1. Lấy thông tin account từ DB
    const { withPrefix, withoutPrefix } = normalizeAccountPair(account_id);
    const adsAccount = await AdsAccount.findOne({
      external_id: { $in: [withPrefix, withoutPrefix] },
    });

    if (!adsAccount) {
      console.warn(`⚠️ getAdSetsLiveCtrl: Không tìm thấy AdsAccount ${account_id} trong DB. Sẽ không lưu data.`);
    }

    // 2. Fetch từ Facebook
    const data = await fetchAdsetsFromFacebook(accessToken, account_id);

    // 3. Upsert vào DB nếu có account
    if (adsAccount && data.length > 0) {
      // Lấy danh sách campaign_id (external) để tìm _id tương ứng trong DB
      const campaignExternalIds = [...new Set(data.map((s) => s.campaign_id).filter(Boolean))];
      const campaigns = await AdsCampaign.find({
        external_id: { $in: campaignExternalIds },
      }).select("_id external_id");
      const campaignsMap = new Map(campaigns.map((c) => [c.external_id, c._id]));

      const bulkOps = [];

      for (const s of data) {
        const campaignId = campaignsMap.get(s.campaign_id);
        // Nếu không tìm thấy campaign cha trong DB, có thể skip hoặc vẫn lưu nhưng để campaign_id null (tùy logic).
        // Logic sync cũ là skip. Ở đây ta cũng skip để đảm bảo integrity.
        if (!campaignId) {
          continue;
        }

        const adsetData = {
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
          // Không set insights ở đây - giữ nguyên insights cũ trong DB
        };

        bulkOps.push({
          updateOne: {
            filter: { external_id: s.id },
            update: { $set: adsetData },
            upsert: true,
          },
        });
      }

      if (bulkOps.length > 0) {
        try {
          await AdsSet.bulkWrite(bulkOps, { ordered: false });
          console.log(`✅ Đã upsert ${bulkOps.length}/${data.length} adsets từ Live API cho account ${account_id}`);
        } catch (writeErr) {
          console.error("❌ Lỗi bulkWrite adsets:", writeErr);
        }
      }
    }

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
    const adset = await AdsSet.findById(id).populate('campaign_id', 'shop_id');
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

    // Log xóa adset thành công
    const currentShopId = await getCurrentShopId(req.user._id);
    await saveLog({
      user_id: req.user._id,
      user_name: req.user?.full_name,
      shop_id: adset.campaign_id?.shop_id || currentShopId,
      action: "DELETE_ADSET",
      target_type: "AdSet",
      target_id: adset._id.toString(),
      target_name: adset.name,
      request: { adset_name: adset.name, ads_deleted: ads.length },
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent'],
    });

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
    const adset = await AdsSet.findById(id).populate('campaign_id', 'shop_id');
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

    // Log lưu trữ adset thành công
    const currentShopId = await getCurrentShopId(req.user._id);
    await saveLog({
      user_id: req.user._id,
      user_name: req.user?.full_name,
      shop_id: adset.campaign_id?.shop_id || currentShopId,
      action: "ARCHIVE_ADSET",
      target_type: "AdSet",
      target_id: adset._id.toString(),
      target_name: adset.name,
      request: { adset_name: adset.name, ads_archived: ads.length },
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent'],
    });

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
 * DB-first: trả về từ DB nếu TTL còn, chỉ gọi Facebook khi stale/missing
 */
const INSIGHTS_TTL_MS = 60 * 60 * 1000; // 1 giờ

export async function getAdsetInsightsCtrl(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ message: "Thiếu danh sách IDs" });
    }

    const adsetIds = ids.split(',').map(id => id.trim()).filter(Boolean);

    // 1. Query DB trước
    const dbAdsets = await AdsSet.find({
      external_id: { $in: adsetIds }
    }).select('external_id insights insights_updated_at').lean();

    const dbMap = new Map();
    const staleIds = [];
    const now = Date.now();

    for (const a of dbAdsets) {
      const updatedAt = a.insights_updated_at ? new Date(a.insights_updated_at).getTime() : 0;
      const isFresh = (now - updatedAt) < INSIGHTS_TTL_MS && a.insights && Object.keys(a.insights).length > 0;
      dbMap.set(a.external_id, { id: a.external_id, insights: a.insights || {} });
      if (!isFresh) {
        staleIds.push(a.external_id);
      }
    }

    // Thêm missing ids vào stale
    for (const id of adsetIds) {
      if (!dbMap.has(id)) {
        staleIds.push(id);
      }
    }

    // 2. Nếu tất cả fresh → trả về từ DB
    if (staleIds.length === 0) {
      const items = adsetIds.map(id => dbMap.get(id) || { id, insights: {} });
      return res.status(200).json({ items, source: 'db' });
    }

    // 3. Gọi Facebook cho stale/missing items
    let accessToken = null;
    try {
      const user = await User.findById(req.user?._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken;
    } catch (e) { /* ignore */ }

    if (!accessToken) {
      const items = adsetIds.map(id => dbMap.get(id) || { id, insights: {} });
      return res.status(200).json({ items, source: 'db_stale' });
    }

    try {
      const insightsData = await fetchInsightsForAdsetIds(accessToken, staleIds);
      const fbMap = new Map();
      for (const item of insightsData) {
        fbMap.set(item.id, { id: item.id, insights: item.insights || {} });
      }

      const items = adsetIds.map(id => fbMap.get(id) || dbMap.get(id) || { id, insights: {} });

      // Save FB data vào DB (background)
      const bulkOps = insightsData
        .filter(item => item.insights && Object.keys(item.insights).length > 0)
        .map(item => ({
          updateOne: {
            filter: { external_id: item.id },
            update: { $set: { insights: item.insights, insights_updated_at: new Date() } },
          },
        }));

      if (bulkOps.length > 0) {
        AdsSet.bulkWrite(bulkOps, { ordered: false })
          .then(() => console.log(`✅ Saved insights for ${bulkOps.length} adsets to DB`))
          .catch(err => console.error("Error saving adset insights to DB:", err.message));
      }

      return res.status(200).json({ items, source: 'facebook' });
    } catch (fbErr) {
      console.error("Facebook fetch failed, falling back to DB:", fbErr.message);
      const items = adsetIds.map(id => dbMap.get(id) || { id, insights: {} });
      return res.status(200).json({ items, source: 'db_stale' });
    }

  } catch (err) {
    console.error("GET Adset Insights error:", err.response?.data || err.message);
    return res.status(500).json({
      message: "Không thể lấy dữ liệu insights",
      detail: err.response?.data || err.message
    });
  }
}
