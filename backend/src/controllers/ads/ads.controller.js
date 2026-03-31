// controllers/ads/ads.controller.js
import Ads from "../../models/ads/ads.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import { fetchAdsFromFacebook, updateAdStatus, deleteEntity, fetchInsightsForAdIds } from "../../services/ads/fbAdsService.js";
import User from "../../models/user/user.model.js";
import { syncEntitiesForAccount } from "../../services/ads/entitySyncService.js";
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
    const { account_id, adset_id, q, status, page = 1, limit = 10, fetch_all = false, date_from, date_to } = req.query;

    if (account_id && !adset_id) {
      const normalizedId = account_id.startsWith("act_")
        ? account_id.substring(4)
        : account_id;

      const accountAdsCount = await Ads.countDocuments({
        external_account_id: { $in: [normalizedId, `act_${normalizedId}`] },
      });

      const account = await AdsAccount.findOne({
        external_id: { $in: [account_id, `act_${normalizedId}`] },
      });

      // if (accountAdsCount === 0 && account && account.sync_metadata?.entities_status === "idle") {
      //   let accessToken = req.query.access_token;
      //   if (!accessToken && req.user?._id) {
      //     const user = await User.findById(req.user._id).select("+facebookAccessToken");
      //     accessToken = user?.facebookAccessToken || null;
      //   }

      //   if (!accessToken) {
      //     return res.status(400).json({
      //       items: [],
      //       total: 0,
      //       page: Number(page),
      //       limit: Number(limit),
      //       pages: 1,
      //       status: "initial_sync",
      //       message: "Hệ thống đang tải dữ liệu lần đầu. Vui lòng refresh sau 15-30s.",
      //     });
      //   }

      //   syncEntitiesForAccount(account_id, accessToken).catch(() => {});

      //   return res.status(200).json({
      //     items: [],
      //     total: 0,
      //     page: Number(page),
      //     limit: Number(limit),
      //     pages: 1,
      //     status: "initial_sync",
      //     message: "Hệ thống đang tải dữ liệu lần đầu. Vui lòng refresh sau 15-30s.",
      //   });
      // }
    }

    const filter = {};

    if (account_id && !adset_id) {
      const normalizedId = account_id.startsWith("act_")
        ? account_id.substring(4)
        : account_id;
      
      const accountAdsets = await AdsSet.find({
        external_account_id: { $in: [normalizedId, `act_${normalizedId}`] }
      }).distinct('_id');
      
      filter.$or = [
        { external_account_id: { $in: [normalizedId, `act_${normalizedId}`] } },
        { set_id: { $in: accountAdsets } }
      ];
    }

    if (adset_id) filter.set_id = adset_id;
    if (status) {
      filter.status = status;
    }
    
    if (q) filter.name = new RegExp(q, "i");

    // ✅ Filter theo ngày bắt đầu (start_time) - Ads không có start_time riêng, dùng created_at
    if (date_from || date_to) {
      filter.created_at = {};
      if (date_from) {
        filter.created_at.$gte = new Date(date_from);
      }
      if (date_to) {
        // Thêm 1 ngày để bao gồm cả ngày kết thúc (end of day)
        const endDate = new Date(date_to);
        endDate.setDate(endDate.getDate() + 1);
        filter.created_at.$lte = endDate;
      }
    }

    // Hỗ trợ fetch_all hoặc limit lớn để Frontend có thể sort và phân trang
    const limitNum = Number(limit);
    const shouldFetchAll = fetch_all === 'true' || fetch_all === true || limitNum === 0 || limitNum > 10000;
    
    let items, total;
    
    if (shouldFetchAll) {
      // Fetch tất cả (không phân trang) - để Frontend sort và phân trang
      [items, total] = await Promise.all([
        Ads.find(filter)
          .populate('created_by', 'full_name email')
          .populate({
            path: 'set_id',
            select: 'name campaign_id daily_budget lifetime_budget',
            populate: {
              path: 'campaign_id',
              select: 'name objective'
            }
          })
          .sort({ createdAt: -1 }), // Sort ở Backend trước
        Ads.countDocuments(filter)
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
        Ads.find(filter)
          .populate('created_by', 'full_name email')
          .populate({
            path: 'set_id',
            select: 'name campaign_id daily_budget lifetime_budget',
            populate: {
              path: 'campaign_id',
              select: 'name objective'
            }
          })
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
    }
  } catch (err) {
    console.error("GET Ads error:", err);
    return res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách quảng cáo", error: err.message });
  }
}

function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? String(accountId) : `act_${accountId}`;
  const withoutPrefix = hasPrefix ? String(accountId).substring(4) : String(accountId);
  return { withPrefix, withoutPrefix };
}

