import { fetchCampaignsFromFacebook, updateCampaignStatus, deleteEntity, fetchInsightsForCampaignIds } from "../../services/ads/fbAdsService.js";
import User from "../../models/user/user.model.js";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";
import AdsAccount from "../../models/ads/adsAccount.model.js";
import UserRole from "../../models/user/userRole.model.js";
import { saveLog } from "../../utils/log.js";

// Helper: Get current shop_id from user's active UserRole
async function getCurrentShopId(userId) {
  const currentRole = await UserRole.findOne({ user_id: userId, is_current: true }).lean();
  return currentRole?.shop_id || null;
}

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
 * GET /api/campaigns
 * Lấy danh sách chiến dịch quảng cáo
 */
export async function listCampaignsCtrl(req, res) {
  try {
    const { account_id, q, status, page = 1, limit = 10, fetch_all = false, date_from, date_to } = req.query;
    
    // Xây dựng filter
    const filter = {};
    
    // ✅ Lấy tất cả items (không filter theo status) - Frontend sẽ filter
    if (account_id) {
      // Hỗ trợ cả định dạng có act_ và không có act_
      const normalizedId = account_id.startsWith('act_') ? account_id.substring(4) : account_id;
      filter.external_account_id = { $in: [normalizedId, `act_${normalizedId}`] };
    }
    
    // Nếu có filter status cụ thể, áp dụng filter đó (bao gồm cả DELETED nếu query)
    if (status) {
      filter.status = status;
    }
    // Nếu không có status parameter, lấy tất cả (bao gồm cả DELETED)
    
    if (q) filter.name = new RegExp(q, 'i');
    
    // ✅ Filter theo ngày bắt đầu chiến dịch (start_time)
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
        AdsCampaign.find(filter)
          .populate('created_by', 'full_name email')
          .sort({ createdAt: -1 }), // Sort ở Backend trước
        AdsCampaign.countDocuments(filter)
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
        AdsCampaign.find(filter)
          .populate('created_by', 'full_name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        AdsCampaign.countDocuments(filter)
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
    console.error("GET Campaigns error:", err);
    return res.status(500).json({ 
      message: "Lỗi khi lấy danh sách chiến dịch", 
      error: err.message 
    });
  }
}
/**
 * GET /api/campaigns/database
 * Lấy campaign từ database theo campaign_id
 */
export async function getCampaignFromDatabase(req, res) {
  try {
    const { campaign_id } = req.query;
    
    if (!campaign_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu campaign_id"
      });
    }

    // Extract và validate campaign_id
    const cleanCampaignId = extractObjectId(campaign_id);
    if (!cleanCampaignId) {
      return res.status(400).json({
        success: false,
        message: "campaign_id không hợp lệ"
      });
    }

    const campaign = await AdsCampaign.findById(cleanCampaignId)
      .populate('created_by', 'full_name email');
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy campaign"
      });
    }

    return res.status(200).json({
      success: true,
      data: campaign
    });
  } catch (err) {
    console.error("GET Campaign from database error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy campaign từ database",
      error: err.message
    });
  }
}

/**
 * GET /api/campaigns/:id
 * Lấy chi tiết một chiến dịch
 */
export async function getCampaignCtrl(req, res) {
  try {
    const campaign = await AdsCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: "Không tìm thấy chiến dịch" });
    }
    return res.status(200).json(campaign);
  } catch (err) {
    console.error("GET Campaign error:", err);
    return res.status(500).json({ 
      message: "Lỗi khi lấy chi tiết chiến dịch", 
      error: err.message 
    });
  }
}

function normalizeAccountPair(accountId) {
  const hasPrefix = String(accountId).startsWith("act_");
  const withPrefix = hasPrefix ? String(accountId) : `act_${accountId}`;
  const withoutPrefix = hasPrefix ? String(accountId).substring(4) : String(accountId);
  return { withPrefix, withoutPrefix };
}

/**
 * GET /api/campaigns/live
 * Lấy danh sách campaigns trực tiếp từ Facebook VÀ lưu vào DB
 */
export async function getCampaignsLiveCtrl(req, res) {
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

    // 1. Lấy thông tin account từ DB để có _id và shop_id
    const { withPrefix, withoutPrefix } = normalizeAccountPair(account_id);
    const adsAccount = await AdsAccount.findOne({
      external_id: { $in: [withPrefix, withoutPrefix] },
    });

    if (!adsAccount) {
      // Nếu không tìm thấy account trong DB, vẫn trả về data từ FB nhưng không lưu (hoặc báo lỗi tùy logic)
      // Ở đây ta chọn vẫn trả về data để UI không bị gãy, nhưng log warning
      console.warn(`⚠️ getCampaignsLiveCtrl: Không tìm thấy AdsAccount ${account_id} trong DB. Sẽ không lưu data.`);
    }

    // 2. Fetch từ Facebook
    const data = await fetchCampaignsFromFacebook(accessToken, account_id);

    // 3. Upsert vào DB nếu có account
    // KHÔNG ghi đè insights - insights được fetch riêng qua /api/campaigns/insights
    if (adsAccount && data.length > 0) {
      const bulkOps = data.map((c) => {
        const campaignData = {
          shop_id: adsAccount.shop_id || null,
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
          // Không set insights ở đây - giữ nguyên insights cũ trong DB
        };

        return {
          updateOne: {
            filter: { external_id: c.id },
            update: { $set: campaignData },
            upsert: true,
          },
        };
      });

      try {
        await AdsCampaign.bulkWrite(bulkOps, { ordered: false });
        console.log(`Đã upsert ${data.length} campaigns từ Live API cho account ${account_id}`);
      } catch (writeErr) {
        console.error("Lỗi bulkWrite campaigns:", writeErr);
        // Không throw lỗi để vẫn trả về data cho client
      }
    }

    return res.status(200).json({ items: data, total: data.length });
  } catch (err) {
    console.error("GET Live Campaigns error:", err);
    return res.status(500).json({ message: "Lỗi lấy campaigns từ Facebook", error: err.message });
  }
}

/**
 * PATCH /api/campaigns/:id/status
 * Bật/Tắt campaign trực tiếp trên Facebook
 */
export async function toggleCampaignStatusCtrl(req, res) {
  try {
    const { id } = req.params; // Facebook campaign id (external_id)
    const { status } = req.body; // "ACTIVE" | "PAUSED"
    if (!id || !status) {
      return res.status(400).json({ message: "Thiếu id hoặc status" });
    }

    // Lấy token người dùng hiện tại
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "Thiếu access token Facebook" });
    }

    const fbId = id.startsWith("act_") ? id : id; // campaign id không có act_
    await updateCampaignStatus(fbId, accessToken, status);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Toggle campaign status error:", err.response?.data || err.message);
    return res.status(500).json({ message: "Không thể cập nhật trạng thái campaign", detail: err.response?.data || err.message });
  }
}