/**
 * GET /api/ads/live
 * Lấy danh sách quảng cáo (ads) trực tiếp từ Facebook VÀ lưu vào DB
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

    // 1. Lấy thông tin account từ DB
    const { withPrefix, withoutPrefix } = normalizeAccountPair(account_id);
    const adsAccount = await AdsAccount.findOne({
      external_id: { $in: [withPrefix, withoutPrefix] },
    });

    if (!adsAccount) {
      console.warn(`getAdsLiveCtrl: Không tìm thấy AdsAccount ${account_id} trong DB. Sẽ không lưu data.`);
    }

    // 2. Fetch từ Facebook
    const data = await fetchAdsFromFacebook(accessToken, account_id);

    // 3. Upsert vào DB nếu có account
    if (adsAccount && data.length > 0) {
      // Lấy danh sách adset_id (external) để tìm _id tương ứng trong DB
      const adsetExternalIds = [...new Set(data.map((a) => a.adset_id).filter(Boolean))];
      const adsets = await AdsSet.find({
        external_id: { $in: adsetExternalIds },
      }).select("_id external_id");
      const adsetsMap = new Map(adsets.map((a) => [a.external_id, a._id]));

      const bulkOps = [];

      for (const a of data) {
        const adsetId = adsetsMap.get(a.adset_id);
        // Nếu không tìm thấy adset cha trong DB, skip
        if (!adsetId) {
          continue;
        }

        const adData = {
          name: a.name,
          status: a.status,
          external_id: a.id,
          external_account_id: withoutPrefix,
          set_id: adsetId,
          effective_status: a.effective_status,
          creative: a.creative,
          // Không set insights ở đây - giữ nguyên insights cũ trong DB
        };

        bulkOps.push({
          updateOne: {
            filter: { external_id: a.id },
            update: { $set: adData },
            upsert: true,
          },
        });
      }

      if (bulkOps.length > 0) {
        try {
          await Ads.bulkWrite(bulkOps, { ordered: false });
          console.log(`Đã upsert ${bulkOps.length}/${data.length} ads từ Live API cho account ${account_id}`);
        } catch (writeErr) {
          console.error("Lỗi bulkWrite ads:", writeErr);
        }
      }
    }

    return res.status(200).json({ items: data, total: data.length });
  } catch (err) {
    console.error("GET Live Ads error:", err);
    return res.status(500).json({ message: "Lỗi lấy ads từ Facebook", error: err.message });
  }
}

/**
 * GET /api/ads/insights
 * DB-first: trả về từ DB nếu TTL còn, chỉ gọi Facebook khi stale/missing
 */
const INSIGHTS_TTL_MS = 60 * 60 * 1000; // 1 giờ