export async function deleteCampaignCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const campaign = await AdsCampaign.findById(id);
    if (!campaign)
      return res.status(404).json({ message: "Không tìm thấy chiến dịch." });

    // ✅ Lấy token từ user hoặc query
    let accessToken = req.query.access_token;
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select(
        "+facebookAccessToken"
      );
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    // Lấy adset + ads liên quan
    const adsets = await AdsSet.find({ campaign_id: campaign._id });
    const adsetIds = adsets.map((a) => a._id);
    const ads = await Ads.find({ set_id: { $in: adsetIds } });

    // ✅ Nếu có token → xoá thật trên Facebook
    if (accessToken) {
      try {
        if (campaign.external_id)
          await deleteEntity(campaign.external_id, accessToken);

        for (const adset of adsets) {
          if (adset.external_id)
            await deleteEntity(adset.external_id, accessToken);
        }

        for (const ad of ads) {
          if (ad.external_id) await deleteEntity(ad.external_id, accessToken);
        }

        console.log(
          `🧹 Đã xoá campaign ${campaign.name} và ${adsets.length} adsets trên Facebook.`
        );
      } catch (fbErr) {
        console.warn(
          "⚠️ Lỗi khi xoá campaign trên Facebook:",
          fbErr?.response?.data || fbErr.message
        );
      }
    }

    // Dù có token hay không → Xoá mềm trong DB
    const now = new Date();
    await Promise.all([
      Ads.updateMany(
        { set_id: { $in: adsetIds } },
        { status: "DELETED", deleted_at: now }
      ),
      AdsSet.updateMany(
        { _id: { $in: adsetIds } },
        { status: "DELETED", deleted_at: now }
      ),
      AdsCampaign.findByIdAndUpdate(id, { status: "DELETED", deleted_at: now }),
    ]);

    // Log xóa campaign thành công
    const currentShopId = await getCurrentShopId(req.user._id);
    await saveLog({
      user_id: req.user._id,
      user_name: req.user?.full_name,
      shop_id: campaign.shop_id || currentShopId,
      action: "DELETE_CAMPAIGN",
      target_type: "Campaign",
      target_id: campaign._id.toString(),
      target_name: campaign.name,
      request: { campaign_name: campaign.name, adsets_deleted: adsets.length, ads_deleted: ads.length },
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Đã xoá chiến dịch "${campaign.name}" cùng toàn bộ nhóm quảng cáo & quảng cáo liên quan.`,
    });
  } catch (err) {
    console.error("❌ Xoá Campaign cascade lỗi:", err);
    return res.status(500).json({
      message: "Xoá thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/campaigns/:id/archive
 * Archive campaign và các adsets, ads liên quan (set status ARCHIVED thay vì DELETED)
 */
export async function archiveCampaignCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const campaign = await AdsCampaign.findById(id);
    if (!campaign)
      return res.status(404).json({ message: "Không tìm thấy chiến dịch." });

    // ✅ Lấy token từ user hoặc query
    let accessToken = req.query.access_token;
    if (!accessToken && req.user?._id) {
      const user = await User.findById(req.user._id).select(
        "+facebookAccessToken"
      );
      accessToken = user?.facebookAccessToken || null;
    }

    if (!accessToken) {
      return res.status(400).json({
        message:
          "Không tìm thấy Facebook access_token. Vui lòng đăng nhập lại.",
        missingToken: true,
      });
    }

    // Lấy adset + ads liên quan
    const adsets = await AdsSet.find({ campaign_id: campaign._id });
    const adsetIds = adsets.map((a) => a._id);
    const ads = await Ads.find({ set_id: { $in: adsetIds } });

    // ✅ Nếu có token → Xóa thật trên Facebook (giống delete)
    if (accessToken) {
      try {
        if (campaign.external_id)
          await deleteEntity(campaign.external_id, accessToken);

        for (const adset of adsets) {
          if (adset.external_id)
            await deleteEntity(adset.external_id, accessToken);
        }

        for (const ad of ads) {
          if (ad.external_id) await deleteEntity(ad.external_id, accessToken);
        }

        console.log(
          `📦 Đã xóa (archive) campaign ${campaign.name} và ${adsets.length} adsets trên Facebook.`
        );
      } catch (fbErr) {
        console.warn(
          "⚠️ Lỗi khi xóa (archive) campaign trên Facebook:",
          fbErr?.response?.data || fbErr.message
        );
      }
    }

    // ✅ Cập nhật status ARCHIVED trong DB
    const now = new Date();
    await Promise.all([
      Ads.updateMany(
        { set_id: { $in: adsetIds } },
        { status: "ARCHIVED", updated_at: now }
      ),
      AdsSet.updateMany(
        { _id: { $in: adsetIds } },
        { status: "ARCHIVED", updated_at: now }
      ),
      AdsCampaign.findByIdAndUpdate(id, { status: "ARCHIVED", updated_at: now }),
    ]);

    // Log lưu trữ campaign thành công
    const currentShopId = await getCurrentShopId(req.user._id);
    await saveLog({
      user_id: req.user._id,
      user_name: req.user?.full_name,
      shop_id: campaign.shop_id || currentShopId,
      action: "ARCHIVE_CAMPAIGN",
      target_type: "Campaign",
      target_id: campaign._id.toString(),
      target_name: campaign.name,
      request: { campaign_name: campaign.name, adsets_archived: adsets.length, ads_archived: ads.length },
      ip_address: req.ip,
      user_agent: req.headers?.['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Đã lưu trữ chiến dịch "${campaign.name}" cùng toàn bộ nhóm quảng cáo & quảng cáo liên quan.`,
    });
  } catch (err) {
    console.error("❌ Archive Campaign cascade lỗi:", err);
    return res.status(500).json({
      message: "Lưu trữ thất bại",
      error: err.message,
    });
  }
}

/**
 * POST /api/campaigns/:id/copy
 * Tạo bản sao Campaign kèm toàn bộ AdSet và Ad con (DB only, không gọi Facebook)
 */
export async function copyCampaignCascadeCtrl(req, res) {
  try {
    const { id } = req.params;
    const source = await AdsCampaign.findById(id);
    if (!source) return res.status(404).json({ message: "Không tìm thấy chiến dịch." });

    // 1) Tạo campaign mới
    const newCampaign = await AdsCampaign.create({
      name: `${source.name || "Chiến dịch"} (bản sao)`,
      objective: source.objective,
      status: "IN_PROCESS",
      account_id: source.account_id,
      shop_id: source.shop_id,
      page_id: source.page_id,
      page_name: source.page_name,
      daily_budget: source.daily_budget,
      lifetime_budget: source.lifetime_budget,
      start_time: source.start_time,
      stop_time: source.stop_time,
      external_id: null,
      external_account_id: source.external_account_id,
    });

    // 2) Lấy tất cả adsets của source
    const srcAdsets = await AdsSet.find({ campaign_id: source._id }).lean();
    const idMap = new Map(); // map source adset _id -> new adset _id

    for (const s of srcAdsets) {
      const created = await AdsSet.create({
        campaign_id: newCampaign._id,
        external_account_id: s.external_account_id,
        name: `${s.name || "Nhóm quảng cáo"} (bản sao)`,
        status: "IN_PROCESS",
        configured_status: s.configured_status,
        effective_status: s.effective_status,
        optimization_goal: s.optimization_goal,
        billing_event: s.billing_event,
        bid_strategy: s.bid_strategy,
        bid_amount: s.bid_amount,
        pixel_id: s.pixel_id,
        conversion_event: s.conversion_event,
        promoted_object: s.promoted_object,
        targeting: s.targeting,
        daily_budget: s.daily_budget,
        lifetime_budget: s.lifetime_budget,
        start_time: s.start_time,
        end_time: s.end_time,
        external_id: null,
      });
      idMap.set(String(s._id), created._id);
    }

    // 3) Copy ads của từng adset
    const srcAdsetIds = srcAdsets.map((a) => a._id);
    const srcAds = await Ads.find({ set_id: { $in: srcAdsetIds } }).lean();
    const newAds = [];
    for (const a of srcAds) {
      const newSetId = idMap.get(String(a.set_id));
      if (!newSetId) continue;
      const createdAd = await Ads.create({
        name: `${a.name || "Quảng cáo"} (bản sao)`,
        status: "IN_PROCESS",
        external_id: null,
        external_account_id: a.external_account_id,
        set_id: newSetId,
        campaign_id: newCampaign._id,
        effective_status: a.effective_status,
        creative: a.creative,
      });
      newAds.push(createdAd);
    }

    return res.status(201).json({
      success: true,
      message: "Đã sao chép chiến dịch cùng AdSet & Ad.",
      data: {
        campaign: newCampaign,
        adsets: Array.from(idMap.values()),
        adsCount: newAds.length,
      },
    });
  } catch (err) {
    console.error("❌ Copy campaign cascade lỗi:", err);
    return res.status(500).json({ message: "Copy thất bại", error: err.message });
  }
}

/**
 * GET /api/campaigns/insights
 * Lấy insights cho nhiều campaigns từ Facebook VÀ LƯU VÀO DB
 */
export async function getCampaignInsightsCtrl(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ message: "Thiếu danh sách IDs" });
    }

    const campaignIds = ids.split(',').map(id => id.trim()).filter(Boolean);

    // Lấy token người dùng hiện tại
    const user = await User.findById(req.user?._id).select("+facebookAccessToken");
    const accessToken = user?.facebookAccessToken;
    if (!accessToken) {
      return res.status(401).json({ message: "Thiếu access token Facebook" });
    }

    // Gọi service để lấy insights từ Facebook
    const insightsData = await fetchInsightsForCampaignIds(accessToken, campaignIds);
    
    console.log(`📊 Fetched insights for ${insightsData.length} campaigns from FB`);

    // Map lại data để FE dễ xử lý: { id: '...', insights: {...} }
    // KHÔNG cần extract .data?.[0] vì service đã làm rồi
    const items = insightsData.map(item => ({
      id: item.id,
      insights: item.insights || {}
    }));

    // LƯU INSIGHTS VÀO DB (background, không block response)
    if (items.length > 0) {
      const bulkOps = items
        .filter(item => item.insights && Object.keys(item.insights).length > 0)
        .map(item => ({
          updateOne: {
            filter: { external_id: item.id },
            update: { $set: { insights: item.insights, insights_updated_at: new Date() } },
          },
        }));

      if (bulkOps.length > 0) {
        AdsCampaign.bulkWrite(bulkOps, { ordered: false })
          .then(() => console.log(`✅ Saved insights for ${bulkOps.length} campaigns to DB`))
          .catch(err => console.error("Error saving campaign insights to DB:", err.message));
      }
    }

    return res.status(200).json({ items });

  } catch (err) {
    console.error("GET Campaign Insights error:", err.response?.data || err.message);
    return res.status(500).json({ 
      message: "Không thể lấy dữ liệu insights", 
      detail: err.response?.data || err.message 
    });
  }
}