export async function getAdsInsightsCtrl(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ message: "Thiếu danh sách ids" });
    }

    const adIds = String(ids)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 1. Query DB trước
    const dbAds = await Ads.find({
      external_id: { $in: adIds }
    }).select('external_id insights insights_updated_at').lean();

    const dbMap = new Map();
    const staleIds = [];
    const now = Date.now();

    for (const ad of dbAds) {
      const updatedAt = ad.insights_updated_at ? new Date(ad.insights_updated_at).getTime() : 0;
      const isFresh = (now - updatedAt) < INSIGHTS_TTL_MS && ad.insights && Object.keys(ad.insights).length > 0;
      dbMap.set(ad.external_id, { id: ad.external_id, insights: ad.insights || {} });
      if (!isFresh) {
        staleIds.push(ad.external_id);
      }
    }

    // Thêm missing ids vào stale
    for (const id of adIds) {
      if (!dbMap.has(id)) {
        staleIds.push(id);
      }
    }

    // 2. Nếu tất cả fresh → trả về từ DB
    if (staleIds.length === 0) {
      const items = adIds.map(id => dbMap.get(id) || { id, insights: {} });
      return res.status(200).json({ items, total: items.length, source: 'db' });
    }

    // 3. Gọi Facebook cho stale/missing items
    let accessToken = req.query.access_token;
    if (!accessToken) {
      try {
        const user = await User.findById(req.user?._id).select("+facebookAccessToken");
        accessToken = user?.facebookAccessToken || null;
      } catch (e) { /* ignore */ }
    }

    if (!accessToken) {
      const items = adIds.map(id => dbMap.get(id) || { id, insights: {} });
      return res.status(200).json({ items, total: items.length, source: 'db_stale' });
    }

    try {
      const insightsData = await fetchInsightsForAdIds(accessToken, staleIds);
      const fbMap = new Map();
      for (const item of insightsData) {
        fbMap.set(item.id, { id: item.id, insights: item.insights || {} });
      }

      const items = adIds.map(id => fbMap.get(id) || dbMap.get(id) || { id, insights: {} });

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
        Ads.bulkWrite(bulkOps, { ordered: false })
          .then(() => console.log(`✅ Saved insights for ${bulkOps.length} ads to DB`))
          .catch(err => console.error("Error saving ad insights to DB:", err.message));
      }

      return res.status(200).json({ items, total: items.length, source: 'facebook' });
    } catch (fbErr) {
      console.error("Facebook fetch failed, falling back to DB:", fbErr.message);
      const items = adIds.map(id => dbMap.get(id) || { id, insights: {} });
      return res.status(200).json({ items, total: items.length, source: 'db_stale' });
    }

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
    const ad = await Ads.findById(id).populate({
      path: 'set_id',
      select: 'campaign_id',
      populate: { path: 'campaign_id', select: 'shop_id' }
    });
    if (!ad)
      return res.status(404).json({ message: "Không tìm thấy quảng cáo." });

    // Lấy access token từ user hoặc query (ưu tiên query)
    let accessToken = req.user?.facebookAccessToken || req.query.access_token || null;

    // Nếu chưa có token trong user, thử lấy từ DB
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select("+facebookAccessToken");
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      console.warn("Không có Facebook access_token — chỉ xóa mềm trong DB, bỏ qua Facebook API.");
    }

    // Thực hiện xoá thật trên Facebook nếu có token & external_id
    if (accessToken && ad.external_id) {
      try {
        const deleted = await deleteEntity(ad.external_id, accessToken);
        if (deleted) {
          console.log(`Đã xoá thật quảng cáo ${ad.name} (${ad.external_id}) trên Facebook`);
        } else {
          console.warn(`Không thể xoá quảng cáo ${ad.name} trên Facebook (Facebook trả về false)`);
        }
      } catch (fbErr) {
        console.warn("Lỗi khi xoá trên Facebook:", fbErr?.response?.data || fbErr.message);
      }
    }

    await Ads.findByIdAndUpdate(id, {
      status: "DELETED",
      deleted_at: new Date(),
    });

    // Log xóa ad thành công
    const currentShopId = await getCurrentShopId(req.user._id);
    await saveLog({
      user_id: req.user._id,
      user_name: req.user?.full_name,
      shop_id: ad.set_id?.campaign_id?.shop_id || currentShopId,
      action: "DELETE_AD",
      target_type: "Ad",
      target_id: ad._id.toString(),
      target_name: ad.name,
      request: { ad_name: ad.name },
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Đã xoá quảng cáo "${ad.name}" ${accessToken ? "(Facebook + DB)" : "(chỉ trong DB)"}.`,
    });
  } catch (err) {
    console.error("Xoá Ad lỗi:", err);
    return res.status(500).json({
      message: "Xoá thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/ads/:id/archive
 * Archive ad (set status ARCHIVED thay vì DELETED)
 */
export async function archiveAdCtrl(req, res) {
  try {
    const { id } = req.params;
    const ad = await Ads.findById(id).populate({
      path: 'set_id',
      select: 'campaign_id',
      populate: { path: 'campaign_id', select: 'shop_id' }
    });
    if (!ad)
      return res.status(404).json({ message: "Không tìm thấy quảng cáo." });

    // Lấy access token từ user hoặc query (ưu tiên query)
    let accessToken = req.user?.facebookAccessToken || req.query.access_token || null;

    // Nếu chưa có token trong user, thử lấy từ DB
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

    // Thực hiện xóa trên Facebook nếu có token & external_id (giống delete)
    if (accessToken && ad.external_id) {
      try {
        await deleteEntity(ad.external_id, accessToken);
        console.log(`Đã xóa (archive) quảng cáo ${ad.name} (${ad.external_id}) trên Facebook`);
      } catch (fbErr) {
        console.warn("Lỗi khi xóa (archive) trên Facebook:", fbErr?.response?.data || fbErr.message);
      }
    }

    await Ads.findByIdAndUpdate(id, {
      status: "ARCHIVED",
      updated_at: new Date(),
    });

    // Log lưu trữ ad thành công
    const currentShopId = await getCurrentShopId(req.user._id);
    await saveLog({
      user_id: req.user._id,
      user_name: req.user?.full_name,
      shop_id: ad.set_id?.campaign_id?.shop_id || currentShopId,
      action: "ARCHIVE_AD",
      target_type: "Ad",
      target_id: ad._id.toString(),
      target_name: ad.name,
      request: { ad_name: ad.name },
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Đã lưu trữ quảng cáo "${ad.name}".`,
    });
  } catch (err) {
    console.error("Archive Ad lỗi:", err);
    return res.status(500).json({
      message: "Lưu trữ thất bại",
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
    console.error('Copy Ad lỗi:', err);
    return res.status(500).json({ message: 'Copy thất bại', error: err.message });
  }
}